# Gameplay/content pass — статус 27 августа 2026

## Не завершён: обязательный runtime QA заблокирован

Изменения внесены поверх существующего dirty worktree. Откатов, reset, checkout, коммитов и изменений исходного Hub/текстур/спрайтов не выполнялось.

Browser skill прочитан и использован. Запуск браузерного runtime неоднократно завершался до подключения:
`windows sandbox failed: helper_unknown_error: setup refresh had errors`,
затем `trusted Node process exited unexpectedly; kernel reset, rerun your request`.
Та же ошибка блокирует обычные shell/file/image tools. Файлы, сборка и технические проверки доступны через явно разрешённые escalated-команды. Неподдерживаемая подмена браузера не использовалась.

**Нельзя считать этот проход принятым по Definition of Done.** Количество browser console errors **не измерено**. Визуальный и gameplay runtime QA **не выполнен**. До восстановления browser runtime нельзя подтвердить проходимость боя, фактическое поведение UI, отсутствие runtime/lifecycle ошибок и качество VFX в движении.

Сервер разработки запущен отдельно: http://127.0.0.1:5175/ .

## Изменения

### Предыдущий polish / UI

- Inventory I: 24 отдельных equipment slots, 6×4, реальные Coins и potion counts, выбор, сравнение и Equip.
- Character C: класс, Level/XP, HP/Mana, базовый/итоговый damage, названия трёх навыков, skin, Weapon/Armor, бонусы и Unequip.
- Окна и 24 кнопки создаются один раз; обновление содержимого зависит от ревизии данных. Закрытые окна не перехватывают клики/фокус.
- Objectives больше не пересоздают DOM каждый кадр. HUD обновляется с ограниченной частотой.
- Общая bounded очередь notifications, максимум четыре сообщения; lifecycle таймеров принадлежит сцене. XP/coins агрегируются; добавлены item/equip/full/restoration/elite/dungeon/boss сообщения.
- Hotbar 2/3: иконки, mana cost, секунды/overlay cooldown, disabled mana state и короткая реакция при отказе.
- Boss использует расширенный target panel; элиты — affix/name. Minimap получает dungeon marker и заменяется dungeon indicator внутри.

### Equipment / loot

- Слоты: Weapon и Armor. Sword → Warrior, Bow → Archer, Staff → Mage; Armor универсальна.
- Несовместимый Equip отклоняется. При DEV смене класса оружие сохраняется в слоте, но его бонусы не действуют; Character явно показывает неактивность.
- Common / Uncommon / Rare / Epic / Legendary с нейтральным, зелёным, синим, фиолетовым и золотым обозначением.
- Weapon: Damage; выше Common — Max Mana; Rare+ — Cooldown Reduction.
- Armor: Max HP; выше Common — Max Mana; Rare+ — Movement Speed.
- CDR cap 20%, Movement Speed cap 10%. Бонусы вычисляются заново от базы; снятие предмета не лечит и не восстанавливает ману.
- Item level: player level + случайное значение из [-1,0,0,0,1], диапазон 1…100.
- Множители редкости: 1 / 1.3 / 1.7 / 2.2 / 3.
- Damage = round((2 + itemLevel) × rarity multiplier); HP = round((8 + 3 × itemLevel) × multiplier); Mana = round((3 + 2 × itemLevel) × multiplier).
- Обычный drop: 12%; веса редкости 60/25/10/4/1. Elite гарантирован: веса 15/40/30/13/2. Boss: два предмета, оба Rare+, веса 0/0/72/25/3.
- Ground loot: Arcade pickup, отдельная иконка, bob, индикатор редкости, ограниченные Rare+ pixels / Legendary beam. При полном inventory pickup отклоняется и объект не уничтожается.
- Предметы на земле относятся к текущей сцене/run и не сериализуются. В save сохраняются inventory/equipped экземпляры.
- Не добавлены продажа, выбрасывание, crafting, аксессуары, sockets или enchanting.

### Save

- Version 3, отдельный ключ ashvale-progress-v3; чтение v2/v1 с миграцией. Старые ключи не удаляются.
- Сохраняются UUID, kind, rarity, itemLevel, rolled stats, inventory/equipment, current class/skin, milestone flags.
- Сохраняются прежние Coins, Level, XP, potions, counters, Forge/Infirmary.
- Типы/числовые диапазоны проверяются; неправильные items/повторяющиеся ID отбрасываются; неизвестные skin не применяются напрямую.
- В исходной реализации class/skin жили в registry. Новый выбор теперь сохраняется; миграция также понимает legacy selectedClass/currentSkin, если они присутствуют.
- Persist вызывается после pickup/equip/unequip/class/skin/milestone/reward через существующий GameProgressService. SDK-архитектура не заменялась.

## Skills и VFX

Damage указан как множитель текущего basic damage после equipment. Cooldown — базовый, уменьшается equipment CDR. Skill 1 исходные config/mana cost сохранены; его damage/cooldown получают только equipment modifiers.

| Класс | Skill | Damage | Mana | CD | Реализация |
| --- | --- | --- | --- | --- | --- |
| Warrior | Whirlwind (2) | 1.6× | 25 | 7 s | Одно попадание по цели в радиусе 76; три движущиеся пиксельные crescent arcs, dust и sparks |
| Warrior | Seismic Slam (3) | 2.2× | 40 | 12 s | Конус до 112, ±0.6 rad; 350 ms stagger обычным врагам; телеграф, ветвящиеся трещины, фронт ударной волны, белое ядро, shake 80 ms |
| Archer | Multishot (2) | 0.75× на стрелу | 20 | 6 s | Три Arcade arrows, ±12°; emerald release flash, короткие trails и impact pixels |
| Archer | Arrow Rain (3) | 4 импульса по 0.6× | 40 | 12 s | Mouse target до 270, radius 82, 440 ms anticipation, импульсы каждые 420 ms; sigil, падающие стрелы, gold/teal impacts |
| Mage | Frost Nova (2) | 1.2× | 25 | 7 s | Radius 92, slow 35% на 2.4 s (boss 14%); cyan/white ice spokes/shards, violet sparks |
| Mage | Arcane Meteor (3) | 2.6× | 45 | 13 s | Mouse target до 270, radius 90; rune, 650 ms anticipation + 290 ms fall, cyan/violet comet, white core/fragments, shake 75 ms |

VFX — bounded Graphics с целочисленными pixel clusters; максимум 60 активных effects, конечный lifetime. Таймеры skill casts отменяются при смерти/смене класса/выходе. Основной sprite/attack animation не генерировался и не заменялся. Нет новой audio architecture.

## Elite / dungeon / boss

- Elite Slime и Spider: шанс 7%, только существующие внешние spawn points. HP 2.2×, Damage 1.3×, XP 3×, Coins 2×; гарантированный equipment.
- Swift: speed 1.18×; Brutal: дополнительно damage 1.07×; Warden: дополнительно HP 1.12×.
- Runtime scale 1.14, подпись и ограниченная aura; исходная artwork не перекрашена произвольным tint.
- Entrance: дальняя часть Spider Hollow, world (3664,520), F возле каменного violet/cyan portal.
- Отдельная DungeonScene переиспользует существующий GameScene lifecycle/input/combat с отдельным Tiled world и DungeonRun.
- Room 1: 3 Slimes. Room 2: Slime + 2 Spiders. Room 3: Slime + 2 Spiders, один guaranteed Warden. Room 4: Ashen Broodmother.
- Три прохода закрыты Arcade static bodies; открываются после clear. Во время run нет respawn обычных encounters.
- Boss: 580 HP (10× Spider), canonical Spider animation ×2 и spine/eye overlay.
- Phase 1: 100–65%, lunge + venom. Phase 2: 65–30%, два обычных adds, web zones. Phase 3: <30%, умеренно быстрее и чаще атаки.
- Lunge: 700 ms предупреждение, 450 ms dash, speed 270, damage 23. Venom: 8 расходящихся projectiles, speed 112, damage 11, lifetime 3.4 s.
- Web zones: 3 зоны radius 44; telegraph 850 ms, active 3 s, damage 7 максимум раз в 900 ms. Нет дополнительного slow этих зон.
- После смерти boss hazards/adds очищаются. Награда защищена health/death state и run clear flag: 150 XP, 24 Coins, два Rare+ предмета.
- bossFirstKill сохраняется, повторный вызов milestone не повторяет переход. В новом run boss появляется заново и даёт обычную повторную награду.
- Смерть/выход из dungeon возвращает в прежний Hub без удаления inventory/equipment/XP/Coins.
- Два полных прохождения, фазы и cleanup **ещё не подтверждены в браузере**.

## Main menu

Исходник 1672×941 скопирован в assets/ui/menu/ashvale-main-menu-original.png. SHA-256 идентичен приложенному файлу; AI generation, repaint, upscale, blur, lossy compression не применялись.

Одна stage с cover-геометрией; real HTML button hit areas поверх art: x≈670, y=400/491/582/673, width≈340, height≈77 исходных pixels. ResizeObserver применяет единый scale к сцене. RU сохраняет нарисованные labels; EN накладывает компактные переведённые labels только в центральную текстовую область. Hover/keyboard focus — тонкая рамка.

Start ведёт в прежний выбор класса/skin с восстановленным выбором. Settings сохраняет прежнее RU/EN переключение. Skin preview сохраняет DEV путь; production открывает штатный выбор доступного skin. Exit безопасно показывает сообщение о закрытии вкладки, без window.close и внешнего перехода.

## Проверки и найденные проблемы

| Проверка | Результат |
| --- | --- |
| npm run typecheck | PASS |
| npm run build | PASS; только warning о размере основного chunk |
| npm audit --json | 0 vulnerabilities |
| scripts/qa-content.cjs | 10 PASS, изолированные save/data/map проверки |
| 100 Equip/Unequip циклов | PASS, бонусы не накапливаются |
| 20 000 rarity rolls + 300 boss rolls | PASS для config/ID/item level |
| Новые icons | 10×32×32 RGBA, binary alpha; enlarged contact просмотрен |
| Menu SHA-256 | Совпадает с исходником |
| 1280×720 / 1366×768 / 1920×1080 | Математическая геометрия cover/buttons PASS; браузерная отрисовка НЕ проверена |
| Реальный бой / движение / collision / все skins / zoom | НЕ проверено |
| Два dungeon runs, death return, phases, rewards exactly once | НЕ проверено в runtime |
| Runtime VFX, projectile/hazard/DOM cleanup, FPS | НЕ проверено |
| Browser console errors | НЕ измерено |

При кодовой/технической проверке исправлены: заглушки Inventory/Character; пересоздание objective DOM; неполная lifecycle очистка уведомлений; возможность повторного projectile callback после его удаления; default hidden windows, перехватывавшие ввод; несовместимый TilemapLayer tint API; сброс cached HUD state при запуске сцены; размывающая различие иконок Arrow Rain/Multishot. Это не список обнаруженных в браузере bugs: браузер не был доступен.

### Воспроизведение тестов

В PowerShell из корня проекта:

```powershell
New-Item -ItemType Directory -Force artifacts/content-qa/node
Set-Content artifacts/content-qa/node/package.json '{"type":"commonjs"}'
./node_modules/.bin/tsc.cmd --module commonjs --moduleResolution node --target ES2022 --esModuleInterop --skipLibCheck --outDir artifacts/content-qa/node src/systems/save/GameProgressService.ts src/data/advancedSkills.ts src/data/skills.ts src/data/elites.ts
node scripts/qa-content.cjs
npm.cmd run typecheck
npm.cmd run build
```

scripts/qa-content-assets.py требует Pillow; доступный bundled Python использован без установки зависимостей.
Артефакты: artifacts/content-qa/icon-contact.png, asset-report.json, node/ (тестовая компиляция, не runtime).

## Файлы этого прохода

### Добавлены

- `artifacts/content-qa/asset-report.json`
- `artifacts/content-qa/icon-contact.png`
- `artifacts/content-qa/node/data/advancedSkills.js`
- `artifacts/content-qa/node/data/elites.js`
- `artifacts/content-qa/node/data/equipment.js`
- `artifacts/content-qa/node/data/playerResources.js`
- `artifacts/content-qa/node/data/progression.js`
- `artifacts/content-qa/node/data/skills.js`
- `artifacts/content-qa/node/entities/player/playerTypes.js`
- `artifacts/content-qa/node/i18n/LocalizationService.js`
- `artifacts/content-qa/node/i18n/contentTranslations.js`
- `artifacts/content-qa/node/package.json`
- `artifacts/content-qa/node/systems/equipment/itemValidation.js`
- `artifacts/content-qa/node/systems/save/GameProgressService.js`
- `assets/equipment/icons/armor.png`
- `assets/equipment/icons/bow.png`
- `assets/equipment/icons/staff.png`
- `assets/equipment/icons/sword.png`
- `assets/ui/menu/ashvale-main-menu-original.png`
- `assets/ui/skills/arcane-meteor.png`
- `assets/ui/skills/arrow-rain.png`
- `assets/ui/skills/frost-nova.png`
- `assets/ui/skills/multishot.png`
- `assets/ui/skills/seismic-slam.png`
- `assets/ui/skills/whirlwind.png`
- `docs/content-pass-status.md`
- `maps/ashen-catacombs.json`
- `scripts/build-ashen-catacombs.py`
- `scripts/build-content-icons.py`
- `scripts/qa-content-assets.py`
- `scripts/qa-content.cjs`
- `src/data/advancedSkills.ts`
- `src/data/dungeon.ts`
- `src/data/elites.ts`
- `src/data/equipment.ts`
- `src/dungeons/DungeonRun.ts`
- `src/dungeons/DungeonWorld.ts`
- `src/dungeons/PixelPortal.ts`
- `src/entities/enemies/AshenBroodmother.ts`
- `src/entities/enemies/EnemyModifiers.ts`
- `src/i18n/contentTranslations.ts`
- `src/scenes/DungeonScene.ts`
- `src/systems/equipment/itemValidation.ts`
- `src/systems/loot/EquipmentLootSystem.ts`
- `src/systems/notifications/notifications.ts`
- `src/systems/skills/AdvancedSkillSystem.ts`
- `src/systems/skills/PixelSkillVfx.ts`
- `src/ui/EquipmentPanels.ts`
- `src/ui/itemIcons.ts`

### Изменены поверх текущего состояния

- `src/combat/ProjectileSystem.ts`
- `src/core/gameConfig.ts`
- `src/core/sceneKeys.ts`
- `src/entities/enemies/EmberSpider.ts`
- `src/entities/enemies/EmberSpiderSpawner.ts`
- `src/entities/enemies/MossSlime.ts`
- `src/entities/enemies/MossSlimeSpawner.ts`
- `src/entities/player/PlayerCharacter.ts`
- `src/i18n/LocalizationService.ts`
- `src/scenes/CharacterSelectScene.ts`
- `src/scenes/GameScene.ts`
- `src/scenes/MainMenuScene.ts`
- `src/scenes/UIScene.ts`
- `src/style.css`
- `src/systems/save/GameProgressService.ts`
- `src/systems/settlement/RestorationSystem.ts`
- `src/systems/skills/SkillSystem.ts`

Ранее изменённые PNG окружения/модалок, SpiderZoneScene, ForgeSmokeEmitter, а также ранее добавленные playerResources/progression/ForgeFireEffects не создавались этим проходом.
