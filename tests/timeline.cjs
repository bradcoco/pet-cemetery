const assert = require('node:assert/strict')
module.exports = function ({ timeline }) {
  const { anniversaries, petTimeline } = timeline
  const pet = (fields) => ({ id: 'p', name: '豆豆', lifeStatus: 'departed', birthday: '', departed: '', ...fields })
  const today = anniversaries([
    pet({ id: 'leap', name: '闰', birthday: '2024-02-29', lifeStatus: 'alive' }),
    pet({ id: 'wrap', name: '岁', birthday: '2020-01-02', departed: '2021-01-01', lifeStatus: 'alive' }),
    pet({ id: 'star', name: '星', birthday: '', departed: '2020-02-28' }),
    pet({ id: 'soon', name: '近', birthday: '2019-11-03', departed: '2024-11-04' }),
    pet({ id: 'far', name: '远', birthday: '2018-12-01', departed: '2019-12-01' }),
    pet({ id: 'bad', name: '坏', birthday: '不是日期', departed: '2020-02-31' }),
  ], '2025-02-28')
  assert.deepEqual(today.map(item => [item.petId, item.kind, item.daysUntil, item.years, item.text]), [
    ['leap', 'birthday', 0, 1, '今天 1 岁'],
    ['star', 'departed', 0, 5, '离开已经 5 年'],
  ])
  const wrapped = anniversaries([pet({ birthday: '2020-01-02', lifeStatus: 'alive' })], '2026-12-30')
  assert.equal(wrapped.length, 1)
  assert.equal(wrapped[0].daysUntil, 3)
  assert.equal(wrapped[0].years, 7)
  assert.equal(wrapped[0].text, '还有 3 天就 7 岁')
  const born = anniversaries([pet({ birthday: '2026-10-28', lifeStatus: 'alive' })], '2026-10-28')
  assert.equal(born[0].text, '今天来到这个世界')
  const leaving = anniversaries([pet({ departed: '2026-10-28', lifeStatus: 'departed' })], '2026-10-28')
  assert.equal(leaving[0].text, '今天成为星星')
  assert.equal(anniversaries([pet({ birthday: '2027-03-01', lifeStatus: 'alive' })], '2026-10-28').length, 0)

  const events = petTimeline({
    birthday: '2020-05-01', departed: '2024-05-01', lifeStatus: 'departed', createdAt: Date.parse('2026-10-27T16:00:00Z'), no: '000007',
  }, [
    { id: 'n1', title: '', content: '   今天   一起晒太阳   ', date: '2026-10-28', photos: [], createdAt: 3 },
    { id: 'n2', title: '', content: '', date: '2026-10-28', photos: ['a.jpg'], createdAt: 2 },
    { id: 'n3', title: '第一篇', content: '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十', date: '2021-01-01', photos: [], createdAt: 1 },
  ], [
    { id: 'old', kind: 'flower', createdAt: undefined },
    { id: 'g1', kind: 'bone', createdAt: Date.parse('2026-10-27T16:00:00Z') },
    { id: 'g0', kind: 'nope', createdAt: Date.parse('2026-10-27T16:00:00Z') },
  ])
  assert.deepEqual(events.map(event => event.title), ['来到这个世界', '第一篇', '成为星星', '写进星屿', '收到🦴 小骨头', '留下照片', '写下一篇笔记'])
  assert.equal(events[2].date, '2024-05-01')
  assert.equal(events[3].date, '2026-10-28')
  assert.equal(events[3].detail, 'No. 000007')
  assert.equal(events[3].dateLabel, '2026年10月28日')
  assert.equal(events[4].detail, '一份心意')
  assert.equal(events[5].title, '留下照片')
  assert.ok(events.find(event => event.id === 'note-n3').detail.endsWith('…'))
  assert.equal(events.find(event => event.id === 'note-n3').detail.length, 37)
  assert.equal(events.find(event => event.id === 'note-n1').detail, '今天 一起晒太阳')
  const alive = petTimeline({ birthday: '2020-05-01', departed: '2024-05-01', lifeStatus: 'alive', createdAt: 0 }, [], [])
  assert.deepEqual(alive.map(event => event.title), ['来到这个世界'])
}
