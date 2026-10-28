"""Generate bundled province geometry from DataV GeoAtlas's 100000_full.json."""
import json, sys
from pathlib import Path
source = Path(sys.argv[1])
shorts = ['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','台湾','香港','澳门']
provinces, maritime = [], []
for feature in json.loads(source.read_text())['features']:
    prop, geometry = feature['properties'], feature['geometry']
    polygons = geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
    if prop.get('adchar')=='JD':
        maritime = polygons
        continue
    points = [point for polygon in polygons for ring in polygon for point in ring]
    provinces.append(dict(code=str(prop['adcode']),name=prop['name'],short=shorts[len(provinces)],center=prop['center'],label=prop.get('centroid',prop['center']),bounds=[min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points)],polygons=polygons))
assert len(provinces)==34 and maritime
out = Path(__file__).resolve().parents[1]/'miniprogram/data/provinces.ts'
out.write_text('// Source: Alibaba Cloud DataV GeoAtlas. See THIRD_PARTY_NOTICES.md.\nexport interface Province { code: string; name: string; short: string; center: number[]; label: number[]; bounds: number[]; polygons: number[][][][] }\nexport const PROVINCES: Province[] = '+json.dumps(provinces,ensure_ascii=False,separators=(',',':'))+'\nexport const MARITIME: number[][][][] = '+json.dumps(maritime,separators=(',',':'))+'\n')
print(f'{len(provinces)} provinces; {out.stat().st_size} bytes')
