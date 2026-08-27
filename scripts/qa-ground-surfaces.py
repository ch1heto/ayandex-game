"""Technical asset checks and offline comparison. Not browser/runtime acceptance."""
from pathlib import Path
import hashlib
import json
import subprocess
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"artifacts/current-pass"
OUT.mkdir(parents=True,exist_ok=True)

def stitch(name):
    doc=json.loads((ROOT/"maps"/(name+".json")).read_text(encoding="utf-8-sig"))
    tileset=doc["tilesets"][0]
    atlas=Image.open((ROOT/"maps"/tileset["image"]).resolve()).convert("RGBA")
    layer=next(l for l in doc["layers"] if l["name"]=="Ground")
    image=Image.new("RGBA",(doc["width"]*32,doc["height"]*32))
    for i,gid in enumerate(layer["data"]):
        if not gid: continue
        index=gid-tileset["firstgid"]
        assert 0<=index<tileset["tilecount"]
        sx=index%tileset["columns"]*32;sy=index//tileset["columns"]*32
        image.paste(atlas.crop((sx,sy,sx+32,sy+32)),(i%doc["width"]*32,i//doc["width"]*32))
    return image

def seam_ratio(im):
    a=np.array(im).astype(np.int16)
    dx=np.abs(a[:,1:,:3]-a[:,:-1,:3]).mean(axis=2)
    dy=np.abs(a[1:,:,:3]-a[:-1,:,:3]).mean(axis=2)
    xedge=np.arange(1,a.shape[1])%32==0
    yedge=np.arange(1,a.shape[0])%32==0
    # Diagnostic contrast ratio only; a low value is not proof of visual quality.
    return {"x":round(float(dx[:,xedge].mean()/max(.001,dx[:,~xedge].mean())),3),
            "y":round(float(dy[yedge,:].mean()/max(.001,dy[~yedge,:].mean())),3)}

atlas=Image.open(ROOT/"assets/tilesets/ashvale-ground.png")
assert atlas.size==(1024,512)
assert set(atlas.getchannel("A").tobytes())<={0,255}
before=stitch("ashvale-world"); after=stitch("ashvale-ground")
assert before.size==after.size
assert set(after.getchannel("A").tobytes())=={255}
dungeon=stitch("catacombs-ground")
assert np.array_equal(np.array(dungeon.getchannel("A"))>0,np.array(stitch("ashen-catacombs").getchannel("A"))>0)
after_ratio=seam_ratio(after)
assert max(after_ratio.values())<1.5,after_ratio
unchanged={}
for name in ["maps/ashvale-world.json","maps/ashen-catacombs.json","src/entities/player/PlayerCharacter.ts",
             "src/systems/save/GameProgressService.ts","src/scenes/MainMenuScene.ts","assets/ui/menu/ashvale-main-menu-original.png"]:
    old=subprocess.check_output(["git","show","HEAD:"+name],cwd=ROOT)
    current=(ROOT/name).read_bytes()
    # Git normalizes text newlines. PNG comparison remains byte exact.
    if not name.endswith(".png"): old=old.replace(b"\r\n",b"\n");current=current.replace(b"\r\n",b"\n")
    assert old==current,name
    unchanged[name]=hashlib.sha256(current).hexdigest()

contact=Image.new("RGB",(768,992),"#172320");pen=ImageDraw.Draw(contact)
for row,(label,x,y) in enumerate([("grass / dirt",1000,880),("dirt / stone / grass",1376,1024),("grass / spider",2320,400),("settlement approach",1740,1184)]):
    for col,im in enumerate([before,after]):
        contact.paste(im.crop((x,y,x+384,y+224)),(col*384,row*248+24))
        pen.text((col*384+8,row*248+6),("BEFORE " if col==0 else "AFTER ")+label,fill="#eee0b5")
contact.save(OUT/"ground-comparison.png")
icons=[]
for name in ["arcane-blink","arcane-bind","piercing-shot"]:
    root=ET.parse(ROOT/"assets/ui/skills"/(name+".svg")).getroot()
    assert root.attrib["viewBox"]=="0 0 32 32"
    assert root.attrib["shape-rendering"]=="crispEdges"
    assert all(node.tag.endswith("path") for node in root)
    assert all("filter" not in node.attrib and "stroke" not in node.attrib for node in root)
    icons.append(name)
report={"atlasSize":atlas.size,"binaryAlpha":True,"voidsPreserved":True,
        "boundaryContrastBefore":seam_ratio(before),"boundaryContrastAfter":after_ratio,
        "unchangedAgainstHEAD":unchanged,"svgIcons":icons,
        "runtimeVisualQA":"BLOCKED: browser sandbox setup failed; console errors not measured"}
(OUT/"surface-qa.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(report,indent=2))
