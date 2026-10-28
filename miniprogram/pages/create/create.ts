import { getMemorial, persistPhoto, saveMemorial, showError, isCloud } from '../../services/store'
import { hasTombstone, Memorial, MemorialInput, STONES, today, validateMemorial } from '../../utils/model'
import { canUseMap, choosePhotos, confirmPetRevival } from '../../utils/platform'
import { PET_EMOJIS } from '../../utils/avatars'
import { requestId } from '../../utils/items'
const emptyForm = (): MemorialInput => ({ name: '', species: '猫咪', breed: '', birthday: '', departed: '', epitaph: '', story: '', locationName: '', latitude: 30.2485, longitude: 120.142, privacy: 'private', stone: 'arch', photos: [], lifeStatus: 'alive', hasMemorial: false, avatarEmoji:'',notebookEnabled:true,notebookPrivacy:'private',markerPhoto:'',memorialNotebook:true })
const DRAFT = 'xingyu.draft.v1'
Page({
  data: {
    step: 0, id: '', form: emptyForm(), stones: STONES, species: ['猫咪', '狗狗', '兔兔', '鸟儿', '其他'],
    today: today(), saving: false, uploading: false, loading: false, error: '', mapAvailable: false, hasDraft: false,
    coordinateLat: '', coordinateLng: '', photoViews: [] as string[], markerView:'',isCloud,
    emojis:PET_EMOJIS,choosingEmoji:false, statusConfirming:false, registered: null as Memorial | null, registrationOrdinal: 1,
  },
  completed: false,
  creationKey: '',
  returningFromPrivacy:false,
  onLoad(options) {
    this.creationKey = requestId()
    this.setData({ mapAvailable: canUseMap(), hasDraft: Boolean(wx.getStorageSync(DRAFT)) })
    if (options.id) { this.load(options.id); return }
    if (options.memorial === '1') this.setData({ 'form.lifeStatus': 'departed', 'form.hasMemorial': true })
    const lat = Number(options.lat), lng = Number(options.lng)
    if (Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180) this.setData({ 'form.latitude': lat, 'form.longitude': lng })
    this.syncCoordinates()
  },
  onShow(){if(this.returningFromPrivacy){this.returningFromPrivacy=false;this.refreshPrivacy()}},
  async refreshPrivacy(){
    if(!this.data.id)return
    try{const pet=await getMemorial(this.data.id);this.setData({'form.privacy':pet.privacy,'form.notebookEnabled':pet.notebookEnabled!==false,'form.notebookPrivacy':pet.notebookPrivacy||'private'})}catch(error){this.setData({error:showError(error)})}
  },
  openPrivacy(){if(!this.data.id||this.data.saving||this.data.uploading)return;this.returningFromPrivacy=true;wx.navigateTo({url:'/pages/settings/settings?id='+encodeURIComponent(this.data.id)})},
  onHide() { this.saveDraft() },
  onUnload() { this.saveDraft() },
  saveDraft() {
    if (!this.completed && !this.data.id && this.data.form.name.trim()) {
      try { wx.setStorageSync(DRAFT, { form: this.data.form, creationKey: this.creationKey }) } catch (_) { /* 不影响已经保存的纪念。 */ }
    }
  },
  restoreDraft() {
    const raw = wx.getStorageSync(DRAFT) as { form?: MemorialInput; creationKey?: string } & MemorialInput
    const form = raw && (raw.form || raw)
    if (form) {
      this.creationKey = raw.creationKey || this.creationKey
      this.setData({ form: { ...emptyForm(), ...form, lifeStatus: form.lifeStatus || 'departed', hasMemorial: form.hasMemorial === undefined ? true : form.hasMemorial }, photoViews: form.photos, markerView:form.markerPhoto||'',hasDraft: false }); this.syncCoordinates()
    }
  },
  async load(id: string) {
    this.setData({ loading: true, id })
    try {
      const m = await getMemorial(id)
      if (!m.owner || m.demo) throw new Error('只有主人可以编辑这份纪念')
      const { name, species, breed, birthday, departed, epitaph, story, locationName, latitude, longitude, privacy, stone, photos, avatarEmoji } = m
      this.setData({ form: { name, species, breed, birthday, departed, epitaph, story, locationName, latitude, longitude, privacy, stone, photos, avatarEmoji:avatarEmoji||'', lifeStatus: m.lifeStatus || 'departed', hasMemorial: hasTombstone(m),notebookEnabled:m.notebookEnabled!==false,notebookPrivacy:m.notebookPrivacy||'private',markerPhoto:m.markerPhoto||'',memorialNotebook:m.memorialNotebook!==false }, markerView:m.markerPhotoUrl||m.markerPhoto||'',photoViews: m.photoUrls || photos })
      this.syncCoordinates()
    } catch (error) { this.setData({ error: showError(error) }) }
    finally { this.setData({ loading: false }) }
  },
  syncCoordinates() { this.setData({ coordinateLat: this.data.form.latitude.toFixed(5), coordinateLng: this.data.form.longitude.toFixed(5) }) },
  input(e: WechatMiniprogram.Input) { const field = e.currentTarget.dataset.field; this.setData({ [`form.${field}`]: e.detail.value, error: '' }) },
  pickDate(e: WechatMiniprogram.CustomEvent<{ value: string }>) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value, error: '' }) },
  choose(e: WechatMiniprogram.TouchEvent) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.currentTarget.dataset.value, error: '' }) },
  async life(e: WechatMiniprogram.TouchEvent) {
    if(this.data.statusConfirming||this.data.saving||this.data.loading)return
    const alive = e.currentTarget.dataset.value === 'alive'
    if(this.data.id&&alive&&this.data.form.lifeStatus!=='alive'){
      this.setData({statusConfirming:true})
      try{if(!await confirmPetRevival(this.data.form.name))return}catch(error){showError(error);return}finally{this.setData({statusConfirming:false})}
    }
    this.setData({ 'form.lifeStatus': alive ? 'alive' : 'departed', 'form.hasMemorial': !alive, ...(alive ? { 'form.departed': '' } : {}), error: '' })
  },
  memorialToggle(e: WechatMiniprogram.CustomEvent<{ value: boolean }>) { this.setData({ 'form.hasMemorial': e.detail.value, error: '' }) },
  notebookToggle(e:WechatMiniprogram.CustomEvent<{value:boolean}>){if(this.data.id)return;this.setData({'form.notebookEnabled':e.detail.value});this.saveDraft()},
  notebookPublicToggle(e:WechatMiniprogram.CustomEvent<{value:boolean}>){if(this.data.id)return;this.setData({'form.notebookPrivacy':e.detail.value?'public':'private'});this.saveDraft()},
  openEmoji(){this.setData({choosingEmoji:true})},
  closeEmoji(){this.setData({choosingEmoji:false})},
  stopTap(){},
  chooseEmoji(e:WechatMiniprogram.TouchEvent){const choice=PET_EMOJIS.find(p=>p.emoji===e.currentTarget.dataset.emoji);if(choice){this.setData({'form.avatarEmoji':choice.emoji,'form.species':choice.species,choosingEmoji:false});this.saveDraft()}},
  mapEnd(e: WechatMiniprogram.CustomEvent) {
    if (e.type !== 'end' && e.detail.type !== 'end') return
    wx.createMapContext('location-map', this).getCenterLocation({
      success: p => { this.setData({ 'form.latitude': p.latitude, 'form.longitude': p.longitude }); this.syncCoordinates() },
      fail: () => this.setData({ mapAvailable: false }),
    })
  },
  mapTap(e: WechatMiniprogram.CustomEvent<{ latitude: number; longitude: number }>) {
    this.setData({ 'form.latitude': e.detail.latitude, 'form.longitude': e.detail.longitude }); this.syncCoordinates()
  },
  coordinateInput(e: WechatMiniprogram.Input) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value, error: '' }) },
  applyCoordinates(): boolean {
    const lat = Number(this.data.coordinateLat), lng = Number(this.data.coordinateLng)
    if (!this.data.coordinateLat.trim() || !this.data.coordinateLng.trim() || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) {
      this.setData({ error: '纬度应在 -90～90，经度应在 -180～180 之间' }); return false
    }
    this.setData({ 'form.latitude': lat, 'form.longitude': lng }); return true
  },
  async searchLocation() {
    if (!wx.canIUse('chooseLocation')) { this.setData({ error: '当前端未启用地点搜索，请拖动地图或填写经纬度' }); return }
    try {
      const p = await wx.chooseLocation({ latitude: this.data.form.latitude, longitude: this.data.form.longitude })
      this.setData({ 'form.latitude': p.latitude, 'form.longitude': p.longitude, 'form.locationName': (p.name || p.address).slice(0, 60) }); this.syncCoordinates()
    } catch (error) { if (!String((error as { errMsg?: string }).errMsg).includes('cancel')) this.setData({ error: '暂时无法使用地点搜索，请拖动地图或填写经纬度' }) }
  },
  mapError() { this.setData({ mapAvailable: false }) },
  previous() { this.setData({ step: Math.max(0, this.data.step - 1), error: '' }); wx.pageScrollTo({ scrollTop: 0 }) },
  next() {
    if (this.data.step === 0) {
      if (hasTombstone(this.data.form)) {
        if (!this.applyCoordinates()) return
        if (!this.data.form.locationName.trim()) { this.setData({ error: '为这个地点起一个有意义的名字吧' }); return }
      }
    } else {
      const error = validateMemorial(this.data.form)
      if (error) { this.setData({ error }); return }
    }
    this.setData({ step: Math.min(2, this.data.step + 1), error: '' }); this.saveDraft(); wx.pageScrollTo({ scrollTop: 0 })
  },
  memorialNotebookToggle(e:WechatMiniprogram.CustomEvent<{value:boolean}>){this.setData({'form.memorialNotebook':e.detail.value});this.saveDraft()},
  async markerPhoto(){
    if(this.data.uploading||this.data.saving)return
    this.setData({uploading:true,error:''})
    try{const paths=await choosePhotos(1);if(!paths[0])return;const photo=await persistPhoto(paths[0]);this.setData({'form.markerPhoto':photo,markerView:isCloud?paths[0]:photo});this.saveDraft()}
    catch(error){if(!String((error as {errMsg?:string}).errMsg).includes('cancel'))showError(error)}
    finally{this.setData({uploading:false})}
  },
  clearMarkerPhoto(){if(this.data.uploading||this.data.saving)return;this.setData({'form.markerPhoto':'',markerView:''});this.saveDraft()},
  async addPhotos() {
    if (this.data.uploading || this.data.saving) return
    this.setData({ uploading: true })
    try {
      const paths = await choosePhotos(9 - this.data.form.photos.length)
      // 逐张保存，部分失败时保留已经成功的照片。
      for (const path of paths) {
        const photo = await persistPhoto(path)
        this.setData({ 'form.photos': [...this.data.form.photos, photo], photoViews: [...this.data.photoViews, isCloud?path:photo] })
      }
      this.saveDraft()
    } catch (error) { if (!String((error as { errMsg?: string }).errMsg).includes('cancel')) showError(error) }
    finally { this.setData({ uploading: false }) }
  },
  removePhoto(e: WechatMiniprogram.TouchEvent) {
    if (this.data.uploading || this.data.saving) return
    const i = Number(e.currentTarget.dataset.index)
    this.setData({ 'form.photos': this.data.form.photos.filter((_, j) => i !== j), photoViews: this.data.photoViews.filter((_, j) => i !== j) })
  },
  async save() {
    if (this.data.saving || this.data.uploading || this.data.loading || this.data.statusConfirming || this.data.registered) return
    const error = validateMemorial(this.data.form)
    if (error) { this.setData({ error }); return }
    this.setData({ saving: true, error: '' })
    try {
      const id = await saveMemorial(this.data.form, this.data.id, this.creationKey, Boolean(this.data.id))
      this.completed = true
      if (!this.data.id) wx.removeStorageSync(DRAFT)
      if (this.data.id) {
        wx.redirectTo({ url: `/pages/memorial/memorial?id=${encodeURIComponent(id)}`, fail: () => this.setData({ error: '档案已保存，请返回“我的档案”打开查看' }) })
      } else {
        const pet = await getMemorial(id)
        this.setData({ registered: pet, registrationOrdinal: Number(pet.no || '0') + 1 })
      }
    } catch (error) { this.setData({ error: showError(error) }) }
    finally { this.setData({ saving: false }) }
  },
  openRegistered() {
    const pet = this.data.registered
    if (pet) wx.redirectTo({ url: `${hasTombstone(pet)||pet.notebookEnabled===false ? '/pages/memorial/memorial' : '/pages/notebook/notebook'}?id=${encodeURIComponent(pet.id)}` })
  },
  openCabinet() { wx.switchTab({ url: '/pages/cabinet/cabinet' }) },
})
