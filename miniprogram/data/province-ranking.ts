export interface ProvinceRank { rank: number; name: string; pets: number; points: number; pointsText: string }

const pointsText = (points: number) => String(points).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const drafted: { name: string; pets: number; points: number }[] = [
  { name: '广东', pets: 86, points: 18640 },
  { name: '江苏', pets: 74, points: 16220 },
  { name: '浙江', pets: 69, points: 15180 },
  { name: '四川', pets: 63, points: 13950 },
  { name: '山东', pets: 58, points: 12840 },
  { name: '河南', pets: 55, points: 12110 },
  { name: '上海', pets: 41, points: 11480 },
  { name: '北京', pets: 38, points: 10960 },
  { name: '湖北', pets: 44, points: 9860 },
  { name: '湖南', pets: 42, points: 9420 },
  { name: '福建', pets: 36, points: 8910 },
  { name: '安徽', pets: 39, points: 8540 },
  { name: '河北', pets: 37, points: 8120 },
  { name: '陕西', pets: 33, points: 7680 },
  { name: '辽宁', pets: 31, points: 7210 },
  { name: '重庆', pets: 28, points: 6890 },
  { name: '江西', pets: 29, points: 6540 },
  { name: '云南', pets: 26, points: 6120 },
  { name: '广西', pets: 24, points: 5780 },
  { name: '山西', pets: 22, points: 5340 },
  { name: '黑龙江', pets: 21, points: 4980 },
  { name: '贵州', pets: 19, points: 4620 },
  { name: '吉林', pets: 18, points: 4310 },
  { name: '内蒙古', pets: 16, points: 3980 },
  { name: '天津', pets: 14, points: 3640 },
  { name: '新疆', pets: 15, points: 3410 },
  { name: '甘肃', pets: 12, points: 2980 },
  { name: '海南', pets: 11, points: 2760 },
  { name: '台湾', pets: 10, points: 2540 },
  { name: '宁夏', pets: 8, points: 2180 },
  { name: '香港', pets: 7, points: 1960 },
  { name: '青海', pets: 6, points: 1720 },
  { name: '西藏', pets: 5, points: 1380 },
  { name: '澳门', pets: 4, points: 960 },
]

export const PROVINCE_RANKING: ProvinceRank[] = [...drafted].sort((a, b) => b.points - a.points).map((item, index) => ({ ...item, rank: index + 1, pointsText: pointsText(item.points) }))
