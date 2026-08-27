export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type Footprint = { left: number; top: number; width: number; height: number };

/** Swept root against Minkowski-expanded blockers, not just an endpoint test.
 * Stops before the first wall/gate/enemy. Pure geometry, shared with QA.
 */
export function blinkDestination(
  start: Point, target: Point, range: number, footprint: Footprint, bounds: Rect,
  obstacles: readonly Rect[], clearance = 2,
): Point {
  let dx = target.x - start.x, dy = target.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (!distance || !Number.isFinite(distance)) return { ...start };
  const travel = Math.min(distance, range);
  dx = dx / distance * travel; dy = dy / distance * travel;
  let limit = 1;
  const minX = bounds.x - footprint.left + clearance;
  const minY = bounds.y - footprint.top + clearance;
  const maxX = bounds.x + bounds.width - footprint.left - footprint.width - clearance;
  const maxY = bounds.y + bounds.height - footprint.top - footprint.height - clearance;
  if (dx > 0) limit = Math.min(limit, (maxX - start.x) / dx);
  if (dx < 0) limit = Math.min(limit, (minX - start.x) / dx);
  if (dy > 0) limit = Math.min(limit, (maxY - start.y) / dy);
  if (dy < 0) limit = Math.min(limit, (minY - start.y) / dy);
  for (const obstacle of obstacles) {
    const left = obstacle.x - footprint.left - footprint.width - clearance;
    const right = obstacle.x + obstacle.width - footprint.left + clearance;
    const top = obstacle.y - footprint.top - footprint.height - clearance;
    const bottom = obstacle.y + obstacle.height - footprint.top + clearance;
    let near = -Infinity, far = Infinity;
    let intersects = true;
    for (const [position, velocity, low, high] of [[start.x, dx, left, right], [start.y, dy, top, bottom]]) {
      if (Math.abs(velocity) < 1e-8) { if (position <= low || position >= high) intersects = false; continue; }
      const a = (low - position) / velocity, b = (high - position) / velocity;
      near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    }
    if (intersects && near <= far && far > 0 && near <= limit) {
      // Being inside the safety margin must still allow escape away from its nearest face.
      if (near < 0) {
        const distances = [start.x - left, right - start.x, start.y - top, bottom - start.y];
        const side = distances.indexOf(Math.min(...distances));
        if ((side === 0 && dx < 0) || (side === 1 && dx > 0) || (side === 2 && dy < 0) || (side === 3 && dy > 0)) continue;
      }
      limit = Math.min(limit, Math.max(0, near - 1 / travel));
    }
  }
  const amount = Math.max(0, Math.min(1, limit));
  return { x: Math.round(start.x + dx * amount), y: Math.round(start.y + dy * amount) };
}
