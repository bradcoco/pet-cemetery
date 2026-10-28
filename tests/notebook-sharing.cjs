const assert=require('node:assert/strict')
module.exports=async function({call,table,clone,first,privatePet}){
  const note={title:'好友的一页',content:'今天替你陪它晒太阳。',date:'2025-01-01',photos:['cloud://env/memories/owner-b/friend.jpg']}
  await call('owner-b',{action:'profile',profile:{nickName:'共写好友',avatarUrl:''}})
  const legacy={_id:'legacy-private-note',_openid:'owner-a',memorialId:privatePet,title:'邀请前的旧记录',content:'旧笔记不迁移也不丢失',date:'2025-01-01',photos:[],createdAt:1,updatedAt:1}
  table('notes').set(legacy._id,clone(legacy))
  const ownerInfo=(await call('owner-a',{action:'notebook',memorialId:privatePet})).data,bookId=ownerInfo.bookId
  assert.equal((await call('owner-b',{action:'notebook',bookId})).ok,false)
  assert.equal((await call('owner-b',{action:'notebookInvite',memorialId:privatePet})).ok,false)
  const sharing=(await call('owner-a',{action:'notebookInvite',memorialId:privatePet})).data
  assert.match(sharing.code,/^[a-f0-9]{32}$/);assert.equal(sharing.members.length,0);assert.ok(sharing.expiresAt>Date.now()+6*86400000)
  assert.equal((await call('owner-a',{action:'notebookInvite',memorialId:privatePet})).data.code,sharing.code)
  const preview=(await call('owner-b',{action:'notebookInvitePreview',code:sharing.code})).data
  assert.ok(preview.title);assert.equal(preview.pet,undefined);assert.equal(preview.bookId,undefined)
  assert.equal((await call('owner-b',{action:'notes',memorialId:privatePet,bookId})).ok,false)
  assert.equal((await call('owner-b',{action:'notebookJoin',code:'bad'})).ok,false)
  const joins=await Promise.all(Array.from({length:5},()=>call('owner-b',{action:'notebookJoin',code:sharing.code})))
  assert.ok(joins.every(r=>r.ok));assert.ok(joins.every(r=>r.data.bookId===bookId))
  assert.equal(table('notebookShares').get(bookId).memberIds.length,1)
  const memberInfo=(await call('owner-b',{action:'notebook',bookId})).data
  assert.equal(memberInfo.isOwner,false);assert.equal(memberInfo.memberCount,1);assert.equal(memberInfo.pet.story,undefined);assert.equal(memberInfo.pet.latitude,undefined)
  assert.equal((await call('owner-b',{action:'get',id:privatePet})).ok,false)
  assert.equal((await call('owner-b',{action:'notes',memorialId:first,bookId})).ok,false)
  assert.equal((await call('owner-b',{action:'noteSave',memorialId:privatePet,input:note})).ok,false)
  const memberNote=(await call('owner-b',{action:'noteSave',memorialId:privatePet,bookId,input:{...note,authorId:'owner-a',_openid:'attacker'}})).data
  assert.ok(memberNote);assert.equal(table('notes').get(memberNote)._openid,'owner-a');assert.equal(table('notes').get(memberNote).authorId,'owner-b')
  const ownerNotes=(await call('owner-a',{action:'notes',memorialId:privatePet})).data,memberNotes=(await call('owner-b',{action:'notes',memorialId:privatePet,bookId})).data
  assert.equal(ownerNotes.length,2);assert.equal(memberNotes.length,2)
  const ownView=ownerNotes.find(n=>n.id===memberNote),friendView=memberNotes.find(n=>n.id===memberNote),oldView=memberNotes.find(n=>n.id===legacy._id)
  assert.equal(ownView.authorName,'共写好友');assert.equal(ownView.canEdit,false);assert.equal(ownView.canDelete,true)
  assert.equal(friendView.canEdit,true);assert.equal(friendView.canDelete,true);assert.equal(friendView.authorId,undefined);assert.equal(friendView._openid,undefined)
  assert.equal(oldView.canEdit,false);assert.equal(oldView.canDelete,false)
  assert.equal((await call('owner-b',{action:'noteSave',memorialId:privatePet,bookId,id:legacy._id,input:note})).ok,false)
  assert.equal((await call('owner-b',{action:'noteDelete',memorialId:privatePet,bookId,id:legacy._id})).ok,false)
  assert.equal((await call('owner-b',{action:'noteSave',memorialId:privatePet,bookId,id:memberNote,input:{...note,content:'补写自己的记录'}})).ok,true)
  assert.equal((await call('owner-a',{action:'noteSave',memorialId:privatePet,id:memberNote,input:{...note,photos:[]}})).ok,false)
  assert.equal((await call('owner-b',{action:'noteSave',memorialId:privatePet,bookId,input:{...note,photos:['cloud://env/memories/owner-a/stolen.jpg']}})).ok,false)
  assert.equal((await call('owner-b',{action:'notebookInvite',bookId})).ok,false)
  assert.equal((await call('owner-b',{action:'notebookSharing',bookId})).ok,false)
  assert.equal((await call('owner-b',{action:'notebookInviteRevoke',bookId})).ok,false)
  const sharedList=(await call('owner-b',{action:'sharedNotebooks',offset:0})).data
  assert.equal(sharedList.items.length,1);assert.equal(sharedList.items[0].bookId,bookId);assert.equal(sharedList.items[0].inviteCode,undefined)
  const ownerSharing=(await call('owner-a',{action:'notebookSharing',memorialId:privatePet})).data
  assert.equal(ownerSharing.members.length,1);assert.equal(ownerSharing.members[0].name,'共写好友');assert.notEqual(ownerSharing.members[0].id,'owner-b')
  assert.equal((await call('owner-b',{action:'notebookMemberRemove',bookId,memberId:ownerSharing.members[0].id})).ok,false)
  assert.equal((await call('owner-a',{action:'notebookInviteRevoke',memorialId:privatePet})).ok,true)
  assert.equal((await call('owner-c',{action:'notebookJoin',code:sharing.code})).ok,false)
  assert.equal((await call('owner-b',{action:'notes',memorialId:privatePet,bookId})).ok,true)
  assert.equal((await call('owner-a',{action:'notebookMemberRemove',memorialId:privatePet,memberId:ownerSharing.members[0].id})).ok,true)
  for(const action of ['notebook','notes','noteSave','noteDelete'])assert.equal((await call('owner-b',{action,memorialId:privatePet,bookId,id:memberNote,input:note})).ok,false)
  assert.equal((await call('owner-b',{action:'sharedNotebooks'})).data.items.length,0)
  assert.equal(table('notes').get(memberNote).content,'补写自己的记录')
  assert.equal((await call('owner-a',{action:'noteDelete',memorialId:privatePet,id:memberNote})).ok,true)
  const fresh=(await call('owner-a',{action:'notebookInvite',memorialId:privatePet})).data
  assert.notEqual(fresh.code,sharing.code)
  const oldNow=Date.now
  try{Date.now=()=>oldNow()+8*86400000;assert.equal((await call('owner-b',{action:'notebookJoin',code:fresh.code})).ok,false)}finally{Date.now=oldNow}
  console.log('✓ 共写邀请：私密单宠授权、重复加入幂等、过期/撤销、移除成员即拒绝读写，保留旧笔记与作者记录')
  const groupInvite=(await call('owner-a',{action:'notebookInvite',memorialId:'__overview__'})).data
  const groupJoin=(await call('owner-b',{action:'notebookJoin',code:groupInvite.code})).data
  const groupShare=table('notebookShares').get(groupJoin.bookId),members=clone(groupShare.memberIds)
  groupShare.memberIds=['owner-b',...Array.from({length:19},(_,i)=>'full-member-'+i)]
  assert.equal((await call('owner-c',{action:'notebookJoin',code:groupInvite.code})).ok,false)
  table('notebookShares').get(groupJoin.bookId).memberIds=members
  const aGroup=(await call('owner-a',{action:'notes',memorialId:'__overview__'})).data.length
  const bGroup=(await call('owner-b',{action:'notes',memorialId:'__overview__'})).data.length
  const friendGroup=(await call('owner-b',{action:'noteSave',memorialId:'__overview__',bookId:groupJoin.bookId,input:{...note,photos:[]}})).data
  assert.ok(friendGroup)
  assert.equal((await call('owner-a',{action:'notes',memorialId:'__overview__'})).data.length,aGroup+1)
  assert.equal((await call('owner-b',{action:'notes',memorialId:'__overview__'})).data.length,bGroup)
  assert.equal((await call('owner-c',{action:'notes',memorialId:'__overview__',bookId:groupJoin.bookId,_openid:'owner-a'})).ok,false)
  assert.equal((await call('owner-a',{action:'noteDelete',memorialId:'__overview__',id:friendGroup})).ok,true)
  await call('owner-a',{action:'delete',id:privatePet})
  assert.equal((await call('owner-a',{action:'notebook',memorialId:privatePet})).ok,false)
  assert.equal((await call('owner-b',{action:'notebookJoin',code:fresh.code})).ok,false)
  assert.equal((await call('owner-b',{action:'notebookInvitePreview',code:fresh.code})).ok,false)
  console.log('✓ 总览本的共写记录不会混入好友自己的总览本；非成员、伪造作者和其他私密档案保持隔离')
}
