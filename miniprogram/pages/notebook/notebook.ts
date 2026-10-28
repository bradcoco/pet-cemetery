import { getNotebook, listMemorials, listNotes, saveNote, deleteNote, persistPhoto, showError, isCloud, getNotebookSharing, inviteNotebook, previewNotebookInvite, joinNotebook, revokeNotebookInvite, removeNotebookMember, addNotebookTag, deleteNotebookTag } from '../../services/store'
import { Memorial, ownPets, today, Privacy } from '../../utils/model'
import { OVERVIEW_NOTEBOOK, Note, NoteInput, validateNote } from '../../utils/cabinet'
import { choosePhotos, isNativeApp } from '../../utils/platform'
import { NotebookPet, NotebookInvitation, NotebookSharing, NotebookTag, filterNotebookNotes, validateTagName } from '../../utils/notebooks'
const emptyNote = (): NoteInput => ({ title: '', content: '', date: today(), photos: [], tagIds: [] })
Page({
  data: {
    memorial: null as NotebookPet | null, notes: [] as Note[], loading: true, error: '', overview:false,overviewPets:[] as Memorial[],volume:'01',
    isCloud,native:isNativeApp(),isOwner:true,canWrite:true,privacy:'private' as Privacy,ownerName:'',memberCount:0,invitation:null as NotebookInvitation|null,joining:false,sharingOpen:false,sharingBusy:false,sharingError:'',sharing:{code:'',expiresAt:0,members:[]} as NotebookSharing,expiresLabel:'',
    editing: false, noteId: '', form: emptyNote(), photoViews: [] as string[], saving: false, uploading: false, today: today(), editorError: '',
    tags:[] as NotebookTag[],editorTags:[] as (NotebookTag & {selected:boolean})[],visibleNotes:[] as (Note & {tags:NotebookTag[]})[],query:'',tagFilter:'',publicBookId:'',settingsTab:'general',settingsBusy:false,settingsError:'',tagName:'',visitorPreview:false,
  },
  id: '',
  bookId:'',
  inviteToken:'',
  loaded:false,
  openMembersOnLoad:false,
  onLoad(options) { this.id = options.overview==='1' ? OVERVIEW_NOTEBOOK : options.id || '';this.bookId=options.bookId||'';this.inviteToken=options.invite||'';this.openMembersOnLoad=options.settings==='members';this.setData({visitorPreview:options.preview==='1'});if(!isNativeApp())wx.hideShareMenu();this.load() },
  onShow(){if(this.loaded&&!this.data.editing&&!this.data.sharingOpen)this.load()},
  draftKey(){return `xingyu.noteDraft.${this.bookId||this.id}`},
  onHide() { this.keepDraft() },
  onUnload() { this.keepDraft() },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      if(this.inviteToken){
        if(this.data.visitorPreview)throw new Error('访客预览不加入共写，请退出预览后打开邀请')
        this.setData({invitation:await previewNotebookInvite(this.inviteToken)})
        wx.setNavigationBarTitle({title:'好友共写邀请'});return
      }
      if(!this.id&&!this.bookId)throw new Error('请从宠物档案选择一本笔记')
      const info=await getNotebook(this.id,this.bookId,this.data.visitorPreview)
      this.id=info.memorialId
      if(!info.isOwner&&info.canWrite)this.bookId=info.bookId
      const [notes,records]=await Promise.all([listNotes(this.id,this.bookId,this.data.visitorPreview),info.isOwner&&this.id===OVERVIEW_NOTEBOOK?listMemorials(true):Promise.resolve([])])
      this.setData({notes,tags:info.tags||[],publicBookId:info.bookId,memorial:info.pet,overview:this.id===OVERVIEW_NOTEBOOK,overviewPets:ownPets(records),volume:info.pet?info.pet.no||'01':'ALL',isOwner:info.isOwner,canWrite:info.canWrite,privacy:info.privacy,ownerName:info.ownerName,memberCount:info.memberCount,invitation:null})
      this.applyFilters()
      wx.setNavigationBarTitle({title:info.title})
      if(!isNativeApp()&&isCloud){if(info.privacy==='public')wx.showShareMenu({menus:['shareAppMessage']});else wx.hideShareMenu()}
      if(this.openMembersOnLoad){this.openMembersOnLoad=false;if(info.isOwner)await this.openSharing()}
    } catch (error) { this.setData({ error: showError(error), memorial: null, notes: [], visibleNotes:[],tags:[] }) }
    finally { this.loaded=true;this.setData({ loading: false }) }
  },
  applyFilters(){
    const tagFilter=this.data.tags.some(t=>t.id===this.data.tagFilter)?this.data.tagFilter:''
    this.setData({tagFilter,visibleNotes:filterNotebookNotes(this.data.notes,this.data.tags,this.data.query,tagFilter)})
  },
  searchNotes(e:WechatMiniprogram.Input){this.setData({query:e.detail.value});this.applyFilters()},
  filterTag(e:WechatMiniprogram.TouchEvent){this.setData({tagFilter:e.currentTarget.dataset.id||''});this.applyFilters()},
  clearFilters(){this.setData({query:'',tagFilter:''});this.applyFilters()},
  updateEditorTags(){this.setData({editorTags:this.data.tags.map(tag=>({...tag,selected:(this.data.form.tagIds||[]).includes(tag.id)}))})},
  selectTag(e:WechatMiniprogram.TouchEvent){
    if(this.data.saving||this.data.uploading)return
    const id=e.currentTarget.dataset.id,ids=this.data.form.tagIds||[]
    if(!this.data.tags.some(tag=>tag.id===id))return
    if(!ids.includes(id)&&ids.length>=10){wx.showToast({title:'每篇最多选择 10 个标签',icon:'none'});return}
    this.setData({'form.tagIds':ids.includes(id)?ids.filter(tag=>tag!==id):[...ids,id]});this.updateEditorTags();this.keepDraft()
  },
  keepDraft() {
    if (!this.data.editing) return
    const { form, noteId } = this.data
    if (form.title.trim() || form.content.trim() || form.photos.length) {
      try { wx.setStorageSync(this.draftKey(), { form, noteId }) } catch (_) { /* 不修改已保存的笔记。 */ }
    } else wx.removeStorageSync(this.draftKey())
  },
  newNote() {
    if(!this.data.canWrite||this.data.loading||this.data.error)return
    const draft = wx.getStorageSync(this.draftKey()) as { form: NoteInput; noteId: string } | undefined
    const validDraft = draft && (!draft.noteId || this.data.notes.some(n => n.id === draft.noteId&&n.canEdit!==false))
    const form=validDraft?draft!.form:emptyNote()
    this.setData({ editing: true, noteId: validDraft ? draft!.noteId : '', form: {...form,tagIds:(form.tagIds||[]).filter(id=>this.data.tags.some(t=>t.id===id))}, photoViews: validDraft ? draft!.form.photos : [], editorError: '' });this.updateEditorTags()
    if (validDraft) wx.showToast({ title: '已找回上次没写完的心事', icon: 'none' })
  },
  editNote(e: WechatMiniprogram.TouchEvent) {
    const note = this.data.notes.find(n => n.id === e.currentTarget.dataset.id)
    if (!this.data.canWrite||!note||note.canEdit===false) return
    this.setData({ editing: true, noteId: note.id, form: { title: note.title, content: note.content, date: note.date, photos: note.photos,tagIds:(note.tagIds||[]).filter(id=>this.data.tags.some(t=>t.id===id)) }, photoViews: note.photoUrls || note.photos, editorError: '' });this.updateEditorTags()
  },
  input(e: WechatMiniprogram.Input) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value, editorError: '' }) },
  date(e: WechatMiniprogram.CustomEvent<{ value: string }>) { this.setData({ 'form.date': e.detail.value, editorError: '' }) },
  closeEditor() { if (!this.data.saving && !this.data.uploading) { this.keepDraft(); this.setData({ editing: false }) } },
  stopTap() {},
  async addPhotos() {
    if (this.data.uploading || this.data.saving) return
    this.setData({ uploading: true })
    try {
      const paths = await choosePhotos(9 - this.data.form.photos.length)
      for (const path of paths) {
        const file = await persistPhoto(path)
        this.setData({ 'form.photos': [...this.data.form.photos, file], photoViews: [...this.data.photoViews, path] })
      }
      this.keepDraft()
    } catch (error) { if (!String((error as { errMsg?: string }).errMsg).includes('cancel')) this.setData({ editorError: showError(error) }) }
    finally { this.setData({ uploading: false }) }
  },
  removePhoto(e: WechatMiniprogram.TouchEvent) {
    if (this.data.uploading || this.data.saving) return
    const i = Number(e.currentTarget.dataset.index)
    this.setData({ 'form.photos': this.data.form.photos.filter((_, j) => i !== j), photoViews: this.data.photoViews.filter((_, j) => i !== j) })
  },
  async save() {
    if (!this.data.canWrite || this.data.saving || this.data.uploading) return
    const input = { ...this.data.form, title: this.data.form.title.trim(), content: this.data.form.content.trim() }, error = validateNote(input)
    if (error) { this.setData({ editorError: error }); return }
    this.setData({ saving: true, editorError: '' })
    try {
      await saveNote(this.id, input, this.data.noteId,this.bookId)
      this.setData({ editing: false }); wx.removeStorageSync(this.draftKey())
      this.setData({ notes: await listNotes(this.id,this.bookId) })
      this.applyFilters()
      wx.showToast({ title: '这一页，替你好好收藏', icon: 'none' })
    } catch (error) {
      this.setData({ editorError: showError(error) })
      if(error instanceof Error&&error.message.includes('标签已被删除')){
        try{
          const info=await getNotebook(this.id,this.bookId),tagIds=(this.data.form.tagIds||[]).filter(id=>info.tags.some(t=>t.id===id))
          this.setData({tags:info.tags,'form.tagIds':tagIds,editorError:'标签已更新，请检查分类后重新保存，正文已保留。'});this.updateEditorTags();this.applyFilters();this.keepDraft()
        }catch(_){ /* 保留当前草稿，等待恢复访问后重试。 */ }
      }
    }
    finally { this.setData({ saving: false }) }
  },
  async remove(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    if(!this.data.notes.some(n=>n.id===id&&n.canDelete!==false))return
    const result = await wx.showModal({ title: '删除这一页笔记？', content: '仅删除这篇记录，不会影响宠物档案和其他回忆。删除后无法恢复。', confirmText: '删除这一页', confirmColor: '#a66b55' })
    if (!result.confirm) return
    try {
      await deleteNote(this.id, id,this.bookId)
      const draft = wx.getStorageSync(this.draftKey()) as { noteId?: string } | undefined
      if (draft && draft.noteId === id) wx.removeStorageSync(this.draftKey())
      this.setData({ notes: await listNotes(this.id,this.bookId) })
      this.applyFilters()
    } catch (error) { showError(error) }
  },
  preview(e: WechatMiniprogram.TouchEvent) {
    const note = this.data.notes.find(n => n.id === e.currentTarget.dataset.id)
    if (note) wx.previewImage({ current: e.currentTarget.dataset.src, urls: note.photoUrls || note.photos })
  },
  async acceptInvite(){
    if(this.data.visitorPreview||this.data.joining)return
    this.setData({joining:true})
    try{const joined=await joinNotebook(this.inviteToken);this.id=joined.memorialId;this.bookId=joined.bookId;this.inviteToken='';await this.load();wx.showToast({title:'已加入，一起写下回忆吧',icon:'none'})}catch(error){showError(error)}finally{this.setData({joining:false})}
  },
  async openSettings(){
    if(!this.data.isOwner)return
    this.setData({sharingOpen:true,settingsTab:'general',settingsError:'',tagName:''})
  },
  async openSharing(){
    if(!this.data.isOwner)return
    this.setData({sharingOpen:true,settingsTab:'members',sharingError:'',settingsError:''})
    if(isCloud)await this.refreshSharing()
  },
  async settingsTab(e:WechatMiniprogram.TouchEvent){
    if(this.data.settingsBusy||this.data.sharingBusy)return
    const tab=e.currentTarget.dataset.tab;this.setData({settingsTab:tab,settingsError:''})
    if(tab==='members'&&isCloud)await this.refreshSharing()
  },
  closeSharing(){if(!this.data.sharingBusy&&!this.data.settingsBusy)this.setData({sharingOpen:false})},
  openPrivacy(){if(!this.data.isOwner||this.data.settingsBusy||this.data.sharingBusy)return;this.setData({sharingOpen:false});wx.navigateTo({url:'/pages/settings/settings?'+(this.data.overview?'section=overview':'id='+encodeURIComponent(this.id))})},
  tagNameInput(e:WechatMiniprogram.Input){this.setData({tagName:e.detail.value,settingsError:''})},
  async addTag(){
    if(!this.data.isOwner||this.data.settingsBusy)return
    const name=this.data.tagName.trim(),error=validateTagName(name)
    if(error){this.setData({settingsError:error});return}
    this.setData({settingsBusy:true,settingsError:''})
    try{this.setData({tags:await addNotebookTag(this.id,name,this.bookId),tagName:''});this.applyFilters()}
    catch(error){this.setData({settingsError:showError(error)})}finally{this.setData({settingsBusy:false})}
  },
  async deleteTag(e:WechatMiniprogram.TouchEvent){
    if(!this.data.isOwner||this.data.settingsBusy)return
    const tag=this.data.tags.find(t=>t.id===e.currentTarget.dataset.id)
    if(!tag)return
    const result=await wx.showModal({title:'删除标签？',content:`删除「${tag.name}」后，已有记录会移除这个分类，记录内容保留。`,confirmText:'删除标签',confirmColor:'#a66b55'})
    if(!result.confirm)return
    this.setData({settingsBusy:true,settingsError:''})
    try{this.setData({tags:await deleteNotebookTag(this.id,tag.id,this.bookId)});this.applyFilters()}
    catch(error){this.setData({settingsError:showError(error)})}finally{this.setData({settingsBusy:false})}
  },
  async refreshSharing(){
    this.setData({sharingBusy:true,sharingError:''})
    try{const sharing=await getNotebookSharing(this.id,this.bookId);this.showSharing(sharing)}catch(error){this.setData({sharingError:showError(error)})}finally{this.setData({sharingBusy:false})}
  },
  showSharing(sharing:NotebookSharing){
    this.setData({sharing,memberCount:sharing.members.length,expiresLabel:sharing.expiresAt?new Date(sharing.expiresAt).toLocaleDateString():''})
    if(!isNativeApp()&&isCloud){if(sharing.code||this.data.privacy==='public')wx.showShareMenu({menus:['shareAppMessage']});else wx.hideShareMenu()}
  },
  async createInvite(){
    if(this.data.sharingBusy)return
    this.setData({sharingBusy:true,sharingError:''})
    try{this.showSharing(await inviteNotebook(this.id,this.bookId))}catch(error){this.setData({sharingError:showError(error)})}finally{this.setData({sharingBusy:false})}
  },
  copyInvite(){if(this.data.sharing.code)wx.setClipboardData({data:this.data.sharing.code})},
  async stopInvite(){
    if(this.data.sharingBusy)return
    this.setData({sharingBusy:true,sharingError:''})
    try{await revokeNotebookInvite(this.id,this.bookId);await this.refreshSharing()}catch(error){this.setData({sharingError:showError(error)})}finally{this.setData({sharingBusy:false})}
  },
  async removeMember(e:WechatMiniprogram.TouchEvent){
    if(this.data.sharingBusy)return
    const member=this.data.sharing.members.find(m=>m.id===e.currentTarget.dataset.id)
    if(!member)return
    const result=await wx.showModal({title:'移除共写好友？',content:`移除「${member.name}」后，对方失去共写权限，已写记录保留。私密本无法再访问，公开本仍可只读。如不希望对方重新加入，请同时停止当前邀请码。`,confirmText:'移除好友',confirmColor:'#7b98ac'})
    if(!result.confirm)return
    this.setData({sharingBusy:true,sharingError:''})
    try{await removeNotebookMember(this.id,member.id,this.bookId);await this.refreshSharing()}catch(error){this.setData({sharingError:showError(error)})}finally{this.setData({sharingBusy:false})}
  },
  onShareAppMessage(e){
    const share=e&&e.target&&e.target.dataset&&(e.target.dataset as {share?:string}).share
    if(this.data.privacy==='public'&&share!=='invite')return {title:this.data.overview?'全体伙伴 · 总览记事本':this.data.memorial!.name+'的时光笔记',path:'/pages/notebook/notebook?'+(this.data.overview?'bookId='+encodeURIComponent(this.data.publicBookId):'id='+encodeURIComponent(this.id))}
    return this.data.isOwner&&this.data.sharing.code?{title:'邀请你一起记录'+(this.data.overview?'全体伙伴的故事':this.data.memorial!.name+'的故事'),path:'/pages/notebook/notebook?invite='+this.data.sharing.code}:{title:'野岛 · 宠物档案',path:'/pages/cabinet/cabinet'}
  },
  openPet(e:WechatMiniprogram.TouchEvent){const id=e.currentTarget.dataset.id,pet=this.data.overviewPets.find(p=>p.id===id);wx.navigateTo({url:(pet&&pet.notebookEnabled===false?'/pages/memorial/memorial?id=':'/pages/notebook/notebook?id=')+encodeURIComponent(id)})},
  memorial() { if(this.data.visitorPreview){wx.navigateBack({delta:1,fail:()=>this.cabinet()});return}if(!this.data.isOwner||this.data.overview){this.cabinet();return} wx.navigateTo({ url: `/pages/memorial/memorial?id=${encodeURIComponent(this.id)}` }) },
  cabinet() { wx.switchTab({ url: '/pages/cabinet/cabinet' }) },
})
