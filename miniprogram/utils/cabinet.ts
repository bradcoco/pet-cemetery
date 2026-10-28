import { Memorial, today } from './model'
import { validateNoteTags } from './notebooks'

export const OVERVIEW_NOTEBOOK = '__overview__'
export type CabinetTheme = 'wood' | 'glass' | 'ivory' | 'night'
export type KeepsakeStyle = 'album' | 'orb'
export interface Placement { memorialId: string; slot: number; style: KeepsakeStyle }
export interface Cabinet { theme: CabinetTheme; slots: number; placements: Placement[] }
export interface Note {
  id: string; memorialId: string; title: string; content: string; date: string
  photos: string[]; photoUrls?: string[]; createdAt: number; updatedAt: number
  authorName?: string; canEdit?: boolean; canDelete?: boolean
  tagIds?: string[]
}
export type NoteInput = Pick<Note, 'title' | 'content' | 'date' | 'photos' | 'tagIds'>
export const THEMES = [
  { id: 'wood', name: '胡桃木', description: '把时光，藏进温暖木纹' },
  { id: 'glass', name: '水晶玻璃', description: '每一段回忆，都透着光' },
  { id: 'ivory', name: '奶油陶瓷', description: '柔软而安静的收藏角落' },
  { id: 'night', name: '星夜金属', description: '属于你们的小小宇宙' },
]
export const emptyCabinet = (): Cabinet => ({ theme: 'wood', slots: 9, placements: [] })
export function slotLabel(slot: number): string { return `第 ${Math.floor(slot / 3) + 1} 层 · ${['左', '中', '右'][slot % 3]}格` }
// 新伙伴填入空格；已有伙伴不因列表排序、筛选或重启而移动。
export function normalizeCabinet(cabinet: Cabinet, records: Memorial[]): Cabinet {
  const ids = new Set(records.map(m => m.id)), occupied = new Set<number>(), placed = new Set<string>()
  const placements = cabinet.placements.filter(p => {
    if (!ids.has(p.memorialId) || occupied.has(p.slot) || placed.has(p.memorialId) || !Number.isInteger(p.slot) || p.slot < 0 || p.slot >= 300) return false
    occupied.add(p.slot); placed.add(p.memorialId); return true
  }).map(p => ({ ...p }))
  for (const m of records) {
    if (placed.has(m.id)) continue
    let slot = 0
    while (occupied.has(slot)) slot++
    if (slot >= 300) throw new Error('档案柜最多容纳 300 位伙伴')
    placements.push({ memorialId: m.id, slot, style: 'album' }); occupied.add(slot)
  }
  const last = placements.reduce((max, p) => Math.max(max, p.slot + 1), 0)
  return { theme: cabinet.theme, slots: Math.min(300, Math.max(9, cabinet.slots, Math.ceil(last / 3) * 3)), placements }
}
export function validateNote(note: NoteInput): string {
  const tagError = validateNoteTags(note.tagIds)
  if (tagError) return tagError
  if (note.title.length > 60 || note.content.length > 5000) return '标题最多 60 字，正文最多 5000 字'
  if (!note.title.trim() && !note.content.trim() && !note.photos.length) return '写下一点回忆，或放上一张照片吧'
  const parsed = new Date(note.date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(note.date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== note.date || note.date > today()) return '请选择有效的记录日期，不能晚于今天'
  if (note.photos.length > 9) return '每篇笔记最多 9 张照片'
  return ''
}
