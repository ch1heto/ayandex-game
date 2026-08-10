# AGENTS.md

# Project: Ashvale

## 1. Mission

Build a polished browser-based top-down pixel-art action RPG for Yandex Games.

The game must feel finished, atmospheric, responsive, and visually rich rather than like a technical prototype.

The canonical game concept is defined in:

- `GAME_DESIGN.md`

The Yandex Games platform and moderation requirements are defined in:

- `docs/yandex-games-requirements.md`

Before changing gameplay rules, progression, classes, buildings, dungeon structure, controls, or economy, read `GAME_DESIGN.md`.

Before changing SDK integration, saves, ads, localization, focus handling, publishing, build output, or platform behavior, read `docs/yandex-games-requirements.md`.

Do not duplicate these documents inside this file.

---

## 2. Technology stack

Use this stack unless the user explicitly approves a change:

- **Phaser 4.2.1**
- **TypeScript**
- **Vite**
- **HTML5**
- **WebGL-first rendering**
- **Phaser Arcade Physics**
- **Tiled JSON tilemaps** for world maps and dungeons
- **Yandex Games SDK**
- `@types/ysdk` for SDK typing

Do not introduce React, Vue, Svelte, Next.js, a backend, or another game engine unless there is a concrete requirement that Phaser cannot reasonably solve.

Keep the project lightweight and browser-first.

---

## 3. Rendering and pixel-art rules

The visual target is a polished atmospheric pixel-art action RPG.

Do not copy sprites, characters, UI, maps, environments, effects, names, or identifiable designs from Stardew Valley or any other existing commercial game.

Stardew Valley may only be treated as a broad reference for the quality, readability, and appeal of pixel-art presentation.

### Base visual rules

- Use original pixel art.
- Use a consistent pixel grid.
- Default world tile size: **32x32 px**.
- Keep character proportions consistent across all classes and NPCs.
- Prefer sprite sheets or texture atlases for animated characters and enemies.
- Use nearest-neighbor texture filtering.
- Enable Phaser pixel-art rendering settings.
- Keep camera movement compatible with crisp pixel rendering.
- Avoid sub-pixel sprite placement where it causes visual blur.
- Use a fixed logical game resolution and scale it to the browser while preserving aspect ratio.
- Initial target logical resolution: **640x360**, 16:9.
- UI must remain readable at the target logical resolution.

### Atmosphere

The world must not look flat or empty.

Use, where appropriate:

- layered tilemaps;
- animated environmental details;
- particles;
- shadows;
- ambient effects;
- weather particles;
- foliage movement;
- water animation;
- fire and torch animation;
- dust;
- sparks;
- magic particles;
- projectile trails;
- impact effects;
- hit flashes;
- short screen shake;
- short hit-stop for strong attacks;
- camera effects;
- Phaser 4 filters such as glow, shadow, color adjustments, vignette-like treatment, blur, or displacement where visually justified;
- lighting effects where performance allows.

Effects must support gameplay readability. Do not cover enemies, projectiles, telegraphs, or the player with excessive visual noise.

Use expensive WebGL effects sparingly and provide a way to disable/reduce heavy effects if performance becomes a problem.

---

## 4. Gameplay input

Canonical desktop controls are defined in `GAME_DESIGN.md`.

Core combat model:

- WASD movement;
- mouse aiming independent of movement;
- left mouse button for basic attack;
- `1`, `2`, `3` for class skills;
- `Q` for health potion;
- `E` for mana potion;
- `Space` for dodge;
- `F` for interaction.

Do not redesign controls without explicit approval.

Combat must remain responsive while moving and aiming simultaneously.

---

## 5. Physics and combat implementation

Use **Phaser Arcade Physics** for:

- player movement;
- enemy movement;
- collision with map geometry;
- projectiles;
- hitboxes;
- overlap checks;
- pickups.

Do not use Matter Physics unless a feature genuinely requires rigid-body simulation.

Separate:

- visual sprite bounds;
- movement collision bodies;
- attack hitboxes;
- hurtboxes.

Combat numbers must live in data/config files where practical instead of being scattered through scene code.

---

## 6. World and map implementation

Use Tiled-compatible JSON tilemaps for:

- settlement;
- open-world regions;
- dungeons.

Maps should support multiple layers such as:

1. ground;
2. ground details;
3. collision;
4. props below player;
5. gameplay objects;
6. props above player;
7. lighting / atmosphere metadata;
8. spawn points / triggers.

Do not hard-code large maps as hundreds of manual sprite placements in scene files.

The game should create the illusion of a larger open world using connected authored regions rather than attempting a single enormous seamless map.

---

## 7. Project architecture

Prefer this structure:

```text
src/
  core/
  scenes/
  entities/
    player/
    enemies/
    npcs/
  combat/
  abilities/
  systems/
    loot/
    inventory/
    equipment/
    settlement/
    progression/
    save/
  world/
  dungeons/
  ui/
  data/
  yandex/
  audio/
  utils/

assets/
  characters/
  enemies/
  npcs/
  tilesets/
  environments/
  items/
  equipment/
  abilities/
  fx/
  ui/
  audio/

maps/
docs/
```

Keep gameplay systems modular.

Avoid giant scene files containing unrelated combat, UI, save, economy, and world logic.

---

## 8. Asset rules

All final game assets must be locally packaged unless there is a deliberate approved reason to load them externally.

Use original assets only.

For generated visual assets:

1. inspect existing assets first;
2. match the established pixel grid, proportions, palette, and lighting;
3. create the smallest necessary asset;
4. save it in the correct asset directory;
5. integrate it into the real game;
6. test it in motion;
7. fix inconsistent scale, outlines, frame alignment, or animation timing.

Do not leave placeholder rectangles, circles, default icons, debug graphics, or temporary AI images in a feature marked complete.

AI may be used during production to create static game assets. Do not add interactive AI generation/chat features inside the published game.

---

## 9. Animation quality

Important gameplay objects should feel alive.

Player classes require clear animations for:

- idle;
- movement;
- basic attack;
- each of the three skills;
- dodge;
- taking damage;
- defeat/death where applicable.

Enemies should have at minimum:

- idle;
- movement;
- attack;
- hit reaction;
- death.

Major bosses need distinct anticipation/telegraph animation for dangerous attacks.

Animations must not change a character's apparent size or pivot unpredictably between frames.

---

## 10. Game feel

Whenever implementing combat, prioritize game feel, not only functional correctness.

Use appropriate combinations of:

- attack anticipation;
- attack follow-through;
- hit reactions;
- particles;
- sound;
- short camera shake;
- hit flash;
- hit-stop;
- knockback;
- cooldown feedback;
- readable enemy attack telegraphs.

Do not make every attack use every effect. Stronger actions should receive stronger feedback.

---

## 11. Yandex Games requirements

The Yandex requirements document is mandatory reading for platform-related work.

At minimum, preserve these principles:

- the game is an HTML5/WebGL browser build;
- Yandex Games SDK is integrated;
- the production archive contains a root `index.html`;
- persistent progression survives reloads;
- gameplay is available without mandatory third-party registration;
- game/audio pause correctly on focus loss and during fullscreen ads;
- Yandex localization/environment data is used where required;
- final content must be substantial enough to qualify as a finished game;
- assets must have valid rights;
- interactive AI must not be part of the published gameplay;
- ads and purchases must use the Yandex-supported integration.

Platform compatibility must be considered during development, not added only after the game is finished.

---

## 12. Saves

Treat player progress as persistent data.

Save important changes after meaningful events such as:

- dungeon completion;
- equipment purchase/equip;
- building construction;
- building upgrade;
- class/progression changes;
- major loot acquisition;
- currency changes where loss would be frustrating.

Keep save data versioned so future game updates can migrate older saves.

Do not make Yandex SDK calls directly throughout unrelated gameplay code. Wrap platform-specific save logic behind a dedicated service/module.

---

## 13. Performance

Target smooth gameplay in a browser.

Avoid:

- creating/destroying large numbers of objects every frame;
- excessive particle counts;
- unnecessary full-screen filters;
- unbounded enemy spawning;
- huge textures where small pixel assets are sufficient;
- loading the entire game world when only one region is needed;
- memory leaks from scenes, timers, input listeners, sounds, or emitters.

Pool frequently reused projectiles and effects where beneficial.

Profile performance after adding visually heavy systems.

---

## 14. Development workflow

Before implementing a non-trivial feature:

1. inspect the relevant existing code;
2. read the relevant design/platform document;
3. identify the smallest coherent implementation;
4. preserve existing architecture unless there is a strong reason to refactor.

After implementation:

1. run TypeScript checks;
2. build the project;
3. launch the game;
4. test the changed feature in actual gameplay;
5. inspect browser console errors;
6. fix obvious visual, input, collision, or lifecycle issues.

A feature is not complete merely because it compiles.

For visual/gameplay features, verify the result in the running game.

---

## 15. Scope control

Do not silently add major mechanics that are not in `GAME_DESIGN.md`.

Do not add systems such as:

- farming;
- multiplayer;
- PvP;
- complex crafting;
- procedural infinite worlds;
- romance systems;
- large talent trees;
- additional classes;

unless explicitly approved.

When a requested feature conflicts with `GAME_DESIGN.md`, point out the conflict before changing the canonical design.

---

## 16. Code quality

- Use TypeScript types rather than `any` where practical.
- Prefer small focused modules.
- Prefer data-driven definitions for classes, skills, enemies, items, buildings, and dungeon rewards.
- Avoid duplicated combat formulas.
- Keep Yandex-specific code inside `src/yandex/`.
- Keep game balance values easy to find and adjust.
- Remove dead code after refactors.
- Do not suppress errors only to make builds pass.

---

## 17. Source-of-truth priority

When instructions conflict, use this priority:

1. explicit current user instruction;
2. `GAME_DESIGN.md` for game design;
3. `docs/yandex-games-requirements.md` for Yandex/platform requirements;
4. this `AGENTS.md`;
5. existing implementation conventions.

If uncertainty would materially change architecture or game design, ask before making the change.
