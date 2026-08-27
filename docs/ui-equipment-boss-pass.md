# UI / Equipment v2 / Broodmother — 2026-08-28

**Статус: реализация внесена; typecheck, build и доступный QA прошли. Весь проход НЕ закрыт: обязательный browser/runtime QA заблокирован средой.**

## Продолжение после сбоя

В начале выполнены `git status --short`, `git diff --stat`, `git diff`.
Сохранились три файла: PlayerCharacter.ts, style.css, forge-shop.css (10 добавлений, 4 удаления).
Это были исправления potion CSS и Archer Dodge. Продолжение началось с Equipment v2; откатов, reset/checkout и повторного внесения этих правок не было.

## Отчёт по 33 пунктам

1. **Причина Forge bug:** глобальный `.potion-glyph` имел `position:absolute` и `inset`. В карточке магазина он растягивался относительно позиционированного `.forge-shop-content`, закрывая содержимое синей mana-фигурой.
2. **Исправление:** обычный glyph теперь relative, 24×30 px; absolute/inset принадлежат только `.hotbar-icon > .potion-glyph`. Убрано растягивание второй potion-карточки на две колонки. Overflow не используется для маскировки ошибки. Проверка обоих зелий в браузере — BLOCKED.
3. **Слоты:** weapon, helmet, chest, legs, boots, amulet, ring1, ring2.
4. **Kinds:** sword, bow, staff, helmet, chest, legs, boots, amulet, ring. Оружие привязано к классу; остальные категории универсальны.
5. **Stat budget:** основной damage остаётся у weapon, основной HP — у chest; остальные слоты получают меньшие бюджеты и тематические аффиксы. Base HP четырёх armor slots до rarity/variance суммарно `11 + 2.85L` вместо копирования старого armor `8 + 3L` в каждый слот. Коэффициенты аффиксов: weapon .8, chest .5, helmet .3, legs .35, boots .25, amulet .35, ring .2. Глобальные caps: CDR 20%, speed 10%, bonus mana regen 3/с. Старые rolls не пересчитываются.
6. **Кольца:** автоматически выбирается пустой слот. Если оба заняты — две явные кнопки Ring 1 / Ring 2 в tooltip; до выбора Equip отключён, comparison не обещает невыбранную замену.
7. **Миграция:** save v5 читает v1–v4. Старые kind/slot armor → chest; weapon, UUID, rolled stats, affixes, inventory, coins, potions, level/XP, selection, buildings, milestones и shop сохраняются. Старый ключ не удаляется. Существующий stock не дополняется и не reroll.
8. **Smart loot:** 75% — выбор среди подходящего оружия и всех universal categories, 25% — другое классовое оружие. Сохранены rarity/level/drop weights и гарантированный подходящий предмет в паре boss loot.
9. **Empty/weak bias:** пустой слот весит 2.2; занятый — 1–2 по недостатку item level × rarity power. Ring category ×1.25 для двух слотов. В QA пустые helmet/boots выросли с 10.60/10.80% до 17.12/17.54%; non-upgrades остаются.
10. **Shop offers:** шесть на новом refresh; сохранённый старый неполный или пустой stock остаётся таким до штатного refresh.
11. **Forge categories:** class weapon, chest, helmet/legs, boots, amulet/ring, random useful. В 200 refresh доступны все universal categories; максимум два weapon offers. Prices зелий 12/14 и правила refresh не менялись.
12. **Inventory:** bag слева, paper-doll в центре, bounded tooltip справа; адаптивное перестроение на меньшей ширине.
13. **Paper-doll:** helmet сверху, boots снизу; weapon/chest/legs слева, amulet/rings справа. Восемь кнопок создаются один раз. Иконки, rarity border, selection, RU/EN labels; пустые слоты — тёмные силуэты.
14. **Player preview:** существующий LivePlayerPreview использует frame/texture/origin текущего PlayerCharacter и текущий skin. Canvas создаётся при открытии, обновляется по frame signature, не пересоздаётся каждый кадр.
15. **Equip/Unequip:** только через Inventory; item из bag → slot, старый item → bag. При полном bag Unequip блокируется; swap сохраняет все предметы. Снятие Ring 2 использует фактический слот по UUID.
16. **Character:** class, level/XP, HP/MP, base/final damage, итоговая скорость, CDR, mana regen, skin, три skills и summary восьми слотов. Кнопок Equip/Unequip нет.
17. **Archer Dodge:** запускает существующий walk и side-view left/right flip. Unit test вызывает реальный метод для направлений/диагонали/aim fallback. Speed 360, duration 200 ms, iframe 180 ms, cooldown 1400 ms и body 18×13 сохранены. Warrior/Mage остаются на прежнем idle-поведении. Afterimages/collision в игре — BLOCKED.
18. **Hotbar:** шесть слотов по 64×64 px; рамка icon 56 px, сама иконка 52×52 px. Снизу по центру: 1/2/3/Q/E/SPACE.
19. **Icons:** добавлены helmet, legs, boots, amulet, ring в существующем оригинальном 32px pipeline. Проверены все девять skill icons; у Arcane Echoes удалён непрозрачный фон. Остальные читаемые skill silhouettes сохранены. Все десять skill/Dodge icons проверены на прозрачность и просмотрены вместе.
20. **Dodge slot:** отдельная runner-иконка, SPACE в углу, dark cooldown overlay/секунды, светлая ready-рамка. DOM и texture не создаются каждый HUD refresh.
21. **Boss slicing:** восемь-связные компоненты alpha ≥128; три крупнейшие позы, затем nearest resize. Оригинал сохранён byte-exact в `assets/bosses/ashen-broodmother/source/attached.png`. SHA-256: `7121e9e4b4c756497c47f1ea3204d18e2fc928b6aac1ecc2e1c3f8b12d965bfa`.
22. **Boss poses:** idle bbox [28,935,532,1348]; attack [597,959,1102,1371]; phase [32,40,1093,966]. Общий canvas 192×192, root [96,168]; видимый размер 176×144 / 176×144 / 176×154. Это states, не walk frames.
23. **Runtime animation:** idle bob ±1 px, малые scale/angle offsets; lunge anticipation → angled compression → dash → 180 ms visual recovery; venom recoil; web/entrance/phase special pose; death fade. Motion отдельно от combat scheduler.
24. **Boss VFX:** три emissive masks только для существующих оранжевых/красных участков, pulse глаз/трещин, усиление по фазам, 2–5 bounded embers и ступенчатая hard-edge shadow. Не перекрашивается всё тело; renderer имеет четыре постоянных display objects, без per-frame texture/timer/tween creation.
25. **Механика босса:** HP, пороги фаз, lunge/venom/web/adds, rewards/first kill/dungeon/target panel не менялись. Сохранены movement body и центральный hurtbox 108×68. Старый Spider не рисуется, старый armor overlay удалён; невидимый sprite оставлен для существующей Arcade Physics и death callback. Обычные Spider assets сохранены.
26. **Equipment QA — PASS:** 100 full-set equip/unequip cycles на каждый из трёх классов (2400 equips и 2400 unequips), отдельные swaps/rings/full bag/wrong class/sell/save/load, caps и отсутствие накопления.
27. **Loot QA — PASS:** 60 000 rolls по трём классам + 60 000 сравнительных full/empty/weak-slot rolls, отдельные rarity/drop/boss-pair tests. Relevance 74.865–74.875%; оружие в slot-bias выборках 32.69–35.01%, не 60%. UUID unique, stats valid, affix IDs уникальны, variance/rarity/levels соответствуют правилам.
28. **Shop QA — PASS на уровне данных:** stable reopen/reload/sold-out, шесть новых offers, категории, coins, insufficient funds/full bag, potion receipts, Rare+ confirm, equipped protection, duplicate transactions. Реальный Buy/Sell layout и scroll — BLOCKED.
29. **Save migration QA — PASS:** v1–v4, отдельно v4 weapon/armor/inventory/affixes/partial stock/sold-out/receipts/все progression fields; сохранение и повторная загрузка всех восьми слотов.
30. **Typecheck — PASS:** `npm run typecheck`.
31. **Build — PASS:** `npm run build`, 182 modules. Vite предупреждает о JS chunk >500 kB (около 1.64 MB / 471 kB gzip); warning не подавлялся. `git diff --check` — PASS.
32. **Browser/runtime QA — BLOCKED:** обе попытки подключения завершились `trusted Node process exited unexpectedly; kernel reset, rerun your request`. Dev server слушает 127.0.0.1:5175, PID 18700. Не проверены реальные 1280×720, 1366×768, 1920×1080; UI actions/save reload в браузере, Archer Dodge в бою, полный boss fight/phase/death/reward/repeat run. Offline и stub tests не заменяют эти проверки.
33. **Browser console errors:** НЕ ИЗМЕРЕНЫ. Заявления «0 ошибок» нет.

## Дополнительный доступный QA

- `scripts/qa-content.cjs`: **37 PASS**; real data/method tests, rendering/physics местами подставлены.
- `scripts/qa-content-assets.py`: **17 PNG PASS**, 32×32/binary alpha; menu source hash совпадает.
- `scripts/qa-ground-surfaces.py`: **PASS**, карты/voids/menu неизменны.
- `scripts/qa-imported-character-skins.py`: **PASS**, errors=[]; Archer walk 8 frames, alpha/hidden RGB без ошибок.
- `scripts/qa-equipment-v2-assets.py`: **PASS**, source hash, три poses, alpha, hidden RGB=0, mask containment, aspect ratio/root, все skill/Dodge icons.
- Контактные листы босса и всех icons просмотрены; создан 100-frame offline motion GIF, просмотрена выборка его фаз. Это не проверка движения в Phaser.

Артефакты: `artifacts/current-pass/boss/{contact.png,all-skills.png,motion.gif,motion-contact.png,asset-qa.json}`; общий icon contact — `artifacts/content-qa/icon-contact.png`.

## Повторить data QA в PowerShell

```powershell
./node_modules/.bin/tsc.cmd --module commonjs --moduleResolution node --target ES2022 --esModuleInterop --skipLibCheck --rootDir src --outDir artifacts/current-pass/node src/vite-env.d.ts src/systems/save/GameProgressService.ts src/data/advancedSkills.ts src/data/skills.ts src/data/elites.ts src/data/arcane.ts src/data/dodge.ts src/combat/CombatTargets.ts src/systems/skills/blinkDestination.ts src/systems/skills/summonPositions.ts src/entities/enemies/EnemyControl.ts src/systems/skills/ArcaneEchoSystem.ts src/systems/skills/CombatFeedback.ts src/entities/player/PlayerCharacter.ts src/entities/enemies/BroodmotherVisual.ts
Set-Content artifacts/current-pass/node/package.json '{"type":"commonjs"}'
$env:ASHVALE_QA_DIR = (Resolve-Path artifacts/current-pass/node).Path
node scripts/qa-content.cjs
```

После восстановления browser runtime нужно выполнить оставшуюся игровую матрицу, включая столкновения/afterimages/полный повторный dungeon run, проверить layout и console. До этого визуальная и игровая приёмка не заявляется.
