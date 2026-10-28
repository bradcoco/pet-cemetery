"""Build small, dependency-free PNG assets for the multi-platform app."""
import json, math, struct, zlib
from pathlib import Path
root = Path(__file__).resolve().parents[1]
assets = root / 'miniprogram/assets'
assets.mkdir(exist_ok=True)
def png(name, size, draw):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            rows.extend(draw((x+.5)/size, (y+.5)/size))
    def chunk(tag, data):
        return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
    (assets/name).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b''))
for active in [False,True]:
    color = (50,142,209,255) if active else (141,167,184,255)
    def map_icon(x,y):
        if not (.16<x<.84 and .2<y<.8): return (0,0,0,0)
        if abs(x-.18)<.02 or abs(x-.82)<.02 or abs(x-.39)<.018 or abs(x-.61)<.018: return color
        top=.22+(.08 if .39<x<.61 else 0)
        return color if abs(y-top)<.022 or abs(y-(top+.46))<.022 else (0,0,0,0)
    def folder(x,y):
        edge=(.18<x<.82 and (.28<y<.32 or .72<y<.76)) or (.18<x<.22 and .3<y<.74) or (.78<x<.82 and .3<y<.74)
        return color if edge or (.22<x<.46 and .22<y<.28) else (0,0,0,0)
    suffix='-active' if active else ''
    png('map'+suffix+'.png',81,map_icon)
    png('folder'+suffix+'.png',81,folder)
def marker(x,y):
    if math.hypot(x-.5,y-.36)<.32 or (.38<y<.95 and abs(x-.5)<(.95-y)*.39):
        return (255,255,255,255) if math.hypot(x-.5,y-.35)<.09 else (255,138,145,255)
    return (0,0,0,0)
png('marker.png',96,marker)
for kind, color in [('cat',(246,148,168,255)),('dog',(244,184,93,255)),('rabbit',(173,153,220,255)),('bird',(106,179,222,255)),('other',(100,191,158,255))]:
    def pet_marker(x,y,color=color):
        base=marker(x,y)
        return color if base==(255,138,145,255) else base
    png('marker-'+kind+'.png',96,pet_marker)
def portrait(x,y):
    bg=(230,247,255,255)
    if ((x-.3)**2/0.035+(y-.33)**2/.048<1 or (x-.7)**2/.035+(y-.33)**2/.048<1): bg=(178,139,93,255)
    if (x-.5)**2/.115+(y-.58)**2/.105<1: bg=(207,169,117,255)
    if ((x-.36)**2+(y-.55)**2<.0012 or (x-.64)**2+(y-.55)**2<.0012): bg=(61,64,49,255)
    if (x-.5)**2/.006+(y-.67)**2/.002<1: bg=(133,96,81,255)
    return bg
png('pet.png',240,portrait)
def appicon(x,y):
    if math.hypot(x-.5,y-.44)<.23: return (193,237,135,255)
    if .64<y<.68 and .32<x<.68: return (193,237,135,255)
    if abs(x-.5)<.015 and .63<y<.75: return (193,237,135,255)
    return (57,184,239,255)
png('app-icon.png',1024,appicon)
for size in [40,58,60,72,80,87,96,120,144,180,192]: png('app-icon-'+str(size)+'.png',size,appicon)
# Tombstone fallbacks for platforms without Canvas PNG export.
for style, color in [('arch',(205,228,220,255)),('star',(210,222,246,255)),('garden',(241,223,189,255)),('heart',(245,206,221,255)),('photo',(255,255,255,255))]:
    def stone_marker(x,y,style=style,color=color):
        if .88<y<.99 and abs(x-.5)<(.99-y)*.85: return color
        inside = .09<x<.91 and .08<y<.9
        if style=='arch': inside=.07<x<.93 and .35<y<.9 or ((x-.5)**2/.185+(y-.36)**2/.085<1 and y<.36)
        if not inside: return (0,0,0,0)
        if style=='photo' and .14<x<.86 and .14<y<.84: return portrait((x-.14)/.72,(y-.14)/.7)
        if (x-.5)**2+(y-.51)**2<.078: return portrait((x-.22)/.56,(y-.23)/.56)
        if .35<x<.65 and .79<y<.815: return (255,255,255,255)
        return color
    png('stone-'+style+'.png',120,stone_marker)
