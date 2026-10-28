import { PROVINCES, Province } from '../data/provinces'
import { fromMapCoordinate } from './geo'
import { Memorial } from './model'
export function inRing(point: number[], ring: number[][]): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j], cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0])
    if (Math.abs(cross) < 1e-10 && x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0]) && y >= Math.min(a[1], b[1]) && y <= Math.max(a[1], b[1])) return true
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}
export function containsProvince(province: Province, longitude: number, latitude: number): boolean {
  const [west, south, east, north] = province.bounds
  if (longitude < west || longitude > east || latitude < south || latitude > north) return false
  return province.polygons.some(poly => inRing([longitude, latitude], poly[0]) && !poly.slice(1).some(hole => inRing([longitude, latitude], hole)))
}
export function provinceForPet(pet: Memorial): string {
  if (!pet.locationName || !Number.isFinite(pet.latitude) || !Number.isFinite(pet.longitude) || pet.latitude === 0 && pet.longitude === 0) return ''
  const p = fromMapCoordinate(pet.latitude, pet.longitude)
  return (PROVINCES.find(province => containsProvince(province, p.longitude, p.latitude)) || { code: '' }).code
}
// Albers equal-area projection keeps the national outline and provincial proportions readable.
export function projectChina(longitude: number, latitude: number): number[] {
  const rad = Math.PI / 180, n = (Math.sin(25 * rad) + Math.sin(47 * rad)) / 2
  const c = Math.cos(25 * rad) ** 2 + 2 * n * Math.sin(25 * rad)
  const rho = Math.sqrt(c - 2 * n * Math.sin(latitude * rad)) / n, rho0 = Math.sqrt(c - 2 * n * Math.sin(35 * rad)) / n
  return [rho * Math.sin(n * (longitude - 105) * rad), rho0 - rho * Math.cos(n * (longitude - 105) * rad)]
}
export function provincePoints(province: Province): number[][] {
  const points = province.polygons.flatMap(poly => poly[0])
  return province.code === '460000' ? points.filter(p => p[1] >= 18) : points
}
