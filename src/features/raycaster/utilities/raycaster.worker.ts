/// <reference lib="webworker" />
import { Block, BlockType, RaycasterMap, Sprite } from './raycaster-map';
import { rotateVectorDirection } from './raycaster-math';
import { Direction, RayResult } from './raycaster-ray';
import { RaycasterTextures } from './raycaster-textures';

// Can move a lot of stuff from function params into here, but not sure how good that is
let raysCast = 0;
let ambientRed = 1.0;
let ambientGreen = 1.0;
let ambientBlue = 1.0;
let depthList: number[];

addEventListener('message', ({ data }) => {
  // reset rays cast TEMP
  raysCast = 0;

  // list of depths
  depthList = [];

  // A list of rays for drawing
  const screenRayList = getScreenRayVectors(
    data.aspectRatio,
    data.projectionLength,
    data.renderWidth,
    data.playerR,
  );

  const verticalSlide = (data.renderHeight / 2.0) * data.playerV;

  // instead of doing this ... make a loop that makes a bunch of rays, and then cast each ray as a promise
  // Each ray will update the target individually, will see if editing that target data causes issues
  // But this might mean I can use more threads

  for (let x = 0; x < data.renderWidth; x++) {
    const screenRay = screenRayList[x];
    const rayResult = castRay(
      data.playerX,
      data.playerY,
      screenRay.x,
      screenRay.y,
      data.map.mapData,
    );
    depthList.push(rayResult.distance);

    const drawPoints = getWallDrawingPoints(
      rayResult.distance,
      data.playerZ,
      verticalSlide,
      data.renderHeight,
    );

    if (rayResult.edge) {
      drawPoints.drawStart = drawPoints.drawEnd;
    }

    let canvasIndice = getColorIndicesForCoord(x, 0, data.renderWidth, data.renderHeight).red;

    // look at last mapCoord to see what texture to use
    let textureId = 0;
    let mapCoordLast = rayResult.mapCoords[rayResult.mapCoords.length - 1];
    textureId = mapCoordLast.wallTexture;

    let mapCoordSecondLast = rayResult.mapCoords[rayResult.mapCoords.length - 2];
    if (
      mapCoordSecondLast &&
      (mapCoordSecondLast.type === BlockType.XDoor || mapCoordSecondLast.type === BlockType.YDoor)
    ) {
      textureId = mapCoordSecondLast.innerWallTexture;
    }

    // draw the sky, wall and floor
    canvasIndice = drawSky(
      drawPoints,
      verticalSlide,
      data.renderHeight,
      data.renderWidth,
      data.target,
      canvasIndice,
    );

    // When drawing the walls we need to update the depth list for drawing sprites later
    canvasIndice = drawWall(
      rayResult,
      drawPoints,
      data.textures,
      textureId,
      data.map,
      mapCoordSecondLast ?? mapCoordLast,
      data.renderWidth,
      data.target,
      canvasIndice,
    );

    // TODO: We should do the floors as horizontal spans, as it's easier to calculate
    // For the lighting, we can do the lighting calculated at specific points along the map, so we'll do the floors in spans of unbroken floors from left to right
    // that'll be quicker than doing the ray calculations even if it's not so optimised
    // And calculate at the start and end of the rays
    // then we'll want to know the distance between the two
    // This might be faster, but probably not so good for the shadows - though we could fade out the shadows in the distance?
    // We should probably first attempt to precalculate the possibility for lights for each square, so we can avoid unnecessary checks
    drawFloor(
      rayResult,
      drawPoints,
      data.playerZ,
      verticalSlide,
      data.textures,
      data.renderHeight,
      data.renderWidth,
      data.map,
      data.target,
      canvasIndice,
    );
  }

  // draw sprites
  drawSprites(
    data.playerX,
    data.playerY,
    data.playerR,
    data.playerZ,
    data.map,
    verticalSlide,
    data.projectionLength,
    data.renderHeight,
    data.renderWidth,
    data.aspectRatio,
    data.textures,
    data.target,
  );

  // how many rays did we cast? Return it so that we can display those stats
  postMessage({ raysCast: raysCast, target: data.target });
});

function drawSky(
  drawPoints: {
    heightStart: number;
    heightEnd: number;
    drawStart: number;
    drawEnd: number;
    heightDifference: number;
  },
  verticalSlide: number,
  renderHeight: number,
  renderWidth: number,
  target: ImageData,
  canvasIndice: number,
) {
  let red = 96;
  let green = 128;
  let blue = 128;

  for (let y = 0; y < drawPoints.drawStart; y++) {
    let skyPosition = (y - verticalSlide) / renderHeight;
    target.data[canvasIndice] = Math.floor(red * skyPosition);
    target.data[canvasIndice + 1] = Math.floor(green * skyPosition);
    target.data[canvasIndice + 2] = Math.floor(blue * skyPosition);

    canvasIndice += renderWidth * 4;
  }
  return canvasIndice;
}

function drawWall(
  rayResult: RayResult,
  drawPoints: {
    heightStart: number;
    heightEnd: number;
    drawStart: number;
    drawEnd: number;
    heightDifference: number;
  },
  textures: RaycasterTextures,
  textureId: number,
  map: RaycasterMap,
  lastMapCoord: Block,
  renderWidth: number,
  target: ImageData,
  canvasIndice: number,
) {
  const wallTexture = textures.textureList[textureId].data;
  let xTextureCoord = Math.floor(rayResult.textureCoord * wallTexture.width);
  let yTextureCoord = 0;

  let lightRed = ambientRed / (rayResult.distance + 1);
  let lightGreen = ambientGreen / (rayResult.distance + 1);
  let lightBlue = ambientBlue / (rayResult.distance + 1);
  for (let light of lastMapCoord.lights) {
    const xd = rayResult.xHit - light.x;
    const yd = rayResult.yHit - light.y;
    const xa = light.x;
    const ya = light.y;

    // Squared distance
    let distance = xd * xd + yd * yd;
    if (distance < Math.pow(light.radius, 2)) {
      // testing the distance squared is less than the desired distance squared before casting rays!

      let lightHit =
        Math.pow(light.mapX - lastMapCoord.x, 2) + Math.pow(light.mapY - lastMapCoord.y, 2) <= 1;

      if (
        !light.castShadows ||
        lastMapCoord.type === BlockType.XDoor ||
        lastMapCoord.type === BlockType.YDoor
      ) {
        lightHit = false;
      }

      if (!lightHit) {
        lightHit = castRay(xa, ya, xd, yd, map.mapData).distance >= 0.999;
      }

      if (lightHit) {
        // We hit the ray so now we sqrt the distance */
        distance = Math.max(1.0 - Math.sqrt(distance) / light.radius, 0);

        lightRed += light.red * distance;
        lightGreen += light.green * distance;
        lightBlue += light.blue * distance;
      }
    }
  }

  for (let y = drawPoints.drawStart; y <= drawPoints.drawEnd; y++) {
    yTextureCoord = Math.floor(
      wallTexture.height * ((y - drawPoints.heightStart) / drawPoints.heightDifference),
    );

    const textureIndices = getColorIndicesForCoord(
      xTextureCoord,
      yTextureCoord,
      wallTexture.width,
      wallTexture.height,
    );
    target.data[canvasIndice] = Math.round(wallTexture.data[textureIndices.red] * lightRed);
    target.data[canvasIndice + 1] = Math.round(wallTexture.data[textureIndices.green] * lightGreen);
    target.data[canvasIndice + 2] = Math.round(wallTexture.data[textureIndices.blue] * lightBlue);

    canvasIndice += renderWidth * 4;
  }
  return canvasIndice;
}

function drawFloor(
  rayResult: RayResult,
  drawPoints: {
    heightStart: number;
    heightEnd: number;
    drawStart: number;
    drawEnd: number;
    heightDifference: number;
  },
  playerZ: number,
  verticalSlide: number,
  textures: RaycasterTextures,
  renderHeight: number,
  renderWidth: number,
  map: RaycasterMap,
  target: ImageData,
  canvasIndice: number,
) {
  let xPos: number;
  let yPos: number;

  for (let y = drawPoints.drawEnd + 1; y < renderHeight; y++) {
    let yAdjusted = y + -Math.min(0, drawPoints.drawEnd);
    const floorDistance =
      (renderHeight * playerZ) / (yAdjusted - verticalSlide - renderHeight / 2.0);
    xPos = rayResult.xa + rayResult.xd * floorDistance;
    yPos = rayResult.ya + rayResult.yd * floorDistance;

    // Get texture
    let mapX = Math.min(map.mapSize - 1, Math.max(0, Math.floor(xPos)));
    let mapY = Math.min(map.mapSize - 1, Math.max(0, Math.floor(yPos)));
    const mapSection = map.mapData[mapX][mapY];
    const floorTexture = textures.textureList[mapSection.floorTexture].data;

    // Do light rays - can I make this a common bit of code so it's not duplicated for walls?
    let lightRed = ambientRed / (floorDistance + 1);
    let lightGreen = ambientGreen / (floorDistance + 1);
    let lightBlue = ambientBlue / (floorDistance + 1);
    for (let light of mapSection.lights) {
      const xd = xPos - light.x;
      const yd = yPos - light.y;
      const xa = light.x;
      const ya = light.y;

      // Squared distance
      let distance = xd * xd + yd * yd;
      if (distance < Math.pow(light.radius, 2)) {
        // testing the distance squared is less than the desired distance squared before casting rays!

        // Also if we are in the same square as the light source, or adjacent to it, we don't need to cast any rays!
        // get a dist squared of the mapX/Y coords - If 1 or less then we don't bother doing shadows

        let lightHit = Math.pow(light.mapX - mapX, 2) + Math.pow(light.mapY - mapY, 2) <= 1;

        if (
          !light.castShadows ||
          mapSection.type === BlockType.XDoor ||
          mapSection.type === BlockType.YDoor
        ) {
          lightHit = false;
        }

        if (!lightHit) {
          lightHit = castRay(xa, ya, xd, yd, map.mapData).distance >= 0.999;
        }

        if (lightHit) {
          // We hit the ray so now we sqrt the distance
          distance = Math.max(1.0 - Math.sqrt(distance) / light.radius, 0);

          lightRed += light.red * distance;
          lightGreen += light.green * distance;
          lightBlue += light.blue * distance;
        }
      }
    }

    // just get decimal from xPos now
    xPos = xPos - Math.floor(xPos);
    yPos = yPos - Math.floor(yPos);
    let xTextureCoord = Math.floor(xPos * floorTexture.width);
    let yTextureCoord = Math.floor(yPos * floorTexture.height);

    const textureIndices = getColorIndicesForCoord(
      xTextureCoord,
      yTextureCoord,
      floorTexture.width,
      floorTexture.height,
    );
    target.data[canvasIndice] = Math.round(floorTexture.data[textureIndices.red] * lightRed);
    target.data[canvasIndice + 1] = Math.round(
      floorTexture.data[textureIndices.green] * lightGreen,
    );
    target.data[canvasIndice + 2] = Math.round(floorTexture.data[textureIndices.blue] * lightBlue);

    canvasIndice += renderWidth * 4;
  }
  return canvasIndice;
}

function drawSprites(
  playerX: number,
  playerY: number,
  playerR: number,
  playerZ: number,
  map: RaycasterMap,
  verticalSlide: number,
  projectionLength: number,
  renderHeight: number,
  renderWidth: number,
  aspectRatio: number,
  textures: RaycasterTextures,
  target: ImageData,
) {
  // order them all by distance (Distance squared)
  let spriteOrdered: { sprite: Sprite; dx: number; dy: number; distance: number }[] = [];

  map.sprites.forEach((sprite) => {
    let distanceX = sprite.x - playerX;
    let distanceY = sprite.y - playerY;

    spriteOrdered.push({
      sprite: sprite,
      dx: distanceX,
      dy: distanceY,
      distance: distanceX * distanceX + distanceY * distanceY,
    });
  });

  // Might get it the wrong way have to check
  spriteOrdered.sort((s1, s2) => {
    return s2.distance - s1.distance;
  });

  spriteOrdered.forEach((sprite) => {
    // draw that sprite!
    // rotate the sprite based on playerR
    let relativePosition = rotateVectorDirection({ x: sprite.dx, y: sprite.dy }, -playerR);

    // Only draw if in front of us
    if (relativePosition.x > 0) {
      let rayDistance = relativePosition.x / projectionLength;

      // find the location on the ground for this point - use X as that's the direction we are facing
      let verticalPoints = getWallDrawingPoints(rayDistance, playerZ, verticalSlide, renderHeight);

      let spriteWidth = (projectionLength * renderHeight) / rayDistance / aspectRatio; // scale the width
      // maybe do the halving here for easeas

      const spriteTexture = textures.textureList[sprite.sprite.texture].data;

      let spriteX =
        (2 * (relativePosition.y * projectionLength * renderHeight)) / rayDistance / aspectRatio +
        renderWidth / 2.0;

      let leftX = spriteX - spriteWidth;
      let rightX = spriteX + spriteWidth;
      let drawLeftX = Math.floor(Math.min(renderWidth - 1, Math.max(0, leftX)));
      let drawRightX = Math.floor(Math.min(renderWidth - 1, Math.max(0, rightX)));
      let differenceX = rightX - leftX;

      // lighting? Perhaps only bother to work this out IF a single part of the sprite is visible
      // As in leave default and only set at the first X column that is worth doing - but later on
      let lightRed = 1.0;
      let lightGreen = 1.0;
      let lightBlue = 1.0;

      for (let x = drawLeftX; x < drawRightX; x++) {
        if (depthList[x] > rayDistance) {
          // only draw if the depth of the main walls is greater than this one
          let canvasIndice = getColorIndicesForCoord(
            Math.round(x),
            Math.round(verticalPoints.drawStart),
            renderWidth,
            renderHeight,
          ).red;

          let xTextureCoord = Math.floor(spriteTexture.width * ((x - leftX) / differenceX));

          for (let y = verticalPoints.drawStart; y <= verticalPoints.drawEnd; y++) {
            let yTextureCoord = Math.floor(
              spriteTexture.height *
                ((y - verticalPoints.heightStart) / verticalPoints.heightDifference),
            );

            const textureIndices = getColorIndicesForCoord(
              xTextureCoord,
              yTextureCoord,
              spriteTexture.width,
              spriteTexture.height,
            );

            let redT = spriteTexture.data[textureIndices.red];
            let greenT = spriteTexture.data[textureIndices.green];
            let blueT = spriteTexture.data[textureIndices.blue];

            // don't draw if transparent
            if (!(redT === 152 && greenT === 0 && blueT === 136)) {
              target.data[canvasIndice] = Math.round(
                spriteTexture.data[textureIndices.red] * lightRed,
              );
              target.data[canvasIndice + 1] = Math.round(
                spriteTexture.data[textureIndices.green] * lightGreen,
              );
              target.data[canvasIndice + 2] = Math.round(
                spriteTexture.data[textureIndices.blue] * lightBlue,
              );
            }

            canvasIndice += renderWidth * 4;
          }
        }
      }
    }
  });
}

function getWallDrawingPoints(
  distance: number,
  playerZ: number,
  verticalSlide: number,
  renderHeight: number,
) {
  const cameraHeight = playerZ * renderHeight;

  // If we round these off, we can make the low precision Kens Labyrinth texture effect
  const heightStart =
    verticalSlide + (-renderHeight + cameraHeight) / distance + renderHeight / 2.0;
  const heightEnd = verticalSlide + cameraHeight / distance + renderHeight / 2.0;
  const heightDifference = (heightEnd - heightStart) * 1.0;

  const drawStart = Math.round(Math.max(0, heightStart));
  const drawEnd = Math.round(Math.min(renderHeight, heightEnd));

  return {
    heightStart: heightStart,
    heightEnd: heightEnd,
    drawStart: drawStart,
    drawEnd: drawEnd,
    heightDifference: heightDifference,
  };
}

// Use this to get the colour indices for a canvas/image - also wrap this number to width and height
// By default it doesn't wrap and it is getting the canvas size
function getColorIndicesForCoord(x: number, y: number, width: number, height: number) {
  x = Math.min(width - 1, Math.max(0, x));
  y = Math.min(height - 1, Math.max(0, y));
  const red = y * (width * 4) + x * 4;
  // return R G B A
  return { red: red, green: red + 1, blue: red + 2, alpha: red + 3 };
}

function castRay(xa: number, ya: number, xd: number, yd: number, map: Block[][]): RayResult {
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

function getScreenRayVectors(
  aspectRatio: number,
  projectionLength: number,
  width: number,
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
