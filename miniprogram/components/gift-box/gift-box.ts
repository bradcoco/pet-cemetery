import { claimDaily, getWallet, sendGift, showError } from '../../services/store'
import { Memorial } from '../../utils/model'
import { canGive, checkInPoints, checkInStatus, checkInRewardText, emptyWallet, ItemKind, ITEMS, requestId } from '../../utils/items'
Component({
  properties: { pet: { type: Object, value: {} } },
  data: { wallet: emptyWallet(), items: [] as { id: ItemKind; name: string; icon: string; unit:string; points:number;balance: number }[], selected: 'flower' as ItemKind, loading: true, sending: false, claiming: false, claimed: false, streak:1,rewardText:'',requestId: requestId(), error: '' },
  lifetimes: { attached() { this.setData({ requestId: requestId() }); this.load() } },
  methods: {
    async load() {
      try { this.setData({ wallet: await getWallet() }); this.refresh() }
      catch (error) { this.setData({ error: showError(error) }) }
      finally { this.setData({ loading: false }) }
    },
    refresh() {
      const pet = this.properties.pet as Memorial | null
      if (!pet) return
      const items = ITEMS.filter(i => canGive(pet, i.id)).map(i => ({ id: i.id, name: i.name, icon: i.icon, unit:i.unit,points:i.points,balance: this.data.wallet.balances[i.id] || 0 }))
      const selected = items.some(i => i.id === this.data.selected) ? this.data.selected : items[0] ? items[0].id : 'flower'
      const status=checkInStatus(this.data.wallet)
      this.setData({ items, selected, claimed: status.claimed,streak:status.streak,rewardText:checkInRewardText(this.data.wallet) })
    },
    select(e: WechatMiniprogram.TouchEvent) { if (!this.data.sending) this.setData({ selected: e.currentTarget.dataset.kind, requestId: requestId(), error: '' }) },
    async claim() {
      this.refresh()
      if (this.data.claiming || this.data.claimed || this.data.sending) return
      this.setData({ claiming: true })
      try { const wallet=await claimDaily(); this.setData({ wallet, error: '' }); this.refresh(); this.triggerEvent('walletchange', { wallet }); wx.showToast({ title: `连续签到 ${wallet.streak} 天，+${checkInPoints(wallet.streak||1)} 积分`, icon: 'none' }) }
      catch (error) { this.setData({ error: showError(error) }) }
      finally { this.setData({ claiming: false }) }
    },
    async give() {
      const pet = this.properties.pet as Memorial | null
      if (!pet || this.data.sending || this.data.claiming) return
      this.setData({ sending: true, error: '' })
      try {
        const result = await sendGift(pet.id, this.data.selected, this.data.requestId)
        this.triggerEvent('gifted', { petId: pet.id, ...result }); this.triggerEvent('close')
        wx.showToast({ title: pet.lifeStatus === 'alive' ? '这份喜欢，它收到了' : '这份想念，它收到了', icon: 'none' })
      } catch (error) { this.setData({ error: showError(error) }) }
      finally { this.setData({ sending: false }) }
    },
    close() { if (!this.data.sending && !this.data.claiming) this.triggerEvent('close') },
    stopTap() {},
  },
})
