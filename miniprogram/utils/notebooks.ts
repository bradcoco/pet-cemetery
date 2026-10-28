import { Memorial, Privacy } from './model'
import type { Note } from './cabinet'

export interface NotebookTag { id: string; name: string }
export type NotebookPet = Pick<Memorial,'id'|'name'|'species'|'photos'|'photoUrls'|'avatarEmoji'|'no'>
export interface NotebookInfo {
  bookId: string; memorialId: string; title: string; ownerName: string; isOwner: boolean
  memberCount: number; pet: NotebookPet | null
  canWrite: boolean; privacy: Privacy; tags: NotebookTag[]
}
export interface NotebookMember { id: string; name: string }
export interface NotebookSharing { code: string; expiresAt: number; members: NotebookMember[] }
export interface NotebookInvitation { title: string; ownerName: string; expiresAt: number }
export type SharedNotebook = Pick<NotebookInfo,'bookId'|'memorialId'|'title'|'ownerName'> & {privacy?:Privacy}

export function validateTagName(name: string): string {
  return typeof name !== 'string' || !name.trim() || name.trim().length > 20 ? '标签名称需要 1～20 个字' : ''
}
export function validateNoteTags(ids: unknown): string {
  return ids !== undefined && (!Array.isArray(ids) || ids.length > 10 || ids.some(id => typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id)) || new Set(ids).size !== ids.length) ? '每篇记录最多选择 10 个不同的标签' : ''
}
export function filterNotebookNotes(notes: Note[], tags: NotebookTag[], query = '', tagId = ''): (Note & {tags: NotebookTag[]})[] {
  const keyword = query.trim().toLocaleLowerCase()
  return notes.map(note => ({...note, tags: tags.filter(tag => (note.tagIds || []).includes(tag.id))})).filter(note => (!tagId || note.tags.some(tag => tag.id === tagId)) && (!keyword || [note.title, note.content, note.date, ...note.tags.map(tag => tag.name)].join('\n').toLocaleLowerCase().includes(keyword)))
}
