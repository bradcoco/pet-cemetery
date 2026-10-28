const assert=require('node:assert/strict')
exports.local=async function({store,storage,model,domain,id,noteInput}){
  const saved=structuredClone(storage.get('xingyu.memorials.v1')),pet=await store.getMemorial(id),notes=await store.listNotes(id)
  try{
    for(const invalid of [{notebookEnabled:'false'},{notebookEnabled:null},{notebookPrivacy:'secret'},{notebookPrivacy:null}]){assert.ok(model.validateMemorial({...pet,...invalid}));assert.throws(()=>domain.cleanInput({...pet,...invalid},'owner'))}
    assert.equal(domain.cleanInput({...pet,notebookEnabled:undefined,notebookPrivacy:undefined},'owner').notebookPrivacy,'private')
    await store.saveMemorial({...pet,notebookEnabled:false,notebookPrivacy:'private'},id)
    assert.equal((await store.getMemorial(id)).notebookEnabled,false)
    for(const operation of [()=>store.getNotebook(id),()=>store.listNotes(id),()=>store.saveNote(id,noteInput),()=>store.deleteNote(id,notes[0].id)])await assert.rejects(operation,/未开启笔记本/)
    const {notebookEnabled,notebookPrivacy,...legacy}=pet
    await store.saveMemorial(legacy,id);assert.equal((await store.getMemorial(id)).notebookEnabled,false)
    await store.saveMemorial({...pet,notebookEnabled:true,notebookPrivacy:'public',privacy:'private'},id)
    const info=await store.getNotebook(id);assert.equal(info.privacy,'public');assert.equal(info.canWrite,true)
    storage.set('xingyu.memorials.v1',storage.get('xingyu.memorials.v1').map(p=>p.id===id?{...p,owner:false}:p))
    const guest=await store.getNotebook(id);assert.equal(guest.canWrite,false);assert.equal(guest.isOwner,false)
    const visible=await store.listNotes(id);assert.equal(visible.length,notes.length);assert.ok(visible.every(n=>!n.canEdit&&!n.canDelete))
    await assert.rejects(store.saveNote(id,noteInput),/主人/);await assert.rejects(store.deleteNote(id,notes[0].id),/权限/)
    storage.set('xingyu.memorials.v1',storage.get('xingyu.memorials.v1').map(p=>p.id===id?{...p,notebookPrivacy:'private'}:p))
    await assert.rejects(store.getNotebook(id),/邀请/)
  }finally{storage.set('xingyu.memorials.v1',saved)}
  assert.deepEqual(await store.listNotes(id),notes)
}
exports.cloud=async function({call,table,clone,id}){
  const original=clone(table('memorials').get(id)),info=(await call('owner-a',{action:'notebook',memorialId:id})).data,bookId=info.bookId,oldShare=clone(table('notebookShares').get(bookId)),created=[]
  const originalNotes=clone([...table('notes').values()].filter(n=>n.memorialId===id&&n._openid==='owner-a'))
  const input={title:'访客不能写',content:'公开阅读和共同编辑分别授权',date:'2025-01-01',photos:[]}
  const save=patch=>call('owner-a',{action:'save',id,input:{...original,...patch}})
  try{
    assert.equal(info.privacy,'private');assert.equal(info.canWrite,true)
    assert.equal((await save({notebookEnabled:false})).ok,true)
    for(const action of ['notebook','notes','noteSave','noteDelete'])assert.equal((await call('owner-a',{action,memorialId:id,input,id:originalNotes[0]._id})).ok,false)
    const {notebookEnabled,notebookPrivacy,...legacy}=original
    assert.equal((await call('owner-a',{action:'save',id,input:legacy})).ok,true);assert.equal(table('memorials').get(id).notebookEnabled,false)
    assert.equal((await save({notebookEnabled:true,notebookPrivacy:'public',privacy:'private'})).ok,true)
    const publicView=(await call('owner-b',{action:'notebook',memorialId:id})).data
    assert.equal(publicView.isOwner,false);assert.equal(publicView.canWrite,false);assert.equal(publicView.privacy,'public');assert.equal(publicView.pet.story,undefined);assert.equal(publicView.pet.latitude,undefined)
    assert.equal((await call('owner-b',{action:'get',id})).ok,false)
    const publicNotes=(await call('owner-b',{action:'notes',memorialId:id})).data
    assert.equal(publicNotes.length,originalNotes.length);assert.ok(publicNotes.every(n=>!n.canEdit&&!n.canDelete&&n._openid===undefined&&n.authorId===undefined))
    const invitation=(await call('owner-a',{action:'notebookInvite',memorialId:id})).data
    for(const action of ['noteSave','noteDelete'])assert.equal((await call('owner-b',{action,memorialId:id,bookId,input,id:originalNotes[0]._id})).ok,false)
    assert.equal((await call('owner-b',{action:'noteSave',memorialId:id,bookId,input})).ok,false)
    assert.equal((await call('owner-b',{action:'notebookJoin',code:invitation.code})).ok,true)
    assert.equal((await call('owner-b',{action:'notebook',bookId})).data.canWrite,true)
    const friend=(await call('owner-b',{action:'noteSave',memorialId:id,bookId,input})).data
    assert.ok(friend);created.push(friend)
    const members=(await call('owner-a',{action:'notebookSharing',memorialId:id})).data.members
    await call('owner-a',{action:'notebookMemberRemove',memorialId:id,memberId:members.find(m=>m.id).id})
    assert.equal((await call('owner-b',{action:'notebook',bookId})).data.canWrite,false)
    const removed=(await call('owner-b',{action:'notes',memorialId:id,bookId})).data.find(n=>n.id===friend)
    assert.equal(removed.canEdit,false);assert.equal(removed.canDelete,false)
    for(const action of ['noteSave','noteDelete'])assert.equal((await call('owner-b',{action,memorialId:id,bookId,input,id:friend})).ok,false)
    assert.equal((await save({notebookEnabled:true,notebookPrivacy:'private'})).ok,true)
    for(const user of ['owner-b','owner-c'])for(const action of ['notebook','notes'])assert.equal((await call(user,{action,memorialId:id,bookId})).ok,false)
    await call('owner-b',{action:'notebookJoin',code:invitation.code})
    assert.equal((await call('owner-b',{action:'notes',memorialId:id,bookId})).ok,true)
    assert.equal((await save({notebookEnabled:false,notebookPrivacy:'public'})).ok,true)
    for(const user of ['owner-a','owner-b','owner-c'])for(const action of ['notebook','notes','noteSave'])assert.equal((await call(user,{action,memorialId:id,bookId,input})).ok,false)
    assert.equal((await call('owner-b',{action:'notebookInvitePreview',code:invitation.code})).ok,false)
    assert.equal((await call('owner-b',{action:'notebookJoin',code:invitation.code})).ok,false)
    assert.ok(!(await call('owner-b',{action:'sharedNotebooks'})).data.items.some(b=>b.bookId===bookId))
    assert.equal((await save({notebookEnabled:true,notebookPrivacy:'private'})).ok,true)
    const restored=(await call('owner-b',{action:'notes',memorialId:id,bookId})).data
    assert.equal(restored.length,originalNotes.length+1);assert.ok(restored.find(n=>n.id===friend).canEdit)
    for(const invalid of [{notebookEnabled:'yes'},{notebookPrivacy:'secret'}])assert.equal((await save(invalid)).ok,false)
  }finally{
    table('memorials').set(id,original)
    if(oldShare)table('notebookShares').set(bookId,oldShare);else table('notebookShares').delete(bookId)
    for(const noteId of created)table('notes').delete(noteId)
  }
  console.log('✓ 笔记本开关与独立隐私：关闭阻止所有读写且保留记录，公开访客只读，转私密立即拒绝非成员，移除的作者也不能再编辑自己的公开记录')
}
