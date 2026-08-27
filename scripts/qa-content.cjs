// Run after the documented tsc test compilation. Uses isolated in-memory storage.
// ASHVALE_QA_DIR can point at an ignored compilation directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const qa = file => require(path.join(process.env.ASHVALE_QA_DIR || path.join(__dirname, '../artifacts/content-qa/node'), file));
const { GameProgressService } = qa('systems/save/GameProgressService.js');
const { rollItem, equipmentBonuses, ITEM_RARITIES, EQUIPMENT_CONFIG, EQUIPMENT_SLOTS, ITEM_BUDGETS, ITEM_DEFINITIONS } = qa('data/equipment.js');
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
const armor = { id:'test-armor-1', kind:'chest', rarity:'epic', itemLevel:3, stats:{ damage:0,maxHealth:40,maxMana:10,cooldownReduction:0,movementSpeed:.04 } };
test('new save: empty inventory, equipment and 3+3 potions', () => {
  const s=fresh().snapshot; assert.equal(s.version,5); assert.deepEqual(s.inventory,[]); assert.deepEqual(s.equipment,{});
  assert.equal(s.player.healthPotions,3); assert.equal(s.player.manaPotions,3); assert.equal(s.milestones.bossFirstKill,false);
});
for (const version of [1,2,3,4]) test('v'+version+' migration preserves progression, buildings and selection', () => {
  storage = new Map([['ashvale-progress-v'+version,JSON.stringify({ version, coins:87, buildings:{forge:true,infirmary:true}, player:{level:4,xp:73,healthPotions:2,manaPotions:1,slimeKills:12,spiderKills:8}, selectedClass:'mage',currentSkin:'necromancer' })]]);
  const s=new GameProgressService().load(); assert.equal(s.coins,87); assert.deepEqual(s.buildings,{forge:true,infirmary:true});
  assert.deepEqual(s.player,{level:4,xp:73,healthPotions:2,manaPotions:1,slimeKills:12,spiderKills:8});
  assert.deepEqual(s.selection,{classId:'mage',skinId:'necromancer'}); assert.deepEqual(s.inventory,[]); assert(storage.has('ashvale-progress-v5'));
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
  const s=fresh(); const item=rollItem(8,'boss'); s.pickup(item); const kindClass=({sword:'warrior',bow:'archer',staff:'mage'}[item.kind] ?? 'mage');
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

const { AFFIXES, EMPTY_STATS, itemStats, equipmentComparison, isRelevant, CLASS_WEAPONS, rollEquipmentDrops } = qa('data/equipment.js');
const { buyPrice, sellPrice, rollPotion } = qa('data/gameplayEconomy.js');
const { CombatTargets, TargetSelector } = qa('combat/CombatTargets.js');
const { DodgeState } = qa('data/dodge.js');
const { summonPositions } = qa('systems/skills/summonPositions.js');
const lootReport = [];
function seeded(initial) { let seed=initial; return ()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }; }
test('60000 smart loot rolls: class relevance, rarity, level weights, affixes, nonnegative stats and unique IDs', () => {
  const ids=new Set();
  for(const [index,classId] of ['warrior','archer','mage'].entries()) {
    const rng=seeded(907+index), counts=Object.fromEntries(ITEM_RARITIES.map(r=>[r,0])), offsets={'-1':0,0:0,1:0};
    let relevant=0, uncommonAffixed=0, uncommonCount=0, epicDouble=0, epicCount=0;
    for(let i=0;i<20000;i++) {
      const item=rollItem(10,'normal',rng,{classId});
      assert(!ids.has(item.id)); ids.add(item.id); assert.deepEqual(validateItem(item),item);
      relevant+=Number(isRelevant(item,classId)); counts[item.rarity]++; offsets[item.itemLevel-10]++;
      const count=item.affixes.length;
      assert.equal(new Set(item.affixes.map(a=>a.id)).size,count);
      if(item.rarity==='common') assert.equal(count,0);
      if(item.rarity==='uncommon') { assert(count<=1); uncommonCount++; uncommonAffixed+=count; }
      if(item.rarity==='rare') assert.equal(count,1);
      if(item.rarity==='epic') { assert(count===1||count===2); epicCount++; epicDouble+=Number(count===2); }
      if(item.rarity==='legendary') assert.equal(count,2);
      for(const affix of item.affixes) assert(affix.value>0&&affix.value<=AFFIXES[affix.id].cap);
      for(const value of Object.values(itemStats(item))) assert(Number.isFinite(value)&&value>=0);
      const rarityIndex=ITEM_RARITIES.indexOf(item.rarity), power=EQUIPMENT_CONFIG.rarityMultipliers[rarityIndex];
      for(const [stat,[base,perLevel]] of Object.entries(ITEM_BUDGETS[item.kind].base)) {
        const expected=(base+perLevel*item.itemLevel)*power,actual=item.stats[stat];assert(actual>=Math.round(expected*.9)&&actual<=Math.round(expected*1.1));
      }
    }
    assert(Math.abs(relevant/20000-.75)<.02);
    ITEM_RARITIES.forEach((r,i)=>assert(Math.abs(counts[r]/20000-EQUIPMENT_CONFIG.rarityWeights.normal[i]/100)<.02));
    for(const [offset,p] of [[-1,.2],[0,.4],[1,.4]]) assert(Math.abs(offsets[offset]/20000-p)<.02);
    assert(Math.abs(uncommonAffixed/uncommonCount-.25)<.035); assert(Math.abs(epicDouble/epicCount-.5)<.07);
    lootReport.push({classId,rolls:20000,relevantPercent:relevant/200,rarity:counts,offsets,uncommonAffixPercent:100*uncommonAffixed/uncommonCount,epicDoublePercent:100*epicDouble/epicCount});
  }
  console.log('LOOT_STATS '+JSON.stringify(lootReport));
});
test('2000 boss reward pairs: two items, at least one relevant, level floor and Rare+; elite level floor',()=>{
  const rng=seeded(492);
  for(let i=0;i<2000;i++){
    const classId=['warrior','archer','mage'][i%3];
    const pair=rollEquipmentDrops(12,'boss',rng,{classId}); assert.equal(pair.length,2);
    assert(pair.some(item=>isRelevant(item,classId)));
    pair.forEach(item=>{assert(item.itemLevel>=12&&item.itemLevel<=13);assert(ITEM_RARITIES.indexOf(item.rarity)>=2);});
    assert(rollItem(12,'elite',rng,{classId}).itemLevel>=12);
  }
});
test('potion drops: 5% / 20% / guaranteed boss, balanced health/mana; normal equipment stays 12%',()=>{
  const rng=seeded(1109);
  for(const [source,chance] of [['normal',.05],['elite',.2],['boss',1]]){
    let count=0,health=0;
    for(let i=0;i<20000;i++){const kind=rollPotion(source,rng);if(kind){count++;health+=Number(kind==='health');}}
    assert(Math.abs(count/20000-chance)<.015); assert(Math.abs(health/count-.5)<.06);
  }
  let count=0;for(let i=0;i<20000;i++)count+=rollEquipmentDrops(5,'normal',rng,{classId:'mage'}).length;
  assert(Math.abs(count/20000-.12)<.015);
});
test('empty and weak slots receive noticeable nonabsolute bias; weapon drops stay below 45%',()=>{
  const sample=(equipment,seed)=>{
    const rng=seeded(seed), counts={};let nonUpgrades=0;
    for(let i=0;i<20000;i++){
      const item=rollItem(10,'normal',rng,{classId:'warrior',equipment});
      counts[item.kind]=(counts[item.kind]||0)+1;
      nonUpgrades+=Number(item.kind==='sword'&&item.itemLevel<30);
    }
    return {counts,nonUpgrades};
  };
  const gear=Object.fromEntries(EQUIPMENT_SLOTS.map(slot=>[slot,rollItem(30,'boss',seeded(87),{kind:slot==='weapon'?'sword':slot.startsWith('ring')?'ring':slot,rarity:'legendary'})]));
  const full=sample(gear,31),emptyGear={...gear};delete emptyGear.helmet;delete emptyGear.boots;
  const empty=sample(emptyGear,31);
  const weakGear={...gear,helmet:{...gear.helmet,itemLevel:1,rarity:'common'}};
  const weak=sample(weakGear,31);
  for(const kind of ['helmet','boots']) assert(empty.counts[kind]>full.counts[kind]*1.5);
  assert(weak.counts.helmet>full.counts.helmet*1.5);
  assert(empty.nonUpgrades>400);
  for(const counts of [full.counts,empty.counts,weak.counts]){
    assert((counts.sword+counts.bow+counts.staff)/20000<.45);
    for(const kind of ['helmet','chest','legs','boots','amulet','ring']) assert(counts[kind]>600);
  }
  console.log('SLOT_STATS '+JSON.stringify({full,empty,weak}));
});

test('2000 comparisons match actual equip bonuses for every slot, rings, caps and class restrictions',()=>{
  const rng=seeded(111);
  for(let i=0;i<2000;i++){
    const classId=['warrior','archer','mage'][i%3];
    const equipment=Object.fromEntries(EQUIPMENT_SLOTS.map(slot=>[slot,rollItem(10,'boss',rng,{kind:slot==='weapon'?CLASS_WEAPONS[classId]:slot.startsWith('ring')?'ring':slot})]));
    const item=rollItem(10,'normal',rng,{classId});const slot=item.kind==='ring'?(i%2?'ring1':'ring2'):ITEM_DEFINITIONS[item.kind].slot;
    const before=equipmentBonuses(equipment,classId), after=isRelevant(item,classId)?equipmentBonuses({...equipment,[slot]:item},classId):before;
    const delta=equipmentComparison(item,equipment,classId,slot);
    for(const key of Object.keys(EMPTY_STATS)) assert(Math.abs(after[key]-before[key]-delta[key])<.00001);
    if(item.kind==='ring') assert.deepEqual(equipmentComparison(item,equipment,classId),EMPTY_STATS);
  }
  const capped={...sword,stats:{...EMPTY_STATS,cooldownReduction:.2},affixes:[{id:'focused',value:.06}]};
  assert.equal(equipmentBonuses({weapon:capped},'warrior').cooldownReduction,.2);
  assert.equal(equipmentComparison(capped,{weapon:capped},'warrior').cooldownReduction,0);
});
function forge() { const s=fresh(); s.addCoins(100000); assert(s.restoreBuilding('forge',12)); return s; }
test('Forge is gated; six class-relevant offers stable across reopen/reload and sold-out state',()=>{
  let s=fresh(); assert.deepEqual(s.ensureShop('mage'),[]); assert.equal(s.buyPotion('health','locked'),'locked');
  s=forge(); const offers=s.ensureShop('mage'); assert.equal(offers.length,6); assert.equal(offers[0].kind,'staff'); assert.equal(offers[1].kind,'chest');
  assert(offers.every(item=>isRelevant(item,'mage'))); assert.deepEqual(s.ensureShop('mage'),offers);
  s=new GameProgressService(); s.load(); assert.deepEqual(s.ensureShop('mage'),offers);
  for(const item of offers){
    const before=s.snapshot.coins; assert.equal(s.buyEquipment(item.id,'mage'),'ok'); assert.equal(before-s.snapshot.coins,buyPrice(item));
    const snapshot=s.snapshot; assert.equal(s.buyEquipment(item.id,'mage'),'missing'); assert.deepEqual(s.snapshot,snapshot);
  }
  assert.deepEqual(s.ensureShop('mage'),[]); const reload=new GameProgressService(); reload.load(); assert.deepEqual(reload.ensureShop('mage'),[]);
  assert.deepEqual(reload.snapshot.inventory,offers);
  const originalIds=new Set(offers.map(item=>item.id)); reload.refreshShop(); assert(reload.ensureShop('mage').every(item=>!originalIds.has(item.id)));
  assert.deepEqual(reload.snapshot.inventory,offers);
});
test('insufficient funds and full bag are atomic; potion purchase and receipts survive reload',()=>{
  const s=forge(); const offers=s.ensureShop('warrior');
  s.spendCoins(s.snapshot.coins); let before=s.snapshot;
  assert.equal(s.buyEquipment(offers[0].id,'warrior'),'coins'); assert.equal(s.buyPotion('mana','no-money'),'coins'); assert.deepEqual(s.snapshot,before);
  s.addCoins(10000);
  for(let i=0;i<24;i++) assert(s.pickup({...sword,id:'full-'+i}));
  before=s.snapshot; assert.equal(s.buyEquipment(offers[0].id,'warrior'),'full'); assert.deepEqual(s.snapshot,before);
  assert.equal(s.buyPotion('health','health-once'),'ok'); assert.equal(s.snapshot.coins,before.coins-12); assert.equal(s.snapshot.player.healthPotions,before.player.healthPotions+1);
  before=s.snapshot; assert.equal(s.buyPotion('health','health-once'),'duplicate'); assert.deepEqual(s.snapshot,before);
  const reload=new GameProgressService(); reload.load(); assert.equal(reload.buyPotion('health','health-once'),'duplicate');
  assert.equal(reload.buyPotion('mana','mana-once'),'ok'); assert.equal(reload.snapshot.coins,before.coins-14);
  assert(reload.addPotion('health')); assert.equal(reload.snapshot.player.healthPotions,before.player.healthPotions+1);
});
test('sell protects equipped items and confirms Rare+; duplicate sell/equip cannot resurrect sold items',()=>{
  const s=forge(); s.pickup(sword); s.equip(sword.id,'warrior');
  let before=s.snapshot; assert.equal(s.sellItem(sword.id,true),'missing'); assert.deepEqual(s.snapshot,before);
  assert(s.unequip('weapon')); before=s.snapshot; assert.equal(s.sellItem(sword.id),'confirm'); assert.deepEqual(s.snapshot,before);
  assert.equal(s.sellItem(sword.id,true),'ok'); assert.equal(s.snapshot.coins,before.coins+sellPrice(sword)); assert(sellPrice(sword)<buyPrice(sword));
  before=s.snapshot; assert.equal(s.sellItem(sword.id,true),'missing'); assert.equal(s.equip(sword.id,'warrior'),'missing'); assert.deepEqual(s.snapshot,before);
});
test('level-up refreshes stock while selection, rolled affixes and inventory remain stable',()=>{
  const s=forge(), old=s.ensureShop('mage'); const item=rollItem(5,'boss',seeded(234),{classId:'mage'});
  s.pickup(item); s.select('mage','little-mage'); const before=s.snapshot.shop.generation;
  s.recordEnemyDefeat('spider',100);
  assert(s.snapshot.shop.generation>before); assert.deepEqual(s.snapshot.inventory,[item]);
  assert(s.ensureShop('mage').every(item=>!old.some(other=>other.id===item.id)));
  assert.deepEqual(new GameProgressService().load(),s.snapshot);
});
test('legacy v3 items are migrated without reroll; malformed and duplicated affixes are sanitized',()=>{
  fresh(); storage.set('ashvale-progress-v3',JSON.stringify({version:3,coins:75,inventory:[sword],equipment:{armor},selection:{classId:'mage',skinId:'little-mage'},milestones:{bossFirstKill:true}}));
  const s=new GameProgressService().load(); assert.equal(s.version,5); assert.equal(s.coins,75);
  assert.equal(s.inventory[0].stats.damage,8); assert.deepEqual(s.inventory[0].affixes,[]); assert.equal(s.equipment.chest.stats.maxHealth,40);
  assert.equal(s.milestones.bossFirstKill,true); assert.equal(s.selection.skinId,'little-mage');
  const item=validateItem({...sword,affixes:[{id:'focused',value:99},{id:'focused',value:.01},{id:'unknown',value:1},{id:'sharp',value:-2}]});
  assert.deepEqual(item.affixes,[{id:'focused',value:.06}]);
});
test('target lock, player priority, dead-target eviction and boss weighting',()=>{
  const targets=new CombatTargets();
  const target=(id,type,x)=>({targetId:id,targetType:type,x,y:0,alive:true,priority:type==='player'?1.2:1,physicsRoot:{},takeDamage:()=>true});
  const player=target('player','player',100), echo=target('echo','summon',90); targets.add(player); targets.add(echo);
  const selector=new TargetSelector(targets); assert.equal(selector.choose(0,0,0),player);
  echo.x=10; assert.equal(selector.choose(399,0,0),player); assert.equal(selector.choose(400,0,0),echo);
  targets.remove(echo); assert.equal(selector.current,undefined); assert.equal(selector.choose(401,0,0),player);
  echo.x=50; targets.add(echo); const boss=new TargetSelector(targets,3); assert.equal(boss.choose(0,0,0),player);
  echo.x=5; assert.equal(boss.choose(400,0,0),echo); echo.alive=false; assert.equal(boss.choose(401,0,0),player);
  targets.remove(player); assert.equal(boss.choose(402,0,0),undefined);
});
test('Dodge has finite iframe/duration, cooldown survives cancellation, repeated starts cannot extend it',()=>{
  const dodge=new DodgeState(); assert(dodge.start(100)); assert(!dodge.start(110));
  assert(dodge.invulnerable(279)); assert(!dodge.invulnerable(280)); assert(dodge.active(299)); assert(!dodge.active(300));
  assert(!dodge.start(1499)); assert(dodge.start(1500)); dodge.cancel();
  assert(!dodge.active(1501)); assert(!dodge.invulnerable(1501)); assert(!dodge.start(1501)); assert(dodge.start(2900));
});
test('600 safe summon layouts respect full footprints, gates, spread and bounds; blocked casts return no partial summons',()=>{
  const rng=seeded(198);
  for(let i=0;i<600;i++){
    const origin={x:30+rng()*440,y:30+rng()*440};
    const blockers=[{x:240,y:0,width:20,height:500}];
    if(origin.x>225&&origin.x<276){i--;continue;}
    const positions=summonPositions(origin,bounds,blockers);
    assert(positions.length===0||positions.length===3);
    positions.forEach((p,index)=>{
      assert(p.x-9>=0&&p.x+9<=500&&p.y-13>=0&&p.y<=500);
      assert(p.x+9<240||p.x-9>260);
      assert((p.x<240)===(origin.x<240));
      positions.slice(index+1).forEach(other=>assert(Math.hypot(p.x-other.x,p.y-other.y)>=32));
    });
  }
  assert.equal(summonPositions({x:100,y:100},bounds,[{x:64,y:64,width:20,height:72},{x:116,y:64,width:20,height:72},{x:84,y:64,width:32,height:20},{x:84,y:116,width:32,height:20}]).length,0);
  assert.equal(summonPositions({x:250,y:250},bounds,[]).length,3);
});


test('summon lifecycle and Volatile damage with stubbed rendering/physics (not browser QA)',()=>{
  const Module=require('node:module'), originalLoad=Module._load;
  const shots=[], projectiles=[], colliders=[], objects=new Set();
  class Art {
    constructor(x=0,y=0,key='idle',frame=0){this.x=x;this.y=y;this.active=true;this.texture={key};this.frame={name:frame};this.data={};this.scaleX=this.scaleY=1;objects.add(this);}
    setOrigin(x,y=x){this.originX=x;this.originY=y;return this;} setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;}
    setDepth(value){this.depth=value;return this;} setFlipX(value){this.flipX=value;return this;} setTint(){return this;} setAlpha(){return this;}
    setPosition(x,y){this.x=x;this.y=y;return this;} setTexture(key,frame=0){this.texture={key};this.frame={name:frame};return this;}
    setData(key,value){this.data[key]=value;return this;} getData(key){return this.data[key];} play(){return this;} stop(){return this;}
    destroy(){this.active=false;objects.delete(this);}
  }
  class Projectiles {
    constructor(){this.active=true;projectiles.push(this);}
    spawn(...args){shots.push({owner:this,hit:args[7]});} update(){} destroy(){this.active=false;}
  }
  class Vfx { effect(){} update(){} impact(){} destroy(){} afterimage(){} }
  const skin={displayScale:2,visualCenterX:7,baseline:16,attackImpactFrame:2,animations:{idle:{frameWidth:16,frameHeight:16},attack:{rootX:11,baseline:32,frameWidth:32,frameHeight:32,frames:6,frameRate:10}}};
  Module._load=function(request,parent,isMain){
    if(request.endsWith('/characterSkins')) return {getCharacterSkin:()=>skin};
    if(request.endsWith('/characterAssets')) return {characterTextureKey:(_skin,state)=>state,characterAnimationKey:(_skin,state)=>state,idleFrameForSkin:()=>0};
    if(request.endsWith('/ProjectileSystem')) return {ProjectileSystem:Projectiles};
    if(request.endsWith('/PixelSkillVfx')) return {PixelSkillVfx:Vfx,line:()=>{},pixel:()=>{}};
    return originalLoad.call(this,request,parent,isMain);
  };
  try {
    const {ArcaneEchoSystem}=qa('systems/skills/ArcaneEchoSystem.js');
    const {CombatFeedback}=qa('systems/skills/CombatFeedback.js');
    const scene={time:{now:0},add:{zone:(...args)=>new Art(...args),sprite:(...args)=>new Art(...args),image:(...args)=>new Art(...args)},physics:{
      world:{bounds},add:{
        existing(root){root.body={setAllowGravity(){return this;},setImmovable(){return this;},setSize(){return this;},updateFromGameObject(){return this;}};},
        collider(){const c={active:true,destroy(){this.active=false;}};colliders.push(c);return c;},
      },overlap:()=>true
    }};
    let dealt=0;
    const player={x:250,y:250,alive:true,activeSkin:'little-mage',activeClass:'mage',finalDamage:50,currentHealth:5,maxHealth:100,currentMana:2,maxMana:100,
      restoreHealth(v){this.currentHealth=Math.min(this.maxHealth,this.currentHealth+v);},restoreMana(v){this.currentMana=Math.min(this.maxMana,this.currentMana+v);}
    };
    const enemy={visual:{x:280,y:270,active:true},currentHealth:100,takeDamage(damage){dealt+=damage;return true;}};
    const group={getChildren:()=>[]};
    const echoes=new ArcaneEchoSystem(scene,{player,obstacles:group,slimes:{group,forEach:fn=>fn(enemy),getSlime:()=>enemy},spiders:{group,hurtboxGroup:group,forEach:()=>{},get:()=>undefined}});
    assert(echoes.cast()); assert.equal(combatTargetsForScene().all().length,0);
    scene.time.now=220; echoes.update(220); assert.equal(combatTargetsForScene().all().length,3);
    scene.time.now=420; echoes.update(420); assert.equal(shots.length,1); shots[0].hit({}); assert.equal(dealt,10);
    const first=combatTargetsForScene().all()[0]; assert(first.takeDamage(0,0,0)); assert(!first.takeDamage(99,0,0));
    assert.equal(combatTargetsForScene().get(first.targetId),undefined); assert(!projectiles[0].active);
    scene.time.now=8000; echoes.update(8000); assert.equal(combatTargetsForScene().all().length,0); assert.equal(objects.size,0);
    assert(echoes.cast()); scene.time.now=8220; echoes.update(8220); const previous=combatTargetsForScene().all();
    assert(echoes.cast()); assert(previous.every(e=>e.disposed)); scene.time.now=8440; echoes.update(8440); assert.equal(combatTargetsForScene().all().length,3);
    player.alive=false; echoes.update(8441); assert.equal(combatTargetsForScene().all().length,0); assert.equal(objects.size,0);
    echoes.destroy(); echoes.destroy(); assert(colliders.every(c=>!c.active)); assert(projectiles.every(p=>!p.active));
    player.alive=true;
    const feedback=new CombatFeedback(scene,player); feedback.levelUp(1); assert.equal(player.currentHealth,35); assert.equal(player.currentMana,32);
    feedback.levelUp(5); assert.equal(player.currentHealth,100); assert.equal(player.currentMana,100);
    const hits={player:0,echo:0,far:0}, dodge=new DodgeState();
    const targets=combatTargetsForScene();
    for(const [id,x] of [['player',250],['echo',265],['far',400]]) targets.add({targetId:id,targetType:id==='player'?'player':'summon',priority:1,x,y:250,alive:true,physicsRoot:{},
      takeDamage(){if(id==='player'&&dodge.invulnerable(scene.time.now))return false;hits[id]++;return true;}
    });
    feedback.volatile(250,250); scene.time.now=9440; assert(dodge.start(scene.time.now)); feedback.update(9440); assert.deepEqual(hits,{player:0,echo:1,far:0});
    feedback.update(9441); assert.deepEqual(hits,{player:0,echo:1,far:0});
    feedback.volatile(250,250); scene.time.now=10441; feedback.update(10441); assert.deepEqual(hits,{player:1,echo:2,far:0});
    feedback.volatile(250,250); feedback.clear(); scene.time.now=12000; feedback.update(12000); assert.deepEqual(hits,{player:1,echo:2,far:0}); assert.equal(objects.size,0);
    function combatTargetsForScene(){return qa('combat/CombatTargets.js').combatTargets(scene);}
  } finally { Module._load=originalLoad; }
});


test('Equipment v2: 100 full-set cycles, both rings, explicit swaps, full bag and every class/kind',()=>{
  const rng=seeded(720);
  for(const classId of ['warrior','archer','mage']) {
    const s=forge();
    const equipped=EQUIPMENT_SLOTS.map(slot=>rollItem(9,'boss',rng,{kind:slot==='weapon'?CLASS_WEAPONS[classId]:slot.startsWith('ring')?'ring':slot}));
    equipped.forEach(item=>assert(s.pickup(item)));
    for(let cycle=0;cycle<100;cycle++){
      equipped.forEach(item=>assert.equal(s.equip(item.id,classId),'ok'));
      const bonus=equipmentBonuses(s.snapshot.equipment,classId);
      assert(bonus.cooldownReduction<=.2&&bonus.movementSpeed<=.1&&bonus.manaRegen<=3);
      assert.equal(new Set(Object.values(s.snapshot.equipment).map(i=>i.id)).size,8);
      assert.deepEqual(new GameProgressService().load(),s.snapshot);
      for(const slot of EQUIPMENT_SLOTS) assert(s.unequip(slot));
      assert.deepEqual(equipmentBonuses(s.snapshot.equipment,classId),EMPTY_STATS);
    }
    equipped.forEach(item=>assert.equal(s.equip(item.id,classId),'ok'));
    const ring=rollItem(9,'boss',rng,{kind:'ring'}); s.pickup(ring);
    const before=s.snapshot;
    assert.equal(s.equip(ring.id,classId),'choose-slot');assert.deepEqual(s.snapshot,before);
    assert.equal(s.equip(ring.id,classId,'weapon'),'choose-slot');
    for(let i=s.snapshot.inventory.length;i<24;i++) assert(s.pickup({...ring,id:'ring-full-'+i}));
    assert(!s.unequip('ring2'));assert.equal(s.equip(ring.id,classId,'ring2'),'ok');
    assert.equal(s.snapshot.inventory.length,24);assert.equal(s.snapshot.equipment.ring2.id,ring.id);
    assert.equal(s.snapshot.equipment.ring1.id,before.equipment.ring1.id);
    assert.equal(s.sellItem(ring.id,true),'missing');
    for(const item of s.snapshot.inventory) {
      const coins=s.snapshot.coins;assert.equal(s.sellItem(item.id),'confirm');
      assert.equal(s.sellItem(item.id,true),'ok');assert.equal(s.snapshot.coins,coins+sellPrice(item));
      assert.equal(s.sellItem(item.id,true),'missing');
    }
    for(const slot of EQUIPMENT_SLOTS) {
      const item=s.snapshot.equipment[slot]; assert(s.unequip(slot)); const coins=s.snapshot.coins;
      assert.equal(s.sellItem(item.id),'confirm');assert.equal(s.sellItem(item.id,true),'ok');assert.equal(s.snapshot.coins,coins+sellPrice(item));
    }
  }
});
test('v4 migration preserves old armor UUID/rolls/affixes, all progression and partial/sold-out shop stock',()=>{
  const oldArmor={...armor,kind:'armor',stats:{...armor.stats,manaRegen:.4},affixes:[{id:'vital',value:13},{id:'restoring',value:.8}]};
  const oldStock=[{...sword,id:'old-stock-weapon'}, {...oldArmor,id:'old-stock-armor'}];
  const old={version:4,coins:93,buildings:{forge:true,infirmary:true},player:{level:7,xp:31,healthPotions:9,manaPotions:8,slimeKills:6,spiderKills:5},
    equipment:{weapon:{...sword,id:'old-equipped-weapon'},armor:oldArmor},inventory:[{...oldArmor,id:'old-bag-armor'}],
    selection:{classId:'archer',skinId:'archer-hero'},milestones:{eliteKilled:true,dungeonEntered:true,bossFirstKill:true},
    shop:{generation:12,stocks:{warrior:oldStock,mage:[]},receipts:['old-potion']}};
  storage=new Map([['ashvale-progress-v4',JSON.stringify(old)]]);
  const s=new GameProgressService();const loaded=s.load();
  assert.equal(loaded.version,5);assert.equal(loaded.equipment.chest.kind,'chest');
  assert.deepEqual(loaded.equipment.chest.stats,{...EMPTY_STATS,...oldArmor.stats});
  assert.deepEqual(loaded.equipment.chest.affixes,oldArmor.affixes);assert.equal(loaded.equipment.chest.id,oldArmor.id);
  assert.equal(loaded.equipment.weapon.id,old.equipment.weapon.id);
  assert.equal(loaded.inventory[0].kind,'chest');assert.equal(loaded.inventory[0].id,'old-bag-armor');
  assert.deepEqual(Object.keys(loaded.equipment).sort(),['chest','weapon']);
  for(const key of ['coins','buildings','player','selection','milestones']) assert.deepEqual(loaded[key],old[key]);
  assert.equal(loaded.shop.generation,12);assert.deepEqual(loaded.shop.receipts,['old-potion']);
  assert.deepEqual(s.ensureShop('warrior'),oldStock.map(validateItem)); assert.deepEqual(s.ensureShop('mage'),[]);
  assert.deepEqual(new GameProgressService().load(),s.snapshot);
  s.refreshShop();assert.equal(s.ensureShop('warrior').length,6);
});
test('200 refreshes cover all universal categories and never create a weapon-heavy shop',()=>{
  const s=forge(),kinds=new Set();
  for(let i=0;i<200;i++){
    s.refreshShop();const offers=s.ensureShop('archer');assert.equal(offers.length,6);
    offers.forEach(item=>kinds.add(item.kind));assert(offers.every(item=>isRelevant(item,'archer')));
    assert(offers.filter(item=>item.kind==='bow').length<=2); assert.equal(offers[1].kind,'chest');assert.equal(offers[3].kind,'boots');
  }
  for(const kind of ['bow','helmet','chest','legs','boots','amulet','ring']) assert(kinds.has(kind));
});
const { broodmotherMotion }=qa('entities/enemies/broodmotherMotion.js');
test('boss visual state motion stays bounded across 20000 frames; attack/recovery/cast/death poses',()=>{
  const base={time:0,action:'idle',actionUntil:0,phase:1,specialUntil:0,recoveryUntil:0,venomAt:-Infinity};
  for(let i=0;i<20000;i++){
    const m=broodmotherMotion({...base,time:i*16,phase:1+i%3,action:['idle','lunge-windup','lunge','venom-windup','zone-windup'][i%5],actionUntil:i*16+300});
    assert(Math.abs(m.bob)<=1);assert(m.scaleX>=.97&&m.scaleX<=1.04);assert(m.scaleY>=.96&&m.scaleY<=1.02);assert(Math.abs(m.angle)<=.35);assert(m.glow<.86);
  }
  assert.equal(broodmotherMotion({...base,action:'lunge'}).pose,'attack');
  assert.equal(broodmotherMotion({...base,recoveryUntil:100}).pose,'attack');
  assert.equal(broodmotherMotion({...base,action:'zone-windup'}).pose,'phase');
  assert.equal(broodmotherMotion({...base,specialUntil:100}).pose,'phase');
  assert.equal(broodmotherMotion({...base,action:'venom-windup'}).pose,'idle');
  assert.equal(broodmotherMotion({...base,time:600,deathAt:0}).alpha,0);
});


test('real PlayerCharacter Dodge chooses Archer walk/flip; Warrior/Mage idle, speed, body and cooldown preserved (stub graphics)',()=>{
  const Module=require('node:module'),originalLoad=Module._load;
  class Vector2 { constructor(x,y){this.x=x;this.y=y;} lengthSq(){return this.x*this.x+this.y*this.y;} set(x,y){this.x=x;this.y=y;return this;} normalize(){const n=Math.hypot(this.x,this.y);if(n){this.x/=n;this.y/=n;}return this;} scale(v){this.x*=v;this.y*=v;return this;} }
  Module._load=function(request,parent,isMain){
    if(request==='phaser') return {Math:{Vector2}};
    if(/\.(png|svg)$/.test(request)) return request;
    return originalLoad.apply(this,arguments);
  };
  try {
    const {PlayerCharacter}=qa('entities/player/PlayerCharacter.js');
    for(const [classId,skinId] of [['archer','archer-hero'],['warrior','sushi-warrior'],['mage','little-mage']]) {
      for(const [mx,my,ax,ay,left] of [[-1,0,1,0,true],[1,0,-1,0,false],[-1,-1,1,0,true],[0,-1,0,0,false],[0,0,-1,0,true]]) {
        const p=Object.create(PlayerCharacter.prototype);
        const visual={originY:0,stop(){this.played=undefined;return this;},setScale(){return this;},clearTint(){return this;},setOrigin(x,y){this.originY=y;return this;},setFlipX(v){this.flipX=v;return this;},setTexture(key){this.texture=key;return this;},play(key){this.played=key;return this;}};
        const body={setVelocity(x,y){this.x=x;this.y=y;return this;},setSize(w,h){this.w=w;this.h=h;return this;},setOffset(){return this;}};
        Object.assign(p,{visual,body,root:{active:true},scene:{time:{now:1000}},health:100,classId,skinId,knockbackUntil:0,dodgeState:new DodgeState(),facing:'down',horizontalFacing:'right',aimX:1,aimY:0});
        assert(p.dodge(mx,my,ax,ay)); assert(Math.abs(Math.hypot(body.x,body.y)-360)<.0001);
        assert.equal(body.w,18);assert.equal(body.h,13);assert.equal(p.dodgeCooldown,1400);
        if(classId==='archer') {assert.equal(visual.played,'character-archer-hero-walk-'+(left?'left':'right'));assert.equal(visual.flipX,left);}
        else {assert.equal(visual.played,undefined);assert.equal(visual.texture,'character-'+skinId+'-idle');}
        assert(!p.dodge(mx,my,ax,ay));p.scene.time.now=1180;assert(!p.dodgeState.invulnerable(1180));assert(p.dodging);
        p.scene.time.now=1200;assert(!p.dodging);assert.equal(p.dodgeCooldown,1200);
      }
    }
  } finally {Module._load=originalLoad;}
});


test('boss renderer reuses four display objects, switches both textures, and cleans up (stub graphics)',()=>{
  const Module=require('node:module'),originalLoad=Module._load,objects=new Set();
  Module._load=function(request,parent,isMain){
    if(request==='phaser') return {Textures:{FilterMode:{NEAREST:0}},BlendModes:{ADD:1}};
    if(/\.png$/.test(request)) return request;
    return originalLoad.apply(this,arguments);
  };
  try{
    const {BroodmotherVisual}=qa('entities/enemies/BroodmotherVisual.js');
    const object=()=>{const o={active:true,destroy(){assert(this.active);this.active=false;objects.delete(this);}};
      for(const method of ['setOrigin','setName','setBlendMode','setPosition','setScale','setAngle','setFlipX','setDepth','setAlpha','clear','fillStyle','fillRect','setTexture']) o[method]=function(...args){this[method+'Args']=args;return this;};
      objects.add(o);return o;};
    let textures=0;const scene={time:{now:0},textures:{get:()=>({setFilter:()=>textures++})},add:{image:object,graphics:object}};
    const visual=new BroodmotherVisual(scene);assert.equal(objects.size,4);assert.equal(textures,6);
    for(let i=0;i<20000;i++) visual.update(i*16,100,200,i%2?'lunge':'idle',i*16+50,1+i%3,true,false);
    assert.equal(objects.size,4);assert.equal(textures,6);
    visual.update(400000,100,200,'zone-windup',400650,3,true,false);
    visual.update(400200,100,200,'zone-windup',400650,3,true,false);
    assert.equal(visual.body.setTextureArgs[0],'broodmother-phase');
    assert.equal(visual.glow.setTextureArgs[0],'broodmother-phase-glow');
    visual.update(400300,100,200,'idle',0,3,false,false);
    visual.update(400900,100,200,'idle',0,3,false,false);assert.equal(visual.body.setAlphaArgs[0],0);
    visual.destroy();assert.equal(objects.size,0);
  }finally{Module._load=originalLoad;}
});
// Offline preview input is the actual production motion function, not hand-authored frame transforms.
const motionFrames=[];
for(let time=0;time<5000;time+=50){
  const action=time<1000?'idle':time<1700?'lunge-windup':time<2150?'lunge':time<2800?'idle':time<3450?'venom-windup':time<3900?'idle':time<4550?'zone-windup':'idle';
  motionFrames.push({...broodmotherMotion({time,action,actionUntil:1700,phase:time<2800?1:3,specialUntil:650,recoveryUntil:time>=2150?2330:0,venomAt:time>=3450?3450:-Infinity}),label:action});
}
const motionDir=path.join(__dirname,'../artifacts/current-pass/boss');
fs.mkdirSync(motionDir,{recursive:true});fs.writeFileSync(path.join(motionDir,'motion.json'),JSON.stringify(motionFrames));

console.log(checks+' data/config/map/geometry checks passed. This is not browser runtime or visual QA.');
