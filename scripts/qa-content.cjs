// Run after the documented tsc test compilation. Uses isolated in-memory storage.
// ASHVALE_QA_DIR can point at an ignored compilation directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const qa = file => require(path.join(process.env.ASHVALE_QA_DIR || path.join(__dirname, '../artifacts/content-qa/node'), file));
const { GameProgressService } = qa('systems/save/GameProgressService.js');
const { rollItem, equipmentBonuses, ITEM_RARITIES, EQUIPMENT_CONFIG } = qa('data/equipment.js');
const { validateItem } = qa('systems/equipment/itemValidation.js');
const { ADVANCED_SKILLS } = qa('data/advancedSkills.js');
const { SKILL_1_CONFIGS } = qa('data/skills.js');
const { ELITE_CONFIG } = qa('data/elites.js');
let checks = 0;
function test(name, action) { action(); checks++; console.log('PASS ' + name); }
let storage = new Map();
global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
function fresh() { storage = new Map(); const service = new GameProgressService(); service.load(); return service; }
const sword = { id:'test-sword-1', kind:'sword', rarity:'rare', itemLevel:3, stats:{ damage:8,maxHealth:0,maxMana:10,cooldownReduction:.06,movementSpeed:0 } };
const armor = { id:'test-armor-1', kind:'armor', rarity:'epic', itemLevel:3, stats:{ damage:0,maxHealth:40,maxMana:10,cooldownReduction:0,movementSpeed:.04 } };
test('new save: empty inventory, equipment and 3+3 potions', () => {
  const s=fresh().snapshot; assert.equal(s.version,3); assert.deepEqual(s.inventory,[]); assert.deepEqual(s.equipment,{});
  assert.equal(s.player.healthPotions,3); assert.equal(s.player.manaPotions,3); assert.equal(s.milestones.bossFirstKill,false);
});
for (const version of [1,2]) test('v'+version+' migration preserves progression, buildings and selection', () => {
  storage = new Map([['ashvale-progress-v'+version,JSON.stringify({ version, coins:87, buildings:{forge:true,infirmary:true}, player:{level:4,xp:73,healthPotions:2,manaPotions:1,slimeKills:12,spiderKills:8}, selectedClass:'mage',currentSkin:'necromancer' })]]);
  const s=new GameProgressService().load(); assert.equal(s.coins,87); assert.deepEqual(s.buildings,{forge:true,infirmary:true});
  assert.deepEqual(s.player,{level:4,xp:73,healthPotions:2,manaPotions:1,slimeKills:12,spiderKills:8});
  assert.deepEqual(s.selection,{classId:'mage',skinId:'necromancer'}); assert.deepEqual(s.inventory,[]); assert(storage.has('ashvale-progress-v3'));
  assert(storage.has('ashvale-progress-v'+version));
});
test('equip restrictions, replacement and 100 equip/unequip cycles do not stack', () => {
  const s=fresh(); assert(s.pickup(sword)); assert(s.pickup(armor)); assert.equal(s.equip(sword.id,'mage'),'wrong-class'); assert.deepEqual(s.snapshot.equipment,{});
  assert.equal(s.equip(armor.id,'warrior'),'ok');
  for(let i=0;i<100;i++) { assert.equal(s.equip(sword.id,'warrior'),'ok'); assert.equal(equipmentBonuses(s.snapshot.equipment,'warrior').damage,8); assert(s.unequip('weapon')); assert.equal(equipmentBonuses(s.snapshot.equipment,'warrior').damage,0); }
  assert.equal(s.equip(sword.id,'warrior'),'ok'); assert.equal(equipmentBonuses(s.snapshot.equipment,'mage').damage,0);
  assert.equal(equipmentBonuses(s.snapshot.equipment,'warrior').maxHealth,40);
});
test('inventory full refuses pickup/unequip without losing items; swapping still works', () => {
  const s=fresh(); s.pickup(sword); s.equip(sword.id,'warrior');
  for(let i=0;i<24;i++) assert(s.pickup({...sword,id:'bag-'+i}));
  assert.equal(s.pickup({...sword,id:'ground-remains'}),false); assert.equal(s.unequip('weapon'),false);
  assert.equal(s.snapshot.equipment.weapon.id,sword.id); assert.equal(s.snapshot.inventory.length,24);
  assert.equal(s.equip('bag-0','warrior'),'ok'); assert.equal(s.snapshot.inventory.length,24); assert(s.snapshot.inventory.some(i=>i.id===sword.id));
});
test('stable UUID, rolled stats and first-kill flag survive save/load unchanged', () => {
  const s=fresh(); const item=rollItem(8,'boss'); s.pickup(item); const kindClass={sword:'warrior',bow:'archer',staff:'mage',armor:'mage'}[item.kind];
  s.equip(item.id,kindClass); assert(s.milestone('bossFirstKill')); assert.equal(s.milestone('bossFirstKill'),false); s.select('mage','necromancer');
  const loaded=new GameProgressService().load(); assert.deepEqual(loaded,s.snapshot); assert.equal(Object.values(loaded.equipment)[0].id,item.id); assert.deepEqual(Object.values(loaded.equipment)[0].stats,item.stats);
});
test('duplicate identifiers and invalid save values are safely normalized', () => {
  fresh(); storage.set('ashvale-progress-v3',JSON.stringify({version:3,coins:'NaN',player:{level:-4,xp:'oops',manaPotions:null},inventory:[sword,sword,{...armor,id:'<script>'}],equipment:{armor},milestones:{bossFirstKill:'true'}}));
  const s=new GameProgressService().load(); assert.equal(s.coins,0); assert.equal(s.player.level,1); assert.equal(s.player.xp,0);
  assert.equal(s.inventory.length,1); assert.equal(s.milestones.bossFirstKill,false);
  assert.equal(validateItem({...sword,stats:{...sword.stats,cooldownReduction:1}}).stats.cooldownReduction,.2);
  assert.equal(validateItem({...armor,stats:{...armor.stats,movementSpeed:1}}).stats.movementSpeed,.1);
});
test('normal rarity distribution and item levels match config; boss always Rare+', () => {
  let seed=723; const rng=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  const counts=Object.fromEntries(ITEM_RARITIES.map(r=>[r,0])); const ids=new Set();
  for(let i=0;i<20000;i++) { const item=rollItem(5,'normal',rng); counts[item.rarity]++; assert(item.itemLevel>=4&&item.itemLevel<=6); assert(!ids.has(item.id)); ids.add(item.id); }
  ITEM_RARITIES.forEach((rarity,index)=>assert(Math.abs(counts[rarity]/20000-EQUIPMENT_CONFIG.rarityWeights.normal[index]/100)<.02));
  for(let i=0;i<300;i++) assert(ITEM_RARITIES.indexOf(rollItem(1,'boss',rng).rarity)>=2);
});
test('six paid skills, free Skill 1 cadence and separate archer/mage roles', () => {
  for(const classId of ['warrior','archer','mage']) { for(const slot of [2,3]) { const c=ADVANCED_SKILLS[classId][slot]; assert(c.mana>0); assert(c.cooldownMs>=6000); } assert.equal(SKILL_1_CONFIGS[classId].cooldownMs,5000); }
  assert.equal(SKILL_1_CONFIGS.warrior.damageMultiplier,1.9); assert.equal(SKILL_1_CONFIGS.archer.damageMultiplier,2); assert.equal(SKILL_1_CONFIGS.mage.damageMultiplier,0);
  assert.equal(SKILL_1_CONFIGS.archer.projectile.maxHits,3); assert(SKILL_1_CONFIGS.archer.projectile.speedMultiplier>1.5);
  assert.equal(ELITE_CONFIG.spawnChance,.07);
});
test('four Tiled rooms, three gates, all four reachable only after gates open', () => {
  const map=JSON.parse(fs.readFileSync(path.join(__dirname,'../maps/ashen-catacombs.json'),'utf8'));
  const layer=name=>map.layers.find(l=>l.name===name);
  assert.equal(layer('Rooms').objects.length,4); assert.equal(layer('Doors').objects.length,3);
  function reachable(open) {
    const blocked=new Set(); const rects=[...layer('Collision').objects,...(open?[]:layer('Doors').objects)];
    for(const r of rects) for(let y=Math.floor(r.y/32);y<Math.ceil((r.y+r.height)/32);y++) for(let x=Math.floor(r.x/32);x<Math.ceil((r.x+r.width)/32);x++) blocked.add(y*map.width+x);
    const start=11*map.width+5, queue=[start], visited=new Set(queue);
    for(let i=0;i<queue.length;i++) { const n=queue[i],x=n%map.width,y=Math.floor(n/map.width); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,ny=y+dy,v=ny*map.width+nx; if(nx<0||nx>=map.width||ny<0||ny>=map.height||visited.has(v)||blocked.has(v)||!layer('Ground').data[v]) continue;visited.add(v);queue.push(v);
    }} return visited;
  }
  const closed=reachable(false),open=reachable(true);
  assert(!closed.has(11*map.width+36)); for(const x of [5,33,61,89]) assert(open.has(11*map.width+x));
});
const { blinkDestination } = qa('systems/skills/blinkDestination.js');
const { EnemyControl } = qa('entities/enemies/EnemyControl.js');
const { BLINK_CONFIG, ARCANE_BIND_CONTROL } = qa('data/arcane.js');
const footprint={left:-9,top:-13,width:18,height:13}, bounds={x:0,y:0,width:500,height:500};
const blink=(start,target,rects=[])=>blinkDestination(start,target,BLINK_CONFIG.range,footprint,bounds,rects,BLINK_CONFIG.clearance);
test('blink clamps to aim/range/world, handles a zero aim and stops before a thin wall',()=>{
  assert.deepEqual(blink({x:50,y:50},{x:70,y:50}),{x:70,y:50});
  assert.deepEqual(blink({x:50,y:50},{x:500,y:50}),{x:202,y:50});
  assert.deepEqual(blink({x:50,y:50},{x:50,y:50}),{x:50,y:50});
  assert(blink({x:50,y:50},{x:-1000,y:50}).x>=11);
  const wall={x:120,y:0,width:1,height:500};
  assert(blink({x:50,y:50},{x:500,y:50},[wall]).x<=109);
});
test('blink respects closed gates and enemy bodies; an opened gate no longer blocks',()=>{
  const start={x:50,y:100},target={x:300,y:100};
  const gate={x:130,y:50,width:32,height:128};
  assert(blink(start,target,[gate]).x<130);
  assert.equal(blink(start,target,[]).x,202);
  const enemy={x:100,y:100,width:42,height:21};
  const end=blink({x:50,y:50},{x:200,y:200},[enemy]);
  assert(end.x+9<100 || end.y<100);
  // Escape away from an already-touching body's margin is permitted.
  assert(blink({x:89,y:110},{x:40,y:110},[enemy]).x<89);
});
test('1200 swept blink paths never cross walls or finish outside world bounds',()=>{
  let seed=903; const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const overlaps=(p,r,pad=0)=>p.x+footprint.left+footprint.width>r.x-pad&&p.x+footprint.left<r.x+r.width+pad&&p.y+footprint.top+footprint.height>r.y-pad&&p.y+footprint.top<r.y+r.height+pad;
  for(let i=0;i<1200;i++){
    const obstacle={x:50+rng()*320,y:50+rng()*320,width:2+rng()*60,height:2+rng()*60};
    const start={x:20+rng()*460,y:25+rng()*450}; if(overlaps(start,obstacle,4)){i--;continue;}
    const end=blink(start,{x:rng()*900-200,y:rng()*900-200},[obstacle]);
    assert(end.x>=11&&end.x<=489&&end.y>=15&&end.y<=498);
    assert(Math.hypot(end.x-start.x,end.y-start.y)<=BLINK_CONFIG.range+1);
    for(let step=1;step<=60;step++) assert(!overlaps({x:start.x+(end.x-start.x)*step/60,y:start.y+(end.y-start.y)*step/60},obstacle));
  }
});
test('stun expires on scene time, cannot be extended and has a recovery window',()=>{
  for(const duration of [ARCANE_BIND_CONTROL.normalMs,ARCANE_BIND_CONTROL.eliteMs]){
    const state=new EnemyControl(); assert(state.apply(100,duration,ARCANE_BIND_CONTROL.recoveryMs));
    assert(state.isStunned(100+duration-1)); assert(!state.apply(200,duration,2400));
    assert(!state.isStunned(100+duration)); assert(!state.apply(100+duration,duration,2400));
    assert(state.apply(100+duration+2400,duration,2400));
    state.clear(); assert(!state.isStunned(101)); assert(state.apply(101,duration,2400));
  }
});
test('visual ground retains authored dimensions and every void/floor cell',()=>{
  for(const [source,surface] of [['ashvale-world','ashvale-ground'],['ashen-catacombs','catacombs-ground']]){
    const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../maps/'+name+'.json'),'utf8'));
    const a=read(source),b=read(surface); assert.equal(a.width,b.width);assert.equal(a.height,b.height);
    const ground=a.layers.find(l=>l.name==='Ground').data,visual=b.layers[0].data;
    assert.equal(ground.length,visual.length);
    ground.forEach((gid,index)=>assert.equal(gid===0,visual[index]===0));
  }
});
console.log(checks+' data/config/map/geometry checks passed. This is not browser runtime or visual QA.');
