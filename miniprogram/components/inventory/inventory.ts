import { chinaDay, checkInStatus, checkInRewardText, emptyWallet, inventoryValue, ITEMS, Wallet } from '../../utils/items'
const clocks = new WeakMap<object, number>()
function stopClock(instance: object): void { const timer = clocks.get(instance); if (timer !== undefined) clearTimeout(timer); clocks.delete(instance) }
Component({
  properties: { wallet: { type: Object, value: emptyWallet() }, loading: { type: Boolean, value: false }, compact: { type: Boolean, value: false } },
  data: { items: ITEMS.map(i => ({ ...i, balance: 0 })), claimed: false,streak:1,rewardText:'',supplement:false,totalValue:0 },
  observers: { wallet: function (wallet: Wallet) { if(wallet)this.refresh() } },
  lifetimes: { attached() { this.startClock() }, detached() { stopClock(this) } },
  pageLifetimes: { show() { this.startClock() }, hide() { stopClock(this) } },
  methods: {
    refresh(now=Date.now()) {
      const wallet=this.properties.wallet as Wallet,status=checkInStatus(wallet,now)
      this.setData({items:ITEMS.map(i=>({...i,balance:wallet.balances[i.id]||0})),totalValue:inventoryValue(wallet.balances),supplement:status.supplement,claimed:status.claimed,streak:status.streak,rewardText:checkInRewardText(wallet,now)})
    },
    startClock() {
      stopClock(this)
      const now = Date.now(), day = chinaDay(now), midnight = Date.parse(`${day}T00:00:00+08:00`)
      this.refresh(now)
      clocks.set(this, setTimeout(() => this.startClock(), midnight + 86400000 - now + 100))
    },
    claim() { this.triggerEvent('claim') },
  },
})
