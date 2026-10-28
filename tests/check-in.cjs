const assert=require('node:assert/strict')
module.exports=async function({items,domain,store,storage}){
  const noon=date=>Date.parse(date+'T04:00:00Z'),monday=noon('2026-10-26'),total=n=>5*n*(n+5)
  let client=items.emptyWallet(),server=domain.emptyWallet()
  for(let day=0;day<21;day++){
    const now=monday+day*86400000,previous=structuredClone(client),status=items.checkInStatus(client,now)
    assert.equal(status.claimed,false);assert.equal(status.streak,day+1);assert.equal(status.points,30+day*10);assert.equal(domain.checkInPoints(day+1),status.points)
    client=items.applyCheckIn(client,now);server=domain.applyCheckIn(server,now)
    assert.deepEqual(client,server);assert.deepEqual(items.applyCheckIn(client,now+3600000),client);assert.deepEqual(domain.applyCheckIn(server,now+3600000),server)
    assert.equal(client.points-previous.points,status.points);assert.deepEqual(client.balances,previous.balances)
    assert.equal(items.checkInStatus(client,now).claimed,true)
  }
  assert.equal(client.points,total(21));assert.equal(client.streak,21)
  const missed=items.applyCheckIn(client,monday+22*86400000)
  assert.equal(missed.streak,1);assert.equal(missed.points,total(21)+30);assert.deepEqual(missed,domain.applyCheckIn(server,monday+22*86400000))
  for(const [first,second]of [['2026-12-31','2027-01-01'],['2028-02-28','2028-02-29'],['2028-02-29','2028-03-01']]){
    const a=items.applyCheckIn(items.emptyWallet(),noon(first)),b=items.applyCheckIn(a,noon(second))
    assert.equal(b.streak,2);assert.equal(b.points,70);assert.deepEqual(b,domain.applyCheckIn(a,noon(second)))
  }
  const beforeMidnight=Date.parse('2026-10-28T15:59:59Z'),afterMidnight=beforeMidnight+1000
  const wed=items.applyCheckIn(items.emptyWallet(),beforeMidnight),thu=items.applyCheckIn(wed,afterMidnight)
  assert.equal(wed.points,30);assert.equal(wed.streak,1);assert.equal(thu.points,70);assert.equal(thu.streak,2)
  assert.deepEqual(wed.balances,items.emptyInventory());assert.deepEqual(thu.balances,items.emptyInventory())
  const legacy={balances:{flower:13,bone:4,fish:6,can:2},claimedOn:'2026-10-28'},kept=items.cleanWallet(legacy)
  assert.equal(items.checkInStatus(legacy,beforeMidnight).claimed,true)
  assert.equal(kept.points,0);assert.equal(kept.streak,1);assert.equal(kept.rewardVersion,1);assert.equal(kept.balances.flower,13)
  assert.deepEqual(items.applyCheckIn(legacy,beforeMidnight),kept);assert.deepEqual(domain.applyCheckIn(legacy,beforeMidnight),kept)
  const next=items.applyCheckIn(legacy,afterMidnight)
  assert.equal(next.streak,2);assert.equal(next.points,40);assert.equal(next.balances.flower,13);assert.equal(next.rewardVersion,3)
  assert.deepEqual(next,domain.applyCheckIn(legacy,afterMidnight));assert.deepEqual(items.applyCheckIn(next,afterMidnight),next)
  for(const invalid of [{...legacy,streak:-1},{...legacy,streak:1.5},{...legacy,streak:0},{...legacy,claimedOn:'2026-02-30'},{...legacy,balances:{...legacy.balances,flower:NaN}},{...kept,points:-1},{...kept,points:1.5}]){assert.throws(()=>items.applyCheckIn(invalid,afterMidnight));assert.throws(()=>domain.applyCheckIn(invalid,afterMidnight))}
  assert.throws(()=>items.applyCheckIn(thu,beforeMidnight),/日期/);assert.throws(()=>domain.applyCheckIn(thu,beforeMidnight),/日期/)
  const full={...items.emptyWallet(),points:999999980},snapshot=structuredClone(full)
  assert.throws(()=>items.applyCheckIn(full,monday));assert.throws(()=>domain.applyCheckIn(full,monday));assert.deepEqual(full,snapshot)
  const bought=items.applyExchange(thu,'heartBalloon')
  assert.equal(bought.points,60);assert.equal(bought.balances.heartBalloon,1);assert.deepEqual(bought,domain.applyExchange(thu,'heartBalloon'))
  assert.throws(()=>items.applyExchange(bought,'eternalCandle'),/积分/);assert.throws(()=>domain.applyExchange(bought,'nope'))
  const saved=storage.get('xingyu.economy.v1'),oldNow=Date.now
  try{
    Date.now=()=>beforeMidnight
    storage.set('xingyu.economy.v1',{wallet:legacy,gifts:{},receipts:[]})
    const topups=await Promise.all(Array.from({length:10},()=>store.claimDaily()))
    assert.ok(topups.every(wallet=>JSON.stringify(wallet)===JSON.stringify(kept)))
    assert.deepEqual(storage.get('xingyu.economy.v1').wallet,legacy)
    storage.delete('xingyu.economy.v1')
    for(let day=0;day<7;day++){
      Date.now=()=>monday+day*86400000
      const results=await Promise.all(Array.from({length:10},()=>store.claimDaily()))
      assert.ok(results.every(w=>w.streak===day+1&&w.points===total(day+1)))
    }
    assert.equal((await store.getWallet()).points,total(7));assert.deepEqual((await store.getWallet()).balances,items.emptyInventory())
    Date.now=()=>monday+8*86400000;const restart=await store.claimDaily();assert.equal(restart.streak,1);assert.equal(restart.points,total(7)+30)
    const persisted=structuredClone(storage.get('xingyu.economy.v1'));assert.deepEqual(await store.claimDaily(),restart);assert.deepEqual(storage.get('xingyu.economy.v1'),persisted)
    const exchanged=await store.exchangeItem('bone');assert.equal(exchanged.balances.bone,1);assert.equal(exchanged.points,restart.points-20)
    const low=storage.get('xingyu.economy.v1');low.wallet.points=9;storage.set('xingyu.economy.v1',low)
    await assert.rejects(store.exchangeItem('heartBalloon'),/积分/);assert.equal((await store.getWallet()).points,9)
  }finally{Date.now=oldNow;if(saved)storage.set('xingyu.economy.v1',saved);else storage.delete('xingyu.economy.v1')}
}
