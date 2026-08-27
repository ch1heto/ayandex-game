"""Deterministic authored four-room Tiled map. Reuses the shipped world tileset."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
W,H,T=112,22,32
ground=[0]*(W*H); walls=[0]*(W*H); details=[0]*(W*H)
collisions=[]; props=[]; doors=[]; rooms=[]
identifier=0
def obj(name,kind,x,y,w=0,h=0,properties=None):
    global identifier
    identifier+=1
    return dict(id=identifier,name=name,type=kind,x=x,y=y,width=w,height=h,rotation=0,visible=True,properties=properties or [])
def rect(name,x,y,w,h): collisions.append(obj(name,'collision',x,y,w,h))
for room in range(4):
    left=1+room*28
    rooms.append(obj('room-'+str(room+1),'room',left*T,T,24*T,20*T))
    for y in range(1,21):
        for x in range(left,left+24):
            ground[y*W+x]=7+(x*7+y*3+room)%4
            if x in (left,left+23) or y in (1,20): walls[y*W+x]=7+(x+y)%4
            elif (x*19+y*7)%31==0: details[y*W+x]=13+(x+y)%4
    rect('north-'+str(room),left*T,T,24*T,T)
    rect('south-'+str(room),left*T,20*T,24*T,T)
    for side,x in [('left',left*T),('right',(left+23)*T)]:
        if (side=='left' and room==0) or (side=='right' and room==3): rect(side+str(room),x,2*T,T,18*T)
        else:
            rect(side+'-top'+str(room),x,2*T,T,7*T)
            rect(side+'-bottom'+str(room),x,13*T,T,7*T)
            for y in range(9,13): walls[y*W+x//T]=0
    if room<3:
        doors.append(obj('gate-'+str(room+1),'gate',(left+23)*T,9*T,T,4*T))
        for x in range(left+24,left+28):
            for y in range(9,13): ground[y*W+x]=7+(x+y)%4
            walls[8*W+x]=8;walls[13*W+x]=8
        rect('hall-top'+str(room),(left+24)*T,8*T,4*T,T)
        rect('hall-bottom'+str(room),(left+24)*T,13*T,4*T,T)
    for i,(px,py,texture) in enumerate([(110,150,'world-web-large'),(620,170,'world-web-small'),(120,580,'world-ember-rock-a'),(635,585,'world-ember-rock-b'),(390,120,'world-ember-plant')]):
        props.append(obj('prop-'+str(room)+'-'+str(i),'prop',left*T+px,py,properties=[dict(name='texture',type='string',value=texture)]))
        if 'rock' in texture: rect('rock-'+str(room)+'-'+str(i),left*T+px-24,py-36,48,36)
layers=[]
for name,data in [('Ground',ground),('GroundDetails',details),('Walls',walls)]:
    layers.append(dict(id=len(layers)+1,name=name,type='tilelayer',width=W,height=H,x=0,y=0,opacity=1,visible=True,data=data))
for name,objects in [('Collision',collisions),('Props',props),('Doors',doors),('Rooms',rooms),('Spawns',[obj('player','player-spawn',170,352)]),('Atmosphere',[])]:
    layers.append(dict(id=len(layers)+1,name=name,type='objectgroup',objects=objects,opacity=1,visible=True))
result=dict(compressionlevel=-1,height=H,width=W,infinite=False,layers=layers,nextlayerid=len(layers)+1,nextobjectid=identifier+1,orientation='orthogonal',renderorder='right-down',tiledversion='1.11.0',tileheight=T,tilewidth=T,type='map',version='1.10',tilesets=[dict(firstgid=1,name='ashvale-world',tilewidth=32,tileheight=32,tilecount=16,columns=16,image='../assets/tilesets/ashvale-world.png',imagewidth=512,imageheight=32,margin=0,spacing=0)])
(ROOT/'maps/ashen-catacombs.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
print('Four rooms, three gates, collision/props/spawn layers written.')
