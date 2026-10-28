import { hasTombstone, Memorial } from './model'
import type { PublicGarden } from './garden'
export type ItemKind = 'flower' | 'bone' | 'fish' | 'can' | 'eternalCandle' | 'memorialGarden' | 'puppuccino' | 'candle' | 'pawHeart' | 'angelWings' | 'rose' | 'rainbowBridge' | 'heartBalloon'
export type Inventory = Record<ItemKind, number>
export interface Wallet { balances: Inventory; claimedOn: string; streak?: number;rewardVersion?:number }
export interface GiftResult { wallet: Wallet; gifts: Inventory; flowers: number }
export interface PublicProfile { profile: ProfileCard; pets: Memorial[]; isOwner: boolean; garden?: PublicGarden | null }
export interface ProfileCard { id: string; nickName: string; avatarUrl: string }
export const ITEMS: { id: ItemKind; name: string; icon: string; unit: string; points:number; target:'memorial'|'dog'|'cat'|'living'|'all' }[] = [
  { id: 'flower', name: '鲜花', icon: '🌼', unit: '朵',points:30,target:'memorial' },
  { id: 'bone', name: '小骨头', icon: '🦴', unit: '份',points:20,target:'dog' },
  { id: 'fish', name: '小鱼干', icon: '🐟', unit: '份',points:15,target:'cat' },
  { id: 'can', name: '小罐头', icon: '🥫', unit: '份',points:45,target:'living' },
  { id: 'eternalCandle', name: '永恒烛光', icon: '🕯️✨', unit: '盏',points:100,target:'memorial' },
  { id: 'memorialGarden', name: '纪念花园', icon: '🌷', unit: '座',points:80,target:'memorial' },
  { id: 'puppuccino', name: '宠物奶泡', icon: '🥛', unit: '杯',points:50,target:'dog' },
  { id: 'candle', name: '纪念蜡烛', icon: '🕯️', unit: '盏',points:35,target:'memorial' },
  { id: 'pawHeart', name: '爪印爱心', icon: '💖', unit: '颗',points:40,target:'all' },
  { id: 'angelWings', name: '天使之翼', icon: '🪽', unit: '对',points:60,target:'memorial' },
  { id: 'rose', name: '玫瑰', icon: '🌹', unit: '朵',points:25,target:'memorial' },
  { id: 'rainbowBridge', name: '彩虹桥', icon: '🌈', unit: '座',points:70,target:'memorial' },
  { id: 'heartBalloon', name: '爱心气球', icon: '🎈', unit: '个',points:10,target:'all' },
]
export const emptyInventory = (): Inventory => Object.fromEntries(ITEMS.map(item=>[item.id,0])) as Inventory
export const inventoryValue = (balances:Partial<Inventory>):number => ITEMS.reduce((sum,item)=>sum+(balances[item.id]||0)*item.points,0)
export const receivedItems = (gifts?:Partial<Inventory>) => ITEMS.filter(item=>(gifts?.[item.id]||0)>0).map(item=>({...item,count:gifts![item.id]!}))
export const emptyWallet = (): Wallet => ({ balances: emptyInventory(), claimedOn: '', streak: 0,rewardVersion:2 })
export function chinaDay(now = Date.now()): string { return new Date(now + 8 * 3600000).toISOString().slice(0, 10) }
export function cleanWallet(raw?: Wallet | null): Wallet {
  const claimedOn=raw?.claimedOn||'',balances={...emptyInventory(),...raw?.balances}
  // 旧钱包只记录最后领取日，以最近一次签到作为新连签的第 1 天。
  const streak=raw?.streak===undefined?(claimedOn?1:0):raw.streak
  if(!ITEMS.every(item=>Number.isSafeInteger(balances[item.id])&&balances[item.id]>=0&&balances[item.id]<1000000000))throw new Error('物品库存状态异常，请稍后重试')
  if(typeof claimedOn!=='string'||claimedOn&&(!/^\d{4}-\d{2}-\d{2}$/.test(claimedOn)||!Number.isFinite(Date.parse(claimedOn))||new Date(claimedOn).toISOString().slice(0,10)!==claimedOn)||!Number.isSafeInteger(streak)||streak<0||Boolean(claimedOn)!==(streak>0))throw new Error('签到记录异常，请稍后重试')
  const rewardVersion=raw?.rewardVersion??(raw?1:2)
  if(rewardVersion!==1&&rewardVersion!==2)throw new Error('签到奖励版本异常')
  return {balances,claimedOn,streak,rewardVersion}
}
export function checkInStatus(raw: Wallet, now=Date.now()): {claimed:boolean;streak:number;supplement:boolean;rewards:Inventory} {
  const wallet=cleanWallet(raw),claimedToday=wallet.claimedOn===chinaDay(now),supplement=claimedToday&&wallet.rewardVersion!==2,claimed=claimedToday&&!supplement
  const streak=claimedToday?wallet.streak!:wallet.claimedOn===chinaDay(now-86400000)?wallet.streak!+1:1
  const weekday=new Date(now+8*3600000).getUTCDay()
  if(supplement)return {claimed,streak,supplement,rewards:{...Object.fromEntries(ITEMS.map(item=>[item.id,1])),flower:0} as Inventory}
  return {claimed,streak,supplement,rewards:{...Object.fromEntries(ITEMS.map(item=>[item.id,1])),flower:streak,bone:1+(weekday===3?2:0),fish:1+(weekday===6?2:0),can:1+(weekday===0?1:0)} as Inventory}
}
export function applyCheckIn(raw: Wallet, now=Date.now()): Wallet {
  const wallet=cleanWallet(raw),status=checkInStatus(wallet,now),day=chinaDay(now)
  if(wallet.claimedOn>day)throw new Error('当前日期早于上次签到，请检查设备日期')
  if(status.claimed)return wallet
  const balances={...wallet.balances}
  for(const item of ITEMS)balances[item.id]+=status.rewards[item.id]
  return cleanWallet({balances,claimedOn:day,streak:status.streak,rewardVersion:2})
}
export function checkInRewardText(wallet:Wallet,now=Date.now()):string {
  const {rewards,supplement}=checkInStatus(wallet,now)
  if(supplement)return '新增物品各 ×1 · 骨头、鱼干、罐头各补 ×1'
  return `每种物品 ×1${rewards.flower>1?' · 鲜花额外 ×'+(rewards.flower-1):''}${rewards.bone>1?' · 小骨头额外 ×2':''}${rewards.fish>1?' · 小鱼干额外 ×2':''}${rewards.can>1?' · 小罐头额外 ×1':''}`
}
export function canGive(pet: Memorial, item: ItemKind): boolean {
  const gift=ITEMS.find(i=>i.id===item)
  if(!gift)return false
  if(pet.lifeStatus==='alive')return gift.target==='all'||gift.target==='living'||gift.target==='dog'&&pet.species==='狗狗'||gift.target==='cat'&&pet.species==='猫咪'
  return hasTombstone(pet)&&(gift.target==='memorial'||gift.target==='all')
}
export function requestId(): string { return `r-${Date.now()}-${Math.random().toString(36).slice(2, 12)}` }
