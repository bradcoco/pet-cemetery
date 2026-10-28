'use strict'
const cloud = require('wx-server-sdk')
const { createHash, randomBytes } = require('crypto')
const { cleanInput, ownFile, readable, owned, cleanCabinet, cleanGarden, cleanNote, itemKinds, emptyWallet, cleanWallet, canGive, applyCheckIn, cleanPetOrder, petStatusPatch, buildPublicGarden, cleanPetPrivacyPatch } = require('./domain')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database({ throwOnNotFound: false })
const records = db.collection('memorials')
const profiles = db.collection('profiles')
const cabinets = db.collection('cabinets')
const notes = db.collection('notes')
const wallets = db.collection('wallets')
const notebookShares = db.collection('notebookShares')
const guestbook = db.collection('guestbookMessages')
const publicId = openid => createHash('sha256').update(`profile:${openid}`).digest('hex').slice(0, 24)
const deny = () => { throw new Error('这份纪念不存在，或仅对主人可见') }
async function find(collection, id) {
  const result = await collection.where({ _id: id }).limit(1).get()
  return result.data[0]
}
function validId(id) { if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id)) throw new Error('纪念编号不正确'); return id }
async function photoUrls(files) {
  if (!files.length) return []
  const result = await cloud.getTempFileURL({ fileList: files.map(fileID => ({ fileID, maxAge: 600 })) })
  return files.map(file => { const match = result.fileList.find(item => item.fileID === file); return match && match.status === 0 ? match.tempFileURL : '' })
}
async function present(record, openid) {
  const { _id, _openid, ...rest } = record
  return { ...rest,gifts:{...emptyWallet().balances,...(record.gifts||{}),flower:record.flowers||0}, id: _id, ownerId: record.ownerId || publicId(_openid), owner: _openid === openid, markerPhotoUrl:record.markerPhoto?(await photoUrls([record.markerPhoto]))[0]:'', photoUrls: await photoUrls(record.photos || []) }
}
async function ensureProfile(openid) {
  return db.runTransaction(async transaction => {
    const ref = transaction.collection('profiles').doc(openid), existing = (await ref.get()).data
    const profile = { _openid: openid, nickName: '星屿的守护者', avatarUrl: '', ...(existing || {}), publicId: publicId(openid) }
    if (!existing || !existing.publicId) await ref.set({ data: profile })
    return profile
  })
}
async function guestbookProfile(user,openid) {
  validId(user)
  const profile=user===publicId(openid)?await ensureProfile(openid):(await profiles.where({publicId:user}).limit(1).get()).data[0]
  if(!profile)throw new Error('这个主页暂时无法访问')
  return profile
}
const notebookId = (owner, id) => createHash('sha256').update(`notebook:${owner}:${id}`).digest('hex').slice(0,32)
async function notebookDoc(name,id,transaction) {
  return transaction?(await transaction.collection(name).doc(id).get()).data:find(db.collection(name),id)
}
async function notebookScope(event,openid,transaction,allowPublic=false) {
  let owner=openid,memorialId=event.memorialId,share=null,bookId=''
  if(event.bookId){
    bookId=validId(event.bookId);share=await notebookDoc('notebookShares',bookId,transaction)
    if(!share)throw new Error('这本笔记不存在，或共写权限已被移除')
    owner=share.ownerId
    if(memorialId&&memorialId!==share.memorialId)throw new Error('笔记本编号不一致')
    memorialId=share.memorialId
  }
  memorialId=validId(memorialId)
  const pet=memorialId==='__overview__'?null:await notebookDoc('memorials',memorialId,transaction)
  if(!event.bookId&&allowPublic&&pet&&pet.notebookPrivacy==='public')owner=pet._openid
  if(memorialId!=='__overview__'&&!owned(pet,owner))deny()
  if(pet&&pet.notebookEnabled===false)throw new Error('这只宠物尚未开启笔记本，请在档案编辑中开启')
  bookId=bookId||notebookId(owner,memorialId)
  if(!share)share=await notebookDoc('notebookShares',bookId,transaction)
  const isOwner=owner===openid,canWrite=isOwner||Boolean(share&&share.memberIds.includes(openid)),privacy=(pet?pet.notebookPrivacy:share&&share.notebookPrivacy)||'private'
  if(allowPublic&&event.preview===true){
    if(privacy!=='public')throw new Error('这本笔记仅对主人和受邀好友可见，普通访客无法查看')
    return {owner,memorialId,bookId,share,pet,isOwner:false,canWrite:false,privacy}
  }
  if(!canWrite&&!(allowPublic&&privacy==='public'))throw new Error('你尚未加入这本笔记，或共写权限已被移除')
  return {owner,memorialId,bookId,share,pet,isOwner,canWrite,privacy}
}
async function notebookSummary(scope) {
  const owner=await find(profiles,scope.owner)
  return {bookId:scope.bookId,memorialId:scope.memorialId,title:scope.pet?scope.pet.name+'的时光笔记':'全体伙伴 · 总览记事本',ownerName:owner&&owner.nickName||'星屿的守护者',privacy:(scope.pet?scope.pet.notebookPrivacy:scope.share&&scope.share.notebookPrivacy)||'private'}
}
function notebookMetadata(scope) {
  const {_id,...share}=scope.share||{}
  return {ownerId:scope.owner,memorialId:scope.memorialId,memberIds:[],inviteCode:'',expiresAt:0,_openid:scope.owner,...share}
}
async function notebookSharing(scope) {
  const share=scope.share,active=share&&share.expiresAt>Date.now()
  const members=await Promise.all((share&&share.memberIds||[]).map(async id=>{const profile=await find(profiles,id);return{id:publicId(id),name:profile&&profile.nickName||'星屿的守护者'}}))
  return {code:active?share.inviteCode:'',expiresAt:active?share.expiresAt:0,members}
}
async function invitation(code) {
  if(typeof code!=='string'||!/^[a-f0-9]{32}$/.test(code))throw new Error('请输入完整的 32 位邀请码')
  const share=(await notebookShares.where({inviteCode:code}).limit(1).get()).data[0]
  if(!share||share.expiresAt<=Date.now())throw new Error('邀请已过期或已被主人停止，请索取新的邀请码')
  return share
}
async function give(openid, event) {
  const id = validId(event.id), key = validId(event.requestId), kind = event.kind
  if (!itemKinds.includes(kind)) throw new Error('请选择有效的物品')
  const receiptId = createHash('sha256').update(`${openid}:${key}`).digest('hex').slice(0, 32)
  return db.runTransaction(async transaction => {
    const petRef = transaction.collection('memorials').doc(id), pet = (await petRef.get()).data
    if (!readable(pet, openid)) deny()
    if (!canGive(pet, kind)) throw new Error('这份礼物不适合它，请重新选择')
    const walletRef = transaction.collection('wallets').doc(openid), wallet = cleanWallet((await walletRef.get()).data)
    const receiptRef = transaction.collection('giftEvents').doc(receiptId), previous = (await receiptRef.get()).data
    const gifts = { ...emptyWallet().balances, ...(pet.gifts || {}), flower: pet.flowers || 0 }
    if (previous) {
      if (previous.petId !== id || previous.kind !== kind) throw new Error('赠礼请求不一致，请重新打开礼物盒')
      return { wallet, gifts, flowers: gifts.flower }
    }
    if (wallet.balances[kind] < 1) throw new Error('这件物品用完了，先看看签到奖励吧')
    if (!Number.isSafeInteger(gifts[kind]) || gifts[kind] < 0 || gifts[kind] >= Number.MAX_SAFE_INTEGER) throw new Error('礼物计数异常，请稍后重试')
    wallet.balances[kind]--; gifts[kind]++
    await walletRef.set({ data: { ...wallet, _openid: openid } })
    await petRef.update({ data: { gifts, flowers: gifts.flower } })
    await receiptRef.set({ data: { _openid: openid, petId: id, kind, createdAt: Date.now() } })
    return { wallet, gifts, flowers: gifts.flower }
  })
}
exports.main = async (event) => {
  try {
    const { OPENID: openid } = cloud.getWXContext()
    if (!openid) throw new Error('请在微信中登录后访问')
    switch (event.action) {
      case 'identity': return { ok: true, data: { userId: openid } }
      case 'login': {
        const profile = await ensureProfile(openid)
        const data = { id: profile.publicId, nickName: profile.nickName, avatarUrl: profile.avatarUrl, avatarFile: profile.avatarUrl }
        if (data.avatarUrl) data.avatarUrl = (await photoUrls([data.avatarUrl]))[0]
        return { ok: true, data }
      }
      case 'profile': {
        const p = event.profile
        if (!p || typeof p.nickName !== 'string' || !p.nickName.trim() || p.nickName.length > 20 || (p.avatarUrl !== '' && !ownFile(p.avatarUrl, openid))) throw new Error('昵称或头像格式不正确，请重新选择头像后保存')
        await profiles.doc(openid).set({ data: { _openid: openid, publicId: publicId(openid), nickName: p.nickName.trim(), avatarUrl: p.avatarUrl } })
        return { ok: true, data: null }
      }
      case 'publicProfile': {
        const user = validId(event.user), self = user === publicId(openid), own = self && event.preview!==true
        const query = await profiles.where({ publicId: user }).limit(1).get(), profile = self ? await ensureProfile(openid) : query.data[0]
        if (!profile) throw new Error('这个主页暂时无法访问')
        const pets = []
        let page
        do {
          const where = own ? { _openid: openid } : { _openid: profile._openid, privacy: 'public' }
          page = (await records.where(where).orderBy('createdAt', 'desc').skip(pets.length).limit(100).get()).data
          pets.push(...page)
        } while (page.length === 100)
        const avatar = profile.avatarUrl ? (await photoUrls([profile.avatarUrl]))[0] : ''
        const visiblePets=await Promise.all(pets.map(p => present(p, event.preview===true?'':openid))),cabinet=await find(cabinets,profile._openid)
        const garden=cabinet&&cabinet.gardenPrivacy==='public'?buildPublicGarden(cabinet.garden||{pets:[],memorials:[]},visiblePets):null
        return { ok: true, data: { profile: { id: user, nickName: profile.nickName, avatarUrl: avatar }, isOwner: own, pets: visiblePets, garden } }
      }
      case 'guestbookList': {
        await guestbookProfile(event.user,openid)
        const offset=event.offset===undefined?0:event.offset
        if(!Number.isInteger(offset)||offset<0||offset>100000)throw new Error('留言分页参数不正确')
        const page=(await guestbook.where({user:event.user}).orderBy('createdAt','desc').orderBy('_id','desc').skip(offset).limit(10).get()).data
        const messages=await Promise.all(page.map(async message=>{
          const author=await find(profiles,message._openid),avatar=author&&author.avatarUrl?(await photoUrls([author.avatarUrl]))[0]:''
          return {id:message._id,content:message.content,createdAt:message.createdAt,author:{id:publicId(message._openid),nickName:author&&author.nickName||'星屿的守护者',avatarUrl:avatar},canDelete:event.preview!==true&&(message._openid===openid||event.user===publicId(openid))}
        }))
        return {ok:true,data:{messages,nextOffset:page.length===10?offset+page.length:null,isOwner:event.preview!==true&&event.user===publicId(openid)}}
      }
      case 'guestbookPost': {
        if(event.preview===true)throw new Error('访客预览不能发布留言')
        if(typeof event.content!=='string'||!event.content.trim()||event.content.trim().length>300)throw new Error('留言需要 1～300 个字')
        const key=validId(event.requestId)
        if(key.length>64)throw new Error('留言请求编号不正确')
        await guestbookProfile(event.user,openid);await ensureProfile(openid)
        const content=event.content.trim(),id=createHash('sha256').update(`guestbook:${openid}:${key}`).digest('hex').slice(0,32)
        await db.runTransaction(async transaction=>{
          const ref=transaction.collection('guestbookMessages').doc(id),previous=(await ref.get()).data
          if(previous){if(previous.user!==event.user||previous.content!==content)throw new Error('留言请求不一致，请重新发布');return}
          await ref.set({data:{user:event.user,content,createdAt:Date.now(),_openid:openid}})
        })
        return {ok:true,data:id}
      }
      case 'guestbookDelete': {
        if(event.preview===true)throw new Error('访客预览不能删除留言')
        await guestbookProfile(event.user,openid)
        const id=validId(event.id)
        await db.runTransaction(async transaction=>{
          const ref=transaction.collection('guestbookMessages').doc(id),message=(await ref.get()).data
          if(!message||message.user!==event.user||message._openid!==openid&&event.user!==publicId(openid))throw new Error('只能删除自己的留言或自己主页上的留言')
          await ref.remove()
        })
        return {ok:true,data:null}
      }
      case 'wallet': return { ok: true, data: cleanWallet(await find(wallets, openid)) }
      case 'claimDaily': {
        const wallet = await db.runTransaction(async transaction => {
          const ref = transaction.collection('wallets').doc(openid), current = cleanWallet((await ref.get()).data),next=applyCheckIn(current)
          if(current.claimedOn!==next.claimedOn||current.rewardVersion!==next.rewardVersion)await ref.set({data:{...next,_openid:openid}})
          return next
        })
        return { ok: true, data: wallet }
      }
      case 'gift': return { ok: true, data: await give(openid, event) }
      case 'petStatus': {
        const id=validId(event.id)
        await db.runTransaction(async transaction=>{
          const ref=transaction.collection('memorials').doc(id),pet=(await ref.get()).data
          if(!owned(pet,openid))deny()
          await ref.update({data:{...petStatusPatch(pet,event.status),updatedAt:Date.now()}})
        })
        return {ok:true,data:null}
      }
      case 'petPrivacy': {
        const id=validId(event.id),patch=cleanPetPrivacyPatch(event.patch)
        await db.runTransaction(async transaction=>{
          const ref=transaction.collection('memorials').doc(id),pet=(await ref.get()).data
          if(!owned(pet,openid))throw new Error('只能设置自己登记的宠物隐私')
          await ref.update({data:patch})
        })
        return {ok:true,data:null}
      }
      case 'petOrder': {
        const cabinet=await find(cabinets,openid)
        return {ok:true,data:cabinet&&cabinet.petOrder||[]}
      }
      case 'petOrderSave': {
        const order=cleanPetOrder(event.order)
        for(let i=0;i<order.length;i+=10){
          const batch=order.slice(i,i+10),result=await records.where({_openid:openid,_id:db.command.in(batch)}).field({_id:true}).limit(10).get()
          if(result.data.length!==batch.length)throw new Error('只能调整自己登记的宠物顺序')
        }
        await db.runTransaction(async transaction=>{
          const ref=transaction.collection('cabinets').doc(openid),previous=(await ref.get()).data
          if(previous)await ref.update({data:{petOrder:order}})
          else await ref.set({data:{theme:'wood',slots:9,placements:[],petOrder:order,_openid:openid}})
        })
        return {ok:true,data:null}
      }
      case 'cabinet': {
        const cabinet = await find(cabinets, openid)
        return { ok: true, data: cabinet ? { theme: cabinet.theme, slots: cabinet.slots, placements: cabinet.placements } : { theme: 'wood', slots: 9, placements: [] } }
      }
      case 'cabinetSave': {
        const cabinet = cleanCabinet(event.cabinet), ids = cabinet.placements.map(p => p.memorialId)
        for (let i = 0; i < ids.length; i += 10) {
          const batch = ids.slice(i, i + 10)
          const result = await records.where({ _openid: openid, _id: db.command.in(batch) }).field({ _id: true }).limit(10).get()
          if (result.data.length !== batch.length) throw new Error('档案柜只能收纳你自己的宠物档案')
        }
        await db.runTransaction(async transaction => {
          const ref = transaction.collection('cabinets').doc(openid), previous = (await ref.get()).data
          await ref.set({ data: { ...cabinet, ...(previous && previous.garden ? {garden:previous.garden} : {}), gardenPrivacy:previous&&previous.gardenPrivacy||'private', petOrder:previous&&previous.petOrder||[], _openid: openid } })
        })
        return { ok: true, data: null }
      }
      case 'garden': {
        const cabinet = await find(cabinets,openid)
        return {ok:true,data:cabinet && cabinet.garden || {pets:[],memorials:[]}}
      }
      case 'gardenPrivacy': {
        const cabinet=await find(cabinets,openid)
        return {ok:true,data:cabinet&&cabinet.gardenPrivacy==='public'?'public':'private'}
      }
      case 'gardenPrivacySave': {
        if(!['public','private'].includes(event.privacy))throw new Error('家园可见范围不正确')
        await db.runTransaction(async transaction=>{
          const ref=transaction.collection('cabinets').doc(openid),previous=(await ref.get()).data
          if(previous)await ref.update({data:{gardenPrivacy:event.privacy}})
          else await ref.set({data:{theme:'wood',slots:9,placements:[],gardenPrivacy:event.privacy,_openid:openid}})
        })
        return {ok:true,data:null}
      }
      case 'gardenSave': {
        const garden = cleanGarden(event.garden), ids = [...garden.pets.map(p=>p.petId),...garden.memorials], ownedPets = []
        for (let i=0;i<ids.length;i+=10) {
          const batch=ids.slice(i,i+10), result=await records.where({_openid:openid,_id:db.command.in(batch)}).limit(10).get()
          if(result.data.length!==batch.length) throw new Error('家园只能放置你自己的伙伴')
          ownedPets.push(...result.data)
        }
        if(garden.pets.some(p=>!ownedPets.some(m=>m._id===p.petId&&m.lifeStatus==='alive')) || garden.memorials.some(id=>!ownedPets.some(m=>m._id===id&&m.lifeStatus!=='alive'))) throw new Error('请按伙伴当前状态选择活动草坪或纪念花园')
        await db.runTransaction(async transaction=>{
          const ref=transaction.collection('cabinets').doc(openid), previous=(await ref.get()).data
          await ref.set({data:{...cleanCabinet(previous||{theme:'wood',slots:9,placements:[]}),petOrder:previous&&previous.petOrder||[],gardenPrivacy:previous&&previous.gardenPrivacy||'private',garden,_openid:openid}})
        })
        return {ok:true,data:null}
      }
      case 'notebook': {
        const scope=await notebookScope(event,openid,undefined,true),pet=scope.pet
        const cover=pet?{id:pet._id,name:pet.name,species:pet.species,no:pet.no||'',avatarEmoji:pet.avatarEmoji||'',photos:(pet.photos||[]).slice(0,1),photoUrls:await photoUrls((pet.photos||[]).slice(0,1))}:null
        return {ok:true,data:{...await notebookSummary(scope),isOwner:scope.isOwner,canWrite:scope.canWrite,tags:scope.share&&scope.share.tags||[],memberCount:scope.share?scope.share.memberIds.length:0,pet:cover}}
      }
      case 'notebookPrivacy': {
        if(!['public','private'].includes(event.privacy))throw new Error('笔记可见范围不正确')
        await db.runTransaction(async transaction=>{
          const scope=await notebookScope(event,openid,transaction)
          if(!scope.isOwner)throw new Error('只有主人可以设置笔记本')
          if(scope.pet)await transaction.collection('memorials').doc(scope.memorialId).update({data:{notebookPrivacy:event.privacy}})
          else await transaction.collection('notebookShares').doc(scope.bookId).set({data:{...notebookMetadata(scope),notebookPrivacy:event.privacy}})
        })
        return {ok:true,data:null}
      }
      case 'notebookTagAdd':
      case 'notebookTagDelete': {
        const tags=await db.runTransaction(async transaction=>{
          const scope=await notebookScope(event,openid,transaction)
          if(!scope.isOwner)throw new Error('只有主人可以管理标签')
          const tags=scope.share&&scope.share.tags||[]
          let updated
          if(event.action==='notebookTagAdd'){
            if(typeof event.name!=='string'||!event.name.trim()||event.name.trim().length>20)throw new Error('标签名称需要 1～20 个字')
            const name=event.name.trim()
            if(tags.some(tag=>tag.name===name))throw new Error('这个标签已经存在')
            if(tags.length>=30)throw new Error('每本笔记最多 30 个标签')
            updated=[...tags,{id:'tag-'+randomBytes(12).toString('hex'),name}]
          }else{const tagId=validId(event.tagId);updated=tags.filter(tag=>tag.id!==tagId)}
          await transaction.collection('notebookShares').doc(scope.bookId).set({data:{...notebookMetadata(scope),tags:updated}})
          return updated
        })
        return {ok:true,data:tags}
      }
      case 'sharedNotebooks': {
        const offset=event.offset||0
        if(!Number.isInteger(offset)||offset<0||offset>100000)throw new Error('分页参数不正确')
        const page=(await notebookShares.where({memberIds:db.command.all([openid])}).orderBy('_id','asc').skip(offset).limit(100).get()).data,items=[]
        for(const share of page){
          const pet=share.memorialId==='__overview__'?null:await find(records,share.memorialId)
          if(share.memorialId!=='__overview__'&&(!owned(pet,share.ownerId)||pet.notebookEnabled===false))continue
          items.push(await notebookSummary({owner:share.ownerId,memorialId:share.memorialId,bookId:share._id,pet,share}))
        }
        return {ok:true,data:{items,nextOffset:page.length===100?offset+100:null}}
      }
      case 'notebookSharing': {
        const scope=await notebookScope(event,openid)
        if(!scope.isOwner)throw new Error('只有主人可以管理共写成员')
        return {ok:true,data:await notebookSharing(scope)}
      }
      case 'notebookInvite': {
        const scope=await db.runTransaction(async transaction=>{
          const scope=await notebookScope(event,openid,transaction)
          if(!scope.isOwner)throw new Error('只有主人可以邀请共写好友')
          const share=scope.share
          if(!share||!share.inviteCode||share.expiresAt<=Date.now()){
            const data={...notebookMetadata(scope),inviteCode:randomBytes(16).toString('hex'),expiresAt:Date.now()+7*86400000}
            await transaction.collection('notebookShares').doc(scope.bookId).set({data})
            scope.share=data
          }
          return scope
        })
        return {ok:true,data:await notebookSharing(scope)}
      }
      case 'notebookInvitePreview': {
        const share=await invitation(event.code),pet=share.memorialId==='__overview__'?null:await find(records,share.memorialId)
        if(share.memorialId!=='__overview__'&&!owned(pet,share.ownerId))deny()
        if(pet&&pet.notebookEnabled===false)throw new Error('主人已关闭这只宠物的笔记本')
        const summary=await notebookSummary({owner:share.ownerId,memorialId:share.memorialId,bookId:share._id,pet})
        return {ok:true,data:{title:summary.title,ownerName:summary.ownerName,expiresAt:share.expiresAt}}
      }
      case 'notebookJoin': {
        const invite=await invitation(event.code)
        await ensureProfile(openid)
        const result=await db.runTransaction(async transaction=>{
          const ref=transaction.collection('notebookShares').doc(invite._id),share=(await ref.get()).data
          if(!share||share.inviteCode!==event.code||share.expiresAt<=Date.now())throw new Error('邀请已过期或已被停止')
          const pet=share.memorialId==='__overview__'?null:await notebookDoc('memorials',share.memorialId,transaction)
          if(share.memorialId!=='__overview__'&&!owned(pet,share.ownerId))deny()
          if(pet&&pet.notebookEnabled===false)throw new Error('主人已关闭这只宠物的笔记本')
          if(share.ownerId!==openid&&!share.memberIds.includes(openid)){
            if(share.memberIds.length>=20)throw new Error('这本笔记已有 20 位共写好友，请联系主人整理成员')
            await ref.update({data:{memberIds:[...share.memberIds,openid]}})
          }
          return {bookId:invite._id,memorialId:share.memorialId}
        })
        return {ok:true,data:result}
      }
      case 'notebookInviteRevoke':
      case 'notebookMemberRemove': {
        await db.runTransaction(async transaction=>{
          const scope=await notebookScope(event,openid,transaction)
          if(!scope.isOwner)throw new Error('只有主人可以管理共写权限')
          if(!scope.share)return
          const ref=transaction.collection('notebookShares').doc(scope.bookId)
          if(event.action==='notebookInviteRevoke')await ref.update({data:{inviteCode:'',expiresAt:0}})
          else{
            const memberId=validId(event.memberId)
            await ref.update({data:{memberIds:scope.share.memberIds.filter(id=>publicId(id)!==memberId)}})
          }
        })
        return {ok:true,data:null}
      }
      case 'notes': {
        const scope=await notebookScope(event,openid,undefined,true),offset=event.offset||0
        if(!Number.isInteger(offset)||offset<0||offset>100000)throw new Error('分页参数不正确')
        const result=await notes.where({memorialId:scope.memorialId,_openid:scope.owner}).orderBy('date','desc').orderBy('createdAt','desc').skip(offset).limit(100).get()
        const data=await Promise.all(result.data.map(async note=>{
          const {_id,_openid,authorId,...rest}=note,author=authorId||_openid
          return {...rest,tagIds:(note.tagIds||[]).filter(id=>(scope.share&&scope.share.tags||[]).some(tag=>tag.id===id)),id:_id,authorName:note.authorName||'笔记本主人',canEdit:scope.canWrite&&author===openid,canDelete:scope.isOwner||scope.canWrite&&author===openid,photoUrls:await photoUrls(note.photos)}
        }))
        return {ok:true,data}
      }
      case 'noteSave': {
        const input=cleanNote(event.input,openid),id=event.id?validId(event.id):'note-'+randomBytes(12).toString('hex')
        await db.runTransaction(async transaction=>{
          const scope=await notebookScope(event,openid,transaction),ref=transaction.collection('notes').doc(id),previous=event.id?(await ref.get()).data:null
          if(event.id&&(!previous||previous._openid!==scope.owner||previous.memorialId!==scope.memorialId||(previous.authorId||previous._openid)!==openid))throw new Error('只能编辑自己在这本笔记中写下的记录')
          const tags=scope.share&&scope.share.tags||[],tagIds=input.tagIds===undefined?(previous&&previous.tagIds||[]).filter(id=>tags.some(tag=>tag.id===id)):input.tagIds
          if(tagIds.some(id=>!tags.some(tag=>tag.id===id)))throw new Error('部分标签已被删除，请重新选择标签')
          const profile=await notebookDoc('profiles',openid,transaction)
          const data={...input,tagIds,updatedAt:Date.now(),authorName:profile&&profile.nickName||'星屿的守护者'}
          if(previous)await ref.update({data})
          else await ref.set({data:{...data,memorialId:scope.memorialId,_openid:scope.owner,authorId:openid,createdAt:Date.now()}})
        })
        return {ok:true,data:id}
      }
      case 'noteDelete': {
        const id=validId(event.id)
        await db.runTransaction(async transaction=>{
          const scope=await notebookScope(event,openid,transaction),ref=transaction.collection('notes').doc(id),previous=(await ref.get()).data
          if(!previous||previous._openid!==scope.owner||previous.memorialId!==scope.memorialId||!scope.isOwner&&(previous.authorId||previous._openid)!==openid)throw new Error('你无权删除这篇记录')
          await ref.remove()
        })
        return {ok:true,data:null}
      }
      case 'list': {
        const offset = event.offset || 0
        if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new Error('分页参数不正确')
        const where = event.mine === true ? { _openid: openid } : db.command.or([{ privacy: 'public' }, { _openid: openid }])
        const result = await records.where(where).orderBy('createdAt', 'desc').orderBy('_id', 'desc').skip(offset).limit(100).get()
        // 列表只签封面，完整相册在权限检查后的详情接口签名。
        const data = await Promise.all(result.data.map(async record => {
          const { _id, _openid, ...rest } = record
          return { ...rest,gifts:{...emptyWallet().balances,...(record.gifts||{}),flower:record.flowers||0}, story: '', photos: record.photos.slice(0, 1), markerPhotoUrl:record.markerPhoto?(await photoUrls([record.markerPhoto]))[0]:'', photoUrls: await photoUrls(record.photos.slice(0, 1)), id: _id, ownerId: record.ownerId || publicId(_openid), owner: _openid === openid }
        }))
        return { ok: true, data }
      }
      case 'get': {
        const record = await find(records, validId(event.id))
        if (!readable(record, openid)) deny()
        if(event.preview===true&&record.privacy!=='public')deny()
        return { ok: true, data: await present(record, event.preview===true?'':openid) }
      }
      case 'save': {
        if (event.id) {
          const id = validId(event.id), record = await find(records, id)
          if (!owned(record, openid)) deny()
          const source=event.preservePrivacy===true?{...event.input,privacy:record.privacy,notebookEnabled:record.notebookEnabled!==false,notebookPrivacy:record.notebookPrivacy||'private'}:event.input
          const input=cleanInput(source,openid,record),{privacy,notebookEnabled,notebookPrivacy,...details}=input
          await records.doc(id).update({ data: { ...(event.preservePrivacy===true?details:input), updatedAt: Date.now() } })
          return { ok: true, data: id }
        }
        const input=cleanInput(event.input,openid)
        const creationKey = validId(event.creationKey), id = createHash('sha256').update(`pet:${openid}:${creationKey}`).digest('hex').slice(0, 32)
        await ensureProfile(openid)
        await db.runTransaction(async transaction => {
          const ref = transaction.collection('memorials').doc(id), previous = (await ref.get()).data
          if (previous) { if (!owned(previous, openid)) deny(); return }
          const counterRef = transaction.collection('counters').doc('pet-sequence'), counter = (await counterRef.get()).data, next = counter ? counter.next : 0
          if (!Number.isSafeInteger(next) || next < 0 || next > 999999) throw new Error('六位宠物编号已用完，请联系管理员')
          await counterRef.set({ data: { next: next + 1 } })
          await ref.set({ data: { ...input, _openid: openid, ownerId: publicId(openid), no: String(next).padStart(6, '0'), flowers: 0, gifts: emptyWallet().balances, createdAt: Date.now(), updatedAt: Date.now() } })
        })
        return { ok: true, data: id }
      }
      case 'delete': {
        const id = validId(event.id), record = await find(records, id)
        if (!owned(record, openid)) deny()
        await records.doc(id).remove()
        return { ok: true, data: null }
      }
      default: throw new Error('不支持的操作')
    }
  } catch (error) {
    console.error('memorial action failed', event && event.action, error)
    const safe = error instanceof Error && !/database|collection|document|cloud|errCode|permission/i.test(error.message)
    return { ok: false, error: safe ? error.message : '服务暂时不可用，请稍后重试或检查云端配置' }
  }
}
