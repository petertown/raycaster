import { Block, BlockType } from './raycaster-map';
import { RayResult } from './raycaster-ray';

let raysCast = 0;

export function resetRayCount() {
  raysCast = 0;
}

export function getRayCount() {
  return raysCast;
}

// Cant work out why but if the start of the ray is on exactly 0.5 it will break badly - something to do with how I'm doing the straight line rays?
export function castRay(
  xa: number,
  ya: number,
  xd: number,
  yd: number,
  map: Block[][],
  pushBlockX: number,
  pushBlockY: number,
  stopAtMax = false,
  onlyTestWalls = false,
): RayResult {
  raysCast++;

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
    nextX = Math.floor(currentX) + 1;
    changeX = 1;
  } else {
    nextX = Math.floor(currentX);
    changeX = -1;
  }
  if (yd > 0) {
    changeY = 1;
    nextY = Math.floor(currentY) + 1;
  } else {
    changeY = -1;
    nextY = Math.floor(currentY);
  }

  // Loop until we reach a limit or a wall - make sure to limit so we don't go out of bounds!
  let hit = false;
  let hitX = 0;
  let hitY = 0;
  let tests = 0;
  let textureCoord = 0;
  let rayDistance = 0;

  // stop when we hit max if we have set stopAtMax
  while (!hit && (currentLength < 1.0 || !stopAtMax)) {
    tests++;

    // First check if there is a half wall in the mapCoord we are currently testing
    // offset the gap to be slightly closer to player so shadows work
    let wallOffset = 0.01;
    if (!onlyTestWalls) {
      if (currentBlock.type === BlockType.XDoor) {
        // Halfwall X (so along X axis so Y is always the same)
        let startX = xa;
        let startY = ya;
        let vectX = xd;
        let vectY = yd;

        let wallY = blockY + 0.5 + (changeY > 0 ? -wallOffset : wallOffset); // offset the wall so shadows work
        let wallX1 = blockX + currentBlock.open;
        let wallX2 = blockX + 1;

        // so when does the Y meet?
        rayDistance = (wallY - startY) / vectY;
        // where is X then?
        hitX = startX + vectX * rayDistance;

        // TODO: Will need to take into account opening and closing of the half wall (as in, some parts of the wall are open or closed)
        if (rayDistance > 0 && hitX >= wallX1 && hitX <= wallX2) {
          textureCoord = hitX - wallX1;
          hitY = wallY;
          // check if any pushwalls first
          currentLength = rayDistance;
          currentX = hitX;
          currentY = hitY;
          checkPushBlock();

          // return the hit of this half wall
          return {
            xa: xa,
            ya: ya,
            xd: xd,
            yd: yd,
            xHit: currentX,
            yHit: currentY,
            distance: currentLength,
            textureCoord: textureCoord,
            wallX: false,
            edge: false,
            mapCoords: mapCoords,
          };
        }
      } else if (currentBlock.type === BlockType.YDoor) {
        // Halfwall Y (so along Y axis so X is always the same)
        let startX = xa;
        let startY = ya;
        let vectX = xd;
        let vectY = yd;

        let wallX = blockX + 0.5 + (changeX > 0 ? -wallOffset : wallOffset); // offset for shadows
        let wallY1 = blockY + currentBlock.open;
        let wallY2 = blockY + 1;

        // so when does the X meet?
        let rayDistance = (wallX - startX) / vectX;
        // where is Y then?
        let hitY = startY + vectY * rayDistance;

        if (rayDistance > 0 && hitY >= wallY1 && hitY <= wallY2) {
          textureCoord = hitY - wallY1;
          hitX = wallX;
          currentX = hitX;
          currentY = hitY;

          // check if any pushwalls first
          currentLength = rayDistance;
          checkPushBlock();

          // return the hit of this half wall
          return {
            xa: xa,
            ya: ya,
            xd: xd,
            yd: yd,
            xHit: currentX,
            yHit: currentY,
            distance: currentLength,
            textureCoord: textureCoord,
            wallX: true,
            edge: false,
            mapCoords: mapCoords,
          };
        }
      }
    }

    // This is going to break if we have an exact angle, so let's never have one ok? Or work something out for it?
    // this is how long the line is away from the next gridline
    // This definitely doesn't work however
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

    // can probably do this more simply with the code above just increment or decrement
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

  textureCoord = wallX ? currentY * changeX : -currentX * changeY;
  textureCoord = textureCoord - Math.floor(textureCoord);

  // Test pushblock
  checkPushBlock();

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

  // inner function because it is used a few times here - so it uses same vars etc
  function checkPushBlock() {
    if (pushBlockX < 0) {
      return;
    }
    const blockTLX = pushBlockX;
    const blockTLY = pushBlockY;
    const blockBRX = pushBlockX + 1;
    const blockBRY = pushBlockY + 1;
    let hitPushBlock = false;
    let hitX: number;
    let hitY: number;

    // check where x is when y is at top
    // so when does the Y meet?
    rayDistance = (blockTLY - ya) / yd;
    // where is X then?
    hitX = xa + xd * rayDistance;
    if (hitX >= blockTLX && hitX <= blockBRX && rayDistance > 0 && rayDistance < currentLength) {
      currentLength = rayDistance;
      currentX = hitX;
      currentY = blockTLY;
      textureCoord = 1 - (hitX - blockTLX);
      hitPushBlock = true;
    }

    // check where x is when y is at bottom
    rayDistance = (blockBRY - ya) / yd;
    hitX = xa + xd * rayDistance;
    if (hitX >= blockTLX && hitX <= blockBRX && rayDistance > 0 && rayDistance < currentLength) {
      currentLength = rayDistance;
      currentX = hitX;
      currentY = blockBRY;
      textureCoord = hitX - blockTLX;
      hitPushBlock = true;
    }

    // check where y is when x is at top
    rayDistance = (blockTLX - xa) / xd;
    hitY = ya + yd * rayDistance;
    if (hitY >= blockTLY && hitY <= blockBRY && rayDistance > 0 && rayDistance < currentLength) {
      currentLength = rayDistance;
      currentX = blockTLX;
      currentY = hitY;
      textureCoord = hitY - blockTLY;
      hitPushBlock = true;
    }

    // check where y is when x is at bottom
    rayDistance = (blockBRX - xa) / xd;
    hitY = ya + yd * rayDistance;
    if (hitY >= blockTLY && hitY <= blockBRY && rayDistance > 0 && rayDistance < currentLength) {
      currentLength = rayDistance;
      currentX = blockBRX;
      currentY = hitY;
      textureCoord = 1 - (hitY - blockTLY);
      hitPushBlock = true;
    }

    if (hitPushBlock) {
      // instead of doing that, return a pushblock obj
      const pushBlock: Block = {
        x: Math.floor(currentX),
        y: Math.floor(currentY),
        type: BlockType.Push,
        wallTexture: 15,
        innerWallTexture: 0,
        floorTexture: 0,
        open: 0,
        lights: [],
      };

      mapCoords = [];
      //mapCoords.push(pushBlock);
      // Push it twice, cos the lighting comes from the prev block
      // This really is awful code
      mapCoords.push(pushBlock);
    }
  }
}
