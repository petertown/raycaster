// Will store all functions for handling rays in here
// Just as functions I guess, no need for a class? Or make it a class that can store the map and use it?

import { Block, BlockType } from './raycaster-map';
import { rotateVectorDirection } from './raycaster-math';

export interface Direction {
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
  public castRay(xa: number, ya: number, xd: number, yd: number, map: Block[][]): RayResult {
    // How big is this map?
    let mapSizeX = map.length;
    let mapSizeY = map[0].length;

    // Which wall do we hit?
    let wallX = false; // if not this, then Y wall
    let hitEdge = false;

    // find the distance of when the horizontal grid is hit, and the distance to the vertical grid
    // (probably 0 as we are exactly on the gridline but we need to handle that case anyway)
    let nextX: number;
    let changeX: number;
    let distanceX: number;
    let nextY: number;
    let changeY: number;
    let distanceY: number;

    // start from player and trace the ray using these params
    let currentX = xa;
    let currentY = ya;

    let currentLength = 0; // How many rays were needed to hit the wall/edge

    // Make a list of Blocks we go through, starting with where we are now
    let blockX = Math.floor(currentX);
    let blockY = Math.floor(currentY);
    hitEdge = blockX < 0 || blockX >= mapSizeX || blockY < 0 || blockY >= mapSizeY;
    if (hitEdge) {
      // We are outside, just act like we've hit straight away so it doesn't crash
      return {
        xa: xa,
        ya: ya,
        xd: xd,
        yd: yd,
        xHit: xa,
        yHit: ya,
        distance: 0.0,
        textureCoord: 0,
        wallX: false,
        edge: hitEdge,
        mapCoords: [],
      };
    }

    let currentBlock = map[blockX][blockY];
    let mapCoords = [currentBlock];

    // if x is positive it will be rounded up, otherwise it'll be rounded down, same for y
    if (xd > 0) {
      nextX = Math.ceil(currentX);
      changeX = 1;
    } else {
      nextX = Math.floor(currentX);
      changeX = -1;
    }
    if (yd > 0) {
      changeY = 1;
      nextY = Math.ceil(currentY);
    } else {
      changeY = -1;
      nextY = Math.floor(currentY);
    }

    // Loop until we reach a limit or a wall - make sure to limit so we don't go out of bounds!
    let hit = false;
    let tests = 0;
    while (!hit) {
      tests++;

      // First check if there is a half wall in the mapCoord we are currently testing
      // offset the gap to be slightly closer to player so shadows work
      let wallOffset = 0.01;
      if (currentBlock.type === BlockType.XWall) {
        // Halfwall X (so along X axis so Y is always the same)
        let startX = xa;
        let startY = ya;
        let vectX = xd;
        let vectY = yd;

        let wallY = blockY + 0.5 + (changeY > 0 ? -wallOffset : wallOffset); // offset the wall so shadows work
        let wallX1 = blockX;
        let wallX2 = blockX + 1;

        // so when does the Y meet?
        let rayDistance = (wallY - startY) / vectY;
        // where is X then?
        let hitX = startX + vectX * rayDistance;

        // TODO: Will need to take into account opening and closing of the half wall (as in, some parts of the wall are open or closed)
        if (rayDistance > 0 && hitX >= wallX1 && hitX <= wallX2) {
          // return the hit of this half wall
          return {
            xa: xa,
            ya: ya,
            xd: xd,
            yd: yd,
            xHit: hitX,
            yHit: wallY,
            distance: rayDistance,
            textureCoord: hitX - wallX1,
            wallX: false,
            edge: false,
            mapCoords: mapCoords,
          };
        }
      } else if (currentBlock.type === BlockType.YWall) {
        // Halfwall Y (so along Y axis so X is always the same)
        let startX = xa;
        let startY = ya;
        let vectX = xd;
        let vectY = yd;

        let wallX = blockX + 0.5 + (changeX > 0 ? -wallOffset : wallOffset); // offset for shadows
        let wallY1 = blockY;
        let wallY2 = blockY + 1;

        // so when does the X meet?
        let rayDistance = (wallX - startX) / vectX;
        // where is Y then?
        let hitY = startY + vectY * rayDistance;

        if (rayDistance > 0 && hitY >= wallY1 && hitY <= wallY2) {
          // return the hit of this half wall
          return {
            xa: xa,
            ya: ya,
            xd: xd,
            yd: yd,
            xHit: wallX,
            yHit: hitY,
            distance: rayDistance,
            textureCoord: hitY - wallY1,
            wallX: true,
            edge: false,
            mapCoords: mapCoords,
          };
        }
      }

      // This is going to break if we have an exact angle, so let's never have one ok? Or work something out for it?
      // this is how long the line is away from the next gridline
      if (xd === 0) {
        distanceX = 9999999;
      } else {
        distanceX = (nextX - currentX) / xd;
      }
      if (yd === 0) {
        distanceY = 9999999;
      } else {
        distanceY = (nextY - currentY) / yd;
      }

      wallX = distanceX < distanceY;

      // add to the length of the ray
      if (wallX) {
        currentLength += distanceX;

        // calculate the new point we are at
        currentX = nextX;
        currentY = ya + yd * currentLength;

        nextX += changeX;
      } else {
        currentLength += distanceY;

        // calculate the new point we are at
        currentX = xa + xd * currentLength;
        currentY = nextY;

        nextY += changeY;
      }

      // If we haven't hit the edge, is it bordering any walls?
      let hitWall = false;
      // get the floor of where we are, then see what we need to do to check from there

      // can probably do this more simply win the code above
      let mapX = Math.floor(currentX);
      let mapY = Math.floor(currentY);

      if (wallX) {
        if (changeX < 0) {
          mapX = mapX - 1;
        }
      } else {
        if (changeY < 0) {
          mapY = mapY - 1;
        }
      }

      blockX = mapX;
      blockY = mapY;
      // If we hit the edge, stop as well
      hitEdge = blockX < 0 || blockX >= mapSizeX || blockY < 0 || blockY >= mapSizeY;

      if (!hitEdge) {
        currentBlock = map[mapX][mapY];
        hitWall = currentBlock.type === BlockType.Wall;
        // add it to the list of mapCoords to check for sprites later
        mapCoords.push(currentBlock);
      }

      // use the "tests" check to make sure I don't break something and loop forever
      if (hitEdge || hitWall || tests > 1000) {
        hit = true;
      }
    }

    let textureCoord = wallX ? currentY * changeX : -currentX * changeY;
    textureCoord = textureCoord - Math.floor(textureCoord);

    return {
      xa: xa,
      ya: ya,
      xd: xd,
      yd: yd,
      xHit: currentX,
      yHit: currentY,
      distance: currentLength,
      textureCoord: textureCoord,
      wallX: wallX,
      edge: hitEdge,
      mapCoords: mapCoords,
    };
  }

  // Do a reflected ray and return the result
  public reflectRay(rayResult: RayResult, map: Block[][]): RayResult {
    let xd = rayResult.xd * (rayResult.wallX ? -1 : 1);
    let yd = rayResult.yd * (rayResult.wallX ? 1 : -1);
    let xa = rayResult.xHit + xd * 0.0001;
    let ya = rayResult.yHit + yd * 0.0001;

    // Interestingly, it seems to get stuck in all walls but the top one? Offset the ray?
    // Yes that works - I assume I need to fix up the accuracy in the actual ray cast but I can do that later
    return this.castRay(xa, ya, xd, yd, map);
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

    return this.castRay(xa, ya, xd, yd, map);
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
    height: number,
    radians: number,
  ): Direction[] {
    let initialRays: Direction[] = [];

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
