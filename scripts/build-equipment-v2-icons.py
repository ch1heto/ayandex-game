"""Extend the existing original 32px icon set; integer geometry, binary alpha."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
INK='#18272e'; STEEL='#63888d'; LIGHT='#b9d8cd'; GOLD='#d3a357'; GLEAM='#f0e5ad'
def save(name,paint,skill=False):
    im=Image.new('RGBA',(32,32)); d=ImageDraw.Draw(im); paint(d)
    im.save(ROOT/('assets/ui/skills' if skill else 'assets/equipment/icons')/(name+'.png'))
def helmet(d):
    d.polygon([(5,27),(4,13),(8,6),(14,3),(22,5),(27,12),(27,27),(21,29),(20,20),(12,20),(11,29)],fill=INK)
    d.polygon([(7,25),(6,13),(10,8),(15,5),(22,8),(25,13),(25,25),(23,26),(22,17),(10,17),(9,26)],fill=STEEL)
    d.polygon([(10,9),(15,6),(20,8),(22,12),(9,12)],fill=LIGHT)
    d.rectangle((7,14,24,16),fill=GOLD);d.rectangle((14,13,17,22),fill=GOLD);d.rectangle((15,13,16,20),fill=GLEAM)
def legs(d):
    d.polygon([(6,3),(26,3),(25,28),(17,29),(15,17),(13,29),(5,28)],fill=INK)
    d.polygon([(8,6),(14,6),(14,15),(11,26),(7,26)],fill=STEEL)
    d.polygon([(17,6),(24,6),(23,26),(19,26),(17,15)],fill=STEEL)
    d.rectangle((8,4,23,7),fill=GOLD);d.rectangle((14,4,17,8),fill=GLEAM)
    d.line((9,10,9,17),fill=LIGHT,width=2);d.line((20,10,21,17),fill=LIGHT,width=2)
    d.rectangle((7,20,12,23),fill=LIGHT);d.rectangle((19,20,24,23),fill=LIGHT)
def boots(d):
    for x,y in [(3,2),(16,5)]:
        d.polygon([(x+2,y+3),(x+11,y+3),(x+10,y+17),(x+13,y+20),(x+13,y+24),(x,y+24),(x,y+18),(x+2,y+17)],fill=INK)
        d.polygon([(x+4,y+5),(x+9,y+5),(x+8,y+18),(x+11,y+20),(x+11,y+21),(x+2,y+21),(x+2,y+19),(x+4,y+17)],fill=STEEL)
        d.rectangle((x+3,y+6,x+10,y+8),fill=GOLD);d.line((x+5,y+10,x+5,y+16),fill=LIGHT,width=2)
        d.line((x+2,y+22,x+11,y+22),fill=GOLD,width=2)
def amulet(d):
    d.line((8,3,5,9,8,16,15,22,24,16,27,9,24,3),fill=INK,width=5)
    d.line((8,3,7,9,10,15,16,20,22,15,25,9,24,3),fill=GOLD,width=2)
    d.polygon([(16,15),(24,22),(16,30),(8,22)],fill=INK)
    d.polygon([(16,17),(22,22),(16,28),(10,22)],fill=GOLD)
    d.polygon([(16,19),(20,22),(16,26),(12,22)],fill='#58bfc4')
    d.polygon([(16,19),(17,22),(14,23),(13,22)],fill=GLEAM)
def ring(d):
    d.ellipse((5,8,27,30),fill=INK);d.ellipse((8,10,24,27),fill=GOLD);d.ellipse((12,14,20,23),fill=INK)
    d.rectangle((5,9,12,14),fill=INK);d.rectangle((9,3,22,13),fill=INK)
    d.polygon([(12,4),(20,4),(23,9),(16,17),(8,9)],fill=GOLD)
    d.polygon([(13,5),(19,5),(21,9),(16,14),(11,9)],fill='#83cacc')
    d.polygon([(13,6),(17,6),(15,10),(12,9)],fill=GLEAM)
    d.line((9,19,9,23,12,26),fill=GLEAM,width=2)
def dodge(d):
    d.polygon([(19,3),(24,3),(26,6),(23,10),(19,9),(17,6)],fill=INK)
    d.rectangle((20,4,23,7),fill=GLEAM)
    d.line((19,12,14,13,9,18),fill=INK,width=6)
    d.line((20,11,16,17,21,20,18,28),fill=INK,width=7)
    d.line((16,17,11,24,5,25),fill=INK,width=6)
    d.line((19,12,15,13,10,18),fill='#7dbeaa',width=3)
    d.line((20,11,16,17,21,20,18,28),fill='#b5e2cd',width=3)
    d.line((16,17,11,24,5,25),fill='#7dbeaa',width=3)
    d.line((3,8,12,8),fill=GOLD,width=2);d.line((1,13,9,13),fill=GOLD,width=2)
    d.line((24,13,29,13),fill=GLEAM,width=2)
for name,paint in [('helmet',helmet),('legs',legs),('boots',boots),('amulet',amulet),('ring',ring)]: save(name,paint)
save('dodge',dodge,True)
print('5 equipment icons + Dodge: 32x32, transparent, integer pixel geometry')
