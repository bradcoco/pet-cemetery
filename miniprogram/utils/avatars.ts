export const PET_EMOJIS = [
  {emoji:'🐱',species:'猫咪'},{emoji:'🐈',species:'猫咪'},{emoji:'🐈‍⬛',species:'猫咪'},
  {emoji:'🐶',species:'狗狗'},{emoji:'🐕',species:'狗狗'},{emoji:'🐩',species:'狗狗'},{emoji:'🦮',species:'狗狗'},
  {emoji:'🐰',species:'兔兔'},{emoji:'🐇',species:'兔兔'},
  {emoji:'🐦',species:'鸟儿'},{emoji:'🐤',species:'鸟儿'},{emoji:'🐥',species:'鸟儿'},{emoji:'🦜',species:'鸟儿'},{emoji:'🦉',species:'鸟儿'},
  {emoji:'🐹',species:'其他'},{emoji:'🐭',species:'其他'},{emoji:'🐢',species:'其他'},{emoji:'🦎',species:'其他'},{emoji:'🐠',species:'其他'},{emoji:'🐟',species:'其他'},{emoji:'🐴',species:'其他'},{emoji:'🦔',species:'其他'},{emoji:'🐿️',species:'其他'},{emoji:'🦊',species:'其他'},{emoji:'🐸',species:'其他'},{emoji:'🐾',species:'其他'},
]
export function defaultPetEmoji(species: string): string { return species==='猫咪'?'🐱':species==='狗狗'?'🐶':species==='兔兔'?'🐰':species==='鸟儿'?'🐦':'🐾' }
