import { getProfile, saveProfile, listMemorials, persistPhoto, showError, modeLabel, isCloud, getWallet, claimDaily, exchangeItem, getPetOrder, savePetOrder, setPetStatus, listSharedNotebooks, getNotebook } from '../../services/store'
import { Memorial, ownPets, PetFilter, Profile, today } from '../../utils/model'
import { anniversaries, Anniversary } from '../../utils/timeline'
import { choosePhotos, confirmPetRevival } from '../../utils/platform'
import { orderedPets, movePetOrder } from '../../utils/pet-order'
import { checkInPoints, emptyWallet, ItemKind } from '../../utils/items'
import { SharedNotebook } from '../../utils/notebooks'
import { OVERVIEW_NOTEBOOK } from '../../utils/cabinet'
Page({
  data: {
    profile:{nickName:'星屿的守护者',avatarUrl:''} as Profile,records:[] as Memorial[],visible:[] as Memorial[],notebooks:[] as Memorial[],filter:'all' as PetFilter,aliveCount:0,departedCount:0,
    loading:true,error:'',modeLabel,isCloud,editingName:false,profileSaving:false,draftName:'',wallet:emptyWallet(),claiming:false,
    sorting:false,mutating:false,gardenOpen:false,overviewPublic:false,anniversaries:[] as Anniversary[],profilePhoto:true,
    sharedBooks:[] as SharedNotebook[],sharedError:'',acceptingInvite:false,inviteInput:'',
  },
  onLoad(){this.setData({profilePhoto:wx.getStorageSync('xingyu.homeProfileStyle.v1')!=='plain'})},
  onShow(){this.load()},
  toggleProfileStyle(){const profilePhoto=!this.data.profilePhoto;wx.setStorageSync('xingyu.homeProfileStyle.v1',profilePhoto?'photo':'plain');this.setData({profilePhoto})},
  toggleGarden(){this.setData({gardenOpen:!this.data.gardenOpen})},
  privacySettings(){wx.navigateTo({url:'/pages/settings/settings'})},
  async onPullDownRefresh(){await this.load();const guestbook=this.selectComponent('#my-guestbook') as {retry?:()=>Promise<void>}|null;if(guestbook&&guestbook.retry)await guestbook.retry();wx.stopPullDownRefresh()},
  async load(){
    this.setData({loading:true,error:''})
    this.loadShared()
    try{
      const [profile,raw,wallet,order,overview]=await Promise.all([getProfile(),listMemorials(true),getWallet(),getPetOrder(),getNotebook(OVERVIEW_NOTEBOOK)]),records=orderedPets(raw,order)
      this.setData({profile,records,wallet,overviewPublic:overview.privacy==='public',anniversaries:anniversaries(ownPets(records),today()),aliveCount:ownPets(records,'alive').length,departedCount:ownPets(records,'departed').length});this.applyFilter()
    }catch(error){this.setData({error:showError(error)})}finally{this.setData({loading:false})}
  },
  async loadShared(){try{this.setData({sharedBooks:await listSharedNotebooks(),sharedError:''})}catch(error){this.setData({sharedError:error instanceof Error?error.message:'共写笔记暂时未能加载'})}},
  toggleAcceptInvite(){this.setData({acceptingInvite:!this.data.acceptingInvite,inviteInput:''})},
  invitationInput(e:WechatMiniprogram.Input){this.setData({inviteInput:e.detail.value})},
  openInvitation(){
    const code=this.data.inviteInput.trim()
    if(!/^[a-f0-9]{32}$/.test(code)){wx.showToast({title:'请输入完整的 32 位邀请码',icon:'none'});return}
    wx.navigateTo({url:'/pages/notebook/notebook?invite='+encodeURIComponent(code)})
  },
  openShared(e:WechatMiniprogram.TouchEvent){wx.navigateTo({url:'/pages/notebook/notebook?bookId='+encodeURIComponent(e.currentTarget.dataset.id)})},
  applyFilter(){const visible=ownPets(this.data.records,this.data.filter);this.setData({visible,notebooks:visible.filter(p=>p.notebookEnabled!==false)})},
  setFilter(e:WechatMiniprogram.TouchEvent){this.setData({filter:e.currentTarget.dataset.filter});this.applyFilter()},
  toggleSort(){if(!this.data.mutating)this.setData({sorting:!this.data.sorting})},
  async movePet(e:WechatMiniprogram.TouchEvent){
    if(this.data.loading||this.data.mutating)return
    const order=movePetOrder(this.data.records,this.data.filter,e.currentTarget.dataset.id,Number(e.currentTarget.dataset.direction))
    this.setData({mutating:true})
    try{await savePetOrder(order);this.setData({records:orderedPets(this.data.records,order)});this.applyFilter()}catch(error){showError(error)}finally{this.setData({mutating:false})}
  },
  async petActions(e:WechatMiniprogram.TouchEvent){
    if(this.data.loading||this.data.mutating||this.data.sorting)return
    const pet=this.data.records.find(p=>p.id===e.currentTarget.dataset.id)
    if(!pet)return
    try{
      const statusLabel=pet.lifeStatus==='alive'?'标记为已故':'看广告复活为现存'
      const result=await wx.showActionSheet({itemList:pet.notebookEnabled===false?['开启笔记本与隐私设置',statusLabel]:['打开档案笔记','编辑宠物资料',statusLabel]})
      if(pet.notebookEnabled===false){if(result.tapIndex===0)wx.navigateTo({url:'/pages/settings/settings?id='+encodeURIComponent(pet.id)});else await this.changeStatus(pet);return}
      if(result.tapIndex===0)this.notebook(e)
      else if(result.tapIndex===1)wx.navigateTo({url:'/pages/create/create?id='+encodeURIComponent(pet.id)})
      else await this.changeStatus(pet)
    }catch(error){if(!String((error as {errMsg?:string}).errMsg).includes('cancel'))showError(error)}
  },
  async changeStatus(pet:Memorial){
    if(this.data.mutating)return
    this.setData({mutating:true})
    try{
      const alive=pet.lifeStatus==='alive'
      const confirmed=alive?(await wx.showModal({title:'标记为已故',content:`确定将「${pet.name}」标记为已故吗？离开日期暂记为今天，可在资料中修改。档案和笔记会保留；地图墓碑需要另行设置。`,confirmText:'确认标记',confirmColor:'#7c9bb5'})).confirm:await confirmPetRevival(pet.name)
      if(!confirmed)return
      await setPetStatus(pet.id,alive?'departed':'alive')
      await this.load()
      wx.showToast({title:alive?'已移入已故档案':'已复活，回到现存伙伴',icon:'none'})
    }catch(error){showError(error)}finally{this.setData({mutating:false})}
  },
  notebook(e:WechatMiniprogram.TouchEvent){const id=e.currentTarget.dataset.id,pet=this.data.records.find(p=>p.id===id);wx.navigateTo({url:(pet&&pet.notebookEnabled===false?'/pages/settings/settings?id=':'/pages/notebook/notebook?id=')+encodeURIComponent(id)})},
  overview(){wx.navigateTo({url:'/pages/notebook/notebook?overview=1'})},
  create(){wx.navigateTo({url:'/pages/create/create'})},
  homepage(){wx.navigateTo({url:'/pages/profile/profile?user='+encodeURIComponent(this.data.profile.id||'local-guardian')})},
  openAnniversary(e:WechatMiniprogram.TouchEvent){wx.navigateTo({url:'/pages/memorial/memorial?id='+encodeURIComponent(e.currentTarget.dataset.id)})},
  previewHomepage(){wx.navigateTo({url:'/pages/profile/profile?user='+encodeURIComponent(this.data.profile.id||'local-guardian')+'&preview=1'})},
  async claim(){
    if(this.data.claiming)return
    this.setData({claiming:true})
    try{const wallet=await claimDaily();this.setData({wallet});wx.showToast({title:`连续签到 ${wallet.streak} 天，+${checkInPoints(wallet.streak||1)} 积分`,icon:'none'})}catch(error){showError(error)}finally{this.setData({claiming:false})}
  },
  async exchange(e:WechatMiniprogram.CustomEvent<{kind:ItemKind}>){
    if(this.data.claiming)return
    this.setData({claiming:true})
    try{this.setData({wallet:await exchangeItem(e.detail.kind)});wx.showToast({title:'兑换成功',icon:'success'})}catch(error){showError(error)}finally{this.setData({claiming:false})}
  },
  nameEditing:false,nameLock:false,
  editName(){if(this.data.profileSaving||this.nameEditing)return;this.nameEditing=true;this.setData({editingName:true,draftName:this.data.profile.nickName})},
  nameInput(e:WechatMiniprogram.Input){this.setData({draftName:e.detail.value})},
  async saveName(){
    if(!this.nameEditing||this.nameLock)return
    this.nameLock=true
    const nickName=this.data.draftName.trim()
    if(!nickName||nickName===this.data.profile.nickName){this.nameEditing=false;this.setData({editingName:false,draftName:this.data.profile.nickName});if(!nickName)wx.showToast({title:'昵称需要 1～20 个字',icon:'none'});this.nameLock=false;return}
    this.setData({profileSaving:true})
    try{await saveProfile({nickName,avatarUrl:this.data.profile.avatarFile||this.data.profile.avatarUrl});this.nameEditing=false;this.setData({editingName:false,profile:await getProfile()})}
    catch(error){showError(error)}finally{this.nameLock=false;this.setData({profileSaving:false})}
  },
  async changeAvatar(){
    if(this.data.profileSaving)return
    let path=''
    try{const paths=await choosePhotos(1);path=paths[0]||''}catch(error){if(!String((error as {errMsg?:string}).errMsg).includes('cancel'))showError(error);return}
    if(!path)return
    const previous=this.data.profile.avatarUrl
    this.setData({profileSaving:true,'profile.avatarUrl':path})
    try{const file=await persistPhoto(path);await saveProfile({nickName:this.data.profile.nickName,avatarUrl:file});this.setData({profile:await getProfile()})}
    catch(error){showError(error);this.setData({'profile.avatarUrl':previous})}finally{this.setData({profileSaving:false})}
  },
  about(){wx.showModal({title:'关于宠物档案',content:'登记时可选择是否同步创建整本宠物笔记，也可在「隐私设置」中开启或隐藏。私密笔记标有 🔒，仅自己与受邀好友可见；公开笔记允许访客阅读。总览笔记记录大家共同的日常。\n\n'+(isCloud?'档案与云端账户关联。':'当前为本机体验，照片和笔记保存在当前设备。跨设备共写需要启用微信云开发账户。'),showCancel:false,confirmColor:'#5badeb'})},
})
