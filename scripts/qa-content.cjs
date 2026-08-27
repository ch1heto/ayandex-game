// Run after the documented tsc test compilation. Uses isolated in-memory storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GameProgressService } = require('../artifacts/content-qa/node/systems/save/GameProgressService.js');
const { rollItem, equipmentBonuses, ITEM_RARITIES, EQUIPMENT_CONFIG } = require('../artifacts/content-qa/node/data/equipment.js');
const { validateItem } = require('../artifacts/content-qa/node/systems/equipment/itemValidation.js');
const { ADVANCED_SKILLS } = require('../artifacts/content-qa/node/data/advancedSkills.js');
const { SKILL_1_CONFIGS } = require('../artifacts/content-qa/node/data/skills.js');
const { ELITE_CONFIG } = require('../artifacts/content-qa/node/data/elites.js');
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
test('six paid skills and unchanged free Skill 1 balance', () => {
  for(const classId of ['warrior','archer','mage']) { for(const slot of [2,3]) { const c=ADVANCED_SKILLS[classId][slot]; assert(c.mana>0); assert(c.cooldownMs>=6000); } assert.equal(SKILL_1_CONFIGS[classId].cooldownMs,5000); }
  assert.equal(SKILL_1_CONFIGS.warrior.damageMultiplier,1.9); assert.equal(SKILL_1_CONFIGS.archer.damageMultiplier,2); assert.equal(SKILL_1_CONFIGS.mage.damageMultiplier,2);
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
console.log(checks+' data/config/map checks passed. This is not browser runtime or visual QA.');
