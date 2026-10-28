import { getGardenPrivacy, getNotebook, getProfile, isCloud, listMemorials, setGardenPrivacy, setNotebookPrivacy, setPetPrivacy, showError } from '../../services/store'
import { Memorial, ownPets, Privacy } from '../../utils/model'
import { OVERVIEW_NOTEBOOK } from '../../utils/cabinet'
import { PetPrivacyPatch } from '../../utils/privacy'
Page({
  data:{records:[] as Memorial[],loading:true,error:'',busy:'',isCloud,gardenPrivacy:'private' as Privacy,overviewPrivacy:'private' as Privacy,user:'',focusId:'',publicPets:0,publicBooks:0},
  section:'',
  onLoad(options){this.section=options.section||'';this.setData({focusId:options.id||''})},
  onShow(){if(!this.data.busy)this.load()},
  async onPullDownRefresh(){if(!this.data.busy)await this.load();wx.stopPullDownRefresh()},
  async load(){
    this.setData({loading:true,error:''})
    try{
      const [records,gardenPrivacy,overview,profile]=await Promise.all([listMemorials(true),getGardenPrivacy(),getNotebook(OVERVIEW_NOTEBOOK),getProfile()])
      this.setData({records:ownPets(records),gardenPrivacy,overviewPrivacy:overview.privacy,user:profile.id||'local-guardian'});this.counts()
      const selector=this.data.focusId&&this.data.records.some(p=>p.id===this.data.focusId)?'#privacy-pet-'+this.data.focusId:this.section==='overview'?'#overview-settings':this.section==='garden'?'#garden-settings':''
      if(selector){this.section='';wx.nextTick(()=>wx.pageScrollTo({selector,duration:0}))}
    }catch(error){this.setData({error:showError(error),records:[]})}finally{this.setData({loading:false})}
  },
  counts(){this.setData({publicPets:this.data.records.filter(p=>p.privacy==='public').length,publicBooks:this.data.records.filter(p=>p.notebookEnabled!==false&&p.notebookPrivacy==='public').length})},
  async globalChange(e:WechatMiniprogram.CustomEvent<{value:boolean}>){
    if(this.data.loading||this.data.busy||this.data.error)return
    const field=e.currentTarget.dataset.field
    if(field!=='garden'&&field!=='overview')return
    const privacy=e.detail.value?'public':'private'
    this.setData({busy:field,error:''})
    try{
      if(field==='garden'){await setGardenPrivacy(privacy);this.setData({gardenPrivacy:privacy})}
      else{await setNotebookPrivacy(OVERVIEW_NOTEBOOK,privacy);this.setData({overviewPrivacy:privacy})}
    }catch(error){showError(error);this.setData({gardenPrivacy:this.data.gardenPrivacy,overviewPrivacy:this.data.overviewPrivacy})}finally{this.setData({busy:''})}
  },
  async petChange(e:WechatMiniprogram.CustomEvent<{value:boolean}>){
    if(this.data.loading||this.data.busy||this.data.error)return
    const {id,field}=e.currentTarget.dataset,pet=this.data.records.find(p=>p.id===id)
    if(!pet||!['privacy','notebookEnabled','notebookPrivacy'].includes(field)||field==='notebookPrivacy'&&pet.notebookEnabled===false)return
    const patch:PetPrivacyPatch=field==='notebookEnabled'?{notebookEnabled:e.detail.value}:{[field]:e.detail.value?'public':'private'}
    this.setData({busy:id+':'+field})
    try{await setPetPrivacy(id,patch);this.setData({records:this.data.records.map(p=>p.id===id?{...p,...patch}:p)});this.counts()}
    catch(error){showError(error);this.setData({records:[...this.data.records]})}finally{this.setData({busy:''})}
  },
  members(e:WechatMiniprogram.TouchEvent){
    if(this.data.busy||this.data.loading)return
    const id=e.currentTarget.dataset.id
    if(id!==OVERVIEW_NOTEBOOK&&!this.data.records.some(p=>p.id===id&&p.notebookEnabled!==false))return
    wx.navigateTo({url:'/pages/notebook/notebook?'+(id===OVERVIEW_NOTEBOOK?'overview=1':'id='+encodeURIComponent(id))+'&settings=members'})
  },
  preview(){if(!this.data.loading&&!this.data.busy&&this.data.user)wx.navigateTo({url:'/pages/profile/profile?user='+encodeURIComponent(this.data.user)+'&preview=1'})},
})
