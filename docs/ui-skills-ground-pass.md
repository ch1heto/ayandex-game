# Ashvale — Inventory / Archer / Mage / Ground pass

Дата: 27 августа 2026.

## Статус

Код и статические ассеты реализованы поверх текущего состояния. На старте `git status --short`, `git diff --stat`, `git diff` были пустыми: прошлый pass уже находился в HEAD. Откаты, reset и перегенерация исходных игровых карт не выполнялись.

**Runtime QA заблокирован средой. Проход не заявляется полностью проверенным или принятым.**

Browser skill прочитан; обе попытки подключения завершились до открытия игры:

- `windows sandbox failed: helper_unknown_error: setup refresh had errors`;
- `trusted Node process exited unexpectedly; kernel reset, rerun your request`.

Стандартные shell/image tools также не запускались; файловые изменения и проверки выполнены через разрешённые escalated-команды. Подмена браузерной проверки другим механизмом не применялась. Dev-сервер уже работал на http://127.0.0.1:5175/ и вернул HTTP 200; это не runtime QA.

## Inventory и Character

- I: 24 equipment cells, занято/всего, Coins, отдельные реальные stacks HP/MP potions.
- Weapon/Armor и управление экипировкой перенесены в Inventory. Выбор вещи → сравнение → «Надеть». Выбор надетого слота → характеристики → «Снять».
- Несовместимое оружие нельзя надеть; после DEV смены класса старое оружие отмечается неактивным. Переполненная сумка блокирует снятие без потери предмета.
- C: только информация — Class, Level, XP/next XP, HP/Mana, base/final damage, skin, сводка вещей и бонусов, названия/стоимость/cooldown/роль трёх навыков. Кнопок Equip/Unequip здесь нет.
- Сохранены Pixellari, тёмная fantasy palette, золотые границы, понятные интервалы. Drag-and-drop и новые слоты не добавлялись.
- Закрытые панели inert; DOM не пересоздаётся каждый кадр. Содержимое зависит от ревизии данных/изменения характеристик.

### Настоящий player preview

`UIScene` получает действующий `PlayerCharacter` от Game/Dungeon и двух прежних сцен. `LivePlayerPreview` рисует именно его текущие texture/frame, origin и flip на маленьком canvas. Class/skin берутся у игрока, не из декоративного портрета.

Масштаб целочисленный и постоянный между состояниями одного skin; smoothing отключён. Обновление только при изменении frame/skin/origin/flip, через существующее обновление HUD. Отдельной физической сущности, texture allocation или animation loop нет. При закрытии canvas удаляется и освобождает буфер.

Preview повторяет текущий кадр игрока, включая неподвижный idle: отдельная idle-анимация не выдумывается. Визуальных equipment overlays в текущей архитектуре нет; предметы меняют характеристики, sprite остаётся текущим skin. Это явно указано в Inventory.

## Archer / Mage

Warrior не перерабатывался. Обычные атаки и hotkeys сохранены. Skill 1 остаётся бесплатным; cooldown всех навыков учитывает прежний equipment CDR.

| Класс / слот | Навык | Damage | Mana | Базовый CD |
| --- | --- | --- | --- | --- |
| Archer 1 | Пронзающий выстрел | 2× по каждой из максимум 3 целей | 0 | 5 с |
| Archer 2 | Тройной выстрел | 0,75× на стрелу, 3 стрелы | 20 | 6 с |
| Archer 3 | Дождь стрел | 4 импульса по 0,6× | 40 | 12 с |
| Mage 1 | Арканный скачок | нет | 0 | 5 с |
| Mage 2 | Арканные оковы | 1,1× | 25 | 7 с |
| Mage 3 | Арканный метеор | 2,6× AoE | 45 | 13 с |

### Teleport

До 152 world px к курсору; при нулевом направлении используется facing. Проверка всего отрезка движения с учётом настоящего footprint, а не только конечной точки. Препятствия читаются из живых Arcade bodies: стены, props/restoration, закрытые ворота и враги. Открытые/уничтоженные ворота больше не блокируют.

Проверка повторяется на release-frame. Перемещение использует существующий `PlayerCharacter.setPosition` / Arcade `Body.reset`, что сбрасывает velocity и collision flags. При отсутствии минимум 12 px безопасного пути перемещение отклоняется; cooldown не теряется. Новой неуязвимости/урона нет.

### Stun / control

Arcane Bind — projectile дальностью 350 px и скоростью 405 px/s. Обычный враг: 1800 ms; elite: 800 ms; boss: полный иммунитет к стану, урон сохраняется.

Стан отменяет текущую атаку, останавливает движение/анимацию и запрещает попадание из animation callback. Активный эффект нельзя продлить. После него действует 2400 ms иммунитета к повторному стану. Таймеры используют scene clock, не системное время. На окончании/смерти/уничтожении эффект очищается, анимация восстанавливается.

### VFX

- Piercing Shot: скорость 630 px/s вместо 350, три уникальных попадания, emerald/teal arrow, pale gold bow flash, направленный pixel trail.
- Multishot: сохранён веер ±12°, добавлен читаемый release; короткие следы, скорость 392 px/s.
- Arrow Rain: телеграф учитывает реальный release-frame Archer и остаётся на время всей серии; падение/урон согласованы на 230 ms каждого импульса.
- Blink: стартовая руна, три послеследа настоящего sprite, разорванный магический след, cyan/violet вспышка прибытия.
- Bind: отдельный rune projectile, сжимающиеся скобы при попадании, привязанные к врагу знаки стазиса на время stun.
- Meteor: сохранён большой дальний burst, падение, руна, контрастное ядро и осколки; общий telegraph timing уточнён.
- Ограничения: 60 Graphics effects на систему, максимум 9 blink echoes, 96 trail objects. Конечные lifetime и явная очистка. Blur/filter/glow smear не добавлялись.
- Три новые pixel SVG-иконки без фильтров и сглаженных strokes; RU/EN названия и роли обновлены.

## Ground / biome transitions

Новый atlas — **1024×512, 486 используемых tiles, 171751 bytes**. Трава, земля, камень, spider soil и dungeon stone строятся детерминированно из коротких палитр/пиксельных кластеров.

Из исходного Ground выводятся общие материалы вершин. Соседние tiles используют одинаковые вершины и непрерывные периодические координаты текстуры. Границы выбирают материал дискретно с органичным отклонением и небольшими кластерами на стыках: это не alpha blur и не bilinear filtering.

Есть переходы grass/dirt, grass/stone, dirt/stone, grass/spider и dirt/spider. Вокруг прежнего spider biome сохраняется существующий переходный пояс земли. Мелкие изолированные квадратные пятна сглажены только визуально.

Runtime загружает один обычный статический GPU tile layer на сцену. Никакой гигантской фоновой картинки, динамической генерации/перерисовки или новых collision layers. Большие stitched PNG находятся только в игнорируемых QA-артефактах, в игру не попадают.

Исходные `ashvale-world.json`, `ashen-catacombs.json`, props, spawn points, gates, маршруты, restoration и collider definitions сохранены. Новые ground tilemaps уничтожаются при shutdown; общая atlas texture переиспользуется.

Статические материалы и сравнение четырёх участков просмотрены. Первый слишком плоский вариант был исправлен. В движении, с камерой и на фоне реальных props результат пока не проверен.

## Сохранения / ограничения

Save schema v3 и сам GameProgressService не менялись: миграция не требуется. Class, skin, coins, XP, level, potions, equipment и milestones остаются в прежнем формате. Core PlayerCharacter, camera/zoom, menu art и MainMenuScene не изменены.

Разделы Archer/Mage в GAME_DESIGN синхронизированы с текущим запросом; прочие классы, экономика и управление не переписывались.

## Проверки

| Проверка | Результат |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS, 159 modules; прежнее предупреждение chunk >500 kB |
| `scripts/qa-content.cjs` | 15 PASS, изолированное in-memory storage |
| Сохранения v1/v2/v3, полный bag, 100 Equip/Unequip | PASS |
| 1200 swept blink paths + стены/ворота/границы/нулевой aim | PASS для чистой геометрии |
| Stun expiry/recovery/non-extension | PASS для scene-clock state |
| `scripts/qa-ground-surfaces.py` | PASS: alpha, размеры, floor/void layout, SVG structure, неизменность исходников |
| `scripts/qa-content-assets.py` | PASS: прежние 10 icons, точный SHA-256 меню, математическая cover-геометрия |
| Статическое сравнение земли | Просмотрено; это не runtime acceptance |
| Контраст на границе tiles / внутри tiles | Был x=2,169 / y=2,181; стал x=0,846 / y=1,022. Только диагностическая метрика |
| `git diff --check` | PASS; сообщения LF/CRLF не являются ошибками diff |
| Dev server | HTTP 200 |
| Browser console errors | **Не измерено** |

### Что осталось непроверенным

На **1280×720, 1366×768, 1920×1080** не выполнены: открытие меню, Inventory/C, Equip/Unequip click flow, соответствие preview всех skins, tooltip/compare, все Archer/Mage skills в реальном бою, stun elite/boss, повторные dungeon runs, cleanup/FPS, движение horizontal/vertical/diagonal, shimmer/швы и читаемость VFX в движении.

Browser skill и combat-vfx требуют реальной проверки игры для визуального принятия. Из-за сбоя подключения эти требования не закрыты. `console errors = 0` не заявляется.

## Воспроизведение технических тестов

```powershell
New-Item -ItemType Directory -Force artifacts/current-pass/node
Set-Content artifacts/current-pass/node/package.json '{"type":"commonjs"}'
./node_modules/.bin/tsc.cmd --module commonjs --moduleResolution node --target ES2022 --esModuleInterop --skipLibCheck --outDir artifacts/current-pass/node src/systems/save/GameProgressService.ts src/data/advancedSkills.ts src/data/skills.ts src/data/elites.ts src/data/arcane.ts src/systems/skills/blinkDestination.ts src/entities/enemies/EnemyControl.ts
$env:ASHVALE_QA_DIR = (Resolve-Path artifacts/current-pass/node).Path
node scripts/qa-content.cjs
npm.cmd run typecheck
npm.cmd run build
```

Для `build-ground-surfaces.py` и `qa-ground-surfaces.py` нужен Python с Pillow и NumPy (доступен bundled runtime). Они не изменяют исходные gameplay maps.

Артефакты: `artifacts/current-pass/ground-comparison.png`, `surface-materials.png`, `surface-qa.json`, `ground-report.json`, `node/`. Папка игнорируется Git.


## Добавлены

- `assets/tilesets/ashvale-ground.png`
- `assets/ui/skills/arcane-bind.svg`
- `assets/ui/skills/arcane-blink.svg`
- `assets/ui/skills/piercing-shot.svg`
- `maps/ashvale-ground.json`
- `maps/catacombs-ground.json`
- `scripts/build-ground-surfaces.py`
- `scripts/qa-ground-surfaces.py`
- `src/data/arcane.ts`
- `src/entities/enemies/EnemyControl.ts`
- `src/systems/skills/blinkDestination.ts`
- `src/ui/LivePlayerPreview.ts`
- `src/world/GroundSurface.ts`
- `docs/ui-skills-ground-pass.md`

## Изменены

- `.gitignore`
- `GAME_DESIGN.md`
- `scripts/qa-content.cjs`
- `src/combat/ProjectileSystem.ts`
- `src/data/advancedSkills.ts`
- `src/data/skills.ts`
- `src/dungeons/DungeonWorld.ts`
- `src/entities/enemies/EmberSpider.ts`
- `src/entities/enemies/EnemyModifiers.ts`
- `src/entities/enemies/MossSlime.ts`
- `src/i18n/LocalizationService.ts`
- `src/i18n/contentTranslations.ts`
- `src/scenes/GameScene.ts`
- `src/scenes/HubScene.ts`
- `src/scenes/SpiderZoneScene.ts`
- `src/scenes/UIScene.ts`
- `src/style.css`
- `src/systems/skills/AdvancedSkillSystem.ts`
- `src/systems/skills/PixelSkillVfx.ts`
- `src/systems/skills/SkillSystem.ts`
- `src/ui/EquipmentPanels.ts`
- `src/ui/itemIcons.ts`
- `src/world/AshvaleWorld.ts`
