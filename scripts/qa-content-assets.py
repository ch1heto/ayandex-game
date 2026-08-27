from pathlib import Path
from PIL import Image,ImageDraw
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/content-qa'
OUT.mkdir(parents=True,exist_ok=True)
files=list((ROOT/'assets/equipment/icons').glob('*.png'))+[ROOT/'assets/ui/skills'/name for name in ['whirlwind.png','seismic-slam.png','multishot.png','arrow-rain.png','frost-nova.png','arcane-meteor.png']]
sheet=Image.new('RGB',(700,300),'#172320')
d=ImageDraw.Draw(sheet)
findings=[]
for i,path in enumerate(files):
    im=Image.open(path).convert('RGBA')
    assert im.size==(32,32),(path,im.size)
    assert set(im.getchannel('A').tobytes())<={0,255},path
    assert im.getbbox(),path
    x=(i%5)*140+22;y=(i//5)*150+12
    sheet.paste(im.resize((96,96),Image.Resampling.NEAREST),(x,y),im.resize((96,96),Image.Resampling.NEAREST))
    d.text((x-10,y+103),path.stem,fill='#e5d29e')
    findings.append({'file':str(path.relative_to(ROOT)),'dimensions':[32,32],'alpha':'binary','status':'technical-pass'})
sheet.save(OUT/'icon-contact.png')
source=Path(r'C:/Users/vanse/AppData/Local/Temp/codex-clipboard-28a3d8f5-ccde-4cf9-a199-a1a2216f690f.png')
menu=ROOT/'assets/ui/menu/ashvale-main-menu-original.png'
assert hashlib.sha256(source.read_bytes()).digest()==hashlib.sha256(menu.read_bytes()).digest()
assert Image.open(menu).size==(1672,941)
geometry=[]
for w,h in [(1280,720),(1366,768),(1920,1080)]:
    scale=max(w/1672,h/941); ox=(w-1672*scale)/2;oy=(h-941*scale)/2
    boxes=[[round(ox+670*scale,2),round(oy+(400+index*91)*scale,2),round(340*scale,2),round(77*scale,2)] for index in range(4)]
    assert all(x>=0 and y>=0 and x+bw<=w and y+bh<=h for x,y,bw,bh in boxes)
    geometry.append({'viewport':[w,h],'scale':scale,'crop':[abs(ox),abs(oy)],'buttonBounds':boxes})
report={'icons':findings,'menuOriginalHashMatches':True,'menuGeometry':geometry,'runtimeVisualQA':'BLOCKED: browser kernel sandbox setup failure'}
(OUT/'asset-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('10 icons: 32x32, binary alpha. Menu SHA-256 identical. Three layout geometries pass; browser rendering NOT verified.')
