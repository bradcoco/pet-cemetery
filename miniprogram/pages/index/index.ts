import { listMemorials, showError, isCloud } from '../../services/store'
import { Memorial } from '../../utils/model'
import { toMapCoordinate } from '../../utils/geo'
import { canUseMap } from '../../utils/platform'
import { PROVINCES } from '../../data/provinces'
import { provinceForPet, provincePoints } from '../../utils/provinces'
import { markerAsset, markerPhoto, loadMarkerImage, exportPetMarker } from '../../utils/markers'
const speciesIcon = (species: string) => species === '狗狗' ? '🐶' : species === '猫咪' ? '🐱' : species === '兔兔' ? '🐰' : species === '鸟儿' ? '🐦' : '🐾'
Page({
  data: {
    loading: true, error: '', isCloud, records: [] as Memorial[], provincePets: [] as Memorial[], pointGroups: [] as Memorial[][], pointPets: [] as Memorial[], markers: [] as object[], polygons: [] as object[],
    provinceCode: '', provinceName: '中国', examples: false,
    mapLng: 104, mapLat: 35, scale: 5, mapAvailable: false,
  },
  markerVersion:0,
  markerJob:Promise.resolve(),
  onUnload(){this.markerVersion++},
  onLoad() { this.setData({ mapAvailable: canUseMap() }) },
  onShow() { this.load() },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      const records = await listMemorials()
      this.setData({ records, examples: records.some(p => p.demo) }); this.updateProvince()
    }
    catch (error) { this.setData({ error: showError(error) }) }
    finally { this.setData({ loading: false }) }
  },
  selectProvince(code: string) {
    const province = PROVINCES.find(p => p.code === code)
    if (!province) return
    const center = toMapCoordinate(province.center[1],province.center[0])
    this.setData({ provinceCode: code, provinceName: province.name, mapLat: center.latitude, mapLng: center.longitude, scale: 7 })
    this.updateProvince(); wx.nextTick(() => this.fitProvince())
  },
  provinceTap(e: WechatMiniprogram.CustomEvent<{code: string}>) { this.selectProvince(e.detail.code) },
  national() { this.markerVersion++; this.setData({ provinceCode: '', provinceName: '中国', provincePets: [], pointGroups: [], pointPets: [], markers: [], polygons: [] }) },
  updateProvince() {
    const province = PROVINCES.find(p => p.code === this.data.provinceCode)
    if (!province) return
    const provincePets = this.data.records.filter(p => provinceForPet(p) === province.code), groups = new Map<string, Memorial[]>()
    for (const pet of provincePets) { const key = `${pet.latitude.toFixed(5)},${pet.longitude.toFixed(5)}`; groups.set(key,[...(groups.get(key) || []),pet]) }
    const pointGroups = [...groups.values()]
    this.setData({
      provincePets, pointGroups,
      markers: pointGroups.map((pets,i) => {
        const m = pets[0]
        return { id: i, latitude: m.latitude, longitude: m.longitude, iconPath: markerAsset(m), width: 40, height: 50, callout: { content: `${speciesIcon(m.species)} ${m.name}${pets.length > 1 ? '等 ' + pets.length + ' 只' : ''}`, color: '#436d87', bgColor: '#fff', borderRadius: 14, padding: 8, display: pointGroups.length <= 20 ? 'ALWAYS' : 'BYCLICK' } }
      }),
      polygons: province.polygons.map(poly => ({ points: poly[0].map(p => toMapCoordinate(p[1],p[0])), strokeColor: '#75bda7', strokeWidth: 2, fillColor: '#8fd5b41a', zIndex: 1 })),
    })
    this.renderMarkers()
  },
  renderMarkers(){
    const version=++this.markerVersion,pets=this.data.pointGroups.map(group=>group[0])
    if(!this.data.mapAvailable||!pets.length)return
    this.markerJob=this.markerJob.then(async()=>{
      if(version!==this.markerVersion)return
      const canvas=await new Promise<WechatMiniprogram.Canvas|null>(resolve=>this.createSelectorQuery().select('#marker-canvas').fields({node:true}).exec(result=>resolve(result[0]?.node||null)))
      if(!canvas||version!==this.markerVersion)return
      const images=await Promise.all(pets.map(p=>loadMarkerImage(canvas,markerPhoto(p))))
      for(let i=0;i<pets.length;i++){
        if(version!==this.markerVersion)return
        try{const path=await exportPetMarker(canvas,pets[i],images[i]);if(version===this.markerVersion)this.setData({markers:this.data.markers.map((marker,j)=>j===i?{...marker,iconPath:path}:marker)})}
        catch(_){/* 当前端不支持画布导出时保留同款静态标记。 */}
      }
    }).catch(()=>{})
  },
  fitProvince() {
    const province = PROVINCES.find(p => p.code === this.data.provinceCode)
    if (!province || !this.data.mapAvailable) return
    const points = [...provincePoints(province).map(p => toMapCoordinate(p[1],p[0])), ...this.data.provincePets.map(p => ({longitude:p.longitude,latitude:p.latitude}))]
    const minLng = Math.min(...points.map(p => p.longitude)), maxLng = Math.max(...points.map(p => p.longitude)), minLat = Math.min(...points.map(p => p.latitude)), maxLat = Math.max(...points.map(p => p.latitude))
    wx.createMapContext('pet-map', this).includePoints({ points: [{latitude:minLat,longitude:minLng},{latitude:maxLat,longitude:maxLng}], padding: [48,36,48,36], fail: () => this.setData({ mapAvailable: false }) })
  },
  markerTap(e: WechatMiniprogram.CustomEvent<{markerId: number}>) {
    const pets = this.data.pointGroups[e.detail.markerId]
    if (!pets || !pets.length) return
    if (pets.length === 1) this.open(pets[0].id)
    else this.setData({ pointPets: pets })
  },
  petTap(e: WechatMiniprogram.CustomEvent<{id: string}>) {
    const pets = this.data.pointGroups.find(group => group.some(p => p.id === e.detail.id))
    if (pets && pets.length > 1) this.setData({ pointPets: pets }); else this.open(e.detail.id)
  },
  pointPet(e: WechatMiniprogram.TouchEvent) { this.open(e.currentTarget.dataset.id); this.closePoint() },
  closePoint() { this.setData({ pointPets: [] }) },
  stopTap() {},
  open(id: string) { wx.navigateTo({ url: `/pages/memorial/memorial?id=${encodeURIComponent(id)}` }) },
  mapError() { this.setData({ mapAvailable: false }) },
  onShareAppMessage() { return { title: '星屿 · 在地图上，看望想念的小伙伴', path: '/pages/index/index' } },
})
