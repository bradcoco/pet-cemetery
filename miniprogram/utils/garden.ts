import { Memorial } from './model'
export interface GardenPet { petId: string; x: number; y: number }
export interface Garden { pets: GardenPet[]; memorials: string[] }
export type GardenRecord = Pick<Memorial,'id'|'name'|'species'|'stone'|'photos'|'photoUrls'|'avatarEmoji'|'lifeStatus'|'markerPhoto'|'markerPhotoUrl'>
export interface PublicGarden { layout: Garden; records: GardenRecord[] }
export const emptyGarden = (): Garden => ({ pets: [], memorials: [] })
export function gardenPosition(x: number, y: number): {x: number; y: number} { return { x: Math.max(9,Math.min(91,x)), y: Math.max(54,Math.min(86,y)) } }
export function validateGarden(garden: Garden): string {
  if (!garden || !Array.isArray(garden.pets) || !Array.isArray(garden.memorials) || garden.pets.length + garden.memorials.length > 300) return '家园最多收纳 300 位伙伴'
  const ids = new Set<string>()
  for (const p of garden.pets) {
    if (!p || typeof p.petId !== 'string' || !/^[\w-]{1,100}$/.test(p.petId) || ids.has(p.petId) || !Number.isFinite(p.x) || p.x < 9 || p.x > 91 || !Number.isFinite(p.y) || p.y < 54 || p.y > 86) return '请把伙伴放在后院草坪上，每只伙伴只能放置一次'
    ids.add(p.petId)
  }
  for (const id of garden.memorials) {
    if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id) || ids.has(id)) return '纪念花园的伙伴不能重复'
    ids.add(id)
  }
  return ''
}
export function normalizeGarden(raw: Garden, records: Memorial[]): Garden {
  const mine = new Map(records.filter(p => p.owner && !p.demo).map(p => [p.id,p])), ids = new Set<string>(), garden = emptyGarden()
  for (const p of raw.pets || []) {
    const pet = p && mine.get(p.petId)
    if (!pet || ids.has(p.petId) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    ids.add(p.petId)
    if (pet.lifeStatus === 'alive') garden.pets.push({ petId: p.petId, ...gardenPosition(p.x,p.y) })
    else garden.memorials.push(p.petId)
  }
  for (const id of raw.memorials || []) { const pet = mine.get(id); if (pet && pet.lifeStatus !== 'alive' && !ids.has(id)) { garden.memorials.push(id); ids.add(id) } }
  return garden
}
export function buildPublicGarden(raw: Garden, records: Memorial[]): PublicGarden {
  const visible=records.filter(p=>p.privacy==='public'&&!p.demo),layout=normalizeGarden(raw,visible.map(p=>({...p,owner:true}))),ids=new Set([...layout.pets.map(p=>p.petId),...layout.memorials])
  return {layout,records:visible.filter(p=>ids.has(p.id)).map(p=>({id:p.id,name:p.name,species:p.species,stone:p.stone,markerPhoto:p.markerPhoto||'',markerPhotoUrl:p.markerPhotoUrl||'',lifeStatus:p.lifeStatus||'departed',avatarEmoji:p.avatarEmoji||'',photos:p.photos.slice(0,1),photoUrls:(p.photoUrls&&p.photoUrls.slice(0,1))||[]}))}
}
export function wanderTarget(position: {x: number; y: number}, random = Math.random): {x: number; y: number; facing: number} {
  const next = gardenPosition(position.x + (random()-.5)*26,position.y + (random()-.5)*12)
  return { ...next, facing: next.x < position.x ? -1 : 1 }
}
