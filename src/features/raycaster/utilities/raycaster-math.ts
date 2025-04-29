import { Coordinate } from './raycaster-ray';

export function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function rotateVectorDirection(direction: Coordinate, radians: number): Coordinate {
  // Rotate this ray by the player angle
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: direction.x * cos - direction.y * sin, y: direction.x * sin + direction.y * cos };
}

export function normaliseVectorDirection(direction: Coordinate): Coordinate {
  const rayLength = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  return { x: direction.x / rayLength, y: direction.y / rayLength };
}
