// Will store all functions for handling rays in here
// Just as functions I guess, no need for a class? Or make it a class that can store the map and use it?

import { castRay } from './functions-rays';
import { Block, BlockType } from './raycaster-map';
import { rotateVectorDirection } from './functions-math';

export interface Coordinate {
  x: number;
  y: number;
}

export interface RayResult {
  xa: number;
  ya: number;
  xd: number;
  yd: number;
  xHit: number;
  yHit: number;
  distance: number;
  textureCoord: number; //coordinate of texture (should we wrap it here?)
  wallX: boolean; // Are we on the X side of the wall
  edge: boolean;
  mapCoords: Block[];
}

// Doesn't need to be a Util now, can just be exported functions
export class RaycasterRays {
  // Do a reflected ray and return the result
  public reflectRay(rayResult: RayResult, map: Block[][]): RayResult {
    let xd = rayResult.xd * (rayResult.wallX ? -1 : 1);
    let yd = rayResult.yd * (rayResult.wallX ? 1 : -1);
    let xa = rayResult.xHit + xd * 0.0001;
    let ya = rayResult.yHit + yd * 0.0001;

    // Interestingly, it seems to get stuck in all walls but the top one? Offset the ray?
    // Yes that works - I assume I need to fix up the accuracy in the actual ray cast but I can do that later
    return castRay(xa, ya, xd, yd, map, false);
  }

  // Do a continued ray that slides along the wall and return the result until we hit the distance of 1.0
  public slideRay(rayResult: RayResult, map: Block[][]): RayResult {
    let xa = rayResult.xHit - rayResult.xd * 0.01; // move slightly back so we don't get all stuck up in there
    let ya = rayResult.yHit - rayResult.yd * 0.01;
    let xd = rayResult.xd * Math.max(0, 1.0 - rayResult.distance);
    let yd = rayResult.yd * Math.max(0, 1.0 - rayResult.distance);
    if (rayResult.wallX) {
      xd = 0;
    } else {
      yd = 0;
    }

    return castRay(xa, ya, xd, yd, map, false);
  }

  // Set the ray to only be the length it was intended to be
  public capRay(rayResult: RayResult) {
    rayResult.distance = Math.min(1.0, rayResult.distance);
    rayResult.xHit = rayResult.xa + rayResult.xd * rayResult.distance;
    rayResult.yHit = rayResult.ya + rayResult.yd * rayResult.distance;
    return rayResult;
  }

  public getScreenRayVectors(
    aspectRatio: number,
    projectionLength: number,
    width: number,
    radians: number,
  ): Coordinate[] {
    let initialRays: Coordinate[] = [];

    // one for each column of the canvas
    for (let x = 0; x < width; x++) {
      // make the field of view
      const xdBase = projectionLength;
      const ydBase = aspectRatio * ((x - width / 2.0) / width);

      initialRays.push(rotateVectorDirection({ x: xdBase, y: ydBase }, radians));
    }

    return initialRays;
  }
}
