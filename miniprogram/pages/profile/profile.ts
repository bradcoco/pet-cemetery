import { claimDaily, exchangeItem, getProfile, getPublicProfile, getWallet, isCloud, showError } from '../../services/store'
import { Memorial } from '../../utils/model'
import { checkInPoints, emptyWallet, GiftResult, ItemKind, ProfileCard, Wallet, receivedItems, inventoryValue } from '../../utils/items'
import { isNativeApp } from '../../utils/platform'
import { PublicGarden } from '../../utils/garden'
const petView=(pet:Memorial)=>({...pet,receivedGifts:receivedItems(pet.gifts),receivedValue:inventoryValue(pet.gifts||{})})
type ProfilePet=ReturnType<typeof petView>
Page({
  data: {
    profile: null as ProfileCard | null, pets: [] as ProfilePet[], living: [] as ProfilePet[], memories: [] as ProfilePet[],
    isOwner: false, loading: true, error: '', wallet: emptyWallet(), claiming: false,
    giftPet: null as Memorial | null, isCloud, native: isNativeApp(), visitorPreview:false,publicGarden:null as PublicGarden|null,
  },
  user: '',
  onLoad(options) { this.user = options.user || ''; this.setData({visitorPreview:options.preview==='1'});this.load() },
  onShow() { if (this.data.profile) this.load() },
  async onPullDownRefresh() { await this.load(); const guestbook=this.selectComponent('#public-guestbook') as {retry?:()=>Promise<void>}|null; if(guestbook&&guestbook.retry)await guestbook.retry(); wx.stopPullDownRefresh() },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      if (!this.user) this.user = (await getProfile()).id || 'local-guardian'
      const result = await getPublicProfile(this.user,this.data.visitorPreview)
      this.setData({ profile: result.profile, pets: result.pets.map(petView), publicGarden:result.garden||null, isOwner: result.isOwner, living: result.pets.filter(p => p.lifeStatus === 'alive').map(petView), memories: result.pets.filter(p => p.lifeStatus !== 'alive').map(petView) })
      if (result.isOwner) this.setData({ wallet: await getWallet() })
      wx.setNavigationBarTitle({ title: this.data.visitorPreview?'访客视角预览':`${result.profile.nickName}的主页` })
      if (!isNativeApp() && isCloud) wx.showShareMenu({ menus: ['shareAppMessage'] })
      else if (!isNativeApp()) wx.hideShareMenu()
    } catch (error) { this.setData({ error: showError(error), profile: null, pets: [], living: [], memories: [], publicGarden:null }) }
    finally { this.setData({ loading: false }) }
  },
  async claim() {
    if (!this.data.isOwner || this.data.visitorPreview || this.data.claiming) return
    this.setData({ claiming: true })
    try { const wallet=await claimDaily(); this.setData({ wallet }); wx.showToast({ title: `连续签到 ${wallet.streak} 天，+${checkInPoints(wallet.streak||1)} 积分`, icon: 'none' }) }
    catch (error) { showError(error) }
    finally { this.setData({ claiming: false }) }
  },
  open(e: WechatMiniprogram.TouchEvent) { wx.navigateTo({ url: `/pages/memorial/memorial?id=${encodeURIComponent(e.currentTarget.dataset.id)}${this.data.visitorPreview?'&preview=1':''}` }) },
  gift(e: WechatMiniprogram.TouchEvent) { if(this.data.visitorPreview){wx.showToast({title:'访客可在这里赠礼，预览时不扣物品',icon:'none'});return}const pet = this.data.pets.find(p => p.id === e.currentTarget.dataset.id); if (pet) this.setData({ giftPet: pet }) },
  closeGift() { this.setData({ giftPet: null }) },
  gifted(e: WechatMiniprogram.CustomEvent<GiftResult & { petId: string }>) {
    const pets = this.data.pets.map(p => p.id === e.detail.petId ? petView({ ...p, gifts: e.detail.gifts, flowers: e.detail.flowers }) : p)
    this.setData({ pets, living: pets.filter(p => p.lifeStatus === 'alive'), memories: pets.filter(p => p.lifeStatus !== 'alive'), wallet: e.detail.wallet })
  },
  walletChange(e: WechatMiniprogram.CustomEvent<{ wallet: Wallet }>) { this.setData({ wallet: e.detail.wallet }) },
  async exchange(e: WechatMiniprogram.CustomEvent<{ kind: ItemKind }>) {
    if (!this.data.isOwner || this.data.visitorPreview || this.data.claiming) return
    this.setData({ claiming: true })
    try { this.setData({ wallet: await exchangeItem(e.detail.kind) }); wx.showToast({ title: '兑换成功', icon: 'success' }) }
    catch (error) { showError(error) }
    finally { this.setData({ claiming: false }) }
  },
  notes(e: WechatMiniprogram.TouchEvent) { wx.navigateTo({ url: `/pages/notebook/notebook?id=${encodeURIComponent(e.currentTarget.dataset.id)}${this.data.visitorPreview?'&preview=1':''}` }) },
  create() { if(this.data.isOwner&&!this.data.visitorPreview)wx.navigateTo({ url: '/pages/create/create' }) },
  edit(e: WechatMiniprogram.TouchEvent) { if(this.data.isOwner&&!this.data.visitorPreview)wx.navigateTo({ url: `/pages/create/create?id=${encodeURIComponent(e.currentTarget.dataset.id)}` }) },
  privacySettings(){if(this.data.isOwner&&!this.data.visitorPreview)wx.navigateTo({url:'/pages/settings/settings'})},
  exitPreview(){wx.switchTab({url:'/pages/cabinet/cabinet'})},
  onShareAppMessage() { return { title: `${this.data.profile ? this.data.profile.nickName : '星屿守护者'}的小小伙伴们，等你来认识`, path: `/pages/profile/profile?user=${encodeURIComponent(this.user)}` } },
})
