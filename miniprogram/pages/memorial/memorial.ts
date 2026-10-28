import { deleteMemorial, getMemorial, listGiftMoments, listNotes, showError, isCloud } from '../../services/store'
import { daysTogether, hasTombstone, Memorial, today } from '../../utils/model'
import { anniversaries, petTimeline, TimelineEvent } from '../../utils/timeline'
import { isNativeApp } from '../../utils/platform'
import { GiftResult, receivedItems, inventoryValue } from '../../utils/items'
Page({
  data: { memorial: null as Memorial | null, loading: true, error: '', together: '', deleting: false, photos: [] as string[], isCloud, native: isNativeApp(), showTombstone: true, archiveView:false,hasMemorial:false,canOpenNotebook:false,notebookHint:'',receivedGifts:receivedItems(),receivedValue:0, giftPet: null as Memorial | null, visitorPreview:false, timeline: [] as TimelineEvent[], anniversary: '' },
  id: '',
  onLoad(options) {
    this.id = options.id || ''
    this.setData({visitorPreview:options.preview==='1',archiveView:options.view==='archive'})
    if (!isNativeApp()) wx.hideShareMenu()
    if (!this.id) { this.setData({ loading: false, error: '没有找到这份纪念，请从地图或宠物档案重新进入' }); return }
    this.load()
  },
  onShow() { if (this.data.memorial) this.load() },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  async load() {
    this.setData({ error: '' })
    try {
      const memorial = await getMemorial(this.id,this.data.visitorPreview)
      const showTombstone=hasTombstone(memorial)&&!this.data.archiveView
      const canOpenNotebook=memorial.notebookEnabled!==false&&(!showTombstone||memorial.memorialNotebook!==false)&&(memorial.owner||memorial.notebookPrivacy==='public')
      const notebookHint=memorial.notebookEnabled===false?'尚未开启笔记本':showTombstone&&memorial.memorialNotebook===false?'主人暂未展示笔记入口':!canOpenNotebook?'🔒 笔记未公开':memorial.notebookPrivacy==='public'?'阅读日常与回忆 ↗':'🔒 查看自己的私密笔记 ↗'
      const anniversary=anniversaries([memorial],today(),0).map(item=>`${item.mark} ${item.text}`).join(' · ')
      this.setData({ memorial,receivedGifts:receivedItems(memorial.gifts),receivedValue:inventoryValue(memorial.gifts||{}),showTombstone,hasMemorial:hasTombstone(memorial),canOpenNotebook,notebookHint,together: daysTogether(memorial), photos: memorial.photoUrls || memorial.photos, anniversary })
      await this.loadTimeline(memorial)
      wx.setNavigationBarTitle({ title: `${memorial.name}${this.data.archiveView||memorial.lifeStatus === 'alive' ? '的小小档案' : '的星屿'}` })
      if (!isNativeApp() && isCloud && memorial.privacy === 'public') wx.showShareMenu({ menus: ['shareAppMessage'] })
      else if (!isNativeApp()) wx.hideShareMenu()
    } catch (error) { this.setData({ memorial: null, error: showError(error) }) }
    finally { this.setData({ loading: false }) }
  },
  async loadTimeline(memorial: Memorial) {
    let notes: Awaited<ReturnType<typeof listNotes>> = []
    if (memorial.notebookEnabled !== false && !memorial.demo) { try { notes = await listNotes(memorial.id, '', this.data.visitorPreview) } catch { notes = [] } }
    let gifts: Awaited<ReturnType<typeof listGiftMoments>> = []
    if (!memorial.demo) { try { gifts = await listGiftMoments(memorial.id) } catch { gifts = [] } }
    this.setData({ timeline: petTimeline(memorial, notes, gifts) })
  },
  preview(e: WechatMiniprogram.TouchEvent) { wx.previewImage({ current: e.currentTarget.dataset.src, urls: this.data.photos }) },
  gift() { if(this.data.visitorPreview){wx.showToast({title:'访客可在这里赠礼，预览时不扣物品',icon:'none'});return}this.setData({ giftPet: this.data.memorial }) },
  closeGift() { this.setData({ giftPet: null }) },
  gifted(e: WechatMiniprogram.CustomEvent<GiftResult>) { this.setData({ 'memorial.gifts': e.detail.gifts, 'memorial.flowers': e.detail.flowers,receivedGifts:receivedItems(e.detail.gifts),receivedValue:inventoryValue(e.detail.gifts) }); if (this.data.memorial) this.loadTimeline(this.data.memorial) },
  guardian() { const m = this.data.memorial; if (m && m.ownerId) wx.navigateTo({ url: `/pages/profile/profile?user=${encodeURIComponent(m.ownerId)}${this.data.visitorPreview?'&preview=1':''}` }) },
  openArchive(){if(this.data.memorial&&!this.data.archiveView)wx.navigateTo({url:`/pages/memorial/memorial?id=${encodeURIComponent(this.id)}&view=archive${this.data.visitorPreview?'&preview=1':''}`})},
  openTombstone(){
    if(!this.data.hasMemorial)return
    const previous=getCurrentPages().slice(-2)[0]
    if(previous&&previous.route==='pages/memorial/memorial'&&previous.options.id===this.id&&previous.options.view!=='archive'&&(previous.options.preview==='1')===this.data.visitorPreview){wx.navigateBack();return}
    wx.redirectTo({url:`/pages/memorial/memorial?id=${encodeURIComponent(this.id)}${this.data.visitorPreview?'&preview=1':''}`})
  },
  notebook() { if(!this.data.canOpenNotebook)return;wx.navigateTo({ url: `/pages/notebook/notebook?id=${encodeURIComponent(this.id)}${this.data.visitorPreview?'&preview=1':''}` }) },
  edit() { if(this.data.memorial&&this.data.memorial.owner&&!this.data.visitorPreview)wx.navigateTo({ url: `/pages/create/create?id=${encodeURIComponent(this.id)}` }) },
  visitLocation() {
    const m = this.data.memorial
    if (!m) return
    if (!wx.canIUse('openLocation')) { wx.setClipboardData({ data: `${m.locationName} ${m.latitude.toFixed(5)}, ${m.longitude.toFixed(5)}` }); return }
    wx.openLocation({ latitude: m.latitude, longitude: m.longitude, name: m.locationName, scale: 15, fail: () => { wx.setClipboardData({ data: `${m.locationName} ${m.latitude.toFixed(5)}, ${m.longitude.toFixed(5)}` }) } })
  },
  async remove() {
    if (!this.data.memorial || !this.data.memorial.owner || this.data.visitorPreview || this.data.deleting) return
    const result = await wx.showModal({ title: '删除这份纪念？', content: '纪念碑、文字和档案将被移除，此操作无法撤销。', confirmText: '确认删除', confirmColor: '#a66b55' })
    if (!result.confirm) return
    this.setData({ deleting: true })
    try { await deleteMemorial(this.id); wx.switchTab({ url: '/pages/cabinet/cabinet' }) }
    catch (error) { showError(error) }
    finally { this.setData({ deleting: false }) }
  },
  home() { wx.switchTab({ url: '/pages/index/index' }) },
  exitPreview(){wx.switchTab({url:'/pages/cabinet/cabinet'})},
  onShareAppMessage() {
    const m = this.data.memorial
    if (!m || m.privacy !== 'public' || !isCloud) return { title: '野岛 · 让爱有迹可循', path: '/pages/index/index' }
    return { title: `${m.name}的小小星屿 · ${m.epitaph || '谢谢你，来过我的世界。'}`, path: `/pages/memorial/memorial?id=${encodeURIComponent(m.id)}${this.data.archiveView?'&view=archive':''}` }
  },
})
