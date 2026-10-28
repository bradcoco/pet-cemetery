import type { ProfileCard } from './items'
export interface GuestbookMessage { id: string; content: string; createdAt: number; author: ProfileCard; canDelete: boolean }
export interface GuestbookPage { messages: GuestbookMessage[]; nextOffset: number | null; isOwner: boolean }
export const GUESTBOOK_PAGE_SIZE = 10
export function validateGuestbookContent(content: unknown): string {
  return typeof content !== 'string' || !content.trim() || content.trim().length > 300 ? '留言需要 1～300 个字' : ''
}
export function guestbookDate(time: number): string {
  const date=new Date(time),pad=(n:number)=>String(n).padStart(2,'0')
  return `${date.getFullYear()}.${pad(date.getMonth()+1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
