import { Direction } from './raycaster-ray';

export function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function rotateVectorDirection(direction: Direction, radians: number): Direction {
  // Rotate this ray by the player angle
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: direction.x * cos - direction.y * sin, y: direction.x * sin + direction.y * cos };
}
