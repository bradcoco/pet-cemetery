# 第三方数据

中国分省地图使用阿里云 DataV GeoAtlas 省级区域数据，保留 34 个省级地区和南海附图数据。

- 数据来源：https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json （获取日期：2026-10-28）
- `miniprogram/data/provinces.ts` 用于区域选择和点位归属；详细底图由当前端的原生地图组件提供。
- 重新生成：`python3 scripts/build-provinces.py /path/to/100000_full.json`。
- PNG 图标和纪念物样式由本项目代码生成或绘制。
