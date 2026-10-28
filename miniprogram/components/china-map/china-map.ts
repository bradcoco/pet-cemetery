import { MARITIME, PROVINCES } from '../../data/provinces'
import { inRing, projectChina, provincePoints } from '../../utils/provinces'
import { fromMapCoordinate } from '../../utils/geo'
import { Memorial } from '../../utils/model'
import { drawPetMarker, markerPhoto, loadMarkerImage } from '../../utils/markers'
type Finger = {x: number; y: number}
interface MapState {
  images:Map<string,WechatMiniprogram.Image|null>;
  canvas: WechatMiniprogram.Canvas | null; ctx: any; width: number; height: number; frame: number
  shapes: { code: string; polygons: number[][][][] }[]; labels: { code: string; x: number; y: number; width: number }[]; pins: { id: string; x: number; y: number }[]
  zoom: number; panX: number; panY: number; start: Finger | null; last: Finger | null; pinch: number; moved: boolean
}
const properties = { province: { type: String, value: '' }, pets: { type: Array, value: [] as Memorial[] } }
type Methods = { [K in 'init' | 'render' | 'draw' | 'hit' | 'canvasError' | 'retry' | 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel' | 'setZoom' | 'zoomIn' | 'zoomOut' | 'reset' | 'clampPan' | 'report']: (...args: any[]) => void }
const offsets: Record<string, number[]> = { '110000': [-7,-8], '120000': [12,4], '310000': [12,0], '810000': [14,-2], '820000': [-6,12] }
Component<{ failed: boolean; currentZoom: number; zoomLabel: string }, typeof properties, Methods, { state: MapState }>({
  properties,
  data: { failed: false, currentZoom: 1, zoomLabel: '1.0' },
  observers: { 'province,pets': function () { if (this.state && this.state.ctx) this.render() } },
  lifetimes: {
    created() { this.state = { images:new Map(),canvas: null, ctx: null, width: 0, height: 0, frame: 0, shapes: [], labels: [], pins: [], zoom: 1, panX: 0, panY: 0, start: null, last: null, pinch: 0, moved: false } },
    ready() { this.init() },
    detached() { if (this.state.canvas && this.state.frame) this.state.canvas.cancelAnimationFrame(this.state.frame); this.state.canvas = null },
  },
  pageLifetimes: { resize() { this.init() } },
  methods: {
    init() {
      this.createSelectorQuery().select('#china').fields({ node: true, size: true }).exec(result => {
        if (!result[0] || !result[0].node) { this.setData({ failed: true }); return }
        const { node, width, height } = result[0], ratio = Math.min(wx.getSystemInfoSync().pixelRatio, 2)
        if (this.state.canvas && this.state.frame) this.state.canvas.cancelAnimationFrame(this.state.frame)
        this.state = { ...this.state, canvas: node, ctx: node.getContext('2d'), width, height, frame: 0 }
        node.width = width * ratio; node.height = height * ratio; this.state.ctx.scale(ratio, ratio)
        this.clampPan(); this.render()
      })
    },
    render() {
      if (!this.state.canvas || !this.state.ctx || this.state.frame) return
      for(const pet of this.properties.pets as Memorial[]){
        const src=markerPhoto(pet)
        if(src&&!this.state.images.has(src)){
          const canvas=this.state.canvas;this.state.images.set(src,null)
          loadMarkerImage(canvas,src).then(image=>{if(this.state.canvas===canvas&&image){this.state.images.set(src,image);this.render()}})
        }
      }
      this.state.frame = this.state.canvas.requestAnimationFrame(() => { this.state.frame = 0; try { this.draw() } catch (_) { this.setData({ failed: true }) } })
    },
    draw() {
      const { ctx: c, width: w, height: h, zoom, panX, panY } = this.state
      const selected = PROVINCES.find(p => p.code === this.properties.province), provinces = selected ? [selected] : PROVINCES
      const projected = (selected ? provincePoints(selected) : provinces.flatMap(p => provincePoints(p))).filter(p => selected || p[1] >= 18).map(p => projectChina(p[0],p[1]))
      const minX = Math.min(...projected.map(p => p[0])), maxX = Math.max(...projected.map(p => p[0])), minY = Math.min(...projected.map(p => p[1])), maxY = Math.max(...projected.map(p => p[1]))
      const pad = selected ? 25 : 12, scale = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2 - (selected ? 0 : 24)) / (maxY - minY))
      const screen = (point: number[]) => { const p = projectChina(point[0],point[1]); return [w / 2 + (p[0] - (minX + maxX) / 2) * scale * zoom + panX, h / 2 - (p[1] - (minY + maxY) / 2) * scale * zoom + panY] }
      c.clearRect(0,0,w,h); this.state.shapes = []; this.state.labels = []; this.state.pins = []
      c.save(); c.beginPath(); c.rect(0,0,w,h); c.clip()
      for (const province of provinces) {
        const polygons = province.polygons.map(poly => poly.map(ring => ring.map(screen)))
        this.state.shapes.push({ code: province.code, polygons }); c.beginPath()
        for (const poly of polygons) for (const ring of poly) { ring.forEach((p,i) => i ? c.lineTo(p[0],p[1]) : c.moveTo(p[0],p[1])); c.closePath() }
        c.fillStyle = '#c6e8d9'; c.fill('evenodd'); c.strokeStyle = '#ffffff'; c.lineWidth = 1.2; c.stroke()
      }
      if (selected) {
        const groups=new Map<string,Memorial[]>()
        for(const pet of this.properties.pets as Memorial[]){const key=`${pet.latitude.toFixed(5)},${pet.longitude.toFixed(5)}`;groups.set(key,[...(groups.get(key)||[]),pet])}
        for (const pets of groups.values()) {
          const pet=pets[0],p = fromMapCoordinate(pet.latitude, pet.longitude), [x,y] = screen([p.longitude,p.latitude])
          this.state.pins.push({ id: pet.id, x, y:y-17 })
          c.save();c.translate(x-15,y-37.5);c.scale(30/96,37.5/120);drawPetMarker(c,pet,this.state.images.get(markerPhoto(pet))||null);c.restore()
          c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#466e87'; c.fillText(pet.name+(pets.length>1?'等 '+pets.length+' 只':''),x,y-43)
        }
      } else {
        c.font = `${w < 330 ? 9 : 10}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'
        for (const p of provinces) {
          const [px,py] = screen(p.label), offset = offsets[p.code] || [0,0], x = px + offset[0], y = py + offset[1]
          if (offset[0] || offset[1]) { c.strokeStyle = '#8bb7a8'; c.lineWidth = .6; c.beginPath(); c.moveTo(px,py); c.lineTo(x,y); c.stroke() }
          c.lineWidth = 3; c.strokeStyle = '#ffffffc9'; c.strokeText(p.short,x,y); c.fillStyle = '#4f8575'; c.fillText(p.short,x,y)
          this.state.labels.push({ code: p.code, x, y, width: p.short.length * 10 })
        }
        if (zoom === 1) {
          const iw = 48, ih = 73, ix = w - iw - 12, iy = h - ih - 15
          c.save(); c.beginPath(); c.rect(ix,iy,iw,ih); c.clip(); c.fillStyle = '#f1faff'; c.fillRect(ix,iy,iw,ih)
          const seaPoint = (p: number[]) => [ix + (p[0]-105)/21*iw, iy + (25-p[1])/23*ih]
          c.fillStyle = '#b8d9cd'; c.strokeStyle = '#94bfb6'; c.lineWidth = .7
          for (const polygons of [...PROVINCES.map(p => p.polygons), MARITIME]) for (const poly of polygons) for (const ring of poly) {
            c.beginPath(); ring.map(seaPoint).forEach((p,i) => i ? c.lineTo(p[0],p[1]) : c.moveTo(p[0],p[1])); c.closePath(); c.fill(); c.stroke()
          }
          c.restore(); c.strokeStyle = '#d0e3eb'; c.lineWidth = 1; c.strokeRect(ix,iy,iw,ih); c.fillStyle = '#7e9baa'; c.font = '8px sans-serif'; c.fillText('南海诸岛',ix+iw/2,iy+ih+7)
        }
      }
      c.restore()
    },
    hit(point: Finger) {
      const {x,y} = point
      if (this.properties.province) {
        const pin = [...this.state.pins].sort((a,b) => Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]
        if (pin && Math.hypot(pin.x-x,pin.y-y)<22) this.triggerEvent('pettap',{id:pin.id})
        return
      }
      const label = this.state.labels.find(p => Math.abs(p.x-x) <= p.width/2+2 && Math.abs(p.y-y) <= 7)
      const shape = this.state.shapes.find(p => p.polygons.some(poly => inRing([x,y],poly[0]) && !poly.slice(1).some(hole => inRing([x,y],hole))))
      const code = label ? label.code : shape ? shape.code : ''
      if (code) this.triggerEvent('provincechange',{code})
    },
    clampPan() {
      const x = this.state.width * (this.state.zoom - 1) / 2, y = this.state.height * (this.state.zoom - 1) / 2
      this.state.panX = Math.max(-x,Math.min(x,this.state.panX)); this.state.panY = Math.max(-y,Math.min(y,this.state.panY))
    },
    report() { this.setData({ currentZoom: this.state.zoom, zoomLabel: this.state.zoom.toFixed(1) }) },
    setZoom(value: number, anchor?: Finger, report = true) {
      const zoom = Math.max(1,Math.min(5,value)), factor = zoom / this.state.zoom, x = (anchor ? anchor.x : this.state.width/2) - this.state.width/2, y = (anchor ? anchor.y : this.state.height/2) - this.state.height/2
      this.state.panX = x - (x - this.state.panX) * factor; this.state.panY = y - (y - this.state.panY) * factor; this.state.zoom = zoom
      this.clampPan(); this.render(); if (report) this.report()
    },
    zoomIn() { this.setZoom(this.state.zoom * 1.4) },
    zoomOut() { this.setZoom(this.state.zoom / 1.4) },
    reset() { this.state.panX = 0; this.state.panY = 0; this.setZoom(1) },
    touchStart(e: WechatMiniprogram.TouchEvent) {
      const touches = e.touches as unknown as Finger[]
      this.state.start = touches[0]; this.state.last = touches[0]; this.state.moved = false
      this.state.pinch = touches.length >= 2 ? Math.hypot(touches[0].x-touches[1].x,touches[0].y-touches[1].y) : 0
    },
    touchMove(e: WechatMiniprogram.TouchEvent) {
      const touches = e.touches as unknown as Finger[]
      if (!touches.length || !this.state.last) return
      if (touches.length >= 2) {
        const distance = Math.hypot(touches[0].x-touches[1].x,touches[0].y-touches[1].y)
        if (this.state.pinch) this.setZoom(this.state.zoom * distance / this.state.pinch,{x:(touches[0].x+touches[1].x)/2,y:(touches[0].y+touches[1].y)/2},false)
        this.state.pinch = distance; this.state.moved = true
      } else {
        if (this.state.pinch) { this.state.pinch = 0; this.state.last = touches[0]; return }
        this.state.panX += touches[0].x-this.state.last.x; this.state.panY += touches[0].y-this.state.last.y
        this.clampPan(); this.render()
        if (this.state.start && Math.hypot(touches[0].x-this.state.start.x,touches[0].y-this.state.start.y)>5) this.state.moved = true
      }
      this.state.last = touches[0]
    },
    touchEnd(e: WechatMiniprogram.TouchEvent) {
      if (e.touches && e.touches.length) { this.state.last = e.touches[0] as unknown as Finger; this.state.pinch = 0; this.state.moved = true; return }
      if (!this.state.moved && this.state.start) this.hit(this.state.start)
      this.report(); this.touchCancel()
    },
    touchCancel() { this.state.start = null; this.state.last = null; this.state.pinch = 0 },
    canvasError() { this.setData({ failed: true }) },
    retry() { this.setData({ failed: false }); wx.nextTick(() => this.init()) },
  },
})
