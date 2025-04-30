import { Coordinate } from './raycaster-ray';

// Some types to use
export interface Colour {
  red: number;
  green: number;
  blue: number;
}

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

// This works with the decimal version, not 255,255,255 colours
export function normaliseLightColour(colour: Colour): Colour {
  const highest = Math.max(colour.red, colour.green, colour.blue);

  return { red: colour.red / highest, green: colour.green / highest, blue: colour.blue / highest };
}

// Using for culling stuff for drawing, gonna try and make the lighting work more efficiently
// by figuring out what squares aren't possible to ever get light from a raycast light source
export function isLeftOfVector(source: Coordinate, dest: Coordinate, point: Coordinate) {
  return (
    (dest.x - source.x) * (point.y - source.y) - (dest.y - source.y) * (point.x - source.x) > 0
  );
}
