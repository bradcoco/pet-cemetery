// 微信开发者工具的多端条件编译；未预处理时默认按微信端检查类型。
export function isNativeApp(): boolean {
  // #if MP
  return false
  // #elif IOS
  return true
  // #elif ANDROID
  return true
  // #else
  return true
  // #endif
}
export function canUseMap(): boolean { return wx.canIUse('map') }
export async function confirmPetRevival(name: string): Promise<boolean> {
  const result=await wx.showModal({title:'看广告复活',content:`让「${name}」重新回到现存伙伴中？\n\n广告功能占位：当前暂未接入真实广告，点击确认即可复活。原编号、照片与笔记都会保留，离开日期和地图墓碑将清除。`,confirmText:'确认复活',cancelText:'暂不复活',confirmColor:'#5badeb'})
  return result.confirm
}
export async function choosePhotos(count: number): Promise<string[]> {
  if (wx.canIUse('chooseMedia')) {
    const result = await wx.chooseMedia({ count, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['album', 'camera'] })
    return result.tempFiles.map(file => file.tempFilePath)
  }
  const result = await wx.chooseImage({ count, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
  return result.tempFilePaths as string[]
}
