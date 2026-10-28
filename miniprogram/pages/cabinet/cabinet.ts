import { getProfile, saveProfile, listMemorials, persistPhoto, showError, modeLabel, isCloud, getWallet, claimDaily, getPetOrder, savePetOrder, setPetStatus, listSharedNotebooks, getNotebook, getGardenPrivacy } from '../../services/store'
import { Memorial, ownPets, PetFilter, Profile, Privacy } from '../../utils/model'
import { choosePhotos, confirmPetRevival } from '../../utils/platform'
import { orderedPets, movePetOrder } from '../../utils/pet-order'
import { emptyWallet } from '../../utils/items'
import { SharedNotebook } from '../../utils/notebooks'
import { OVERVIEW_NOTEBOOK } from '../../utils/cabinet'
Page({
  data: {
    profile:{nickName:'星屿的守护者',avatarUrl:''} as Profile,records:[] as Memorial[],visible:[] as Memorial[],notebooks:[] as Memorial[],filter:'all' as PetFilter,aliveCount:0,departedCount:0,
    loading:true,error:'',modeLabel,isCloud,editing:false,profileSaving:false,draftName:'',draftAvatar:'',wallet:emptyWallet(),claiming:false,
    sorting:false,mutating:false,gardenOpen:false,overviewPublic:false,gardenPrivacy:'private' as Privacy,
    sharedBooks:[] as SharedNotebook[],sharedError:'',acceptingInvite:false,inviteInput:'',
  },
  onShow(){this.load()},
  toggleGarden(){this.setData({gardenOpen:!this.data.gardenOpen})},
  privacySettings(){wx.navigateTo({url:'/pages/settings/settings'})},
  gardenSettings(){wx.navigateTo({url:'/pages/settings/settings?section=garden'})},
  async onPullDownRefresh(){await this.load();await this.selectComponent('#my-guestbook')?.retry();wx.stopPullDownRefresh()},
  async load(){
    this.setData({loading:true,error:''})
    this.loadShared()
    try{
      const [profile,raw,wallet,order,overview,gardenPrivacy]=await Promise.all([getProfile(),listMemorials(true),getWallet(),getPetOrder(),getNotebook(OVERVIEW_NOTEBOOK),getGardenPrivacy()]),records=orderedPets(raw,order)
      this.setData({profile,records,wallet,gardenPrivacy,overviewPublic:overview.privacy==='public',aliveCount:ownPets(records,'alive').length,departedCount:ownPets(records,'departed').length});this.applyFilter()
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
  notebook(e:WechatMiniprogram.TouchEvent){const id=e.currentTarget.dataset.id,pet=this.data.records.find(p=>p.id===id);wx.navigateTo({url:(pet?.notebookEnabled===false?'/pages/settings/settings?id=':'/pages/notebook/notebook?id=')+encodeURIComponent(id)})},
  overview(){wx.navigateTo({url:'/pages/notebook/notebook?overview=1'})},
  create(){wx.navigateTo({url:'/pages/create/create'})},
  homepage(){wx.navigateTo({url:'/pages/profile/profile?user='+encodeURIComponent(this.data.profile.id||'local-guardian')})},
  previewHomepage(){wx.navigateTo({url:'/pages/profile/profile?user='+encodeURIComponent(this.data.profile.id||'local-guardian')+'&preview=1'})},
  async claim(){
    if(this.data.claiming)return
    this.setData({claiming:true})
    try{this.setData({wallet:await claimDaily()});wx.showToast({title:'签到成功，奖励已到账',icon:'none'})}catch(error){showError(error)}finally{this.setData({claiming:false})}
  },
  editProfile(){this.setData({editing:!this.data.editing,draftName:this.data.profile.nickName,draftAvatar:this.data.profile.avatarFile||this.data.profile.avatarUrl})},
  nameInput(e:WechatMiniprogram.Input){this.setData({draftName:e.detail.value})},
  async avatar(){
    if(this.data.profileSaving)return
    this.setData({profileSaving:true})
    try{const paths=await choosePhotos(1);if(paths[0])this.setData({draftAvatar:await persistPhoto(paths[0])})}catch(error){if(!String((error as {errMsg?:string}).errMsg).includes('cancel'))showError(error)}finally{this.setData({profileSaving:false})}
  },
  async saveProfile(){
    if(this.data.profileSaving)return
    this.setData({profileSaving:true})
    try{await saveProfile({nickName:this.data.draftName.trim(),avatarUrl:this.data.draftAvatar});this.setData({editing:false,profile:await getProfile()});wx.showToast({title:'已保存',icon:'success'})}catch(error){showError(error)}finally{this.setData({profileSaving:false})}
  },
  about(){wx.showModal({title:'关于宠物档案',content:'登记时可选择是否同步创建整本宠物笔记，也可在「隐私设置」中开启或隐藏。私密笔记标有 🔒，仅自己与受邀好友可见；公开笔记允许访客阅读。总览笔记记录大家共同的日常。\n\n'+(isCloud?'档案与云端账户关联。':'当前为本机体验，照片和笔记保存在当前设备。跨设备共写需要启用微信云开发账户。'),showCancel:false,confirmColor:'#5badeb'})},
})
