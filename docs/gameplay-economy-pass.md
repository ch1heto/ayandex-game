# Ashvale — gameplay/economy pass

Дата: 2026-08-27. Работа от чистого текущего HEAD, без reset/revert и без изменения исходных карт, меню, земли или спрайтов персонажей.

**Статус:** реализация в коде и технические проверки завершены. **Browser runtime / visual acceptance: BLOCKED.** Полноценную проверку игры, FPS, реальных столкновений и интерфейса нельзя считать выполненной.

## Бой и summons

| Изменение | Реализация и числа |
| --- | --- |
| Mage Skill 3 | Meteor заменён на **Arcane Echoes / АРКАННЫЕ ОТРАЖЕНИЯ**, клавиша 3 |
| Количество | Ровно 3, старые копии очищаются при новом успешном вызове |
| Damage | `round(player.finalDamage × 0.20)` на момент материализации вызова; equipment включён, item procs не копируются |
| Cadence / lifetime | 1400 мс; 8000 мс с создания, включая 220 мс материализации |
| Цена / cooldown | 45 MP / базовые 15000 мс; существующий equipment CDR применяется |
| Spawn | Три разнесённые позиции; поиск ближайшей к каждой желаемой точке в радиусе 32–112; полный body 18×13 + зазор; swept path не пересекает стены/ворота; учитываются world bounds и живые тела врагов |
| Заблокированный cast | Если три позиции не найдены — нет частичного вызова. Повторная проверка при срабатывании; при отказе MP возвращается, cooldown снимается |
| Clone AI | Стационарная дальняя basic-атака ближайшего живого врага. Leash 210 до Mage и радиус поиска 210 от копии. Нет follower/pathfinding, skills, маны, лечения, зелий, XP и собственной экипировки |
| One hit | Любой успешный `takeDamage`, включая нулевое численное damage, уничтожает копию; собственной модели HP нет |
| Общие цели | `CombatTarget`, scene-local registry; позиция, alive, priority, type, body, damage |
| Агро normal/elite | Distance / priority; Player 1.2, summon 1; retarget 400 мс и 10% hysteresis. Начатая melee-атака держит ID цели до impact |
| Босс | Дополнительный вес Player ×3, итоговый 3.6 против summon 1 для lunge. Web/venom ориентируются на Player, но могут поражать копии. Фазы, thresholds, summons adds и cadence сохранены |
| Cleanup | Registry хранит только живые цели, selector — ID. Уничтожаются root, sprite, outline, collider и собственные снаряды/их trail timers. Очистка при expiry, попадании, смерти Player, смене класса/облика, shutdown |
| VFX | Triple rune, cyan/violet pulse, три расходящихся изображения текущего skin, alpha .78, тонкий outline, фрагменты на исчезновении. Без blur и новых персонажных ассетов |
| Warrior | Базовые **140 HP / 20 basic damage**. Скорость, mana, skill multipliers и cooldown не изменены |
| Dodge | Space; движение по WASD, иначе aim; **200 мс**, **1400 мс cooldown**, **180 мс iframe**, скорость 360. Около 72 world units без столкновений |
| Dodge collision | Существующий Arcade body, velocity и активные colliders/world bounds; teleport не используется |
| Dodge UX | Три afterimages на 0/70/140 мс, pixel dust с палитрой класса, компактный Space/CD indicator. Отменяет собственный незавершённый cast, не обнуляет его стоимость/cooldown |
| Level-up | **30% max HP и max mana за уровень**, clamp, уведомление, короткий pixel pulse, refresh shop |
| Volatile | Четвёртый вариант после Swift/Brutal/Warden. Elite chance остаётся 7%, каждый вариант равновероятен. После death callback: **1000 мс** telegraph, **radius 62**, **damage 18**, один взрыв; Player iframe учитывается, summons погибают от hit |

## Smart loot и предметы

- **75%** — оружие текущего класса или armor; **25%** — оружие других классов. У relevant-ветки weapon/armor 50/50 с мягким сдвигом до ±15 процентных пунктов по слабому слоту. Upgrade не гарантирован.
- Equipment drop chance normal остаётся **12%**; elite — один предмет, boss — **два**, минимум один relevant.
- Normal item level: **L−1 / L / L+1 = 20% / 40% / 40%**. Elite: L/L+1 = 40/60%; boss: L/L+1 = 20/80%. Минимум 1, верхний технический предел 10000.
- Rarity weights Common/Uncommon/Rare/Epic/Legendary сохранены: normal **60/25/10/4/1**, elite **15/40/30/13/2**, boss **0/0/72/25/3**.
- Независимый разброс базовых численных rolls **0.9–1.1**; целые damage/HP/mana, положительные дробные speed/CDR. Отрицательных собственных характеристик нет.
- Tooltip: **ХАРАКТЕРИСТИКИ / STATS** с итоговыми бонусами предмета; аффиксы перечислены отдельно и помечены как уже включённые; **ПРИ ЭКИПИРОВКЕ / ON EQUIP** учитывает текущую экипировку, класс и caps. Плюс зелёный, минус красный только в сравнении. Предмет другого класса получает пояснение вместо недоступного сравнения.

### Шесть аффиксов

| ID | Эффект | Базовая формула до variance / ограничения |
| --- | --- | --- |
| Vital | max HP | 5 + 2L |
| Arcane | max mana | 3 + L |
| Swift | move speed | .01 + .001L, не более .04 на аффикс |
| Focused | CDR | .015 + .001L, не более .06 на аффикс |
| Sharp | basic damage | 1 + .5L |
| Restoring | mana regeneration / sec | .4 + .04L, не более 1.5 на аффикс |

Аффиксы также имеют variance 0.9–1.1, значения сохраняются. Common: **0**; Uncommon: **25% на 1**, иначе 0; Rare: **1**; Epic: **1–2, 50/50**; Legendary: **2**. Без повторов внутри предмета. Общие caps: CDR **20%**, move speed **10%**, bonus mana regen **3/с**. Численные HP/mana/damage rolls ограничены 10000 на отдельное значение.

## Экономика и Forge Shop

- Зелья падают на землю через тот же pickup system: normal **5%**, elite **20%**, boss **1 гарантированно**. Тип **50/50 Health/Mana**, независимо от equipment drop.
- При подборе проверяются membership и claimed-флаг до изменения счётчика, повторный callback не выдаёт второе зелье.
- Shop доступен только у восстановленной Forge через **F**. Развалины недоступны. Цены восстановления **12 Forge / 16 Infirmary** и старое лечение не изменены.
- Shop продаёт Health Potion за **12**, Mana Potion за **14** монет.
- Три equipment offers: оружие класса, armor, random relevant. Уровень L/L+1 = 50/50%; rarity Common/Uncommon/Rare = 35/50/15%. Epic/Legendary в этом shop не добавлены.
- Stock хранится отдельно для каждого класса, не меняется при открытии и reload. Проданные предложения не восстанавливаются. Refresh — level-up или dungeon completion, без платного reroll.
- Продажа только inventory equipment; надетые предметы нельзя продать. Rare+ требует подтверждения. Панель показывает баланс, price, stats/affixes/compare, режим продажи и сообщения.
- Sell price: `floor((2 + 2 × itemLevel) × rarityFactor)`, factor = **1/2/4/7/11**. Buy price: **sellPrice ×4 +10**.
- Buy/sell проверяются в одном синхронном методе сервиса: существование ID, stock, coins, capacity, confirmation; затем единое изменение и persist. Повторный ID после покупки/продажи недоступен. Potion transactions имеют сохраняемые receipt IDs (последние 64). Отсоединённые кнопки не обрабатывают queued clicks.

## Сохранения

**v4**, ключ `ashvale-progress-v4`, fallback/migration v3 → v2 → v1. Старые ключи не удаляются.

Сохраняются inventory/equipment/UUID/base stats/affix IDs и values, stock по классам, receipts, generation, coins, potions, level/XP/kills, buildings, milestones/boss flag, class/skin selection. Старые items получают пустой affix list без reroll; невалидные/повторные ID и аффиксы фильтруются. Summons, Dodge, projectiles и hazards **не сохраняются**. SDK и способ хранения не перестраивались.

## Проверки

| Проверка | Результат |
| --- | --- |
| `npm run typecheck` | **PASS**, exit 0 |
| `npm run build` | **PASS**, exit 0; 168 modules; root dist/index.html |
| Существующее предупреждение Vite | Chunk >500 kB остаётся; JS ≈1627.69 kB, gzip ≈466.38 kB. Оптимизация bundle вне pass |
| `scripts/qa-content.cjs` | **30 PASS** |
| Smart loot | **60000** нормальных item rolls, по 20000 на класс; дополнительно сохранён прежний тест 20000 rolls |
| Boss loot | **2000** пар через production `rollEquipmentDrops`, два предмета и relevant guarantee PASS |
| Potions | По **20000** rolls normal/elite/boss, шанс и 50/50 PASS; отдельно 20000 normal equipment drop rolls для 12% |
| Сравнения | **2000** сравнений с фактическими bonuses, caps и class rules PASS |
| Сохранения/магазин | v1/v2/v3 migration, v4 roundtrip, full inventory, insufficient coins, repeat buy/sell, sold-out reload, rare confirm, affix stability PASS |
| Геометрия | **600** summon layouts и закрытая комната; существующие **1200** swept Blink paths PASS |
| Target / Dodge | Lock, eviction, weighting, конечные окна iframe/duration/cooldown PASS |
| Echo/Volatile module test | Реальные модули с **заглушками renderer/physics**: 20% damage, one hit, max3/recast, lifetime, смерть Player, cleanup; Volatile один hit, radial exclusion, iframe, clear; 30% heal/clamp PASS |
| Asset QA | `qa-ground-surfaces.py` и `qa-content-assets.py` PASS; новая SVG 32×32/crispEdges, menu SHA-256 и исходные maps неизменны |
| `git diff --check` | **PASS** |
| Dev server | Listener 127.0.0.1:5175, PID 18700; существующий сервер не перезапускался |
| Browser QA | **BLOCKED** |
| Browser console errors | **Не измерено** |

### Финальная статистика normal loot

| Класс | Relevant | Common | Uncommon | Rare | Epic | Legendary | L−1 / L / L+1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Warrior | 75.080% | 12016 | 5004 | 2058 | 743 | 179 | 4065 / 8017 / 7918 |
| Archer | 74.715% | 11979 | 5083 | 1936 | 809 | 193 | 4049 / 7937 / 8014 |
| Mage | 74.570% | 12080 | 5017 | 1945 | 766 | 192 | 4026 / 7852 / 8122 |

Во всех 60000 items: UUID без повторов, неотрицательные stats, допустимые affix count/IDs/values, без дублей аффиксов, roundtrip validation без изменения rolls. Aggregate level weights ≈20.23/39.68/40.09%.

### Browser blocker и непроверенные пункты

Две попытки через browser skill завершились **до подключения**:

```text
trusted Node process exited unexpectedly; kernel reset, rerun your request
```

На **1280×720, 1366×768, 1920×1080** НЕ выполнены реальные: открытие кузницы/Inventory, покупки/продажи/confirm clicks, enemy aggro, boss phases в движении, столкновения Dodge со стенами/зданиями/воротами, VFX readability, reload через UI, длительные dungeon runs, FPS и поиск console errors. Геометрические тесты и модули с заглушками не заменяют эти проверки.

Skill `combat-vfx` требует реальной проверки в игре до визуального принятия; browser skill runtime здесь недоступен. Поэтому визуальное принятие и performance acceptance остаются незакрытыми. Новые персонажи/спрайты не генерировались.

### Исправления при аудите

- У постоянной кнопки закрытия shop убран одноразовый latch: теперь проверяются открытое состояние и подключение DOM-кнопки; queued callbacks от старых карточек игнорируются.
- Boss venom не уничтожается только из-за отказа `takeDamage` во время iframe; атака и её обычный lifecycle продолжаются.
- Tooltip предмета другого класса больше не показывает недоступную потерю бонусов как реальный результат equip.
- Подтверждение продажи вынесено в видимую верхнюю часть списка; пока оно открыто, список inert.
- Мёртвые runtime-ветки и тексты Meteor удалены. Старый PNG оставлен неизменным как исходный ассет, но больше не подключён в skill UI.
- В ground QA убраны устаревшие запреты на изменение Player/Save, поскольку этот pass прямо требует этих изменений; проверки карт/земли/меню сохранены.
- Offline asset scripts больше не выдают за свой результат ранее захардкоженный browser blocker.

## Воспроизведение data/module QA

```powershell
New-Item -ItemType Directory -Force artifacts/current-pass/node
Set-Content artifacts/current-pass/node/package.json '{"type":"commonjs"}'
./node_modules/.bin/tsc.cmd --module commonjs --moduleResolution node --target ES2022 --esModuleInterop --skipLibCheck --outDir artifacts/current-pass/node src/vite-env.d.ts src/systems/save/GameProgressService.ts src/data/advancedSkills.ts src/data/skills.ts src/data/elites.ts src/data/arcane.ts src/data/dodge.ts src/combat/CombatTargets.ts src/systems/skills/blinkDestination.ts src/systems/skills/summonPositions.ts src/entities/enemies/EnemyControl.ts src/systems/skills/ArcaneEchoSystem.ts src/systems/skills/CombatFeedback.ts
$env:ASHVALE_QA_DIR = (Resolve-Path artifacts/current-pass/node).Path
node scripts/qa-content.cjs
npm run typecheck
npm run build
```

Asset QA требует Python с Pillow/NumPy. Компиляция QA находится в игнорируемой папке artifacts/current-pass; тестовое localStorage — отдельный in-memory Map, пользовательские сохранения не менялись.

## Добавлены (11)

- `assets/ui/skills/arcane-echoes.svg`
- `src/combat/CombatTargets.ts`
- `src/data/dodge.ts`
- `src/data/echoes.ts`
- `src/systems/skills/ArcaneEchoSystem.ts`
- `src/systems/skills/CombatFeedback.ts`
- `src/systems/skills/summonPositions.ts`
- `src/ui/ForgeShop.ts`
- `src/ui/ItemDetails.ts`
- `src/ui/forge-shop.css`
- `docs/gameplay-economy-pass.md`

## Изменены (24)

- `GAME_DESIGN.md`
- `scripts/qa-content-assets.py`
- `scripts/qa-content.cjs`
- `scripts/qa-ground-surfaces.py`
- `src/data/advancedSkills.ts`
- `src/data/elites.ts`
- `src/data/equipment.ts`
- `src/data/gameplayEconomy.ts`
- `src/data/playerClasses.ts`
- `src/entities/enemies/AshenBroodmother.ts`
- `src/entities/enemies/EmberSpider.ts`
- `src/entities/enemies/MossSlime.ts`
- `src/entities/player/PlayerCharacter.ts`
- `src/i18n/contentTranslations.ts`
- `src/scenes/GameScene.ts`
- `src/scenes/UIScene.ts`
- `src/systems/equipment/itemValidation.ts`
- `src/systems/loot/EquipmentLootSystem.ts`
- `src/systems/save/GameProgressService.ts`
- `src/systems/settlement/RestorationSystem.ts`
- `src/systems/skills/AdvancedSkillSystem.ts`
- `src/systems/skills/PixelSkillVfx.ts`
- `src/ui/EquipmentPanels.ts`
- `src/ui/itemIcons.ts`

Новые регионы, классы, данжи, боссы, pets, crafting, ads и redesign Inventory не добавлялись. Archer skills и Mage Blink/Bind не менялись. Коммит не создавался.
