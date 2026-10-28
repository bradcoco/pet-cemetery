import type { Memorial } from './model'
export type PetPrivacyPatch = Partial<Pick<Memorial,'privacy'|'notebookEnabled'|'notebookPrivacy'>>
export function validatePetPrivacyPatch(patch: unknown): string {
  if(!patch||typeof patch!=='object'||Array.isArray(patch))return '隐私设置格式不正确'
  const entries=Object.entries(patch)
  if(!entries.length||entries.some(([key,value])=>!['privacy','notebookEnabled','notebookPrivacy'].includes(key)||(key==='notebookEnabled'?typeof value!=='boolean':value!=='public'&&value!=='private')))return '只能修改宠物资料和笔记本的可见范围'
  return ''
}
