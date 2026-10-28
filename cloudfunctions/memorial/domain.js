'use strict'
const fields = ['name', 'species', 'breed', 'birthday', 'departed', 'epitaph', 'story', 'locationName', 'latitude', 'longitude', 'privacy', 'stone', 'photos', 'lifeStatus', 'hasMemorial', 'avatarEmoji', 'notebookEnabled', 'notebookPrivacy', 'markerPhoto', 'memorialNotebook']
const PET_EMOJIS = ['🐱','🐈','🐈‍⬛','🐶','🐕','🐩','🦮','🐰','🐇','🐦','🐤','🐥','🦜','🦉','🐹','🐭','🐢','🦎','🐠','🐟','🐴','🦔','🐿️','🦊','🐸','🐾']
function cleanInput(input, openid, previous = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('纪念资料格式不正确')
  const m = Object.fromEntries(fields.map(key => [key, input[key]]))
  if(m.markerPhoto===undefined)m.markerPhoto=previous.markerPhoto||''
  if(m.memorialNotebook===undefined)m.memorialNotebook=previous.memorialNotebook!==false
  if(typeof m.memorialNotebook!=='boolean')throw new Error('请选择是否展示墓碑笔记入口')
  if(m.markerPhoto!==''&&!ownFile(m.markerPhoto,openid))throw new Error('标记照片必须来自你自己的上传文件')
  if(m.notebookEnabled===undefined)m.notebookEnabled=previous.notebookEnabled===undefined?true:previous.notebookEnabled
  if(m.notebookPrivacy===undefined)m.notebookPrivacy=previous.notebookPrivacy===undefined?'private':previous.notebookPrivacy
  if(typeof m.notebookEnabled!=='boolean'||!['private','public'].includes(m.notebookPrivacy))throw new Error('笔记本开关或可见范围不正确')
  if (m.avatarEmoji === undefined) m.avatarEmoji=''
  if (typeof m.avatarEmoji!=='string'||m.avatarEmoji&&!PET_EMOJIS.includes(m.avatarEmoji)) throw new Error('请选择内置的动物形象')
  if (m.lifeStatus === undefined) m.lifeStatus = 'departed'
  if (m.hasMemorial === undefined) m.hasMemorial = m.lifeStatus !== 'alive'
  const limits = { name: 20, species: 10, breed: 30, birthday: 10, departed: 10, epitaph: 80, story: 3000, locationName: 60, privacy: 10, stone: 10, lifeStatus: 10 }
  for (const [field, max] of Object.entries(limits)) {
    if (typeof m[field] !== 'string' || m[field].length > max) throw new Error('纪念文字格式或长度不正确')
    m[field] = m[field].trim()
  }
  if (!m.name) throw new Error('宠物名字不能为空')
  if (!['alive', 'departed'].includes(m.lifeStatus) || typeof m.hasMemorial !== 'boolean' || m.lifeStatus === 'alive' && m.hasMemorial) throw new Error('宠物状态和纪念碑设置不正确')
  if (m.hasMemorial && !m.locationName) throw new Error('纪念地点不能为空')
  if (!['猫咪', '狗狗', '兔兔', '鸟儿', '其他'].includes(m.species) || !['public', 'private'].includes(m.privacy) || !['arch', 'star', 'garden', 'heart', 'photo'].includes(m.stone)) throw new Error('请选择有效的类型、样式和可见范围')
  if (m.hasMemorial && (!Number.isFinite(m.latitude) || Math.abs(m.latitude) > 90 || !Number.isFinite(m.longitude) || Math.abs(m.longitude) > 180)) throw new Error('纪念位置不正确')
  if (!m.hasMemorial) { m.latitude = 0; m.longitude = 0; m.locationName = '' }
  if (m.lifeStatus !== 'alive' && !m.departed) throw new Error('请选择离开日期')
  if (m.lifeStatus === 'alive') m.departed = ''
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  for (const date of [m.birthday, m.departed].filter(Boolean)) {
    const parsed = new Date(date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > today) throw new Error('日期无效或晚于今天')
  }
  if (m.lifeStatus !== 'alive' && m.birthday && m.birthday > m.departed) throw new Error('离开日期不能早于出生日期')
  if (!Array.isArray(m.photos) || m.photos.length > 9 || !m.photos.every(photo => ownFile(photo, openid))) throw new Error('照片必须来自你自己的上传文件，最多 9 张')
  if(m.hasMemorial&&m.stone==='photo'&&!m.markerPhoto&&!m.photos[0])throw new Error('仅照片样式需要上传一张宠物照片')
  return m
}
function ownFile(file, openid) { return typeof file === 'string' && file.length < 500 && file.startsWith('cloud://') && file.includes(`/memories/${openid}/`) && !file.includes('..') }
function readable(record, openid) { return Boolean(record && (record.privacy === 'public' || record._openid === openid)) }
function owned(record, openid) { return Boolean(record && record._openid === openid) }
function cleanCabinet(input) {
  if (!input || !['wood', 'glass', 'ivory', 'night'].includes(input.theme) || !Number.isInteger(input.slots) || input.slots < 9 || input.slots > 300 || input.slots % 3 !== 0 || !Array.isArray(input.placements) || input.placements.length > 300) throw new Error('档案柜设置不正确')
  const ids = new Set(), slots = new Set()
  const placements = input.placements.map(p => {
    if (!p || typeof p.memorialId !== 'string' || !/^[\w-]{1,100}$/.test(p.memorialId) || ids.has(p.memorialId) || !Number.isInteger(p.slot) || p.slot < 0 || p.slot >= input.slots || slots.has(p.slot) || !['album', 'orb'].includes(p.style)) throw new Error('每位伙伴只能放在一个空格中，请重新选择位置')
    ids.add(p.memorialId); slots.add(p.slot)
    return { memorialId: p.memorialId, slot: p.slot, style: p.style }
  })
  return { theme: input.theme, slots: input.slots, placements }
}
function cleanNote(input, openid) {
  if (!input || typeof input.title !== 'string' || input.title.length > 60 || typeof input.content !== 'string' || input.content.length > 5000 || typeof input.date !== 'string' || !Array.isArray(input.photos) || input.photos.length > 9 || !input.photos.every(p => ownFile(p, openid))) throw new Error('笔记格式不正确：标题最多 60 字，正文最多 5000 字，照片最多 9 张')
  const title = input.title.trim(), content = input.content.trim(), date = input.date, parsed = new Date(date)
  if (!title && !content && !input.photos.length) throw new Error('请写下一点回忆或添加照片')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)) throw new Error('笔记日期不正确')
  const tagIds=input.tagIds
  if(tagIds!==undefined&&(!Array.isArray(tagIds)||tagIds.length>10||tagIds.some(id=>typeof id!=='string'||!/^[\w-]{1,100}$/.test(id))||new Set(tagIds).size!==tagIds.length))throw new Error('每篇记录最多选择 10 个不同的标签')
  return { title, content, date, photos: input.photos, ...(tagIds===undefined?{}:{tagIds}) }
}
const itemKinds = ['flower','bone','fish','can','eternalCandle','memorialGarden','puppuccino','candle','pawHeart','angelWings','rose','rainbowBridge','heartBalloon']
function emptyWallet() { return { balances: Object.fromEntries(itemKinds.map(kind=>[kind,0])), claimedOn: '', streak:0,rewardVersion:2 } }
function cleanWallet(raw) {
  const claimedOn=raw&&raw.claimedOn||''
  const wallet = raw ? { balances: { ...emptyWallet().balances, ...raw.balances }, claimedOn, streak:raw.streak===undefined?(claimedOn?1:0):raw.streak } : emptyWallet()
  if (!itemKinds.every(kind => Number.isSafeInteger(wallet.balances[kind]) && wallet.balances[kind] >= 0 && wallet.balances[kind] < 1000000000)) throw new Error('物品库存状态异常，请稍后重试')
  if(typeof claimedOn!=='string'||claimedOn&&(!/^\d{4}-\d{2}-\d{2}$/.test(claimedOn)||!Number.isFinite(Date.parse(claimedOn))||new Date(claimedOn).toISOString().slice(0,10)!==claimedOn)||!Number.isSafeInteger(wallet.streak)||wallet.streak<0||Boolean(claimedOn)!==(wallet.streak>0))throw new Error('签到记录异常，请稍后重试')
  wallet.rewardVersion=raw&&raw.rewardVersion!==undefined?raw.rewardVersion:raw?1:2
  if(wallet.rewardVersion!==1&&wallet.rewardVersion!==2)throw new Error('签到奖励版本异常')
  return wallet
}
function applyCheckIn(raw,now=Date.now()) {
  const wallet=cleanWallet(raw),day=chinaDay(now)
  if(wallet.claimedOn>day)throw new Error('当前日期早于上次签到，请检查设备日期')
  const supplement=wallet.claimedOn===day&&wallet.rewardVersion!==2
  if(wallet.claimedOn===day&&!supplement)return wallet
  const streak=supplement?wallet.streak:wallet.claimedOn===chinaDay(now-86400000)?wallet.streak+1:1,weekday=new Date(now+8*3600000).getUTCDay()
  const rewards={...Object.fromEntries(itemKinds.map(kind=>[kind,1])),flower:streak,bone:1+(weekday===3?2:0),fish:1+(weekday===6?2:0),can:1+(weekday===0?1:0)},balances={...wallet.balances}
  if(supplement){for(const kind of itemKinds)rewards[kind]=kind==='flower'?0:1}
  for(const kind of itemKinds)balances[kind]+=rewards[kind]
  return cleanWallet({balances,claimedOn:day,streak,rewardVersion:2})
}
function canGive(pet, kind) {
  if(!itemKinds.includes(kind))return false
  const universal=kind==='pawHeart'||kind==='heartBalloon'
  if(pet.lifeStatus==='alive')return universal||kind==='can'||(kind==='bone'||kind==='puppuccino')&&pet.species==='狗狗'||kind==='fish'&&pet.species==='猫咪'
  return pet.hasMemorial!==false&&(universal||['flower','eternalCandle','memorialGarden','candle','angelWings','rose','rainbowBridge'].includes(kind))
}
function chinaDay(now = Date.now()) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10) }
module.exports = { cleanPetPrivacyPatch, buildPublicGarden, applyCheckIn, cleanPetOrder, petStatusPatch, cleanGarden, cleanInput, ownFile, readable, owned, cleanCabinet, cleanNote, itemKinds, emptyWallet, cleanWallet, canGive, chinaDay }

function cleanPetPrivacyPatch(patch) {
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('隐私设置格式不正确')
  const entries=Object.entries(patch)
  if(!entries.length||entries.some(([key,value])=>!['privacy','notebookEnabled','notebookPrivacy'].includes(key)||(key==='notebookEnabled'?typeof value!=='boolean':value!=='public'&&value!=='private')))throw new Error('只能修改宠物资料和笔记本的可见范围')
  return Object.fromEntries(entries)
}

function buildPublicGarden(raw, records) {
  const visible=records.filter(p=>p.privacy==='public'&&!p.demo),byId=new Map(visible.map(p=>[p.id,p])),ids=new Set(),layout={pets:[],memorials:[]}
  for(const p of raw.pets||[]){
    const pet=p&&byId.get(p.petId)
    if(!pet||ids.has(p.petId)||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue
    ids.add(p.petId)
    if(pet.lifeStatus==='alive')layout.pets.push({petId:p.petId,x:Math.max(9,Math.min(91,p.x)),y:Math.max(54,Math.min(86,p.y))})
    else layout.memorials.push(p.petId)
  }
  for(const id of raw.memorials||[]){const pet=byId.get(id);if(pet&&pet.lifeStatus!=='alive'&&!ids.has(id)){layout.memorials.push(id);ids.add(id)}}
  return {layout,records:visible.filter(p=>ids.has(p.id)).map(p=>({id:p.id,name:p.name,species:p.species,stone:p.stone,markerPhoto:p.markerPhoto||'',markerPhotoUrl:p.markerPhotoUrl||'',lifeStatus:p.lifeStatus||'departed',avatarEmoji:p.avatarEmoji||'',photos:p.photos.slice(0,1),photoUrls:p.photoUrls?.slice(0,1)||[]}))}
}

function cleanPetOrder(order) {
  if(!Array.isArray(order)||order.length>10000||order.some(id=>typeof id!=='string'||!/^[\w-]{1,100}$/.test(id))||new Set(order).size!==order.length)throw new Error('宠物排序不正确，请重新调整')
  return [...order]
}
function petStatusPatch(pet,status) {
  if(!['alive','departed'].includes(status))throw new Error('请选择现存或已故状态')
  if((pet.lifeStatus||'departed')===status)return {}
  return {lifeStatus:status,departed:status==='alive'?'':chinaDay(),hasMemorial:false,latitude:0,longitude:0,locationName:''}
}

function cleanGarden(input) {
  if (!input || !Array.isArray(input.pets) || !Array.isArray(input.memorials) || input.pets.length + input.memorials.length > 300) throw new Error('家园设置不正确')
  const ids = new Set()
  const pets = input.pets.map(p => {
    if (!p || typeof p.petId !== 'string' || !/^[\w-]{1,100}$/.test(p.petId) || ids.has(p.petId) || !Number.isFinite(p.x) || p.x<9 || p.x>91 || !Number.isFinite(p.y) || p.y<54 || p.y>86) throw new Error('请把伙伴放在后院草坪上，每只伙伴只能放置一次')
    ids.add(p.petId); return {petId:p.petId,x:p.x,y:p.y}
  })
  const memorials = input.memorials.map(id => {
    if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id) || ids.has(id)) throw new Error('纪念花园的伙伴不能重复')
    ids.add(id); return id
  })
  return {pets,memorials}
}
