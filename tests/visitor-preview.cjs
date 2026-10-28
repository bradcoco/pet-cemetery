const assert=require('node:assert/strict')
exports.local=async function({store,storage,id}){
  const keys=['xingyu.memorials.v1','xingyu.notebookSettings.v1'],saved=keys.map(k=>structuredClone(storage.get(k))),beforeNotes=structuredClone(storage.get('xingyu.notes.v1')),beforeEconomy=structuredClone(storage.get('xingyu.economy.v1'))
  const patch=values=>storage.set('xingyu.memorials.v1',storage.get('xingyu.memorials.v1').map(p=>p.id===id?{...p,...values}:p))
  try{
    patch({privacy:'private',notebookPrivacy:'private',notebookEnabled:true})
    const owner=await store.getPublicProfile('local-guardian'),preview=await store.getPublicProfile('local-guardian',true)
    assert.equal(owner.isOwner,true);assert.ok(owner.pets.some(p=>p.id===id))
    assert.equal(preview.isOwner,false);assert.ok(preview.pets.every(p=>p.privacy==='public'&&!p.owner));assert.ok(!preview.pets.some(p=>p.id===id));assert.equal(preview.wallet,undefined)
    await assert.rejects(store.getMemorial(id,true),/访客/)
    await assert.rejects(store.getNotebook(id,'',true));await assert.rejects(store.listNotes(id,'',true))
    patch({privacy:'public'})
    assert.equal((await store.getMemorial(id,true)).owner,false);assert.equal((await store.getMemorial(id)).owner,true)
    const publicList=await store.getPublicProfile('local-guardian',true);assert.ok(publicList.pets.some(p=>p.id===id&&!p.owner))
    await assert.rejects(store.getNotebook(id,'',true))
    patch({notebookPrivacy:'public'})
    const book=await store.getNotebook(id,'',true),notes=await store.listNotes(id,'',true)
    assert.equal(book.isOwner,false);assert.equal(book.canWrite,false);assert.ok(notes.length);assert.ok(notes.every(n=>n.canEdit===false&&n.canDelete===false))
    assert.equal((await store.getNotebook(id)).isOwner,true)
    patch({privacy:'private'})
    assert.equal((await store.getNotebook(id,'',true)).canWrite,false)
    assert.ok(!(await store.getPublicProfile('local-guardian',true)).pets.some(p=>p.id===id))
    patch({notebookEnabled:false});await assert.rejects(store.getNotebook(id,'',true),/未开启/)
    await store.setNotebookPrivacy('__overview__','public');assert.equal((await store.getNotebook('__overview__','',true)).isOwner,false)
    await store.setNotebookPrivacy('__overview__','private');await assert.rejects(store.listNotes('__overview__','',true),/访客/)
    assert.deepEqual(storage.get('xingyu.notes.v1'),beforeNotes);assert.deepEqual(storage.get('xingyu.economy.v1'),beforeEconomy)
  }finally{keys.forEach((key,i)=>saved[i]===undefined?storage.delete(key):storage.set(key,saved[i]))}
}
exports.cloud=async function({call,table,clone,id}){
  const original=clone(table('memorials').get(id)),info=(await call('owner-a',{action:'notebook',memorialId:id})).data,bookId=info.bookId,oldShare=clone(table('notebookShares').get(bookId)),notes=clone([...table('notes')]),wallets=clone([...table('wallets')])
  const profile=(await call('owner-a',{action:'login'})).data,user=profile.id
  const patch=values=>table('memorials').set(id,{...table('memorials').get(id),...values})
  try{
    patch({privacy:'private',notebookPrivacy:'private',notebookEnabled:true})
    const preview=(await call('owner-a',{action:'publicProfile',user,preview:true})).data,guest=(await call('owner-c',{action:'publicProfile',user})).data
    assert.equal(preview.isOwner,false);assert.deepEqual(preview.pets,guest.pets);assert.ok(!preview.pets.some(p=>p.id===id));assert.equal(preview.wallet,undefined)
    assert.ok((await call('owner-a',{action:'publicProfile',user})).data.pets.some(p=>p.id===id))
    for(const action of ['get','notebook','notes'])assert.equal((await call('owner-a',{action,id,memorialId:id,preview:true})).ok,false)
    const invite=(await call('owner-a',{action:'notebookInvite',memorialId:id})).data
    assert.ok((await call('owner-b',{action:'notebookJoin',code:invite.code})).ok)
    assert.ok((await call('owner-b',{action:'notebook',bookId})).data.canWrite)
    assert.equal((await call('owner-b',{action:'notebook',bookId,preview:true})).ok,false)
    patch({privacy:'public',notebookPrivacy:'public'})
    const normal=(await call('owner-a',{action:'get',id})).data,detail=(await call('owner-a',{action:'get',id,preview:true})).data
    assert.equal(normal.owner,true);assert.equal(detail.owner,false)
    for(const who of ['owner-a','owner-b','owner-c']){
      const book=(await call(who,{action:'notebook',bookId,preview:true})).data
      assert.equal(book.isOwner,false);assert.equal(book.canWrite,false)
      const rows=(await call(who,{action:'notes',bookId,preview:true})).data
      assert.ok(rows.length);assert.ok(rows.every(n=>n.canEdit===false&&n.canDelete===false));assert.ok(rows.every(n=>n._openid===undefined&&n.authorId===undefined))
    }
    assert.deepEqual((await call('owner-a',{action:'publicProfile',user,preview:true})).data,(await call('owner-c',{action:'publicProfile',user})).data)
    assert.equal((await call('owner-a',{action:'notebook',bookId})).data.isOwner,true)
    assert.deepEqual([...table('notes')],notes);assert.deepEqual([...table('wallets')],wallets)
  }finally{table('memorials').set(id,original);if(oldShare)table('notebookShares').set(bookId,oldShare);else table('notebookShares').delete(bookId)}
  console.log('✓ 云端访客预览与普通访客内容一致；主人/受邀成员均不能预览私密笔记，公开记录只读，库存与记录不变')
}
