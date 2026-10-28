import { CLOUD_ENV } from '../config'
import { DEMOS } from '../data/demo'
import { Memorial, MemorialInput, Profile, Privacy, validateMemorial, petStatusPatch } from '../utils/model'
import { validatePetOrder } from '../utils/pet-order'
import { isNativeApp } from '../utils/platform'
import { Cabinet, emptyCabinet, OVERVIEW_NOTEBOOK, Note, NoteInput, validateNote } from '../utils/cabinet'
import { canGive, cleanWallet, applyCheckIn, emptyInventory, emptyWallet, GiftResult, Inventory, ItemKind, ITEMS, PublicProfile, requestId, Wallet } from '../utils/items'

import { Garden, emptyGarden, normalizeGarden, validateGarden, buildPublicGarden } from '../utils/garden'
import { NotebookInfo, NotebookInvitation, NotebookSharing, SharedNotebook, NotebookTag, validateTagName } from '../utils/notebooks'
import { GuestbookMessage, GuestbookPage, GUESTBOOK_PAGE_SIZE, validateGuestbookContent } from '../utils/guestbook'
import { PetPrivacyPatch, validatePetPrivacyPatch } from '../utils/privacy'

const GARDEN = 'xingyu.garden.v1'
const GARDEN_PRIVACY = 'xingyu.gardenPrivacy.v1'
const GUESTBOOK = 'xingyu.guestbook.v1'
interface LocalMessage extends Omit<GuestbookMessage,'canDelete'> { user: string }
const PET_ORDER = 'xingyu.petOrder.v1'
const RECORDS = 'xingyu.memorials.v1'
const PROFILE = 'xingyu.profile.v1'
const CABINET = 'xingyu.cabinet.v1'
const NOTES = 'xingyu.notes.v1'
const NOTEBOOK_SETTINGS = 'xingyu.notebookSettings.v1'
interface LocalNotebookSettings { tags?: NotebookTag[]; privacy?: Privacy }
function notebookSettings(): Record<string, LocalNotebookSettings> { return wx.getStorageSync(NOTEBOOK_SETTINGS) || {} }
const ECONOMY = 'xingyu.economy.v1'
interface Economy { wallet: Wallet; gifts: Record<string, Inventory>; receipts: { id: string; petId: string; kind: ItemKind }[] }
function economy(): Economy { const state=wx.getStorageSync(ECONOMY)||{wallet:emptyWallet(),gifts:{},receipts:[]};return {...state,wallet:cleanWallet(state.wallet)} }
export const isCloud = Boolean(CLOUD_ENV) && !isNativeApp()
export const modeLabel = isCloud ? '云端账户' : '本机体验 · 数据仅保存在当前设备'
async function call<T>(action: string, payload: object = {}): Promise<T> {
  if (!wx.cloud || !wx.cloud.callFunction) throw new Error('当前环境未启用微信云开发，请检查环境配置')
  const response = await wx.cloud.callFunction({ name: 'memorial', data: { action, ...payload } })
  const result = response.result as { ok: boolean; data: T; error?: string }
  if (!result || !result.ok) throw new Error(result && result.error || '云服务暂时不可用，请稍后重试')
  return result.data
}
function localRecords(): Memorial[] {
  const records = (wx.getStorageSync(RECORDS) || []) as Memorial[]
  if (records.some(m => !m.no)) {
    let next = Math.max(Number(wx.getStorageSync('xingyu.nextPetNo.v1')) || 0, ...records.map(m => m.no ? Number(m.no) + 1 : 0))
    for (const m of [...records].sort((a, b) => a.createdAt - b.createdAt)) if (!m.no) {
      if (next > 999999) throw new Error('本机的六位宠物编号已用完')
      m.no = String(next++).padStart(6, '0')
    }
    writeRecords(records); wx.setStorageSync('xingyu.nextPetNo.v1', next)
  }
  return records
}
function writeRecords(records: Memorial[]): void { wx.setStorageSync(RECORDS, records) }
function decorate(m: Memorial): Memorial {
  const extra = {...emptyInventory(),...economy().gifts[m.id]}, gifts = { ...emptyInventory(), ...(m.gifts || {}), flower: m.flowers }
  for (const item of ITEMS) gifts[item.id] += extra[item.id]
  return { ...m, ownerId: m.demo ? 'demo-garden' : 'local-guardian', gifts, flowers: gifts.flower }
}
export async function listMemorials(mine = false): Promise<Memorial[]> {
  if (isCloud) {
    const records: Memorial[] = []
    let page: Memorial[]
    do { page = await call<Memorial[]>('list', { mine, offset: records.length }); records.push(...page) } while (page.length === 100)
    return records
  }
  const records = localRecords()
  return (mine ? records : [...records, ...DEMOS.map(m => ({ ...m }))]).map(decorate)
}
export async function getMemorial(id: string, preview = false): Promise<Memorial> {
  if (id.startsWith('demo-') && !isCloud) {
    const demo = DEMOS.find(m => m.id === id)
    if (demo) return decorate({ ...demo, flowers: demo.flowers + (wx.getStorageSync(`flower.${id}`) ? 1 : 0) })
  }
  if (isCloud) {
    const record=await call<Memorial>('get', { id, preview })
    if(preview&&record.privacy!=='public')throw new Error('这份纪念仅对主人可见，访客无法查看')
    return preview?{...record,owner:false}:record
  }
  const record = localRecords().find(m => m.id === id)
  if (!record) throw new Error('这份纪念不存在，或仅对主人可见')
  if(preview&&record.privacy!=='public')throw new Error('这份纪念仅对主人可见，访客无法查看')
  return decorate(preview?{...record,owner:false}:record)
}
export async function saveMemorial(input: MemorialInput, id = '', creationKey = requestId(), preservePrivacy = false): Promise<string> {
  if(id&&!isCloud){
    const previous=localRecords().find(p=>p.id===id)
    if(previous){
      input={...input,markerPhoto:input.markerPhoto===undefined?previous.markerPhoto||'':input.markerPhoto,memorialNotebook:input.memorialNotebook===undefined?previous.memorialNotebook!==false:input.memorialNotebook}
      if(preservePrivacy)input={...input,privacy:previous.privacy,notebookEnabled:previous.notebookEnabled!==false,notebookPrivacy:previous.notebookPrivacy||'private'}
    }
  }
  const error = validateMemorial(input)
  if (error) throw new Error(error)
  if (isCloud) return call<string>('save', { input, id, creationKey, preservePrivacy })
  const records = localRecords()
  const existingCreation = !id && records.find(m => m.id === `local-${creationKey}`)
  if (existingCreation) return existingCreation.id
  const previous = id ? records.find(m => m.id === id) : undefined
  if (id && !previous) throw new Error('无法修改这份纪念')
  const next = Math.max(Number(wx.getStorageSync('xingyu.nextPetNo.v1')) || 0, ...records.map(m => m.no ? Number(m.no) + 1 : 0))
  if (!previous && next > 999999) throw new Error('本机的六位宠物编号已用完')
  const normalized = input.hasMemorial === false || input.lifeStatus === 'alive' ? { ...input, hasMemorial: false, latitude: 0, longitude: 0, locationName: '', departed: input.lifeStatus === 'alive' ? '' : input.departed } : input
  const record: Memorial = { ...normalized,markerPhoto:input.markerPhoto===undefined?previous?.markerPhoto||'':input.markerPhoto,memorialNotebook:input.memorialNotebook===undefined?previous?.memorialNotebook!==false:input.memorialNotebook, notebookEnabled:input.notebookEnabled===undefined?previous?.notebookEnabled!==false:input.notebookEnabled,notebookPrivacy:input.notebookPrivacy===undefined?previous?.notebookPrivacy||'private':input.notebookPrivacy,id: previous ? previous.id : `local-${creationKey}`, no: previous ? previous.no : String(next).padStart(6, '0'), flowers: previous ? previous.flowers : 0, gifts: previous ? previous.gifts : emptyInventory(), createdAt: previous ? previous.createdAt : Date.now(), owner: true }
  writeRecords([record, ...records.filter(m => m.id !== record.id)])
  if (!previous) wx.setStorageSync('xingyu.nextPetNo.v1', next + 1)
  return record.id
}
export async function deleteMemorial(id: string): Promise<void> {
  if (isCloud) return call<void>('delete', { id })
  const records = localRecords()
  if (!records.some(m => m.id === id && m.owner)) throw new Error('无法删除这份纪念')
  writeRecords(records.filter(m => m.id !== id))
  wx.setStorageSync(NOTES, ((wx.getStorageSync(NOTES) || []) as Note[]).filter(n => n.memorialId !== id))
  const cabinet = await getCabinet()
  wx.setStorageSync(CABINET, { ...cabinet, placements: cabinet.placements.filter(p => p.memorialId !== id) })
}
export async function setPetStatus(id: string, status: 'alive' | 'departed'): Promise<void> {
  if(!['alive','departed'].includes(status))throw new Error('请选择现存或已故状态')
  if(isCloud)return call<void>('petStatus',{id,status})
  const records=localRecords(),pet=records.find(p=>p.id===id&&p.owner&&!p.demo)
  if(!pet)throw new Error('只能修改自己登记的宠物状态')
  writeRecords(records.map(p=>p.id===id?{...p,...petStatusPatch(p,status)}:p))
}
export async function setPetPrivacy(id: string, patch: PetPrivacyPatch): Promise<void> {
  const error=validatePetPrivacyPatch(patch)
  if(error)throw new Error(error)
  if(isCloud)return call<void>('petPrivacy',{id,patch})
  const records=localRecords(),pet=records.find(p=>p.id===id&&p.owner&&!p.demo)
  if(!pet)throw new Error('只能设置自己登记的宠物隐私')
  writeRecords(records.map(p=>p.id===id?{...p,...patch}:p))
}
export async function getPetOrder(): Promise<string[]> {
  return isCloud?call<string[]>('petOrder'):wx.getStorageSync(PET_ORDER)||[]
}
export async function savePetOrder(order: string[]): Promise<void> {
  const error=validatePetOrder(order)
  if(error)throw new Error(error)
  if(isCloud)return call<void>('petOrderSave',{order})
  const pets=localRecords()
  if(order.some(id=>!pets.some(p=>p.id===id&&p.owner&&!p.demo)))throw new Error('只能调整自己登记的宠物顺序')
  wx.setStorageSync(PET_ORDER,[...order])
}
export async function sendFlower(id: string): Promise<number> {
  return (await sendGift(id, 'flower')).flowers
}
export async function getProfile(): Promise<Profile> {
  return isCloud ? call<Profile>('login') : { ...(wx.getStorageSync(PROFILE) || { nickName: '星屿的守护者', avatarUrl: '' }), id: 'local-guardian' }
}
export async function saveProfile(profile: Profile): Promise<void> {
  if (!profile.nickName.trim() || profile.nickName.length > 20) throw new Error('昵称需要 1～20 个字')
  if (isCloud) return call<void>('profile', { profile })
  wx.setStorageSync(PROFILE, profile)
}
export async function persistPhoto(path: string): Promise<string> {
  if (isCloud) {
    const { userId } = await call<{ userId: string }>('identity')
    const result = await wx.cloud.uploadFile({ cloudPath: `memories/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`, filePath: path })
    return result.fileID
  }
  const result = await wx.saveFile({ tempFilePath: path })
  return result.savedFilePath
}
export async function getCabinet(): Promise<Cabinet> {
  return isCloud ? call<Cabinet>('cabinet') : wx.getStorageSync(CABINET) || emptyCabinet()
}
export async function saveCabinet(cabinet: Cabinet): Promise<void> {
  if (isCloud) return call<void>('cabinetSave', { cabinet })
  wx.setStorageSync(CABINET, cabinet)
}
const collaborationUnavailable = '当前是本机体验，跨设备邀请需要先启用微信云开发账户；App 端暂未接入共享账户。'
function requireCollaboration(): void { if(!isCloud)throw new Error(collaborationUnavailable) }
export async function getNotebook(memorialId: string, bookId = '', preview = false): Promise<NotebookInfo> {
  if(isCloud){
    const info=await call<NotebookInfo>('notebook',{memorialId,bookId,preview})
    if(preview&&info.privacy!=='public')throw new Error('这本笔记仅对主人和受邀好友可见，普通访客无法查看')
    return preview?{...info,isOwner:false,canWrite:false}:info
  }
  if(bookId)throw new Error(collaborationUnavailable)
  const pet=memorialId===OVERVIEW_NOTEBOOK?null:await getMemorial(memorialId)
  if(pet?.notebookEnabled===false)throw new Error('这只宠物尚未开启笔记本，请在档案编辑中开启')
  const isOwner=!preview&&(!pet||pet.owner&&!pet.demo)
  if(pet&&!isOwner&&pet.notebookPrivacy!=='public')throw new Error('这本笔记需要主人邀请后才能查看')
  const profile=await getProfile()
  const cover=pet?{id:pet.id,name:pet.name,species:pet.species,no:pet.no,avatarEmoji:pet.avatarEmoji,photos:pet.photos.slice(0,1),photoUrls:pet.photoUrls?.slice(0,1)}:null
  const settings=notebookSettings()[memorialId]||{}
  const privacy=pet?pet.notebookPrivacy||'private':settings.privacy||'private'
  if(preview&&privacy!=='public')throw new Error('这本笔记仅对主人和受邀好友可见，普通访客无法查看')
  return {bookId:'',memorialId,title:pet?pet.name+'的时光笔记':'全体伙伴 · 总览记事本',ownerName:isOwner||preview?profile.nickName:'宠物守护者',isOwner,canWrite:isOwner,privacy,tags:settings.tags||[],memberCount:0,pet:cover}
}
export async function setNotebookPrivacy(memorialId: string, privacy: Privacy, bookId = ''): Promise<void> {
  if(!['public','private'].includes(privacy))throw new Error('笔记可见范围不正确')
  if(isCloud)return call<void>('notebookPrivacy',{memorialId,bookId,privacy})
  const info=await getNotebook(memorialId,bookId)
  if(!info.isOwner)throw new Error('只有主人可以设置笔记本')
  if(memorialId===OVERVIEW_NOTEBOOK){const settings=notebookSettings();settings[memorialId]={...settings[memorialId],privacy};wx.setStorageSync(NOTEBOOK_SETTINGS,settings)}
  else writeRecords(localRecords().map(p=>p.id===memorialId?{...p,notebookPrivacy:privacy}:p))
}
export async function addNotebookTag(memorialId: string, name: string, bookId = ''): Promise<NotebookTag[]> {
  const error=validateTagName(name)
  if(error)throw new Error(error)
  if(isCloud)return call<NotebookTag[]>('notebookTagAdd',{memorialId,bookId,name:name.trim()})
  const info=await getNotebook(memorialId,bookId)
  if(!info.isOwner)throw new Error('只有主人可以管理标签')
  const settings=notebookSettings(),current=settings[memorialId]||{},tags=current.tags||[]
  if(tags.some(t=>t.name===name.trim()))throw new Error('这个标签已经存在')
  if(tags.length>=30)throw new Error('每本笔记最多 30 个标签')
  const updated=[...tags,{id:requestId(),name:name.trim()}]
  settings[memorialId]={...current,tags:updated};wx.setStorageSync(NOTEBOOK_SETTINGS,settings);return updated
}
export async function deleteNotebookTag(memorialId: string, tagId: string, bookId = ''): Promise<NotebookTag[]> {
  if(typeof tagId!=='string'||!/^[\w-]{1,100}$/.test(tagId))throw new Error('标签编号不正确')
  if(isCloud)return call<NotebookTag[]>('notebookTagDelete',{memorialId,bookId,tagId})
  const info=await getNotebook(memorialId,bookId)
  if(!info.isOwner)throw new Error('只有主人可以管理标签')
  const settings=notebookSettings(),current=settings[memorialId]||{},tags=(current.tags||[]).filter(t=>t.id!==tagId)
  settings[memorialId]={...current,tags};wx.setStorageSync(NOTEBOOK_SETTINGS,settings);return tags
}
export async function listSharedNotebooks(): Promise<SharedNotebook[]> {
  if(!isCloud)return []
  const items:SharedNotebook[]=[]
  let offset:number|null=0
  do{const page:{items:SharedNotebook[];nextOffset:number|null}=await call('sharedNotebooks',{offset});items.push(...page.items);offset=page.nextOffset}while(offset!==null)
  return items
}
export async function getNotebookSharing(memorialId:string,bookId=''):Promise<NotebookSharing>{requireCollaboration();return call('notebookSharing',{memorialId,bookId})}
export async function inviteNotebook(memorialId:string,bookId=''):Promise<NotebookSharing>{requireCollaboration();return call('notebookInvite',{memorialId,bookId})}
export async function previewNotebookInvite(code:string):Promise<NotebookInvitation>{requireCollaboration();return call('notebookInvitePreview',{code:code.trim()})}
export async function joinNotebook(code:string):Promise<{bookId:string;memorialId:string}>{requireCollaboration();return call('notebookJoin',{code:code.trim()})}
export async function revokeNotebookInvite(memorialId:string,bookId=''):Promise<void>{requireCollaboration();return call('notebookInviteRevoke',{memorialId,bookId})}
export async function removeNotebookMember(memorialId:string,memberId:string,bookId=''):Promise<void>{requireCollaboration();return call('notebookMemberRemove',{memorialId,memberId,bookId})}
export async function listNotes(memorialId: string, bookId = '', preview = false): Promise<Note[]> {
  if (isCloud) {
    if(preview)await getNotebook(memorialId,bookId,true)
    const notes: Note[] = []
    let page: Note[]
    do { page = await call<Note[]>('notes', { memorialId, bookId, preview, offset: notes.length }); notes.push(...page) } while (page.length === 100)
    return preview?notes.map(note=>({...note,canEdit:false,canDelete:false})):notes
  }
  if(bookId)throw new Error(collaborationUnavailable)
  const info=await getNotebook(memorialId,'',preview)
  return ((wx.getStorageSync(NOTES) || []) as Note[]).filter(n => n.memorialId === memorialId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).map(n=>({...n,tagIds:(n.tagIds||[]).filter(id=>info.tags.some(t=>t.id===id)),authorName:info.isOwner?'我':'笔记本主人',canEdit:info.canWrite,canDelete:info.isOwner}))
}
export async function saveNote(memorialId: string, input: NoteInput, id = '', bookId = ''): Promise<string> {
  const error = validateNote(input)
  if (error) throw new Error(error)
  if (isCloud) return call<string>('noteSave', { memorialId, bookId, input, id })
  if(bookId)throw new Error(collaborationUnavailable)
  const info=await getNotebook(memorialId)
  if(!info.canWrite)throw new Error('笔记仅主人或已邀请的共写好友可以编辑')
  const notes = (wx.getStorageSync(NOTES) || []) as Note[], previous = notes.find(n => n.id === id && n.memorialId === memorialId)
  if (id && !previous) throw new Error('这篇笔记不存在')
  const tagIds=input.tagIds===undefined?(previous?.tagIds||[]).filter(id=>info.tags.some(t=>t.id===id)):input.tagIds
  if(tagIds.some(id=>!info.tags.some(t=>t.id===id)))throw new Error('部分标签已被删除，请重新选择标签')
  const note: Note = { ...input, tagIds, id: previous ? previous.id : `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, memorialId, createdAt: previous ? previous.createdAt : Date.now(), updatedAt: Date.now() }
  wx.setStorageSync(NOTES, [note, ...notes.filter(n => n.id !== note.id)])
  return note.id
}
export async function deleteNote(memorialId: string, id: string, bookId = ''): Promise<void> {
  if (isCloud) return call<void>('noteDelete', { memorialId, bookId, id })
  if(bookId)throw new Error(collaborationUnavailable)
  const notes = await listNotes(memorialId)
  if (!notes.some(n => n.id === id&&n.canDelete)) throw new Error('这篇笔记不存在，或你没有删除权限')
  wx.setStorageSync(NOTES, ((wx.getStorageSync(NOTES) || []) as Note[]).filter(n => n.id !== id))
}
export async function getWallet(): Promise<Wallet> { return isCloud ? call<Wallet>('wallet') : economy().wallet }
export async function claimDaily(): Promise<Wallet> {
  if (isCloud) return call<Wallet>('claimDaily')
  const state = economy(),wallet=applyCheckIn(state.wallet)
  if(state.wallet.claimedOn!==wallet.claimedOn||state.wallet.rewardVersion!==wallet.rewardVersion)wx.setStorageSync(ECONOMY,{...state,wallet})
  state.wallet=wallet
  return state.wallet
}
export async function sendGift(petId: string, kind: ItemKind, key = requestId()): Promise<GiftResult> {
  if (isCloud) return call<GiftResult>('gift', { id: petId, kind, requestId: key })
  const raw = localRecords().find(m => m.id === petId) || DEMOS.find(m => m.id === petId)
  if (!raw) throw new Error('没有找到这位伙伴')
  if (!canGive(raw, kind)) throw new Error('这份礼物不适合它，请重新选择')
  const state = economy(), receipt = state.receipts.find(r => r.id === key)
  if (receipt && (receipt.petId !== petId || receipt.kind !== kind)) throw new Error('赠礼请求不一致，请重新打开礼物盒')
  if (!receipt) {
    if (!Number.isSafeInteger(state.wallet.balances[kind]) || state.wallet.balances[kind] < 1) throw new Error('这件物品用完了，先看看签到奖励吧')
    const count=state.gifts[petId]?.[kind]??0
    if(!Number.isSafeInteger(count)||count<0||count>=Number.MAX_SAFE_INTEGER)throw new Error('礼物计数异常，请稍后重试')
    state.wallet.balances[kind]--
    state.gifts[petId] = {...emptyInventory(),...state.gifts[petId]}
    state.gifts[petId][kind]=count+1; state.receipts.push({ id: key, petId, kind })
    wx.setStorageSync(ECONOMY, state)
  }
  const pet = decorate(raw)
  return { wallet: state.wallet, gifts: {...emptyInventory(),...pet.gifts},flowers: pet.flowers }
}
export async function getPublicProfile(user: string, preview = false): Promise<PublicProfile> {
  if (isCloud) {
    const result=await call<PublicProfile>('publicProfile', { user, preview })
    return preview?{...result,isOwner:false,pets:result.pets.filter(p=>p.privacy==='public').map(p=>({...p,owner:false}))}:result
  }
  if (user === 'local-guardian') {
    const profile = await getProfile()
    const pets=localRecords().filter(p=>!preview||p.privacy==='public').map(p=>decorate(preview?{...p,owner:false}:p))
    const garden=(await getGardenPrivacy())==='public'?buildPublicGarden(wx.getStorageSync(GARDEN)||emptyGarden(),localRecords()):null
    return { profile: { id: user, nickName: profile.nickName, avatarUrl: profile.avatarUrl }, pets, isOwner: !preview, garden }
  }
  if (user === 'demo-garden') return { profile: { id: user, nickName: '星屿花园', avatarUrl: '' }, pets: DEMOS.filter(m => m.privacy === 'public').map(decorate), isOwner: false }
  throw new Error('这个主页暂时无法访问')
}
export async function listGuestbook(user: string, offset = 0, preview = false): Promise<GuestbookPage> {
  if(!Number.isInteger(offset)||offset<0||offset>100000)throw new Error('留言分页参数不正确')
  if(isCloud){
    const page=await call<GuestbookPage>('guestbookList',{user,offset,preview})
    return preview?{...page,isOwner:false,messages:page.messages.map(m=>({...m,canDelete:false}))}:page
  }
  await getPublicProfile(user)
  const profile=await getProfile(),messages=((wx.getStorageSync(GUESTBOOK)||[]) as LocalMessage[]).filter(m=>m.user===user).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).slice(offset,offset+GUESTBOOK_PAGE_SIZE)
  return {isOwner:!preview&&user==='local-guardian',messages:messages.map(m=>({id:m.id,content:m.content,createdAt:m.createdAt,author:m.author.id==='local-guardian'?{id:'local-guardian',nickName:profile.nickName,avatarUrl:profile.avatarUrl}:m.author,canDelete:!preview&&(user==='local-guardian'||m.author.id==='local-guardian')})),nextOffset:messages.length===GUESTBOOK_PAGE_SIZE?offset+messages.length:null}
}
export async function postGuestbookMessage(user: string, content: string, key = requestId()): Promise<string> {
  const error=validateGuestbookContent(content)
  if(error)throw new Error(error)
  if(typeof key!=='string'||!/^[\w-]{1,64}$/.test(key))throw new Error('留言请求编号不正确')
  if(isCloud)return call<string>('guestbookPost',{user,content:content.trim(),requestId:key})
  await getPublicProfile(user)
  const profile=await getProfile()
  const messages=(wx.getStorageSync(GUESTBOOK)||[]) as LocalMessage[],id='message-'+key,previous=messages.find(m=>m.id===id)
  if(previous){if(previous.user!==user||previous.content!==content.trim())throw new Error('留言请求不一致，请重新发布');return id}
  wx.setStorageSync(GUESTBOOK,[{id,user,content:content.trim(),createdAt:Date.now(),author:{id:'local-guardian',nickName:profile.nickName,avatarUrl:profile.avatarUrl}},...messages])
  return id
}
export async function deleteGuestbookMessage(user: string, id: string): Promise<void> {
  if(isCloud)return call<void>('guestbookDelete',{user,id})
  await getPublicProfile(user)
  const messages=(wx.getStorageSync(GUESTBOOK)||[]) as LocalMessage[],message=messages.find(m=>m.id===id&&m.user===user)
  if(!message||user!=='local-guardian'&&message.author.id!=='local-guardian')throw new Error('只能删除自己的留言或自己主页上的留言')
  wx.setStorageSync(GUESTBOOK,messages.filter(m=>m.id!==id))
}
export function showError(error: unknown): string {
  const message = error instanceof Error ? error.message : '操作未完成，请检查网络后重试'
  wx.showToast({ title: message, icon: 'none', duration: 3000 })
  return message
}

export async function getGarden(): Promise<Garden> {
  const garden = isCloud ? await call<Garden>('garden') : wx.getStorageSync(GARDEN) || emptyGarden()
  return normalizeGarden(garden,await listMemorials(true))
}
export async function getGardenPrivacy(): Promise<Privacy> {
  return isCloud?call<Privacy>('gardenPrivacy'):wx.getStorageSync(GARDEN_PRIVACY)==='public'?'public':'private'
}
export async function setGardenPrivacy(privacy: Privacy): Promise<void> {
  if(!['public','private'].includes(privacy))throw new Error('家园可见范围不正确')
  if(isCloud)return call<void>('gardenPrivacySave',{privacy})
  wx.setStorageSync(GARDEN_PRIVACY,privacy)
}
export async function saveGarden(garden: Garden): Promise<void> {
  const error = validateGarden(garden)
  if (error) throw new Error(error)
  if (isCloud) return call<void>('gardenSave',{garden})
  const records = localRecords()
  for (const p of garden.pets) if (!records.some(m => m.id === p.petId && m.owner && !m.demo && m.lifeStatus === 'alive')) throw new Error('活动草坪只能放置你自己仍在陪伴的伙伴')
  for (const id of garden.memorials) if (!records.some(m => m.id === id && m.owner && !m.demo && m.lifeStatus !== 'alive')) throw new Error('纪念花园只能安放你自己的离世伙伴')
  wx.setStorageSync(GARDEN,{ pets: garden.pets.map(p => ({...p})), memorials: [...garden.memorials] })
}
