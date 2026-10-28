const assert=require('node:assert/strict')
exports.local=async function({store,storage,privacy,domain,id,noteInput}){
  const keys=['xingyu.memorials.v1','xingyu.notes.v1','xingyu.notebookSettings.v1'],saved=keys.map(k=>structuredClone(storage.get(k)))
  try{
    const original=await store.getMemorial(id),raw=structuredClone(storage.get('xingyu.memorials.v1').find(p=>p.id===id))
    for(const invalid of [null,[],{}, {privacy:'secret'},{privacy:undefined},{notebookEnabled:'false'},{notebookEnabled:null},{notebookPrivacy:'everyone'},{privacy:'public',story:'不应修改'},{owner:true}]){
      assert.ok(privacy.validatePetPrivacyPatch(invalid));assert.throws(()=>domain.cleanPetPrivacyPatch(invalid));await assert.rejects(store.setPetPrivacy(id,invalid))
    }
    await store.setPetPrivacy(id,{privacy:'private',notebookEnabled:false,notebookPrivacy:'public'})
    const hidden=await store.getMemorial(id)
    assert.equal(hidden.privacy,'private');assert.equal(hidden.notebookEnabled,false);assert.equal(hidden.notebookPrivacy,'public')
    for(const key of Object.keys(raw).filter(k=>!['privacy','notebookEnabled','notebookPrivacy'].includes(k)))assert.deepEqual(storage.get('xingyu.memorials.v1').find(p=>p.id===id)[key],raw[key],key)
    await assert.rejects(store.listNotes(id),/未开启/)
    const beforeNotes=structuredClone(storage.get('xingyu.notes.v1'))
    await store.setPetPrivacy(id,{notebookEnabled:true});assert.equal((await store.getNotebook(id)).privacy,'public');assert.deepEqual(storage.get('xingyu.notes.v1'),beforeNotes)
    const stale={...original,name:'只改资料不改隐私',privacy:'public',notebookEnabled:false,notebookPrivacy:'private'}
    await store.saveMemorial(stale,id,'edit-from-archive',true)
    const after=await store.getMemorial(id);assert.equal(after.name,stale.name);assert.equal(after.privacy,'private');assert.equal(after.notebookEnabled,true);assert.equal(after.notebookPrivacy,'public')
    assert.equal(after.no,original.no);assert.deepEqual(after.photos,original.photos);assert.deepEqual(after.gifts,original.gifts)
    const foreign=id+'-foreign';storage.get('xingyu.memorials.v1').push({...raw,id:foreign,owner:false,no:'900010'})
    await assert.rejects(store.setPetPrivacy(foreign,{privacy:'public'}),/自己/);await assert.rejects(store.setPetPrivacy('demo-tuantuan',{privacy:'public'}),/自己/)
    assert.ok(await store.saveNote(id,noteInput))
  }finally{keys.forEach((key,i)=>saved[i]===undefined?storage.delete(key):storage.set(key,saved[i]))}
}
exports.cloud=async function({call,table,clone,id}){
  const original=clone(table('memorials').get(id)),allNotes=clone([...table('notes')]),sharing=clone([...table('notebookShares')])
  const ok=async(who,event)=>{const result=await call(who,event);assert.equal(result.ok,true,result.error);return result.data}
  try{
    const previous=clone(table('memorials').get(id))
    for(const patch of [{privacy:'private'},{notebookEnabled:false},{notebookPrivacy:'public'}])await ok('owner-a',{action:'petPrivacy',id,patch})
    const after=table('memorials').get(id);assert.equal(after.privacy,'private');assert.equal(after.notebookEnabled,false);assert.equal(after.notebookPrivacy,'public')
    for(const key of Object.keys(previous).filter(k=>!['privacy','notebookEnabled','notebookPrivacy'].includes(k)))assert.deepEqual(after[key],previous[key],key)
    assert.equal((await call('owner-a',{action:'notebook',memorialId:id})).ok,false)
    await ok('owner-a',{action:'petPrivacy',id,patch:{notebookEnabled:true}})
    assert.equal((await ok('owner-a',{action:'notebook',memorialId:id})).privacy,'public')
    const stale={...original,name:'编辑资料保留集中隐私',privacy:'public',notebookEnabled:false,notebookPrivacy:'private'}
    await Promise.all([ok('owner-a',{action:'petPrivacy',id,patch:{privacy:'private',notebookEnabled:true,notebookPrivacy:'public'}}),ok('owner-a',{action:'save',id,input:stale,preservePrivacy:true})])
    const fresh=table('memorials').get(id);assert.equal(fresh.name,stale.name);assert.equal(fresh.privacy,'private');assert.equal(fresh.notebookEnabled,true);assert.equal(fresh.notebookPrivacy,'public')
    assert.deepEqual(fresh.photos,original.photos);assert.equal(fresh.no,original.no);assert.deepEqual(fresh.gifts,original.gifts)
    for(const user of ['owner-b','owner-c'])assert.equal((await call(user,{action:'petPrivacy',id,patch:{privacy:'public'},_openid:'owner-a'})).ok,false)
    for(const patch of [null,[],{}, {privacy:'secret'},{notebookEnabled:'false'},{notebookPrivacy:null},{privacy:'public',story:'不要修改'}, {_openid:'owner-b'}, {no:'999999'}])assert.equal((await call('owner-a',{action:'petPrivacy',id,patch})).ok,false)
    assert.deepEqual([...table('notes')],allNotes);assert.deepEqual([...table('notebookShares')],sharing)
  }finally{table('memorials').set(id,original)}
  console.log('✓ 云端集中隐私：仅主人修改指定隐私字段，关闭/恢复笔记保留内容和成员；档案编辑与隐私并发保存互不覆盖')
}
