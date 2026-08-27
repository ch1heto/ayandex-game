"""Build visual-only Tiled surfaces from authored ground, never gameplay geometry.
Shared vertex materials + periodic texture coordinates make every tile edge agree.
Run with the project Pillow runtime. No runtime canvas generation or per-frame work.
"""
from pathlib import Path
from collections import Counter
import hashlib
import json
import math
import random
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/current-pass"
TILE = 32
PERIOD = 128
PALETTES = [
    ["#304939", "#38513c", "#415b40", "#506444", "#758054"],  # meadow
    ["#63533d", "#716047", "#7e694b", "#8b7351", "#ab9163"],  # worn earth
    ["#474e49", "#4d544e", "#535a53", "#596058", "#63685e"],  # settlement stone
    ["#302c35", "#35303a", "#3a343e", "#403943", "#48404a"],  # spider soil
    ["#343540", "#393b46", "#41434d", "#484954", "#515360"],  # catacomb stone
]

def noise(x, y, step, seed=0):
    def h(a, b):
        a %= PERIOD // step; b %= PERIOD // step
        return (((a * 73856093) ^ (b * 19349663) ^ (seed * 83492791)) * 1664525 + 1013904223 & 0xffffffff) / 0xffffffff
    ix, iy = x // step, y // step
    fx, fy = (x % step) / step, (y % step) / step
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    return (h(ix, iy) * (1-fx) + h(ix+1, iy) * fx) * (1-fy) + (h(ix, iy+1) * (1-fx) + h(ix+1, iy+1) * fx) * fy

def texture(material):
    palette = PALETTES[material]
    im = Image.new("RGBA", (PERIOD, PERIOD))
    p = im.load()
    for y in range(PERIOD):
        for x in range(PERIOD):
            shade = noise(x, y, 32, material+3) * .65 + noise(x, y, 8, material+11) * .35
            p[x,y] = tuple(bytes.fromhex(palette[min(3, int(shade*4))][1:])) + (255,)
    rng = random.Random(1703 + material)
    draw = ImageDraw.Draw(im)
    def wrap_rect(x,y,w,h,color):
        for ox in [-PERIOD,0,PERIOD]:
            for oy in [-PERIOD,0,PERIOD]:
                draw.rectangle((x+ox,y+oy,x+ox+w-1,y+oy+h-1), fill=color)
    if material in (2,4):
        # Wrapped, staggered Voronoi stones. No tile-sized outlines.
        centers=[]
        for row in range(7):
            for col in range(7):
                centers.append((col*PERIOD/7 + (row%2)*7 + rng.randint(-4,4), row*PERIOD/7 + rng.randint(-4,4)))
        for y in range(PERIOD):
            for x in range(PERIOD):
                distances=[]
                for cx,cy in centers:
                    dx=(x-cx+PERIOD/2)%PERIOD-PERIOD/2
                    dy=(y-cy+PERIOD/2)%PERIOD-PERIOD/2
                    distances.append((math.hypot(dx,dy*1.22),dx,dy))
                distances.sort()
                first,second=distances[:2]
                if second[0]-first[0]<.65:
                    p[x,y] = tuple(bytes.fromhex(("#383f39" if material==2 else "#292d37")[1:]))+(255,)
                elif second[0]-first[0]<1.5 and first[1]+first[2]<-2:
                    p[x,y]=tuple(bytes.fromhex(palette[4][1:]))+(255,)
    elif material == 0:
        for i in range(320):
            x,y=rng.randrange(PERIOD),rng.randrange(PERIOD)
            wrap_rect(x-1,y,5,2,palette[0])
            wrap_rect(x,y-1,3,2,palette[2])
            wrap_rect(x+1,y-3,1,3,palette[3])
            wrap_rect(x-2,y-2,1,2,palette[3])
            if i%4==0: wrap_rect(x+1,y-3,1,1,palette[4])
            if i%5==0:
                wrap_rect(x+3,y-1,2,1,palette[3]); wrap_rect(x+4,y-2,1,1,palette[4])
        for i in range(160):
            wrap_rect(rng.randrange(PERIOD),rng.randrange(PERIOD),2,1,palette[rng.choice([1,2,3])])
    elif material == 1:
        for i in range(180):
            x,y=rng.randrange(PERIOD),rng.randrange(PERIOD)
            wrap_rect(x,y,2+(i%2),1,palette[1 if i%3 else 4])
            if i%4==0:
                wrap_rect(x,y+1,3,1,"#584d38")
                wrap_rect(x+1,y-1,2,1,palette[3])
        for i in range(320):
            wrap_rect(rng.randrange(PERIOD),rng.randrange(PERIOD),1+(i%2),1,palette[rng.choice([0,1,2,3])])
    else:
        for i in range(15):
            x,y=rng.randrange(PERIOD),rng.randrange(PERIOD)
            for step in range(rng.randint(3,7)):
                wrap_rect(x+step*2,y+step//2,2,1,"#292831")
                if step%3==0: wrap_rect(x+step*2,y+step//2+1,2,1,palette[3])
        for i in range(30):
            wrap_rect(rng.randrange(PERIOD),rng.randrange(PERIOD),2,1,palette[4])
    return im

def material(gid, dungeon):
    if dungeon: return 4
    if gid <= 4: return 0
    if gid in (5,6,11,12): return 1
    if gid <= 10: return 2
    return 3

def make_vertices(data, width, height, dungeon):
    vertices=[]
    for y in range(height+1):
        row=[]
        for x in range(width+1):
            samples=[material(data[min(height-1,max(0,cy))*width+min(width-1,max(0,cx))], dungeon)
                     for cx,cy in [(x-1,y-1),(x,y-1),(x-1,y),(x,y)]]
            counts=Counter(samples)
            # A deterministic tie-break shared by all tiles touching this vertex.
            row.append(max(sorted(counts), key=counts.get))
        vertices.append(row)
    return vertices

def build():
    OUT.mkdir(parents=True, exist_ok=True)
    textures=[texture(m) for m in range(5)]
    pixels=[im.load() for im in textures]
    organic=[[noise(x,y,8,27)*.55 + noise(x,y,16,21)*.45 for x in range(PERIOD)] for y in range(PERIOD)]
    breakup=[[noise(x,y,4,59) for x in range(PERIOD)] for y in range(PERIOD)]
    cache={}; tiles=[]; documents=[]; metadata=[]
    for name,source,dungeon in [("ashvale-ground","ashvale-world",False),("catacombs-ground","ashen-catacombs",True)]:
        source_path=ROOT/"maps"/(source+".json")
        original=json.loads(source_path.read_text(encoding="utf-8-sig"))
        width,height=original["width"],original["height"]
        authored=next(layer["data"] for layer in original["layers"] if layer["name"]=="Ground")
        vertices=make_vertices(authored,width,height,dungeon)
        data=[]
        for ty in range(height):
            for tx in range(width):
                if not authored[ty*width+tx]: data.append(0); continue
                corners=(vertices[ty][tx],vertices[ty][tx+1],vertices[ty+1][tx],vertices[ty+1][tx+1])
                phase_x,phase_y=tx%4,ty%4
                key=(corners,phase_x,phase_y)
                if key not in cache:
                    tile=Image.new("RGBA",(TILE,TILE)); dest=tile.load()
                    candidates=sorted(set(corners))
                    for py in range(TILE):
                        for px in range(TILE):
                            gx,gy=phase_x*TILE+px,phase_y*TILE+py
                            u,v=(px+.5)/TILE,(py+.5)/TILE
                            weights=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v]
                            scores={m:sum(w for c,w in zip(corners,weights) if c==m) for m in candidates}
                            # Discrete material choice, not opacity mixing. Noise is global and periodic.
                            for m in candidates:
                                scores[m] *= .4 + organic[(gy+m*17)%PERIOD][(gx+m*23)%PERIOD] * 1.2
                            chosen=max(candidates,key=scores.get)
                            if len(candidates)>1:
                                ranked=sorted(candidates,key=scores.get,reverse=True)
                                runner=ranked[1]
                                mix=scores[runner]/max(.001,scores[chosen]+scores[runner])
                                if mix>.28 and breakup[gy][gx]>.68+(1-mix)*.14:
                                    chosen=runner
                            dest[px,py]=pixels[chosen][gx,gy]
                    cache[key]=len(tiles)+1; tiles.append(tile)
                data.append(cache[key])
        documents.append((name,width,height,data))
        metadata.append({"source":source,"sha256":hashlib.sha256(source_path.read_bytes()).hexdigest(),"width":width,"height":height})
    columns=32
    atlas=Image.new("RGBA",(columns*TILE, math.ceil(len(tiles)/columns)*TILE))
    for index,tile in enumerate(tiles): atlas.alpha_composite(tile,((index%columns)*TILE,(index//columns)*TILE))
    atlas_path=ROOT/"assets/tilesets/ashvale-ground.png"
    atlas.save(atlas_path,optimize=True)
    for name,width,height,data in documents:
        doc={"type":"map","version":"1.10","tiledversion":"1.11.2","orientation":"orthogonal","renderorder":"right-down","infinite":False,
             "width":width,"height":height,"tilewidth":TILE,"tileheight":TILE,
             "layers":[{"id":1,"name":"Ground","type":"tilelayer","x":0,"y":0,"width":width,"height":height,"opacity":1,"visible":True,"data":data}],
             "tilesets":[{"firstgid":1,"name":"ashvale-ground","columns":columns,"image":"../assets/tilesets/ashvale-ground.png",
                          "imagewidth":atlas.width,"imageheight":atlas.height,"tilewidth":TILE,"tileheight":TILE,"tilecount":columns*(atlas.height//TILE),"margin":0,"spacing":0}]}
        (ROOT/"maps"/(name+".json")).write_text(json.dumps(doc,separators=(",",":")),encoding="utf-8")
        # QA only: stitched image is never loaded by the game.
        canvas=Image.new("RGBA",(width*TILE,height*TILE))
        for i,gid in enumerate(data):
            if gid: canvas.alpha_composite(tiles[gid-1],((i%width)*TILE,(i//width)*TILE))
        canvas.save(OUT/(name+"-stitched.png"),optimize=True)
    contact=Image.new("RGB",(640,160),"#172320")
    for i,im in enumerate(textures): contact.paste(im,(i*128,0))
    labels=ImageDraw.Draw(contact)
    for i,label in enumerate(["grass","dirt","stone","spider","catacomb"]): labels.text((i*128+8,138),label,fill="#dfce9a")
    contact.save(OUT/"surface-materials.png")
    report={"sources":metadata,"uniqueTiles":len(tiles),"atlasSize":atlas.size,"atlasBytes":atlas_path.stat().st_size,
            "runtime":"One static GPU tile layer per scene; no procedural render update.",
            "visualQA":"Offline review required; browser QA separate."}
    (OUT/"ground-report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps(report,indent=2))

if __name__=="__main__": build()
