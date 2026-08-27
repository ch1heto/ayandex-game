import type Phaser from 'phaser';

export type HudNotification = { id: number; message: string; color?: string; expiresAt: number };
let nextId = 0;
const recent = new WeakMap<Phaser.Scene, Map<string, number>>();
/** A bounded registry queue shared by gameplay, restoration, loot and UI. */
export function notify(scene: Phaser.Scene, message: string, key = message, color?: string): void {
  let seen = recent.get(scene);
  if (!seen) { seen = new Map(); recent.set(scene, seen); }
  const now = scene.time.now;
  if (now - (seen.get(key) ?? -Infinity) < 900) return;
  seen.set(key, now);
  for (const [entry, time] of seen) if (now - time > 4000) seen.delete(entry);
  const previous = scene.registry.get('hudNotifications') as HudNotification[] | undefined;
  const queue = (previous ?? []).filter(item => item.expiresAt > now).slice(-3);
  queue.push({ id: ++nextId, message, color, expiresAt: now + 2600 });
  scene.registry.set('hudNotifications', queue);
}
