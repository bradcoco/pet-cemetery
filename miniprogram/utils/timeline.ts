import { Note } from './cabinet'
import { ITEMS, ItemKind } from './items'
import { Memorial } from './model'

export interface Anniversary {
  id: string
  petId: string
  name: string
  kind: 'birthday' | 'departed'
  daysUntil: number
  years: number
  mark: string
  text: string
}
export interface GiftMoment { id: string; kind: ItemKind; createdAt: number }
export interface TimelineEvent { id: string; date: string; dateLabel: string; title: string; detail: string }

const utc = (day: string) => Date.parse(`${day}T00:00:00Z`)
const validDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day
const isLeap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
function observe(source: string, year: number): string {
  const month = source.slice(5, 7), day = source.slice(8, 10)
  if (month === '02' && day === '29' && !isLeap(year)) return `${year}-02-28`
  return `${year}-${month}-${day}`
}
function nextOccurrence(source: string, today: string): { daysUntil: number; years: number } | null {
  if (!validDay(source)) return null
  const year = Number(today.slice(0, 4))
  let date = observe(source, year)
  if (date < today) date = observe(source, year + 1)
  if (date < source) return null
  const daysUntil = Math.round((utc(date) - utc(today)) / 86400000)
  const years = Number(date.slice(0, 4)) - Number(source.slice(0, 4))
  if (!Number.isFinite(daysUntil) || daysUntil < 0 || years < 0) return null
  return { daysUntil, years }
}
function anniversaryText(kind: Anniversary['kind'], daysUntil: number, years: number): string {
  if (kind === 'birthday') {
    if (daysUntil === 0 && years === 0) return '今天来到这个世界'
    if (daysUntil === 0) return `今天 ${years} 岁`
    if (years === 0) return `还有 ${daysUntil} 天来到这个世界`
    return `还有 ${daysUntil} 天就 ${years} 岁`
  }
  if (daysUntil === 0 && years === 0) return '今天成为星星'
  if (daysUntil === 0) return `离开已经 ${years} 年`
  return `还有 ${daysUntil} 天，离开满 ${years} 年`
}
export function anniversaries(pets: Pick<Memorial, 'id' | 'name' | 'birthday' | 'departed' | 'lifeStatus'>[], today: string, within = 7): Anniversary[] {
  const found: Anniversary[] = []
  for (const pet of pets) {
    const dates: { kind: Anniversary['kind']; source: string }[] = []
    if (pet.birthday) dates.push({ kind: 'birthday', source: pet.birthday })
    if (pet.lifeStatus !== 'alive' && pet.departed) dates.push({ kind: 'departed', source: pet.departed })
    for (const item of dates) {
      const next = nextOccurrence(item.source, today)
      if (!next || next.daysUntil > within) continue
      found.push({ id: `${pet.id}:${item.kind}`, petId: pet.id, name: pet.name, kind: item.kind, daysUntil: next.daysUntil, years: next.years, mark: item.kind === 'birthday' ? '♡' : '☽', text: anniversaryText(item.kind, next.daysUntil, next.years) })
    }
  }
  return found.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name, 'zh') || a.kind.localeCompare(b.kind))
}

function dayFromStamp(ts: number): string {
  return new Date(ts + 8 * 3600000).toISOString().slice(0, 10)
}
export function timelineDateLabel(date: string): string {
  const [year, month, day] = date.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}
function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 36 ? `${flat.slice(0, 36)}…` : flat
}
export function petTimeline(pet: Pick<Memorial, 'birthday' | 'departed' | 'lifeStatus' | 'createdAt' | 'no'>, notes: Pick<Note, 'id' | 'title' | 'content' | 'date' | 'photos' | 'createdAt'>[], gifts: GiftMoment[]): TimelineEvent[] {
  const events: (TimelineEvent & { rank: number; at: number })[] = []
  const push = (event: Omit<TimelineEvent, 'dateLabel'> & { rank: number; at: number }) => {
    if (!validDay(event.date)) return
    events.push({ ...event, dateLabel: timelineDateLabel(event.date) })
  }
  if (pet.birthday) push({ id: `birthday-${pet.birthday}`, date: pet.birthday, rank: 0, at: 0, title: '来到这个世界', detail: '' })
  if (pet.lifeStatus !== 'alive' && pet.departed) push({ id: `departed-${pet.departed}`, date: pet.departed, rank: 1, at: 0, title: '成为星星', detail: '' })
  if (pet.createdAt) push({ id: 'registered', date: dayFromStamp(pet.createdAt), rank: 2, at: pet.createdAt, title: '写进星屿', detail: pet.no ? `No. ${pet.no}` : '' })
  for (const gift of gifts) {
    const item = ITEMS.find(entry => entry.id === gift.kind)
    if (!item || !Number.isFinite(gift.createdAt)) continue
    push({ id: `gift-${gift.id}`, date: dayFromStamp(gift.createdAt), rank: 3, at: gift.createdAt, title: `收到${item.icon} ${item.name}`, detail: '一份心意' })
  }
  for (const note of notes) {
    const title = note.title.trim() || (note.photos.length ? '留下照片' : '写下一篇笔记')
    push({ id: `note-${note.id}`, date: note.date, rank: 4, at: note.createdAt || 0, title, detail: clip(note.content) })
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank || a.at - b.at).map(({ rank, at, ...event }) => event)
}
