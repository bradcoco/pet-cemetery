import { PET_EMOJIS } from './avatars'
export type Privacy = 'public' | 'private'
export type Stone = 'arch' | 'star' | 'garden' | 'heart' | 'photo'
export interface Memorial {
  id: string; name: string; species: string; breed: string; birthday: string; departed: string
  epitaph: string; story: string; locationName: string; latitude: number; longitude: number
  privacy: Privacy; stone: Stone; photos: string[]; flowers: number; createdAt: number
  owner: boolean; demo?: boolean; photoUrls?: string[]
  avatarEmoji?: string; lifeStatus?: 'alive' | 'departed'; hasMemorial?: boolean; no?: string; ownerId?: string
  notebookEnabled?: boolean; notebookPrivacy?: Privacy
  markerPhoto?: string; markerPhotoUrl?: string; memorialNotebook?: boolean
  gifts?: Partial<import('./items').Inventory> & { flower: number; bone: number; fish: number; can: number }
}
export interface Profile { nickName: string; avatarUrl: string; avatarFile?: string; id?: string }
export type MemorialInput = Omit<Memorial, 'id' | 'flowers' | 'createdAt' | 'owner' | 'demo' | 'photoUrls' | 'no' | 'ownerId' | 'gifts' | 'markerPhotoUrl'>
export function hasTombstone(pet: MemorialInput): boolean { return pet.lifeStatus !== 'alive' && pet.hasMemorial !== false }
export const STONES = [
  { id: 'arch', name: '月光拱门', symbol: '☽', description: '月亮会替我轻轻拥抱你' },
  { id: 'star', name: '一颗星星', symbol: '✧', description: '你是夜空最温柔的光' },
  { id: 'garden', name: '花间小憩', symbol: '❀', description: '在开满花的地方等你' },
  { id: 'heart', name: '爱心纪念', symbol: '♡', description: '把爱轻轻留在这里' },
  { id: 'photo', name: '仅用照片', symbol: '▧', description: '用最熟悉的模样作为标记' },
]
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function validateMemorial(m: MemorialInput): string {
  if(m.memorialNotebook!==undefined&&typeof m.memorialNotebook!=='boolean')return '请选择是否展示墓碑笔记入口'
  if(m.markerPhoto!==undefined&&(typeof m.markerPhoto!=='string'||m.markerPhoto.length>500))return '请重新上传标记照片'
  if(hasTombstone(m)&&m.stone==='photo'&&!m.markerPhoto&&!m.photos[0])return '仅照片样式需要上传一张宠物照片'
  if(m.notebookEnabled!==undefined&&typeof m.notebookEnabled!=='boolean')return '请选择是否创建宠物笔记本'
  if(m.notebookPrivacy!==undefined&&!['private','public'].includes(m.notebookPrivacy))return '请选择笔记本的可见范围'
  if (m.avatarEmoji !== undefined && (typeof m.avatarEmoji !== 'string' || m.avatarEmoji && !PET_EMOJIS.some(p=>p.emoji===m.avatarEmoji))) return '请选择内置的动物形象'
  if (!m.name.trim() || m.name.length > 20) return '请填写宠物的名字（最多 20 字）'
  if (!['猫咪', '狗狗', '兔兔', '鸟儿', '其他'].includes(m.species)) return '请选择宠物类型'
  if (m.lifeStatus && !['alive', 'departed'].includes(m.lifeStatus)) return '请选择伙伴的状态'
  if (m.lifeStatus === 'alive' && m.hasMemorial) return '活着的伙伴不需要设立纪念碑'
  if (hasTombstone(m) && (!m.locationName.trim() || m.locationName.length > 60)) return '请为这个地点起个名字（最多 60 字）'
  if (hasTombstone(m) && (!Number.isFinite(m.latitude) || Math.abs(m.latitude) > 90 || !Number.isFinite(m.longitude) || Math.abs(m.longitude) > 180)) return '请重新选择地图位置'
  if (m.lifeStatus !== 'alive' && !m.departed) return '请选择离开的日期'
  for (const date of [m.birthday, m.departed].filter(Boolean)) {
    const parsed = new Date(date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > today()) return '请填写有效日期，不能晚于今天'
  }
  if (m.lifeStatus !== 'alive' && m.birthday && m.birthday > m.departed) return '离开日期不能早于出生日期'
  if (m.epitaph.length > 80 || m.story.length > 3000 || m.breed.length > 30) return '文字超过长度限制'
  if (!['public', 'private'].includes(m.privacy) || !STONES.some(s=>s.id===m.stone)) return '请选择纪念碑样式和可见范围'
  if (m.photos.length > 9) return '最多保存 9 张照片'
  return ''
}
export function daysTogether(m: Memorial): string {
  if (!m.birthday) return '每一天，都值得记得'
  const days = Math.round((Date.parse(m.lifeStatus === 'alive' ? today() : m.departed) - Date.parse(m.birthday)) / 86400000) + 1
  return m.lifeStatus === 'alive' ? `正在好好长大的第 ${days.toLocaleString()} 天` : `一起走过 ${days.toLocaleString()} 天`
}

export type PetFilter = 'all' | 'alive' | 'departed'
export function petStatusPatch(pet: Memorial, status: 'alive' | 'departed'): Partial<Memorial> {
  if(!['alive','departed'].includes(status))throw new Error('请选择现存或已故状态')
  if((pet.lifeStatus||'departed')===status)return {}
  return {lifeStatus:status,departed:status==='alive'?'':today(),hasMemorial:false,latitude:0,longitude:0,locationName:''}
}
export function ownPets(records: Memorial[], filter: PetFilter = 'all'): Memorial[] {
  return records.filter(p=>p.owner&&!p.demo&&(filter==='all'||(p.lifeStatus==='alive')===(filter==='alive')))
}
