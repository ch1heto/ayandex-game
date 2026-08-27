import { blinkDestination, type Point, type Rect } from './blinkDestination';
/** Whole-footprint, reachable positions; search nearest to each of three spread anchors. */
export function summonPositions(origin: Point, bounds: Rect, obstacles: readonly Rect[]): Point[] {
  const result: Point[] = [];
  const footprint = { left: -9, top: -13, width: 18, height: 13 };
  for (let slot = 0; slot < 3; slot++) {
    const angle = -Math.PI / 2 + slot * Math.PI * 2 / 3;
    const desired = { x: origin.x + Math.cos(angle) * 54, y: origin.y + Math.sin(angle) * 54 };
    const candidates: Point[] = [];
    for (let radius = 32; radius <= 112; radius += 8) for (let i = 0; i < 32; i++) {
      candidates.push({ x: Math.round(origin.x + Math.cos(i * Math.PI / 16) * radius), y: Math.round(origin.y + Math.sin(i * Math.PI / 16) * radius) });
    }
    candidates.sort((a, b) => Math.hypot(a.x - desired.x, a.y - desired.y) - Math.hypot(b.x - desired.x, b.y - desired.y));
    const found = candidates.find(point => {
      if (result.some(other => Math.hypot(point.x - other.x, point.y - other.y) < 32)) return false;
      const box = { x: point.x - 11, y: point.y - 15, width: 22, height: 17 };
      if (box.x < bounds.x || box.y < bounds.y || box.x + box.width > bounds.x + bounds.width || box.y + box.height > bounds.y + bounds.height) return false;
      if (obstacles.some(rect => box.x < rect.x + rect.width && box.x + box.width > rect.x && box.y < rect.y + rect.height && box.y + box.height > rect.y)) return false;
      const reached = blinkDestination(origin, point, 120, footprint, bounds, obstacles);
      return Math.hypot(reached.x - point.x, reached.y - point.y) <= 1;
    });
    if (!found) return [];
    result.push(found);
  }
  return result;
}
