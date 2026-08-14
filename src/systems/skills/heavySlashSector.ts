export type HeavySlashSector = {
  originX: number;
  originY: number;
  aimAngle: number;
  innerRadius: number;
  outerRadius: number;
  halfAngle: number;
};

export type SectorPoint = { x: number; y: number };

export function createHeavySlashSector(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  innerRadius: number,
  outerRadius: number,
  halfAngle: number,
): HeavySlashSector {
  return {
    originX,
    originY,
    aimAngle: Math.atan2(targetY - originY, targetX - originX),
    innerRadius,
    outerRadius,
    halfAngle,
  };
}

export function pointInHeavySlashSector(sector: HeavySlashSector, x: number, y: number): boolean {
  const dx = x - sector.originX;
  const dy = y - sector.originY;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared < sector.innerRadius * sector.innerRadius) return false;
  if (distanceSquared > sector.outerRadius * sector.outerRadius) return false;
  const angularDelta = normalizeAngle(Math.atan2(dy, dx) - sector.aimAngle);
  return Math.abs(angularDelta) <= sector.halfAngle;
}

export function heavySlashSectorPolygon(sector: HeavySlashSector, arcSegments = 18): SectorPoint[] {
  const points: SectorPoint[] = [];
  for (let segment = 0; segment <= arcSegments; segment += 1) {
    const angle = sector.aimAngle - sector.halfAngle + (segment / arcSegments) * sector.halfAngle * 2;
    points.push(pointOnSector(sector, angle, sector.outerRadius));
  }
  for (let segment = arcSegments; segment >= 0; segment -= 1) {
    const angle = sector.aimAngle - sector.halfAngle + (segment / arcSegments) * sector.halfAngle * 2;
    points.push(pointOnSector(sector, angle, sector.innerRadius));
  }
  return points;
}

export function pointOnSector(sector: HeavySlashSector, angle: number, radius: number): SectorPoint {
  return {
    x: sector.originX + Math.cos(angle) * radius,
    y: sector.originY + Math.sin(angle) * radius,
  };
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
