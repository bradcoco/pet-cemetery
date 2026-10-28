const assert=require('node:assert/strict')
module.exports=async function({items,domain,store,storage}){
  const noon=date=>Date.parse(date+'T04:00:00Z'),monday=noon('2026-10-26')
  const base=(count=1)=>Object.fromEntries(items.ITEMS.map(item=>[item.id,count]))
  let client=items.emptyWallet(),server=domain.emptyWallet()
  for(let day=0;day<21;day++){
    const now=monday+day*86400000,weekday=day%7
    const expected={...base(),flower:day+1,bone:1+(weekday===2?2:0),fish:1+(weekday===5?2:0),can:1+(weekday===6?1:0)}
    const previous=structuredClone(client),status=items.checkInStatus(client,now)
    assert.equal(status.claimed,false);assert.equal(status.streak,day+1);assert.deepEqual(status.rewards,expected)
    client=items.applyCheckIn(client,now);server=domain.applyCheckIn(server,now)
    assert.deepEqual(client,server);assert.deepEqual(items.applyCheckIn(client,now+3600000),client);assert.deepEqual(domain.applyCheckIn(server,now+3600000),server)
    for(const key of Object.keys(expected))assert.equal(client.balances[key]-previous.balances[key],expected[key])
    assert.equal(items.checkInStatus(client,now).claimed,true)
  }
  assert.equal(client.balances.flower,231);assert.equal(client.streak,21)
  const missed=items.applyCheckIn(client,monday+22*86400000)
  assert.equal(missed.streak,1);assert.equal(missed.balances.flower,232);assert.deepEqual(missed,domain.applyCheckIn(server,monday+22*86400000))
  for(const [first,second]of [['2026-12-31','2027-01-01'],['2028-02-28','2028-02-29'],['2028-02-29','2028-03-01']]){
    const a=items.applyCheckIn(items.emptyWallet(),noon(first)),b=items.applyCheckIn(a,noon(second))
    assert.equal(b.streak,2);assert.deepEqual(b,domain.applyCheckIn(a,noon(second)))
  }
  const beforeMidnight=Date.parse('2026-10-28T15:59:59Z'),afterMidnight=beforeMidnight+1000
  const wed=items.applyCheckIn(items.emptyWallet(),beforeMidnight),thu=items.applyCheckIn(wed,afterMidnight)
  assert.deepEqual(wed.balances,{...base(),flower:1,bone:3,fish:1,can:1});assert.deepEqual(thu.balances,{...base(2),flower:3,bone:4,fish:2,can:2});assert.equal(thu.streak,2)
  const legacy={balances:{flower:13,bone:4,fish:6,can:2},claimedOn:'2026-10-28'}
  const supplemented={...legacy,balances:{...base(),...legacy.balances,bone:5,fish:7,can:3},streak:1,rewardVersion:2}
  assert.equal(items.checkInStatus(legacy,beforeMidnight).supplement,true)
  assert.deepEqual(items.applyCheckIn(legacy,beforeMidnight),supplemented);assert.deepEqual(domain.applyCheckIn(legacy,beforeMidnight),supplemented)
  assert.deepEqual(items.applyCheckIn(supplemented,beforeMidnight),supplemented);assert.deepEqual(domain.applyCheckIn(supplemented,beforeMidnight),supplemented)
  assert.equal(items.applyCheckIn(legacy,afterMidnight).streak,2)
  for(const invalid of [{...legacy,streak:-1},{...legacy,streak:1.5},{...legacy,streak:0},{...legacy,claimedOn:'2026-02-30'},{...legacy,balances:{...legacy.balances,flower:NaN}}]){assert.throws(()=>items.applyCheckIn(invalid,afterMidnight));assert.throws(()=>domain.applyCheckIn(invalid,afterMidnight))}
  assert.throws(()=>items.applyCheckIn(thu,beforeMidnight),/日期/);assert.throws(()=>domain.applyCheckIn(thu,beforeMidnight),/日期/)
  const full={balances:{flower:999999999,bone:0,fish:0,can:0},claimedOn:'',streak:0},snapshot=structuredClone(full)
  assert.throws(()=>items.applyCheckIn(full,monday));assert.throws(()=>domain.applyCheckIn(full,monday));assert.deepEqual(full,snapshot)
  const saved=storage.get('xingyu.economy.v1'),oldNow=Date.now
  try{
    Date.now=()=>beforeMidnight
    storage.set('xingyu.economy.v1',{wallet:legacy,gifts:{},receipts:[]})
    const topups=await Promise.all(Array.from({length:10},()=>store.claimDaily()))
    assert.ok(topups.every(wallet=>JSON.stringify(wallet)===JSON.stringify(supplemented)))
    assert.deepEqual(storage.get('xingyu.economy.v1').wallet,supplemented)
    storage.delete('xingyu.economy.v1')
    for(let day=0;day<7;day++){
      Date.now=()=>monday+day*86400000
      const results=await Promise.all(Array.from({length:10},()=>store.claimDaily()))
      assert.ok(results.every(w=>w.streak===day+1));assert.equal((await store.getWallet()).balances.flower,(day+1)*(day+2)/2)
    }
    assert.deepEqual((await store.getWallet()).balances,{...base(7),flower:28,bone:9,fish:9,can:8})
    Date.now=()=>monday+8*86400000;const restart=await store.claimDaily();assert.equal(restart.streak,1);assert.equal(restart.balances.flower,29)
    const persisted=structuredClone(storage.get('xingyu.economy.v1'));assert.deepEqual(await store.claimDaily(),restart);assert.deepEqual(storage.get('xingyu.economy.v1'),persisted)
  }finally{Date.now=oldNow;if(saved)storage.set('xingyu.economy.v1',saved);else storage.delete('xingyu.economy.v1')}
}
