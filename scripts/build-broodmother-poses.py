"""Deterministic alpha components from the attached boss; never redraw source art."""
from pathlib import Path
from collections import deque
from PIL import Image, ImageDraw
import numpy as np, json, shutil, hashlib
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/bosses/ashen-broodmother/source/attached.png'
ATTACHED=Path(r'C:/Users/vanse/AppData/Local/Temp/codex-clipboard-0c727126-5cbb-4b98-a503-3bba3bb97711.png')
OUT=ROOT/'assets/bosses/ashen-broodmother/runtime'
QA=ROOT/'artifacts/current-pass/boss'
SOURCE.parent.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True);QA.mkdir(parents=True,exist_ok=True)
if not SOURCE.exists(): shutil.copyfile(ATTACHED,SOURCE)
if ATTACHED.exists(): assert SOURCE.read_bytes()==ATTACHED.read_bytes()
im=Image.open(SOURCE).convert('RGBA'); rgba=np.array(im)
mask=rgba[:,:,3]>=128
h,w=mask.shape; labels=np.zeros((h,w),dtype=np.int32); components=[]
# Eight-connected components on alpha, no semantic detection.
for y,x in zip(*np.where(mask)):
    if labels[y,x]: continue
    label=len(components)+1; labels[y,x]=label; stack=[(int(x),int(y))]
    left=right=int(x);top=bottom=int(y);count=0
    while stack:
        px,py=stack.pop();count+=1
        left=min(left,px);right=max(right,px);top=min(top,py);bottom=max(bottom,py)
        for ny in range(max(0,py-1),min(h,py+2)):
            for nx in range(max(0,px-1),min(w,px+2)):
                if mask[ny,nx] and not labels[ny,nx]:
                    labels[ny,nx]=label;stack.append((nx,ny))
    components.append((count,label,(left,top,right+1,bottom+1)))
main=sorted(components,reverse=True)[:3]
assert len(main)==3 and min(c[0] for c in main)>30000,main
# Largest top pose is phase; lower components sorted left/right are idle/attack.
phase=max(main,key=lambda c:c[0]); small=sorted([c for c in main if c!=phase],key=lambda c:c[2][0])
poses={'idle':small[0],'attack':small[1],'phase':phase}
report={'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'canvas':[192,192],'root':[96,168],'alphaThreshold':128,'poses':{}}
sheet=Image.new('RGB',(1152,444),'#202831');draw=ImageDraw.Draw(sheet)
for i,(name,(count,label,bbox)) in enumerate(poses.items()):
    x0,y0,x1,y1=bbox
    # Keep opaque pixels inside pose bounds, including detached tips; exclude other main poses.
    part=rgba[y0:y1,x0:x1].copy()
    alpha=mask[y0:y1,x0:x1].copy()
    for _,other,_ in main:
        if other!=label: alpha &= labels[y0:y1,x0:x1]!=other
    part[:,:,3]=np.where(alpha,255,0)
    part[~alpha,:3]=0
    crop=Image.fromarray(part)
    scale=min(176/crop.width,156/crop.height)
    size=(round(crop.width*scale),round(crop.height*scale))
    resized=crop.resize(size,Image.Resampling.NEAREST)
    canvas=Image.new('RGBA',(192,192));offset=(96-size[0]//2,168-size[1]);canvas.alpha_composite(resized,offset)
    canvas.save(OUT/(name+'.png'))
    # Warm/emissive pixels only: body is never globally recolored.
    arr=np.array(canvas);r=arr[:,:,0].astype(int);g=arr[:,:,1].astype(int);b=arr[:,:,2].astype(int)
    glow=(arr[:,:,3]>0)&(r>125)&(r>g*1.25)&(r>b*1.8)
    arr[:,:,3]=np.where(glow,255,0);arr[~glow,:3]=0
    Image.fromarray(arr).save(OUT/(name+'-glow.png'))
    preview=canvas.resize((384,384),Image.Resampling.NEAREST)
    sheet.paste(preview,(i*384,30),preview)
    draw.line((i*384,366,(i+1)*384,366),fill='#709787')
    draw.text((i*384+12,10),name,fill='#f0d4a3')
    draw.text((i*384+12,414),str(bbox)+' -> '+str(size),fill='#f0d4a3')
    report['poses'][name]={'bbox':list(bbox),'opaqueComponentPixels':count,'size':list(size),'offset':list(offset),'scale':scale}
sheet.save(QA/'contact.png')
(OUT/'poses.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
