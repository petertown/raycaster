/// <reference lib="webworker" />
import { Colour, rotateVectorDirection } from './functions-math';
import { castRay, getRayCount, resetRayCount } from './functions-rays';
import { Block, BlockType, RaycasterMap, Sprite } from './raycaster-map';
import { Coordinate, RayResult } from './raycaster-ray';
import { RaycasterTextures } from './raycaster-textures';

// Can move a lot of stuff from function params into here, but not sure how good that is
let ambientRed = 0.5;
let ambientGreen = 0.5;
let ambientBlue = 0.5;
let depthList: number[];
// This is all "app wide globals" which could be good for some generic rendering data
// But I don't think I should put anything else here

// In hindsight, I could just be passing the data object around, but is that right?
// Then none of the other render/ray methods are generic
// Maybe not

// Either way, one at a time put these functions in different files and make sure they aren't duplicated
// Because right now it's mostly duplicates

let target: ImageData;
let map: RaycasterMap;
let textures: RaycasterTextures;
let renderWidth: number;
let renderHeight: number;

// temp for demoing, can be removed when Ive made video
let drawTextures = true;
let spritesTransparent = true;
let spritesDepth = true;

// Dynamic ray detail
let lightCalcMod = 3;
let lightRayCountDrop = 50000;
let lightRayCountIncrease = 20000;
let lightRayModOffsets: number[] = [];

addEventListener('message', ({ data }) => {
  if (data.messageType === 'draw') {
    postMessage(drawScene(data));
  } else if (data.messageType === 'init') {
    postMessage(initScene(data));
  }
});

function initScene(data: any) {
  target = data.target;
  map = data.map;
  textures = data.textures;
  renderWidth = data.renderWidth;
  renderHeight = data.renderHeight;

  // Make the initial version of the offsets for mod
  lightRayModOffsets = [];
  for (let x = 0; x < renderWidth; x++) {
    lightRayModOffsets.push(0);
  }

  return { messageType: 'init' };
}

function drawScene(data: any) {
  // reset rays cast amount
  resetRayCount();

  // Update the map with the updated data
  updateMap(data.updatedMapData);

  // list of depths
  depthList = [];

  // A list of rays for drawing
  const screenRayList = getScreenRayVectors(
    data.aspectRatio,
    data.projectionLength,
    renderWidth,
    data.playerR,
  );

  const verticalSlide = (renderHeight / 2.0) * data.playerV;

  // instead of doing this ... make a loop that makes a bunch of rays, and then cast each ray as a promise
  // Each ray will update the target individually, will see if editing that target data causes issues
  // But this might mean I can use more threads

  for (let x = 0; x < renderWidth; x++) {
    const screenRay = screenRayList[x];
    const rayResult = castRay(
      data.playerX,
      data.playerY,
      screenRay.x,
      screenRay.y,
      map.mapData,
      false,
    );
    depthList.push(rayResult.distance);

    const drawPoints = getWallDrawingPoints(
      rayResult.distance,
      data.playerZ,
      verticalSlide,
      renderHeight,
    );

    if (rayResult.edge) {
      drawPoints.drawStart = drawPoints.drawEnd;
    }

    let canvasIndice = getColorIndicesForCoord(x, 0, renderWidth, renderHeight).red;

    // look at last mapCoord to see what texture to use
    let textureId = 0;
    let mapCoordLast = rayResult.mapCoords[rayResult.mapCoords.length - 1];
    textureId = mapCoordLast.wallTexture;

    let isDoor = false;
    let mapCoordSecondLast = rayResult.mapCoords[rayResult.mapCoords.length - 2];
    if (
      mapCoordSecondLast &&
      (mapCoordSecondLast.type === BlockType.XDoor || mapCoordSecondLast.type === BlockType.YDoor)
    ) {
      isDoor = true;
      textureId = mapCoordSecondLast.innerWallTexture;
    }

    // draw the sky
    if (drawPoints.drawStart > 0) {
      canvasIndice = drawSky(
        drawPoints,
        verticalSlide,
        renderHeight,
        renderWidth,
        target,
        canvasIndice,
      );
    }

    // Only draw wall if there's any section of wall at all
    if (drawPoints.drawStart < drawPoints.drawEnd) {
      canvasIndice = drawWall(
        rayResult,
        drawPoints,
        textures,
        textureId,
        map,
        mapCoordSecondLast ?? mapCoordLast,
        renderWidth,
        target,
        canvasIndice,
        isDoor,
      );
    }

    // TODO: We should do the floors as horizontal spans, as it's easier to calculate
    // For the lighting, we can do the lighting calculated at specific points along the map, so we'll do the floors in spans of unbroken floors from left to right
    // that'll be quicker than doing the ray calculations even if it's not so optimised
    // And calculate at the start and end of the rays
    // then we'll want to know the distance between the two
    // This might be faster, but probably not so good for the shadows - though we could fade out the shadows in the distance?
    // We should probably first attempt to precalculate the possibility for lights for each square, so we can avoid unnecessary checks
    if (drawPoints.drawEnd < renderHeight) {
      drawFloor(
        x,
        rayResult,
        drawPoints,
        data.playerZ,
        verticalSlide,
        textures,
        renderHeight,
        renderWidth,
        map,
        target,
        canvasIndice,
      );
    }
  }

  // draw sprites
  drawSprites(
    data.playerX,
    data.playerY,
    data.playerR,
    data.playerZ,
    map,
    verticalSlide,
    data.projectionLength,
    renderHeight,
    renderWidth,
    data.aspectRatio,
    textures,
    target,
  );

  // Dynamically adjust ray count detail for next frame and make a noise pattern
  const rayCount = getRayCount();
  let updateModOffsets = false;
  if (rayCount > lightRayCountDrop) {
    lightCalcMod++;
    updateModOffsets = true;
  } else if (rayCount < lightRayCountIncrease) {
    lightCalcMod = Math.max(1, lightCalcMod - 1);
    updateModOffsets = true;
  }
  if (updateModOffsets) {
    for (let x = 0; x < renderWidth; x++) {
      lightRayModOffsets[x] = Math.floor(Math.random() * lightCalcMod);
    }
  }

  // how many rays did we cast? Return it so that we can display those stats
  return { raysCast: rayCount, target: target, messageType: 'draw' };
}

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
    if (drawTextures) {
      let skyPosition = (y - verticalSlide) / renderHeight;
      target.data[canvasIndice] = Math.floor(red * skyPosition);
      target.data[canvasIndice + 1] = Math.floor(green * skyPosition);
      target.data[canvasIndice + 2] = Math.floor(blue * skyPosition);
    } else {
      target.data[canvasIndice] = 64;
      target.data[canvasIndice + 1] = 128;
      target.data[canvasIndice + 2] = 128;
    }

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
  isDoor: boolean,
) {
  const wallTexture = textures.textureList[textureId].data;
  let xTextureCoord = Math.floor(rayResult.textureCoord * wallTexture.width);
  let yTextureCoord = 0;

  let lightRed = ambientRed / (rayResult.distance + 1);
  let lightGreen = ambientGreen / (rayResult.distance + 1);
  let lightBlue = ambientBlue / (rayResult.distance + 1);

  // add prebaked lighting
  const bakedLighting = getLightingAt(rayResult.xHit, rayResult.yHit, map, lastMapCoord, isDoor);
  lightRed += bakedLighting.red;
  lightGreen += bakedLighting.green;
  lightBlue += bakedLighting.blue;
  // NOTE this doesn't work for doors... I think doors need to have the current map coord instead
  // It does seem like they don't calculate shadows from diagonal lights

  for (let y = drawPoints.drawStart; y <= drawPoints.drawEnd; y++) {
    if (drawTextures) {
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
      target.data[canvasIndice + 1] = Math.round(
        wallTexture.data[textureIndices.green] * lightGreen,
      );
      target.data[canvasIndice + 2] = Math.round(wallTexture.data[textureIndices.blue] * lightBlue);
    } else {
      const colour = rayResult.wallX ? 128 : 160;
      target.data[canvasIndice] = colour;
      target.data[canvasIndice + 1] = colour;
      target.data[canvasIndice + 2] = colour;
    }
    canvasIndice += renderWidth * 4;
  }
  return canvasIndice;
}

// I'd like to make a new version of this which happens after all walls are drawn and it has stored all the heights of the walls
// And then we can do it horizontally
// Then the "low detail" setting can be horizontal not vertical, thought that might look worse, it could do the full horizontal detail and save it
// and then the next row would print out the same details unless it needs to get a new one that's missing
// It might be more efficient
// We could also use the same texture mapping to also interpolate between the raycasting
// but first - get the precalculated shader working and maybe clean up the code so we don't have it all duplicated everywhere
function drawFloor(
  screenX: number,
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

  // Only do light rays for every X pixel (based on y) - move this to a better place
  let lightRed = 0;
  let lightGreen = 0;
  let lightBlue = 0;
  let firstCalc = true;

  for (let y = drawPoints.drawEnd + 1; y < renderHeight; y++) {
    if (drawTextures) {
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

      // Do light rays - can I make this a common bit of code so it's not duplicated for walls and maybe ceilings?
      // Also only do every second pixel, or third, try to limit how many rays we need
      if (firstCalc || (y - lightRayModOffsets[screenX]) % lightCalcMod === 0) {
        firstCalc = false;

        lightRed = ambientRed / (floorDistance + 1);
        lightGreen = ambientGreen / (floorDistance + 1);
        lightBlue = ambientBlue / (floorDistance + 1);

        // add prebaked lighting
        const bakedLighting = getLightingAt(xPos, yPos, map, mapSection, false);
        lightRed += bakedLighting.red;
        lightGreen += bakedLighting.green;
        lightBlue += bakedLighting.blue;
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
      target.data[canvasIndice + 2] = Math.round(
        floorTexture.data[textureIndices.blue] * lightBlue,
      );
    } else {
      target.data[canvasIndice] = 128;
      target.data[canvasIndice + 1] = 112;
      target.data[canvasIndice + 2] = 128;
    }
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

      for (let x = drawLeftX; x < drawRightX; x++) {
        if (!spritesDepth || depthList[x] > rayDistance) {
          // only draw if the depth of the main walls is greater than this one
          let canvasIndice = getColorIndicesForCoord(
            Math.round(x),
            Math.round(verticalPoints.drawStart),
            renderWidth,
            renderHeight,
          ).red;

          let xTextureCoord = Math.floor(spriteTexture.width * ((x - leftX) / differenceX));
          let yTextureCoords: number[] = [];
          for (let y = verticalPoints.drawStart; y <= verticalPoints.drawEnd; y++) {
            yTextureCoords.push(
              Math.floor(
                spriteTexture.height *
                  ((y - verticalPoints.heightStart) / verticalPoints.heightDifference),
              ),
            );
          }

          // Ideally we'd check if the sprite is drawn at all before doing any of this
          const mapCoord = map.mapData[Math.floor(sprite.sprite.x)][Math.floor(sprite.sprite.y)];
          const lighting = getLightingAt(sprite.sprite.x, sprite.sprite.y, map, mapCoord, false);

          for (let y = verticalPoints.drawStart; y <= verticalPoints.drawEnd; y++) {
            let yTextureCoord = yTextureCoords[y - verticalPoints.drawStart];

            /*  = Math.floor(
              spriteTexture.height *
                ((y - verticalPoints.heightStart) / verticalPoints.heightDifference),
            ); */

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
            if (!spritesTransparent || !(redT === 152 && greenT === 0 && blueT === 136)) {
              redT *= lighting.red;
              greenT *= lighting.green;
              blueT *= lighting.blue;

              target.data[canvasIndice] = Math.round(redT);
              target.data[canvasIndice + 1] = Math.round(greenT);
              target.data[canvasIndice + 2] = Math.round(blueT);
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

  const wallHeight = 1.0; // maybe store it elsewhere as we also need to use this to deal with the texture scales

  const heightStart =
    verticalSlide + (-renderHeight * wallHeight + cameraHeight) / distance + renderHeight / 2.0;
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

function getScreenRayVectors(
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

// Perhaps can do the ray lighting here too
function getLightingAt(x: number, y: number, map: RaycasterMap, mapCoord: Block, isDoor: boolean) {
  // However slow this is, it's gonna be faster than raycasting shadows or whatever else surely?
  // But if it doesn't work... just get rid of it I guess
  const mapX1 = Math.floor(x);
  const mapY1 = Math.floor(y);
  const mapX2 = mapX1 + 1;
  const mapY2 = mapY1 + 1;

  const tl = map.lightData[mapX1][mapY1];
  const tr = map.lightData[mapX2][mapY1];
  const bl = map.lightData[mapX1][mapY2];
  const br = map.lightData[mapX2][mapY2];

  // interpolate between the four points (bilinear interpolation)

  // percent across the two axis
  const xpc2 = x - mapX1;
  const xpc1 = 1 - xpc2;
  const ypc2 = y - mapY1;
  const ypc1 = 1 - ypc2;

  // top col and bottom col
  const topCol = blendColours(tl, tr, xpc1, xpc2);
  const bottomCol = blendColours(bl, br, xpc1, xpc2);
  const midCol = blendColours(topCol, bottomCol, ypc1, ypc2);

  for (let light of mapCoord.lights) {
    const xd = x - light.x;
    const yd = y - light.y;
    const xa = light.x;
    const ya = light.y;

    // Squared distance
    let distance = xd * xd + yd * yd;
    if (distance < Math.pow(light.radius, 2)) {
      // testing the distance squared is less than the desired distance squared before casting rays!

      // Also if we are in the same square as the light source, or adjacent to it, we don't need to cast any rays!
      // get a dist squared of the mapX/Y coords - If 1 or less then we don't bother doing shadows
      let lightHit =
        Math.pow(light.mapX - mapCoord.x, 2) + Math.pow(light.mapY - mapCoord.y, 2) <= 1;

      if (isDoor) {
        lightHit = false;
      }

      if (!lightHit) {
        lightHit =
          !light.castShadows || castRay(xa, ya, xd, yd, map.mapData, true).distance >= 0.999;
      }

      if (lightHit) {
        // We hit the ray so now we sqrt the distance
        distance = Math.max(1.0 - Math.sqrt(distance) / light.radius, 0);

        midCol.red += light.red * distance;
        midCol.green += light.green * distance;
        midCol.blue += light.blue * distance;
      }
    }
  }

  return midCol;
}

function blendColours(
  colour1: Colour,
  colour2: Colour,
  percent1: number,
  percent2: number,
): Colour {
  return {
    red: colour1.red * percent1 + colour2.red * percent2,
    green: colour1.green * percent1 + colour2.green * percent2,
    blue: colour1.blue * percent1 + colour2.blue * percent2,
  };
}
function updateMap(updatedMapData: Block[]) {
  updatedMapData.forEach((block) => {
    map.mapData[block.x][block.y] = block;
  });
}
