import { Note, OVERVIEW_NOTEBOOK } from '../utils/cabinet'
import { Garden } from '../utils/garden'
import { emptyInventory, ItemKind } from '../utils/items'
import { Memorial } from '../utils/model'
import { NotebookTag } from '../utils/notebooks'

export interface DebugFixtures {
  records: Memorial[]
  notes: Note[]
  receipts: { id: string; petId: string; kind: ItemKind; createdAt: number }[]
  garden: Garden
  notebookSettings: Record<string, { tags: NotebookTag[] }>
}

const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
const yearsAgo = (day: string, years: number) => {
  const year = Number(day.slice(0, 4)) - years
  const monthDay = day.slice(5)
  if (monthDay === '02-29' && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) return `${year}-02-28`
  return `${year}-${monthDay}`
}
const stamp = (day: string) => Date.parse(`${day}T04:00:00Z`)
const counts = (partial: Partial<ReturnType<typeof emptyInventory>>) => ({ ...emptyInventory(), ...partial })
export const DEBUG_EXTRA_IDS = ['debug-doubao', 'debug-niunai', 'debug-juzi', 'debug-xueqiu', 'debug-wanfeng', 'debug-huasheng', 'debug-shanzhu', 'debug-haiyan', 'debug-qingtuan', 'debug-bingbing', 'debug-yunduo', 'debug-huyang', 'debug-yezi', 'debug-nanfeng']

export function debugFixtures(today: string): DebugFixtures {
  const bornToday = yearsAgo(today, 4)
  const leavingToday = yearsAgo(today, 2)
  const birthdaySoon = yearsAgo(shift(today, 2), 6)
  const rabbitBirthday = yearsAgo(shift(today, 5), 1)
  const quietBirthday = yearsAgo(shift(today, 20), 2)
  const birdBirthday = yearsAgo(shift(today, 6), 4)
  const birdDeparted = yearsAgo(shift(today, 6), 1)
  const hamsterBirthday = yearsAgo(shift(today, 40), 8)
  const hamsterDeparted = yearsAgo(shift(today, 40), 1)
  const registered = stamp(shift(today, -3))
  const records: Memorial[] = [
    { id: 'debug-niangao', name: '年糕', species: '狗狗', breed: '柯基', birthday: bornToday, departed: '', epitaph: '听到牵引绳就冲到门口。', story: '年糕还在身边。草地、跑步，还有每个会叫它名字的人，都是它今天的事情。', locationName: '', latitude: 0, longitude: 0, privacy: 'public', stone: 'arch', photos: [], flowers: 0, gifts: counts({ bone: 2, can: 1 }), createdAt: registered, owner: true, avatarEmoji: '🐶', lifeStatus: 'alive', hasMemorial: false, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-xiaoman', name: '小满', species: '兔兔', breed: '垂耳兔', birthday: rabbitBirthday, departed: '', epitaph: '叶子可以留到最后。', story: '小满吃东西很慢，会先把胡萝卜的叶子拨到一边。傍晚最喜欢把下巴搁在手心里。', locationName: '', latitude: 0, longitude: 0, privacy: 'public', stone: 'heart', photos: [], flowers: 0, gifts: counts({ heartBalloon: 1 }), createdAt: registered, owner: true, avatarEmoji: '🐰', lifeStatus: 'alive', hasMemorial: false, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-meiqiu', name: '煤球', species: '猫咪', breed: '黑猫', birthday: quietBirthday, departed: '', epitaph: '只给熟悉的人看肚皮。', story: '煤球的档案是私密的，笔记本也先关着。用来看访客视角和未开启笔记时，时间线还留下哪些日子。', locationName: '', latitude: 0, longitude: 0, privacy: 'private', stone: 'arch', photos: [], flowers: 0, gifts: counts({}), createdAt: registered, owner: true, avatarEmoji: '🐈‍⬛', lifeStatus: 'alive', hasMemorial: false, notebookEnabled: false, notebookPrivacy: 'private' },
    { id: 'debug-tuanzi', name: '团子', species: '猫咪', breed: '橘猫', birthday: birthdaySoon, departed: leavingToday, epitaph: '窗台上的阳光还在。', story: '团子离开的日子就在今天这个月日。笔记是公开的，访客预览也能读到。墓碑在南京的梧桐下面。', locationName: '南京 · 梧桐下面', latitude: 32.0603, longitude: 118.7969, privacy: 'public', stone: 'heart', photos: [], flowers: 1, gifts: counts({ flower: 1, rose: 1, candle: 1 }), createdAt: registered, owner: true, avatarEmoji: '🐱', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'public' },
    { id: 'debug-abai', name: '阿白', species: '鸟儿', breed: '玄凤', birthday: birdBirthday, departed: birdDeparted, epitaph: '房间会因为它变轻。', story: '阿白已经离开，但还没有立碑。它会留在宠物仓里，可以再放进家园的纪念区。', locationName: '', latitude: 0, longitude: 0, privacy: 'private', stone: 'star', photos: [], flowers: 0, gifts: counts({}), createdAt: registered, owner: true, avatarEmoji: '🦜', lifeStatus: 'departed', hasMemorial: false, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-xingxing', name: '星星', species: '其他', breed: '仓鼠', birthday: hamsterBirthday, departed: hamsterDeparted, epitaph: '夜跑时口袋里有瓜子。', story: '星星的纪念日不在这七天里。墓碑在西安，用来看地图上的另一座城市，以及一份比较长的时间线。', locationName: '西安 · 城墙边的桂花', latitude: 34.3416, longitude: 108.9398, privacy: 'public', stone: 'garden', photos: [], flowers: 1, gifts: counts({ flower: 1 }), createdAt: stamp(shift(today, -10)), owner: true, avatarEmoji: '🐹', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-doubao', name: '豆包', species: '狗狗', breed: '金毛', birthday: yearsAgo(shift(today, 12), 3), departed: '', epitaph: '球扔出去，它比球先到。', story: '豆包还在身边。草坪上有它的位置，笔记本先只留给自己。', locationName: '', latitude: 0, longitude: 0, privacy: 'public', stone: 'arch', photos: [], flowers: 0, gifts: counts({ bone: 1 }), createdAt: stamp(shift(today, -2)), owner: true, avatarEmoji: '🦮', lifeStatus: 'alive', hasMemorial: false, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-niunai', name: '牛奶', species: '猫咪', breed: '奶牛猫', birthday: yearsAgo(shift(today, 18), 2), departed: '', epitaph: '会把玩具排成一排。', story: '牛奶的笔记是公开的，访客可以读到它把玩具排队的事。', locationName: '', latitude: 0, longitude: 0, privacy: 'public', stone: 'heart', photos: [], flowers: 0, gifts: counts({}), createdAt: stamp(shift(today, -4)), owner: true, avatarEmoji: '🐱', lifeStatus: 'alive', hasMemorial: false, notebookEnabled: true, notebookPrivacy: 'public' },
    { id: 'debug-juzi', name: '橘子', species: '鸟儿', breed: '虎皮鹦鹉', birthday: yearsAgo(shift(today, 25), 1), departed: '', epitaph: '会跟着收音机哼。', story: '橘子的档案是私密的，还没有放进草坪。用来看一只活着、但还没进家园的鸟。', locationName: '', latitude: 0, longitude: 0, privacy: 'private', stone: 'star', photos: [], flowers: 0, gifts: counts({}), createdAt: stamp(shift(today, -5)), owner: true, avatarEmoji: '🐤', lifeStatus: 'alive', hasMemorial: false, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-xueqiu', name: '雪球', species: '狗狗', breed: '萨摩耶', birthday: yearsAgo(shift(today, 32), 7), departed: yearsAgo(shift(today, 15), 2), epitaph: '雪停的时候还会回头。', story: '雪球的墓碑在北京。纪念日不在这七天里，用来看另一座城市的标记。', locationName: '北京 · 胡同口的阳光', latitude: 39.9042, longitude: 116.4074, privacy: 'public', stone: 'arch', photos: [], flowers: 1, gifts: counts({ flower: 1 }), createdAt: stamp(shift(today, -12)), owner: true, avatarEmoji: '🐶', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'public' },
    { id: 'debug-wanfeng', name: '晚风', species: '猫咪', breed: '英国短毛猫', birthday: yearsAgo(shift(today, 40), 5), departed: yearsAgo(shift(today, 21), 1), epitaph: '江边的风还认得它。', story: '晚风在上海。笔记先不公开，墓碑可以在地图上点开。', locationName: '上海 · 有晚风的江边', latitude: 31.2304, longitude: 121.4737, privacy: 'public', stone: 'star', photos: [], flowers: 1, gifts: counts({ candle: 1 }), createdAt: stamp(shift(today, -9)), owner: true, avatarEmoji: '🐈', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-huasheng', name: '花生', species: '狗狗', breed: '腊肠犬', birthday: yearsAgo(shift(today, 48), 9), departed: yearsAgo(shift(today, 28), 3), epitaph: '短腿也能走到很远。', story: '花生的墓碑在广州，方便看南边的省份地图。', locationName: '广州 · 骑楼下的阴凉', latitude: 23.1291, longitude: 113.2644, privacy: 'public', stone: 'garden', photos: [], flowers: 0, gifts: counts({}), createdAt: stamp(shift(today, -7)), owner: true, avatarEmoji: '🐕', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-shanzhu', name: '山竹', species: '兔兔', breed: '垂耳兔', birthday: yearsAgo(shift(today, 55), 4), departed: yearsAgo(shift(today, 33), 1), epitaph: '叶子还是要留到最后。', story: '山竹在成都。和团子、星星不在同一个省，点进四川就能看见它。', locationName: '成都 · 我们散步的公园', latitude: 30.6598, longitude: 104.0668, privacy: 'public', stone: 'heart', photos: [], flowers: 0, gifts: counts({}), createdAt: stamp(shift(today, -6)), owner: true, avatarEmoji: '🐰', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-haiyan', name: '海盐', species: '鸟儿', breed: '金丝雀', birthday: yearsAgo(shift(today, 62), 3), departed: yearsAgo(shift(today, 40), 1), epitaph: '早上会先叫一声。', story: '海盐的墓碑在厦门，用来看海边的城市。', locationName: '厦门 · 能看见海的窗台', latitude: 24.4798, longitude: 118.0894, privacy: 'public', stone: 'arch', photos: [], flowers: 0, gifts: counts({}), createdAt: stamp(shift(today, -8)), owner: true, avatarEmoji: '🐥', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-qingtuan', name: '青团', species: '猫咪', breed: '布偶猫', birthday: yearsAgo(shift(today, 70), 6), departed: yearsAgo(shift(today, 48), 2), epitaph: '湖边的树还在。', story: '青团在杭州。和示例里的团团不是同一只，点进去看的是自己的档案。', locationName: '杭州 · 湖边的另一棵树', latitude: 30.2741, longitude: 120.1551, privacy: 'public', stone: 'garden', photos: [], flowers: 0, gifts: counts({}), createdAt: stamp(shift(today, -11)), owner: true, avatarEmoji: '🐱', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'public' },
    { id: 'debug-bingbing', name: '冰冰', species: '狗狗', breed: '哈士奇', birthday: yearsAgo(shift(today, 80), 4), departed: yearsAgo(shift(today, 55), 1), epitaph: '雪地里只露出眼睛。', story: '冰冰在哈尔滨，用来看最北边的标记。', locationName: '哈尔滨 · 松花江边的雪', latitude: 45.7567, longitude: 126.6424, privacy: 'public', stone: 'arch', photos: [], flowers: 0, gifts: counts({}), createdAt: stamp(shift(today, -13)), owner: true, avatarEmoji: '🐶', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-yunduo', name: '云朵', species: '猫咪', breed: '三花猫', birthday: yearsAgo(shift(today, 88), 8), departed: yearsAgo(shift(today, 62), 2), epitaph: '花开的时候会来坐一会儿。', story: '云朵在昆明。点进云南就能看见它的墓碑。', locationName: '昆明 · 翠湖边的海棠', latitude: 25.0406, longitude: 102.7123, privacy: 'public', stone: 'star', photos: [], flowers: 0, gifts: counts({}), createdAt: stamp(shift(today, -14)), owner: true, avatarEmoji: '🐱', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-huyang', name: '胡杨', species: '狗狗', breed: '中华田园犬', birthday: yearsAgo(shift(today, 96), 10), departed: yearsAgo(shift(today, 70), 4), epitaph: '远远地也会跟着走。', story: '胡杨在乌鲁木齐，用来看地图西边的省份。', locationName: '乌鲁木齐 · 胡杨还没黄的时候', latitude: 43.8256, longitude: 87.6168, privacy: 'public', stone: 'garden', photos: [], flowers: 0, gifts: counts({}), createdAt: stamp(shift(today, -16)), owner: true, avatarEmoji: '🐕', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-yezi', name: '椰子', species: '鸟儿', breed: '玄凤', birthday: yearsAgo(shift(today, 104), 5), departed: yearsAgo(shift(today, 80), 2), epitaph: '海风会把它的叫声送来。', story: '椰子在海口。和阿白一样是玄凤，但这只有墓碑，在海南。', locationName: '海口 · 椰子树下的风', latitude: 20.0444, longitude: 110.1999, privacy: 'public', stone: 'heart', photos: [], flowers: 0, gifts: counts({}), createdAt: stamp(shift(today, -18)), owner: true, avatarEmoji: '🦜', lifeStatus: 'departed', hasMemorial: true, notebookEnabled: true, notebookPrivacy: 'private' },
    { id: 'debug-nanfeng', name: '南风', species: '猫咪', breed: '狸花猫', birthday: yearsAgo(shift(today, 19), 4), departed: yearsAgo(shift(today, 19), 1), epitaph: '门开着，它会自己回来。', story: '南风已经离开，还没有立碑。档案是私密的，可以再放进纪念区。', locationName: '', latitude: 0, longitude: 0, privacy: 'private', stone: 'arch', photos: [], flowers: 0, gifts: counts({}), createdAt: stamp(shift(today, -3)), owner: true, avatarEmoji: '🐈', lifeStatus: 'departed', hasMemorial: false, notebookEnabled: true, notebookPrivacy: 'private' },
  ]
  const note = (id: string, memorialId: string, date: string, title: string, content: string, tagIds: string[] = []): Note => ({ id, memorialId, title, content, date, photos: [], createdAt: stamp(date), updatedAt: stamp(date), tagIds })
  const notes: Note[] = [
    note('note-debug-niangao-1', 'debug-niangao', shift(today, -1), '公园', '在草地上打了三个滚，回家还沾着草籽。', ['tag-debug-sunny']),
    note('note-debug-niangao-2', 'debug-niangao', shift(today, -20), '', '第一次学会握手。'),
    note('note-debug-xiaoman', 'debug-xiaoman', shift(today, -4), '胡萝卜', '把叶子留到了最后。'),
    note('note-debug-tuanzi-1', 'debug-tuanzi', shift(today, -2), '小雏菊', '今天带了一朵花来看你。'),
    note('note-debug-tuanzi-2', 'debug-tuanzi', shift(today, -30), '窗台', '下午的阳光还停在原来的位置。'),
    note('note-debug-abai', 'debug-abai', shift(today, -12), '', '它把脑袋靠过来的时候，房间都变轻了。'),
    note('note-debug-xingxing', 'debug-xingxing', shift(today, -15), '夜跑', '口袋里还留着当时的瓜子壳。'),
    note('note-debug-overview', OVERVIEW_NOTEBOOK, shift(today, -1), '一起的傍晚', '年糕在草坪上，团子的花还没谢。'),
    note('note-debug-doubao', 'debug-doubao', shift(today, -3), '捡球', '球还没落地，它已经转身往回跑。'),
    note('note-debug-niunai', 'debug-niunai', shift(today, -6), '排队', '今天的玩具被排成了很直的一列。'),
    note('note-debug-xueqiu', 'debug-xueqiu', shift(today, -11), '胡同', '阳光正好停在它以前坐下的地方。'),
    note('note-debug-qingtuan', 'debug-qingtuan', shift(today, -20), '湖边', '换了一棵树，还是坐了一会儿。'),
  ]
  const receipt = (id: string, petId: string, kind: ItemKind, day: string) => ({ id, petId, kind, createdAt: stamp(day) })
  return {
    records,
    notes,
    receipts: [
      receipt('receipt-debug-niangao-1', 'debug-niangao', 'bone', shift(today, -1)),
      receipt('receipt-debug-niangao-2', 'debug-niangao', 'bone', shift(today, -8)),
      receipt('receipt-debug-niangao-3', 'debug-niangao', 'can', shift(today, -8)),
      receipt('receipt-debug-xiaoman', 'debug-xiaoman', 'heartBalloon', shift(today, -4)),
      receipt('receipt-debug-tuanzi-1', 'debug-tuanzi', 'flower', shift(today, -2)),
      receipt('receipt-debug-tuanzi-2', 'debug-tuanzi', 'rose', shift(today, -30)),
      receipt('receipt-debug-tuanzi-3', 'debug-tuanzi', 'candle', leavingToday),
      receipt('receipt-debug-xingxing', 'debug-xingxing', 'flower', shift(today, -15)),
      receipt('receipt-debug-doubao', 'debug-doubao', 'bone', shift(today, -3)),
      receipt('receipt-debug-xueqiu', 'debug-xueqiu', 'flower', shift(today, -11)),
      receipt('receipt-debug-wanfeng', 'debug-wanfeng', 'candle', shift(today, -9)),
    ],
    garden: { pets: [{ petId: 'debug-niangao', x: 28, y: 68 }, { petId: 'debug-xiaoman', x: 62, y: 74 }, { petId: 'debug-doubao', x: 40, y: 62 }, { petId: 'debug-niunai', x: 78, y: 70 }], memorials: ['debug-tuanzi', 'debug-xingxing', 'debug-xueqiu', 'debug-wanfeng', 'debug-huasheng', 'debug-shanzhu', 'debug-haiyan', 'debug-qingtuan', 'debug-bingbing', 'debug-yunduo', 'debug-huyang', 'debug-yezi'] },
    notebookSettings: { 'debug-niangao': { tags: [{ id: 'tag-debug-sunny', name: '晒太阳' }] } },
  }
}
