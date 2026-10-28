const RAD = Math.PI / 180
// 省界可视化使用 WGS84；国内原生地图选点使用 GCJ02。
export function toMapCoordinate(latitude: number, longitude: number): { latitude: number; longitude: number } {
  if (longitude < 72.004 || longitude > 137.8347 || latitude < .8293 || latitude > 55.8271) return { latitude, longitude }
  const x = longitude - 105, y = latitude - 35
  let a = -100 + 2 * x + 3 * y + .2 * y * y + .1 * x * y + .2 * Math.sqrt(Math.abs(x))
  let b = 300 + x + 2 * y + .1 * x * x + .1 * x * y + .1 * Math.sqrt(Math.abs(x))
  const common = (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3
  a += common + (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3 + (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3
  b += common + (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3 + (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3
  const sin = Math.sin(latitude * RAD), magic = 1 - .006693421622965943 * sin * sin, sqrt = Math.sqrt(magic)
  return { latitude: latitude + a * 180 / ((6378245 * (1 - .006693421622965943)) / (magic * sqrt) * Math.PI), longitude: longitude + b * 180 / (6378245 / sqrt * Math.cos(latitude * RAD) * Math.PI) }
}

export function fromMapCoordinate(latitude: number, longitude: number): { latitude: number; longitude: number } {
  let result = { latitude, longitude }
  for (let i = 0; i < 3; i++) {
    const mapped = toMapCoordinate(result.latitude, result.longitude)
    result = { latitude: result.latitude + latitude - mapped.latitude, longitude: result.longitude + longitude - mapped.longitude }
  }
  return result
}
