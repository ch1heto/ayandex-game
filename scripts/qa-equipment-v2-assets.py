"""Read-only Equipment v2 asset QA and offline pose-motion previews, not browser acceptance."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np, json, hashlib, re, xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]; QA=ROOT/'artifacts/current-pass/boss'; QA.mkdir(parents=True,exist_ok=True)
RUNTIME=ROOT/'assets/bosses/ashen-broodmother/runtime'
meta=json.loads((RUNTIME/'poses.json').read_text())
source=ROOT/'assets/bosses/ashen-broodmother/source/attached.png'
assert hashlib.sha256(source.read_bytes()).hexdigest()==meta['sourceSha256']
poses={}
for name,config in meta['poses'].items():
    im=Image.open(RUNTIME/(name+'.png')).convert('RGBA');a=np.array(im)
    assert im.size==tuple(meta['canvas'])==(192,192)
    assert set(np.unique(a[:,:,3]))=={0,255}
    assert not np.any(a[a[:,:,3]==0,:3]),name
    bbox=im.getbbox();assert 7<=bbox[0]<=10 and 174<=bbox[2]-bbox[0]<=177 and bbox[3]==168,(name,bbox)
    src=config['bbox'];assert abs(config['size'][0]/config['size'][1]-(src[2]-src[0])/(src[3]-src[1]))<.012
    glow=np.array(Image.open(RUNTIME/(name+'-glow.png')))
    assert not np.any((glow[:,:,3]>0)&(a[:,:,3]==0))
    assert (glow[:,:,3]>0).sum()<(a[:,:,3]>0).sum()*.35
    assert np.array_equal(glow[glow[:,:,3]>0],a[glow[:,:,3]>0])
    poses[name]=im
# All current nine skill icons + Dodge. Rasterize the established orthogonal SVG paths for QA only.
def pixel_svg(path):
    out=Image.new('RGBA',(128,128));d=ImageDraw.Draw(out)
    for child in ET.parse(path).getroot():
        assert child.tag.endswith('path')
        tokens=re.findall(r'[A-Za-z]|-?\d+(?:\.\d+)?',child.attrib['d'])
        x=y=0;points=[];cmd=None;i=0
        def flush():
            if points:d.polygon([(round(px*4),round(py*4)) for px,py in points],fill=child.attrib['fill'])
        while i<len(tokens):
            if tokens[i].isalpha():
                cmd=tokens[i];i+=1
                if cmd.lower()=='z':
                    flush();x,y=points[0];points=[];continue
            assert cmd in ['M','m','L','l','H','h','V','v'],cmd
            if cmd.lower() in ['m','l']:
                nx=float(tokens[i]);ny=float(tokens[i+1]);i+=2
                if cmd.islower():nx+=x;ny+=y
                if cmd.lower()=='m' and points:flush();points=[]
                x,y=nx,ny;points.append((x,y));cmd='l' if cmd.islower() else 'L'
            elif cmd.lower()=='h':
                nx=float(tokens[i]);i+=1;x=nx+x if cmd.islower() else nx;points.append((x,y))
            else:
                ny=float(tokens[i]);i+=1;y=ny+y if cmd.islower() else ny;points.append((x,y))
        flush()
    return out.resize((32,32),Image.Resampling.NEAREST)
names=['heavy-slash.png','whirlwind.png','seismic-slam.png','piercing-shot.svg','multishot.png','arrow-rain.png','arcane-blink.svg','arcane-bind.svg','arcane-echoes.svg','dodge.png']
sheet=Image.new('RGB',(660,330),'#202b25');pen=ImageDraw.Draw(sheet)
for i,name in enumerate(names):
    p=ROOT/'assets/ui/skills'/name
    im=pixel_svg(p) if p.suffix=='.svg' else Image.open(p).convert('RGBA')
    assert im.getpixel((0,0))[3]==0,name
    assert set(im.getchannel('A').tobytes())=={0,255},name
    x=i%5*132+18;y=i//5*165+12
    large=im.resize((96,96),Image.Resampling.NEAREST);sheet.paste(large,(x,y),large);pen.text((x-12,y+106),p.stem,fill='#efd8ad')
sheet.save(QA/'all-skills.png')
frames=[]
motion=json.loads((QA/'motion.json').read_text())
for state in motion:
    im=poses[state['pose']]
    # Same visual math output as production; nearest sampling with the shared foot root.
    w=round(192*state['scaleX']);h=round(192*state['scaleY'])
    transformed=im.resize((w,h),Image.Resampling.NEAREST)
    frame=Image.new('RGBA',(256,216),'#202b25');d=ImageDraw.Draw(frame)
    d.rectangle((85,175,171,187),fill='#12191c');d.rectangle((96,171,160,191),fill='#12191c')
    frame.alpha_composite(transformed,(128-w//2,184-round(168*state['scaleY'])+state['bob']))
    d.text((8,8),state['label'],fill='#f0d4a3')
    frames.append(frame.convert('RGB').resize((512,432),Image.Resampling.NEAREST))
sampled=Image.new('RGB',(768,432),'#202b25')
for i,index in enumerate([0,20,30,38,50,86]): sampled.paste(frames[index].resize((256,216),Image.Resampling.NEAREST),(i%3*256,i//3*216))
sampled.save(QA/'motion-contact.png')
frames[0].save(QA/'motion.gif',save_all=True,append_images=frames[1:],duration=50,loop=0)
report={'sourceExact':True,'poses':meta['poses'],'binaryAlpha':True,'hiddenRGB':0,'glowInsideBodyOnly':True,
        'sharedRoot':meta['root'],'skillIcons':names,'offlineMotionFrames':len(frames),'browserQA':'NOT RUN: offline asset and motion sampling only'}
(QA/'asset-qa.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
