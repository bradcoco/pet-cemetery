import { CLOUD_ENV } from './config'
import { isNativeApp } from './utils/platform'

App({
  onLaunch() {
    if (CLOUD_ENV && !isNativeApp() && wx.cloud) wx.cloud.init({ env: CLOUD_ENV, traceUser: false })
  },
})
