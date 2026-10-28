const assert=require('node:assert/strict')
exports.catalog=function({items,domain,input}){
 assert.equal(items.ITEMS.length,13);assert.equal(new Set(items.ITEMS.map(i=>i.points)).size,13)
 assert.ok(items.ITEMS.every(i=>Number.isSafeInteger(i.points)&&i.points>0&&i.icon&&i.name))
 assert.deepEqual(items.ITEMS.map(i=>i.id),domain.itemKinds)
 assert.equal(items.inventoryValue({bone:2,rose:3}),115)
 const variants=[{...input,lifeStatus:'alive',species:'狗狗',hasMemorial:false},{...input,lifeStatus:'alive',species:'猫咪',hasMemorial:false},{...input,lifeStatus:'alive',species:'兔兔',hasMemorial:false},{...input,lifeStatus:'departed',hasMemorial:true},{...input,lifeStatus:'departed',hasMemorial:false}]
 for(const pet of variants)for(const item of items.ITEMS)assert.equal(items.canGive(pet,item.id),domain.canGive(pet,item.id),pet.lifeStatus+pet.species+item.id)
 for(const pet of variants){assert.equal(items.canGive(pet,'unknown'),false);assert.equal(domain.canGive(pet,'unknown'),false)}
 assert.equal(items.receivedItems({rose:2}).length,1);assert.equal(items.receivedItems({rose:2})[0].count,2)
 assert.deepEqual(items.cleanWallet(),domain.cleanWallet())
}
exports.local=async function({items,store,storage,id}){
 const keys=['xingyu.memorials.v1','xingyu.economy.v1'],saved=keys.map(k=>structuredClone(storage.get(k))),now=Date.now
 try{
  const pet=await store.getMemorial(id),dog={...pet,id:id+'-gift-dog',no:'900099',lifeStatus:'alive',hasMemorial:false,species:'狗狗'}
  storage.set(keys[0],[{...pet,lifeStatus:'departed',hasMemorial:true,privacy:'public'},dog]);storage.set(keys[1],{wallet:{...items.emptyWallet(),balances:{flower:7,bone:0,fish:0,can:0},claimedOn:'2026-10-28',streak:4,rewardVersion:1},gifts:{[id]:{flower:2,bone:0,fish:0,can:0}},receipts:[]})
  Date.now=()=>Date.parse('2026-10-28T04:00:00Z')
  const wallet=await store.claimDaily();assert.equal(wallet.balances.flower,7);assert.equal(wallet.streak,4);assert.equal(wallet.balances.eternalCandle,1)
  const before=structuredClone(await store.getWallet())
  await assert.rejects(store.sendGift(dog.id,'angelWings','wrong-target'),/不适合/)
  assert.deepEqual(await store.getWallet(),before)
  for(const item of items.ITEMS.filter(i=>!['flower','bone','fish','can'].includes(i.id))){
   const target=items.canGive(dog,item.id)?dog.id:id,key='new-item-'+item.id
   const result=await store.sendGift(target,item.id,key);assert.equal(result.wallet.balances[item.id],0);assert.equal(result.gifts[item.id],1)
   const repeat=await store.sendGift(target,item.id,key);assert.deepEqual(repeat,result)
   await assert.rejects(store.sendGift(target,item.id,key+'-second'),/用完/)
  }
  const petAfter=await store.getMemorial(id);assert.equal(petAfter.no,pet.no);assert.ok(Object.values(petAfter.gifts).every(Number.isFinite));assert.equal(petAfter.flowers,pet.flowers+2)
 }finally{Date.now=now;keys.forEach((k,i)=>saved[i]===undefined?storage.delete(k):storage.set(k,saved[i]))}
}
exports.cloud=async function({call,table,clone,id}){
 const original=clone(table('memorials').get(id)),now=Date.now,who='catalog-user'
 try{
  Date.now=()=>Date.parse('2026-10-28T04:00:00Z')
  table('wallets').set(who,{_openid:who,balances:{flower:7,bone:2,fish:0,can:0},claimedOn:'2026-10-28',streak:4})
  const results=await Promise.all(Array.from({length:20},()=>call(who,{action:'claimDaily',rewardVersion:1})))
  assert.ok(results.every(r=>r.ok));let wallet=table('wallets').get(who);assert.equal(wallet.balances.eternalCandle,1);assert.equal(wallet.balances.bone,3);assert.equal(wallet.balances.flower,7);assert.equal(wallet.streak,4)
  const snapshot=clone(wallet);await call(who,{action:'claimDaily'});assert.deepEqual(table('wallets').get(who),snapshot)
  table('memorials').set(id,{...original,privacy:'public',lifeStatus:'departed',hasMemorial:true,gifts:undefined,flowers:4})
  const legacyGet=await call(who,{action:'get',id});assert.equal(legacyGet.data.gifts.flower,4);assert.equal(legacyGet.data.gifts.eternalCandle,0)
  const legacyList=await call(who,{action:'list'});assert.equal(legacyList.data.find(p=>p.id===id).gifts.flower,4)
  for(const kind of ['eternalCandle','memorialGarden','candle','pawHeart','angelWings','rose','rainbowBridge','heartBalloon']){
   const gifts=await Promise.all(Array.from({length:10},()=>call(who,{action:'gift',id,kind,requestId:'catalog-'+kind,points:999999})))
   assert.ok(gifts.every(r=>r.ok));assert.equal(table('wallets').get(who).balances[kind],0);assert.equal(table('memorials').get(id).gifts[kind],1)
   assert.equal((await call(who,{action:'gift',id,kind,requestId:'catalog-next-'+kind})).ok,false)
  }
  wallet=clone(table('wallets').get(who));assert.equal((await call(who,{action:'gift',id,kind:'puppuccino',requestId:'wrong-food'})).ok,false);assert.deepEqual(table('wallets').get(who),wallet)
  assert.equal((await call(who,{action:'gift',id,kind:'not-an-item',requestId:'unknown'})).ok,false)
 }finally{Date.now=now;table('memorials').set(id,original);table('wallets').delete(who)}
 console.log('✓ 云端新增物品：旧签到当天仅补领一次、并发赠礼幂等、类型与库存校验，忽略伪造积分')
}
