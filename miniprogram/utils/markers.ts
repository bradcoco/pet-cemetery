import { Memorial } from './model'
export type MarkerPet = Pick<Memorial,'stone'|'species'|'avatarEmoji'|'photos'|'photoUrls'|'markerPhoto'|'markerPhotoUrl'>
export const markerPhoto = (pet: MarkerPet): string => pet.markerPhotoUrl || pet.markerPhoto || (pet.photoUrls && pet.photoUrls[0]) || pet.photos[0] || ''
export const markerAsset = (pet: MarkerPet): string => `/assets/stone-${['arch','star','garden','heart','photo'].includes(pet.stone)?pet.stone:'arch'}.png`
export function loadMarkerImage(canvas: WechatMiniprogram.Canvas, src: string): Promise<WechatMiniprogram.Image | null> {
  if(!src)return Promise.resolve(null)
  return new Promise(resolve=>{
    const image=canvas.createImage(),timer=setTimeout(()=>resolve(null),5000)
    image.onload=()=>{clearTimeout(timer);resolve(image)}
    image.onerror=()=>{clearTimeout(timer);resolve(null)}
    image.src=src
  })
}
// Both native map icons and the canvas map use this same 96 × 120 drawing.
export function drawPetMarker(c:any,pet:MarkerPet,image:WechatMiniprogram.Image|null){
  const style=pet.stone||'arch',photo=style==='photo',color=style==='star'?'#d2def6':style==='garden'?'#f1dfbd':style==='heart'?'#f5cedd':'#cde4dc'
  c.save();c.beginPath()
  if(photo)c.rect(7,7,82,98)
  else if(style==='arch'){c.moveTo(6,108);c.lineTo(6,50);c.bezierCurveTo(6,-6,90,-6,90,50);c.lineTo(90,108);c.closePath()}
  else if(style==='heart'){c.moveTo(48,17);c.bezierCurveTo(10,-14,-9,31,11,49);c.lineTo(11,108);c.lineTo(85,108);c.lineTo(85,49);c.bezierCurveTo(105,31,86,-14,48,17);c.closePath()}
  else {c.moveTo(9,108);c.lineTo(9,27);c.quadraticCurveTo(9,9,27,9);c.lineTo(69,9);c.quadraticCurveTo(87,9,87,27);c.lineTo(87,108);c.closePath()}
  c.fillStyle=photo?'#ffffff':color;c.fill();c.strokeStyle='#ffffff';c.lineWidth=4;c.stroke()
  c.save();c.beginPath();if(photo)c.rect(10,10,76,92);else c.arc(48,62,28,0,Math.PI*2);c.clip()
  c.fillStyle='#f4fbff';c.fillRect(10,10,76,94)
  if(image){const width=image.width||1,height=image.height||1,w=photo?76:56,h=photo?92:56,scale=Math.max(w/width,h/height),x=photo?10:20,y=photo?10:34;c.drawImage(image,x+(w-width*scale)/2,y+(h-height*scale)/2,width*scale,height*scale)}
  else {c.font='34px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#618a9a';c.fillText(pet.avatarEmoji||(pet.species==='狗狗'?'🐶':pet.species==='猫咪'?'🐱':pet.species==='兔兔'?'🐰':pet.species==='鸟儿'?'🐦':'🐾'),48,65)}
  c.restore()
  if(!photo){c.font='21px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=style==='heart'?'#bf7996':'#789c98';c.fillText(style==='star'?'✧':style==='garden'?'❀':style==='heart'?'♡':'☽',48,22);c.fillStyle='#ffffff';c.fillRect(31,98,34,3)}
  c.fillStyle=photo?'#ffffff':color;c.beginPath();c.moveTo(39,108);c.lineTo(57,108);c.lineTo(48,119);c.closePath();c.fill();c.restore()
}
export async function exportPetMarker(canvas:WechatMiniprogram.Canvas,pet:MarkerPet,image:WechatMiniprogram.Image|null):Promise<string>{
  canvas.width=96;canvas.height=120
  const c=canvas.getContext('2d');c.clearRect(0,0,96,120);drawPetMarker(c,pet,image)
  const result=await wx.canvasToTempFilePath({canvas,width:96,height:120,destWidth:96,destHeight:120,fileType:'png'})
  return result.tempFilePath
}
