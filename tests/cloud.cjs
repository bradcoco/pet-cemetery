const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
module.exports=async function(){
  const actualNow=Date.now
  Date.now=()=>Date.parse('2026-10-28T04:00:00Z')
  try{
  const tables=new Map(), clone=value=>structuredClone(value)
  let openid='',sequence=0,queue=Promise.resolve()
  function table(name){if(!tables.has(name))tables.set(name,new Map());return tables.get(name)}
  function matches(row,query){if(query.$or)return query.$or.some(q=>matches(row,q));return Object.entries(query).every(([key,value])=>value&&value.$in?value.$in.includes(row[key]):value&&value.$all?Array.isArray(row[key])&&value.$all.every(v=>row[key].includes(v)):row[key]===value)}
  function collection(name,query={},sort=[],offset=0,limit=100,fields=null){
    return {
      where(q){return collection(name,q,sort,offset,limit,fields)},
      orderBy(key,direction){return collection(name,query,[...sort,[key,direction]],offset,limit,fields)},
      skip(value){return collection(name,query,sort,value,limit,fields)},
      limit(value){return collection(name,query,sort,offset,value,fields)},
      field(value){return collection(name,query,sort,offset,limit,value)},
      async get(){let data=[...table(name).values()].filter(row=>matches(row,query));data.sort((a,b)=>{for(const [key,direction]of sort){if(a[key]!==b[key])return(a[key]<b[key]?-1:1)*(direction==='desc'?-1:1)}return 0});data=data.slice(offset,offset+limit);if(fields)data=data.map(row=>Object.fromEntries(Object.keys(fields).filter(key=>fields[key]).map(key=>[key,row[key]])));return{data:clone(data)}},
      doc(id){return{
        async get(){return{data:table(name).has(id)?clone(table(name).get(id)):null}},
        async set({data}){table(name).set(id,{...clone(data),_id:id});return{stats:{created:1}}},
        async update({data}){const row=table(name).get(id);if(!row)throw Error('document not found');table(name).set(id,{...row,...clone(data)});return{stats:{updated:1}}},
        async remove(){table(name).delete(id);return{stats:{removed:1}}},
      }},
      async add({data}){const id='test-'+ ++sequence;table(name).set(id,{...clone(data),_id:id});return{_id:id}},
    }
  }
  const db={collection,command:{or:values=>({$or:values}),in:values=>({$in:values}),all:values=>({$all:values})},runTransaction(callback){
    const run=queue.then(async()=>{const before=clone(tables);try{return await callback({collection})}catch(error){tables.clear();for(const [name,data]of before)tables.set(name,data);throw error}})
    queue=run.catch(()=>{});return run
  }}
  const cloud={DYNAMIC_CURRENT_ENV:'test',init(){},database(options){assert.equal(options.throwOnNotFound,false);return db},getWXContext:()=>({OPENID:openid}),getTempFileURL:async({fileList})=>({fileList:fileList.map(file=>({fileID:file.fileID,tempFileURL:'https://test.invalid/photo',status:0}))})}
  const exports={}
  const source=fs.readFileSync(path.join(__dirname,'../cloudfunctions/memorial/index.js'),'utf8')
  vm.runInNewContext(source,{exports,Date,require:name=>name==='wx-server-sdk'?cloud:name==='./domain'?require('../cloudfunctions/memorial/domain'):require(name),console:{error(){}}})
  const call=(user,event)=>{openid=user;return exports.main(event)}
  const baseBalances=(count=1)=>Object.fromEntries(require('../cloudfunctions/memorial/domain').itemKinds.map(kind=>[kind,count]))
  const input={name:'伙伴',species:'狗狗',breed:'',birthday:'2020-01-01',departed:'',epitaph:'你好',story:'',locationName:'',latitude:0,longitude:0,privacy:'public',stone:'arch',photos:[],lifeStatus:'alive',hasMemorial:false}
  const registrations=await Promise.all(Array.from({length:20},(_,i)=>call(i%2?'owner-b':'owner-a',{action:'save',creationKey:'registration-'+i,input:{...input,name:'伙伴'+i}})))
  assert.ok(registrations.every(r=>r.ok))
  const petRows=[...table('memorials').values()]
  assert.deepEqual(petRows.map(p=>p.no).sort(),Array.from({length:20},(_,i)=>String(i).padStart(6,'0')))
  const first=registrations[0].data
  assert.equal((await call('owner-a',{action:'save',creationKey:'registration-0',input})).data,first)
  assert.equal(table('counters').get('pet-sequence').next,20)
  console.log('✓ 云端事务：跨账户并发录入产生连续唯一六位编号，重试不重复注册')
  await call('owner-a',{action:'save',id:first,input:{...input,no:'999999',flowers:999,_openid:'attacker'}})
  assert.equal(table('memorials').get(first).no,'000000');assert.equal(table('memorials').get(first)._openid,'owner-a');assert.equal(table('memorials').get(first).flowers,0)
  const ownProfile=(await call('owner-a',{action:'login'})).data
  const privatePet=registrations[2].data
  await call('owner-a',{action:'save',id:privatePet,input:{...input,privacy:'private'}})
  const visitor=(await call('owner-b',{action:'publicProfile',user:ownProfile.id})).data
  assert.equal(visitor.isOwner,false);assert.equal(visitor.pets.length,9);assert.equal(visitor.wallet,undefined)
  assert.ok(visitor.pets.every(p=>p._openid===undefined&&p.privacy==='public'))
  const ownerView=(await call('owner-a',{action:'publicProfile',user:ownProfile.id})).data
  assert.equal(ownerView.pets.length,10)
  await call('owner-a',{action:'noteSave',memorialId:first,input:{title:'私密',content:'仅主人可读',date:'2025-01-01',photos:[]}})
  assert.equal((await call('owner-b',{action:'notes',memorialId:first})).ok,false)
  assert.equal((await call('owner-b',{action:'cabinetSave',cabinet:{theme:'wood',slots:9,placements:[{memorialId:first,slot:0,style:'album'}]}})).ok,false)
  const group=(await call('owner-a',{action:'noteSave',memorialId:'__overview__',input:{title:'全体伙伴',content:'一起在后院晒太阳。',date:'2025-01-01',photos:[]}})).data
  assert.ok(group)
  assert.equal((await call('owner-a',{action:'notes',memorialId:'__overview__'})).data.length,1)
  assert.equal((await call('owner-b',{action:'notes',memorialId:'__overview__',_openid:'owner-a'})).data.length,0)
  assert.equal((await call('owner-b',{action:'noteDelete',memorialId:'__overview__',id:group})).ok,false)
  assert.equal((await call('owner-b',{action:'noteSave',memorialId:'__overview__',id:group,input:{title:'越权',content:'',date:'2025-01-01',photos:[]}})).ok,false)
  assert.equal((await call('owner-a',{action:'noteSave',memorialId:first,id:group,input:{title:'串用',content:'',date:'2025-01-01',photos:[]}})).ok,false)
  assert.equal((await call('owner-a',{action:'save',id:first,input:{...input,avatarEmoji:'🦮'}})).ok,true)
  assert.equal(table('memorials').get(first).avatarEmoji,'🦮')
  assert.equal((await call('owner-a',{action:'save',id:first,input:{...input,avatarEmoji:'untrusted-url'}})).ok,false)
  console.log('✓ 总览笔记按账户隔离，禁止跨用户与跨笔记本修改；内置动物 emoji 校验与保存正常')
  console.log('✓ 云端主页只展示公开伙伴，笔记、柜位和库存不能被他人读取或修改')
  assert.equal((await call('owner-b',{action:'gift',id:first,kind:'bone',requestId:'before-claim'})).ok,false)
  const claims=await Promise.all(Array.from({length:20},()=>call('owner-b',{action:'claimDaily',date:'2099-12-31',streak:999,points:999})))
  assert.ok(claims.every(r=>r.ok&&r.data.points===30&&r.data.streak===1));assert.deepEqual(table('wallets').get('owner-b').balances,{...baseBalances(0)});assert.equal(table('wallets').get('owner-b').points,30)
  assert.equal((await call('owner-b',{action:'exchange',kind:'bone',points:1})).ok,true);assert.equal(table('wallets').get('owner-b').points,10);assert.equal(table('wallets').get('owner-b').balances.bone,1)
  assert.equal((await call('owner-b',{action:'exchange',kind:'bone',points:0})).ok,false);assert.equal(table('wallets').get('owner-b').balances.bone,1)
  const gifts=await Promise.all(Array.from({length:20},()=>call('owner-b',{action:'gift',id:first,kind:'bone',requestId:'one-click'})))
  assert.ok(gifts.every(r=>r.ok));assert.equal(table('wallets').get('owner-b').balances.bone,0);assert.equal(table('memorials').get(first).gifts.bone,1)
  const history=await call('owner-b',{action:'gifts',id:first})
  assert.equal(history.ok,true);assert.equal(history.data.length,1);assert.equal(history.data[0].kind,'bone');assert.equal(history.data[0].createdAt,Date.parse('2026-10-28T04:00:00Z'));assert.equal(history.data[0]._openid,undefined)
  assert.equal((await call('owner-b',{action:'gifts',id:privatePet})).ok,false)
  assert.equal((await call('owner-b',{action:'gift',id:first,kind:'fish',requestId:'wrong-food'})).ok,false)
  assert.equal((await call('owner-b',{action:'gift',id:privatePet,kind:'bone',requestId:'private'})).ok,false)
  assert.equal((await call('owner-b',{action:'flower',id:first})).ok,false)
  assert.equal((await call('owner-b',{action:'gift',id:first,kind:'bone',requestId:'second-click'})).ok,false)
  assert.equal((await call('owner-b',{action:'gift',id:first,kind:'bone',requestId:'third-click'})).ok,false)
  assert.equal((await call('owner-b',{action:'gift',id:first,kind:'bone',requestId:'empty-wallet'})).ok,false)
  assert.equal(table('wallets').get('owner-b').balances.bone,0)
  assert.equal((await call('owner-a',{action:'wallet',user:'owner-b'})).data.balances.bone,0)
  console.log('✓ 云端补给与赠礼事务：并发重复领取/重试只执行一次，物种校验与库存不足均不扣款')
  const stone=(await call('owner-a',{action:'save',creationKey:'stone-pet',input:{...input,lifeStatus:'departed',hasMemorial:true,departed:'2025-01-01',locationName:'湖边',latitude:30,longitude:120}})).data
  const garden={pets:[{petId:first,x:30,y:65}],memorials:[stone]}
  assert.equal((await call('owner-a',{action:'gardenSave',garden})).ok,true)
  assert.deepEqual(JSON.parse(JSON.stringify((await call('owner-a',{action:'garden'})).data)),garden)
  assert.deepEqual(JSON.parse(JSON.stringify((await call('owner-b',{action:'garden',user:'owner-a'})).data)),{pets:[],memorials:[]})
  assert.equal((await call('owner-b',{action:'gardenSave',garden})).ok,false)
  assert.equal((await call('owner-a',{action:'gardenSave',garden:{pets:[{petId:stone,x:20,y:60}],memorials:[]}})).ok,false)
  assert.equal((await call('owner-a',{action:'gardenSave',garden:{pets:[],memorials:[first]}})).ok,false)
  assert.equal((await call('owner-a',{action:'gardenSave',garden:{pets:[{petId:first,x:NaN,y:60}],memorials:[]}})).ok,false)
  const cabinet={theme:'glass',slots:9,placements:[{memorialId:first,slot:0,style:'orb'}]}
  assert.equal((await call('owner-a',{action:'cabinetSave',cabinet})).ok,true)
  assert.deepEqual(JSON.parse(JSON.stringify((await call('owner-a',{action:'garden'})).data)),garden)
  assert.equal((await call('owner-a',{action:'gardenSave',garden})).ok,true)
  assert.deepEqual(JSON.parse(JSON.stringify((await call('owner-a',{action:'cabinet'})).data)),cabinet)
  const both=await Promise.all([call('owner-a',{action:'gardenSave',garden}),call('owner-a',{action:'cabinetSave',cabinet:{...cabinet,theme:'night'}})])
  assert.ok(both.every(r=>r.ok));assert.equal(table('cabinets').get('owner-a').theme,'night');assert.deepEqual(table('cabinets').get('owner-a').garden,garden)
  console.log('✓ 云端家园归属、在世/离世分区与坐标校验；家园和档案柜并发保存互不覆盖')
  assert.equal((await call('owner-b',{action:'gift',id:stone,kind:'flower',requestId:'a-flower'})).ok,false)
  assert.equal((await call('owner-b',{action:'gift',id:stone,kind:'can',requestId:'wrong-memorial-gift'})).ok,false)
  const now=Date.now
  try{
    Date.now=()=>now()+86400000
    await call('owner-b',{action:'claimDaily'});await call('owner-b',{action:'claimDaily'})
    assert.equal(table('wallets').get('owner-b').points,50);assert.equal(table('wallets').get('owner-b').streak,2);assert.equal(table('wallets').get('owner-b').balances.flower,0)
    assert.equal((await call('owner-b',{action:'exchange',kind:'flower',points:1})).ok,true)
    assert.equal((await call('owner-b',{action:'gift',id:stone,kind:'flower',requestId:'a-flower'})).ok,true)
    assert.equal(table('memorials').get(stone).flowers,1);assert.equal(table('wallets').get('owner-b').balances.flower,0);assert.equal(table('wallets').get('owner-b').points,20)
  }finally{Date.now=now}
  assert.equal((await call('owner-a',{action:'petOrderSave',order:[stone,first]})).ok,true)
  assert.deepEqual(JSON.parse(JSON.stringify((await call('owner-a',{action:'petOrder'})).data)),[stone,first])
  assert.deepEqual(JSON.parse(JSON.stringify((await call('owner-b',{action:'petOrder',user:'owner-a'})).data)),[])
  assert.equal((await call('owner-b',{action:'petOrderSave',order:[first]})).ok,false)
  assert.equal((await call('owner-a',{action:'petOrderSave',order:[first,first]})).ok,false)
  assert.equal((await call('owner-a',{action:'petOrderSave',order:[null]})).ok,false)
  const allLayouts=await Promise.all([call('owner-a',{action:'gardenSave',garden}),call('owner-a',{action:'cabinetSave',cabinet}),call('owner-a',{action:'petOrderSave',order:[first,stone]})])
  assert.ok(allLayouts.every(r=>r.ok));assert.deepEqual(table('cabinets').get('owner-a').garden,garden);assert.equal(table('cabinets').get('owner-a').theme,'glass');assert.deepEqual(table('cabinets').get('owner-a').petOrder,[first,stone])
  assert.equal((await call('owner-a',{action:'save',id:first,input:{...input,story:'完整故事不能被列表中的空文本覆盖',photos:['cloud://env/memories/owner-a/one.jpg','cloud://env/memories/owner-a/two.jpg'],avatarEmoji:'🦮'}})).ok,true)
  const beforeStatus=clone(table('memorials').get(first))
  assert.equal((await call('owner-b',{action:'petStatus',id:first,status:'departed',_openid:'owner-a'})).ok,false)
  assert.equal((await call('owner-a',{action:'petStatus',id:first,status:'all'})).ok,false)
  assert.deepEqual(table('memorials').get(first),beforeStatus)
  assert.equal((await call('owner-a',{action:'petStatus',id:first,status:'departed',no:'999999',flowers:1000})).ok,true)
  assert.equal(table('memorials').get(first).lifeStatus,'departed');assert.equal(table('memorials').get(first).hasMemorial,false)
  assert.equal((await call('owner-a',{action:'petStatus',id:first,status:'alive'})).ok,true)
  const revived=table('memorials').get(first)
  for(const key of ['no','photos','story','flowers','gifts','avatarEmoji','_openid','privacy'])assert.deepEqual(revived[key],beforeStatus[key])
  assert.equal(revived.departed,'');assert.equal(revived.lifeStatus,'alive')
  assert.equal((await call('owner-a',{action:'petStatus',id:stone,status:'alive'})).ok,true)
  assert.equal(table('memorials').get(stone).latitude,0);assert.equal(table('memorials').get(stone).hasMemorial,false)
  assert.equal((await call('owner-a',{action:'notes',memorialId:first})).data.length,1)
  console.log('✓ 云端排序按账户隔离，三类布局并发保存互不覆盖；状态修改事务拒绝越权并保留完整档案、编号、礼物与笔记')
  await require('./notebook-visibility.cjs').cloud({call,table,clone,id:first})
  await require('./notebook-settings.cjs').cloud({call,table,clone,id:first})
  await require('./visitor-preview.cjs').cloud({call,table,clone,id:first})
  await require('./public-garden.cjs').cloud({call,table,clone,id:first,stone})
  await require('./guestbook.cjs').cloud({call,table,clone})
  await require('./items-catalog.cjs').cloud({call,table,clone,id:first})
  await require('./tombstones.cjs').cloud({call,table,clone,id:first})
  await require('./privacy-settings.cjs').cloud({call,table,clone,id:first})
  await require('./notebook-sharing.cjs')({call,table,clone,first,privatePet})
  await call('owner-a',{action:'delete',id:first})
  assert.equal((await call('owner-a',{action:'notes',memorialId:'__overview__'})).data.length,1)
  const afterDelete=(await call('owner-a',{action:'save',creationKey:'after-delete',input})).data
  assert.equal(table('memorials').get(afterDelete).no,'000021')
  table('counters').get('pet-sequence').next=1000000
  const beforeCount=table('memorials').size
  assert.equal((await call('owner-a',{action:'save',creationKey:'overflow',input})).ok,false)
  assert.equal(table('memorials').size,beforeCount)
  console.log('✓ 跨日奖励、墓碑献花、编号不回收与六位上限检查通过')
  const monday=Date.parse('2026-10-26T04:00:00Z')
  for(let day=0;day<14;day++){
    Date.now=()=>monday+day*86400000
    const results=await Promise.all(Array.from({length:20},()=>call('checkin-user',{action:'claimDaily',date:'2099-12-31',streak:999,rewards:{flower:999},points:999999})))
    assert.ok(results.every(r=>r.ok&&r.data.streak===day+1&&r.data.points===5*(day+1)*(day+6)))
  }
  assert.equal(table('wallets').get('checkin-user').points,5*14*19);assert.deepEqual(table('wallets').get('checkin-user').balances,{...baseBalances(0)})
  Date.now=()=>monday+15*86400000;const reset=await call('checkin-user',{action:'claimDaily'});assert.equal(reset.data.streak,1);assert.equal(reset.data.points,5*14*19+30)
  const savedWallet=clone(table('wallets').get('checkin-user'))
  Date.now=()=>monday;assert.equal((await call('checkin-user',{action:'claimDaily'})).ok,false);assert.deepEqual(table('wallets').get('checkin-user'),savedWallet)
  console.log('✓ 云端签到：连续 14 天每日并发只发一次，首日 30 分且每天 +10，忽略伪造日期、连签与积分，断签重置且回拨不重复发放')
  }finally{Date.now=actualNow}
}
