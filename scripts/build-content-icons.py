"""Original 32px icons, extending the project's deterministic skill-icon pipeline."""
from pathlib import Path
from math import cos, sin, pi
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
def save(name, painter, equipment=False):
    im=Image.new('RGBA',(32,32)); d=ImageDraw.Draw(im); painter(d)
    path=ROOT/('assets/equipment/icons' if equipment else 'assets/ui/skills')/(name+'.png')
    path.parent.mkdir(parents=True,exist_ok=True); im.save(path)
def sword(d):
    d.polygon([(6,25),(6,20),(23,3),(28,3),(28,8),(11,25)],fill='#18272e')
    d.polygon([(9,20),(24,5),(26,5),(26,8),(12,23)],fill='#94cbd6')
    d.line((11,20,25,6),fill='#f0f3cf',width=2)
    d.polygon([(3,20),(5,18),(16,27),(14,29)],fill='#d3a357')
    d.line((5,27,9,23),fill='#774728',width=3); d.rectangle((3,27,5,29),fill='#f0c972')
def bow(d):
    d.line((9,3,19,8,22,15,19,23,9,29),fill='#172924',width=5)
    d.line((9,3,18,8,20,15,18,23,9,29),fill='#b68142',width=3)
    d.line((10,5,17,9,19,15),fill='#edcd83',width=1)
    d.line((9,4,12,16,9,28),fill='#cee2bd')
    d.line((5,16,29,16),fill='#e4dca5',width=2)
    d.polygon([(29,16),(25,12),(25,20)],fill='#82c5a0')
    d.line((4,12,8,16,4,20),fill='#529077',width=2)
def staff(d):
    d.line((7,29,22,8),fill='#18202d',width=6)
    d.line((7,28,20,10),fill='#866046',width=3)
    d.line((8,27,19,11),fill='#d6ac6a')
    d.polygon([(16,3),(23,2),(29,8),(24,15),(17,13),(13,8)],fill='#302348')
    d.polygon([(19,3),(25,4),(27,8),(23,12),(17,10),(16,7)],fill='#8d6ccd')
    d.polygon([(21,4),(25,7),(22,10),(18,8)],fill='#8be4df')
    d.rectangle((20,5,22,6),fill='#efffec'); d.line((14,12,20,15,25,12),fill='#ceaa63',width=2)
def armor(d):
    d.polygon([(4,7),(10,4),(13,6),(19,6),(22,4),(28,7),(29,15),(25,17),(25,28),(7,28),(7,17),(3,15)],fill='#1a252c')
    d.polygon([(5,8),(10,6),(13,9),(19,9),(22,6),(27,8),(27,13),(23,14),(23,25),(9,25),(9,14),(5,13)],fill='#63888d')
    d.polygon([(10,11),(15,13),(21,10),(20,22),(11,22)],fill='#91afb0')
    d.line((11,12,16,15,20,12),fill='#d7d8b4',width=2)
    d.rectangle((9,23,23,25),fill='#b2884e'); d.rectangle((14,23,17,26),fill='#f0c46d')
for name,p in [('sword',sword),('bow',bow),('staff',staff),('armor',armor)]: save(name,p,True)
def arc(d,color):
    for offset in [0,2*pi/3,4*pi/3]:
        points=[(round(16+cos(offset+i*.09)*12),round(16+sin(offset+i*.09)*10)) for i in range(17)]
        d.line(points,fill='#813a29',width=5); d.line(points[:-3],fill=color,width=3); d.line(points[:7],fill='#fff3bd')
    d.polygon([(14,11),(19,13),(17,20),(12,18)],fill='#e5ba63')
save('whirlwind',lambda d:arc(d,'#ffbe5a'))
def slam(d):
    d.polygon([(12,3),(17,3),(18,17),(14,22),(10,17)],fill='#f9dfa0')
    d.line((7,15,21,15),fill='#d08334',width=3)
    for x in [3,10,21,28]: d.line((15,22,x,27,x+2,30),fill='#ff9143',width=2)
    d.rectangle((12,21,18,24),fill='#fff4cb')
save('seismic-slam',slam)
def arrows(d,rain=False):
    if rain:
        d.line((3,4,10,2,22,2,29,4),fill='#2b7565',width=2)
        for i in range(3):
            x=5+i*9
            d.line((x+4,6,x,23),fill='#205443',width=4)
            d.line((x+4,6,x,23),fill='#94eac4',width=2)
            d.polygon([(x,28),(x-3,21),(x+4,22)],fill='#f0dfa2')
            d.line((x+1,7,x+4,10,x+7,8),fill='#4eae95',width=2)
        d.line((2,30,9,28,23,28,30,30),fill='#b7d884',width=1)
        return
    for i in range(3):
        x=5+i*9; y=4+i%2*4
        d.line((x,26,x+7,y+6),fill='#174835',width=4)
        d.line((x,26,x+7,y+6),fill='#90e6b3',width=2)
        d.polygon([(x+7,y),(x+3,y+8),(x+10,y+7)],fill='#f2e5a9')
        d.line((x-2,23,x,26,x+3,25),fill='#49a69a',width=2)
    if rain: d.line((2,29,8,27,24,27,30,29),fill='#e4c77e',width=2)
save('multishot',lambda d:arrows(d))
save('arrow-rain',lambda d:arrows(d,True))
def frost(d):
    for i in range(6):
        a=i*pi/3
        x=round(16+cos(a)*13);y=round(16+sin(a)*13)
        d.line((16,16,x,y),fill='#4865af',width=5);d.line((16,16,x,y),fill='#9ee5ef',width=2)
    d.polygon([(16,7),(22,16),(16,24),(9,16)],fill='#65a8d0')
    d.polygon([(16,11),(19,16),(16,20),(13,16)],fill='#eefff1')
save('frost-nova',frost)
def meteor(d):
    d.polygon([(27,2),(24,19),(15,28),(3,23),(7,13)],fill='#473568')
    d.polygon([(26,3),(21,20),(11,25),(5,21),(9,14)],fill='#916ed5')
    d.line((25,4,13,17),fill='#73cbd8',width=4)
    d.polygon([(9,16),(15,14),(20,20),(15,26),(8,24),(6,20)],fill='#64b1d1')
    d.polygon([(11,16),(16,18),(16,22),(11,23),(9,20)],fill='#f1ffe6')
    d.rectangle((2,28,5,30),fill='#b09aef');d.rectangle((24,24,27,26),fill='#78cfe5')
save('arcane-meteor',meteor)
print('4 equipment icons and 6 skill icons created (32x32 RGBA, binary alpha).')
