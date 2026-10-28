const assert=require('node:assert/strict')
exports.local=async function({store,storage,gardenModel,domain,id}){
  const keys=['xingyu.memorials.v1','xingyu.garden.v1','xingyu.gardenPrivacy.v1','xingyu.cabinet.v1','xingyu.petOrder.v1'],saved=keys.map(k=>structuredClone(storage.get(k))),base=await store.getMemorial(id)
  const living=id+'-live',hidden=id+'-hidden',unplaced=id+'-unplaced'
  try{
    const records=[{...base,id,privacy:'public',lifeStatus:'departed',owner:true},{...base,id:living,no:'900001',privacy:'public',lifeStatus:'alive',owner:true,photos:['one','two'],story:'完整故事不属于家园接口'},{...base,id:hidden,no:'900002',privacy:'private',lifeStatus:'alive',owner:true},{...base,id:unplaced,no:'900003',privacy:'public',lifeStatus:'alive',owner:true}]
    storage.set('xingyu.memorials.v1',records);storage.delete('xingyu.gardenPrivacy.v1')
    const layout={pets:[{petId:living,x:29,y:70},{petId:hidden,x:79,y:78}],memorials:[id]}
    await store.saveGarden(layout)
    assert.equal(await store.getGardenPrivacy(),'private');assert.equal((await store.getPublicProfile('local-guardian',true)).garden,null)
    await store.setGardenPrivacy('public');assert.equal(await store.getGardenPrivacy(),'public')
    const preview=await store.getPublicProfile('local-guardian',true),garden=preview.garden
    assert.deepEqual(garden.layout,{pets:[{petId:living,x:29,y:70}],memorials:[id]})
    assert.deepEqual(new Set(garden.records.map(p=>p.id)),new Set([id,living]))
    assert.ok(!JSON.stringify(garden).includes(hidden));assert.ok(!JSON.stringify(garden).includes(unplaced))
    assert.equal(garden.records.find(p=>p.id===living).photos.length,1)
    for(const p of garden.records)for(const key of ['owner','ownerId','privacy','story','birthday','locationName','gifts','notebookPrivacy'])assert.equal(p[key],undefined,key)
    assert.deepEqual(gardenModel.buildPublicGarden(layout,records),domain.buildPublicGarden(layout,records))
    assert.deepEqual((await store.getPublicProfile('local-guardian')).garden,garden)
    await store.saveCabinet({theme:'night',slots:9,placements:[]});await store.savePetOrder([living,hidden,id,unplaced]);await store.saveGarden(layout)
    assert.equal(await store.getGardenPrivacy(),'public');assert.deepEqual(await store.getGarden(),layout)
    storage.set('xingyu.memorials.v1',records.map(p=>p.id===living?{...p,privacy:'private'}:p))
    assert.deepEqual((await store.getPublicProfile('local-guardian',true)).garden.layout,{pets:[],memorials:[id]})
    storage.set('xingyu.memorials.v1',records.map(p=>p.id===living?{...p,lifeStatus:'departed'}:p))
    assert.deepEqual((await store.getPublicProfile('local-guardian',true)).garden.layout,{pets:[],memorials:[living,id]})
    storage.set('xingyu.memorials.v1',records.filter(p=>p.id!==living));assert.ok(!(await store.getPublicProfile('local-guardian',true)).garden.records.some(p=>p.id===living))
    await store.setGardenPrivacy('private');assert.equal((await store.getPublicProfile('local-guardian',true)).garden,null)
    assert.deepEqual(storage.get('xingyu.garden.v1'),layout);await assert.rejects(store.setGardenPrivacy('invalid'),/范围/)
  }finally{keys.forEach((key,i)=>saved[i]===undefined?storage.delete(key):storage.set(key,saved[i]))}
}
exports.cloud=async function({call,table,clone,id,stone}){
  const original=clone(table('memorials').get(id)),originalStone=clone(table('memorials').get(stone)),oldCabinet=clone(table('cabinets').get('owner-a')),oldOther=clone(table('cabinets').get('owner-b'))
  const profile=(await call('owner-a',{action:'login'})).data,user=profile.id
  const ok=async(who,event)=>{const r=await call(who,event);assert.equal(r.ok,true,r.error);return JSON.parse(JSON.stringify(r.data))}
  try{
    table('memorials').set(id,{...original,privacy:'public',lifeStatus:'alive',photos:['cloud://env/memories/owner-a/one.jpg','cloud://env/memories/owner-a/two.jpg']})
    table('memorials').set(stone,{...originalStone,privacy:'private',lifeStatus:'departed'})
    const layout={pets:[{petId:id,x:25,y:70}],memorials:[stone]},cabinet={theme:'glass',slots:9,placements:[]}
    table('cabinets').set('owner-a',{...oldCabinet,garden:layout,gardenPrivacy:undefined})
    assert.equal(await ok('owner-a',{action:'gardenPrivacy'}),'private')
    assert.equal((await ok('owner-c',{action:'publicProfile',user})).garden,null)
    await ok('owner-a',{action:'gardenPrivacySave',privacy:'public'})
    const guest=await ok('owner-c',{action:'publicProfile',user}),preview=await ok('owner-a',{action:'publicProfile',user,preview:true})
    assert.deepEqual(guest.garden,preview.garden);assert.deepEqual(guest.garden.layout,{pets:[{petId:id,x:25,y:70}],memorials:[]})
    assert.equal(guest.garden.records.length,1);assert.equal(guest.garden.records[0].photos.length,1)
    for(const key of ['_openid','ownerId','story','gifts','birthday','locationName','privacy','notebookPrivacy'])assert.equal(guest.garden.records[0][key],undefined,key)
    assert.ok(!JSON.stringify(guest.garden).includes(stone))
    await ok('owner-b',{action:'gardenPrivacySave',privacy:'private',user:'owner-a',ownerId:'owner-a'})
    assert.equal(table('cabinets').get('owner-a').gardenPrivacy,'public')
    assert.deepEqual(await ok('owner-b',{action:'garden',user:'owner-a'}),{pets:[],memorials:[]})
    await Promise.all([ok('owner-a',{action:'gardenPrivacySave',privacy:'public'}),ok('owner-a',{action:'gardenSave',garden:layout}),ok('owner-a',{action:'cabinetSave',cabinet}),ok('owner-a',{action:'petOrderSave',order:[id,stone]})])
    const saved=table('cabinets').get('owner-a');assert.equal(saved.gardenPrivacy,'public');assert.deepEqual(saved.garden,layout);assert.deepEqual(saved.petOrder,[id,stone]);assert.equal(saved.theme,'glass')
    assert.equal((await call('owner-a',{action:'gardenPrivacySave',privacy:'bad'})).ok,false)
    table('memorials').set(stone,{...table('memorials').get(stone),privacy:'public'})
    assert.deepEqual((await ok('owner-c',{action:'publicProfile',user})).garden.layout,layout)
    table('memorials').set(id,{...table('memorials').get(id),privacy:'private'})
    assert.deepEqual((await ok('owner-c',{action:'publicProfile',user})).garden.layout,{pets:[],memorials:[stone]})
    table('memorials').set(id,{...table('memorials').get(id),privacy:'public',lifeStatus:'departed'})
    assert.deepEqual((await ok('owner-c',{action:'publicProfile',user})).garden.layout,{pets:[],memorials:[id,stone]})
    await ok('owner-a',{action:'gardenPrivacySave',privacy:'private'})
    assert.equal((await ok('owner-c',{action:'publicProfile',user})).garden,null)
    assert.deepEqual(table('cabinets').get('owner-a').garden,layout)
  }finally{
    table('memorials').set(id,original);table('memorials').set(stone,originalStone)
    for(const [key,value]of [['owner-a',oldCabinet],['owner-b',oldOther]]){if(value)table('cabinets').set(key,value);else table('cabinets').delete(key)}
  }
  console.log('✓ 云端公开家园：默认私密、仅公开伙伴及封面、访客与预览一致、开关按账户隔离，公开性与布局/排序并发保存互不覆盖')
}
