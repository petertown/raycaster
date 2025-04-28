import { RaycasterCanvas } from './raycaster-canvas';
import { Block, BlockType, RaycasterMap, Sprite } from './raycaster-map';
import { rotateVectorDirection } from './raycaster-math';
import { RaycasterRays, RayResult } from './raycaster-ray';
import { RaycasterTextures } from './raycaster-textures';

export class RaycasterRenderer3D {
  map: RaycasterMap;
  canvas: RaycasterCanvas;
  rays: RaycasterRays;
  textures: RaycasterTextures;

  verticalLookMax = 200;
  ambientRed = 1.0;
  ambientGreen = 1.0;
  ambientBlue = 1.0;
  doLighting = false;

  // render targets and data
  depthList: number[];

  constructor(
    map: RaycasterMap,
    canvas: RaycasterCanvas,
    rays: RaycasterRays,
    textures: RaycasterTextures,
  ) {
    this.map = map;
    this.canvas = canvas;
    this.rays = rays;
    this.textures = textures;

    // make depth list to be used later - the size of the width of the canvas in pixels
    this.depthList = [];
    for (let i = 0; i < this.canvas.width; i++) {
      this.depthList.push(0);
    }
  }

  public drawScene(
    playerX: number,
    playerY: number,
    playerZ: number,
    playerR: number,
    playerV: number,
  ) {
    // reset rays cast TEMP
    this.rays.raysCast = 0;

    // A list of rays for drawing
    const screenRayList = this.rays.getScreenRayVectors(
      this.canvas.aspectRatio,
      this.canvas.projectionLength,
      this.canvas.width,
      this.canvas.height,
      playerR,
    );

    const verticalSlide = this.verticalLookMax * playerV;
    let target = this.canvas.getTarget();

    // instead of doing this ... make a loop that makes a bunch of rays, and then cast each ray as a promise
    // Each ray will update the target individually, will see if editing that target data causes issues
    // But this might mean I can use more threads

    for (let x = 0; x < this.canvas.width; x++) {
      const screenRay = screenRayList[x];
      const rayResult = this.rays.castRay(
        playerX,
        playerY,
        screenRay.x,
        screenRay.y,
        this.map.mapData,
      );
      this.depthList[x] = rayResult.distance;

      const drawPoints = this.getWallDrawingPoints(rayResult.distance, playerZ, verticalSlide);

      if (rayResult.edge) {
        drawPoints.drawStart = drawPoints.drawEnd;
      }

      let canvasIndice = this.canvas.getColorIndicesForCoord(x, 0).red;

      // look at last mapCoord to see what texture to use
      let textureId = 0;
      let mapCoordLast = rayResult.mapCoords[rayResult.mapCoords.length - 1];
      textureId = mapCoordLast.wallTexture;

      // if (rayResult.mapCoords.length > 1) {
      let mapCoordSecondLast = rayResult.mapCoords[rayResult.mapCoords.length - 2];
      if (
        mapCoordSecondLast &&
        (mapCoordSecondLast.type === BlockType.XDoor || mapCoordSecondLast.type === BlockType.YDoor)
      ) {
        textureId = mapCoordSecondLast.innerWallTexture;
      }
      // }

      // draw the sky, wall and floor
      canvasIndice = this.drawSky(drawPoints, verticalSlide, target, canvasIndice);

      // When drawing the walls we need to update the depth list for drawing sprites later
      canvasIndice = this.drawWall(
        rayResult,
        drawPoints,
        textureId,
        mapCoordSecondLast ?? mapCoordLast,
        target,
        canvasIndice,
      );

      // TODO: We should do the floors as horizontal spans, as it's easier to calculate
      // For the lighting, we can do the lighting calculated at specific points along the map, so we'll do the floors in spans of unbroken floors from left to right
      // that'll be quicker than doing the ray calculations even if it's not so optimised
      // And calculate at the start and end of the rays
      // then we'll want to know the distance between the two
      // This might be faster, but probably not so good for the shadows - though we could fade out the shadows in the distance?
      // We should probably first attempt to precalculate the possibility for lights for each square, so we can avoid unnecessary checks
      this.drawFloor(rayResult, drawPoints, playerZ, verticalSlide, target, canvasIndice);
    }

    // draw sprites
    this.drawSprites(playerX, playerY, playerR, playerZ, verticalSlide, target);

    // how many rays did we cast? Return it so that we can display those stats
    return this.rays.raysCast;
  }

  private drawSky(
    drawPoints: {
      heightStart: number;
      heightEnd: number;
      drawStart: number;
      drawEnd: number;
      heightDifference: number;
    },
    verticalSlide: number,
    target: ImageData,
    canvasIndice: number,
  ) {
    let red = 96;
    let green = 128;
    let blue = 128;

    for (let y = 0; y < drawPoints.drawStart; y++) {
      let skyPosition = (y - verticalSlide) / this.canvas.height;
      target.data[canvasIndice] = Math.floor(red * skyPosition);
      target.data[canvasIndice + 1] = Math.floor(green * skyPosition);
      target.data[canvasIndice + 2] = Math.floor(blue * skyPosition);

      canvasIndice += this.canvas.width * 4;
    }
    return canvasIndice;
  }

  private drawWall(
    rayResult: RayResult,
    drawPoints: {
      heightStart: number;
      heightEnd: number;
      drawStart: number;
      drawEnd: number;
      heightDifference: number;
    },
    textureId: number,
    lastMapCoord: Block,
    target: ImageData,
    canvasIndice: number,
  ) {
    const wallTexture = this.textures.textureList[textureId].data;
    let xTextureCoord = Math.floor(rayResult.textureCoord * wallTexture.width);
    let yTextureCoord = 0;

    let lightRed = this.ambientRed / (rayResult.distance + 1);
    let lightGreen = this.ambientGreen / (rayResult.distance + 1);
    let lightBlue = this.ambientBlue / (rayResult.distance + 1);
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
          !light.castShadows ||
          Math.pow(light.mapX - lastMapCoord.x, 2) + Math.pow(light.mapY - lastMapCoord.y, 2) <= 1;

        if (!lightHit) {
          lightHit = this.rays.castRay(xa, ya, xd, yd, this.map.mapData).distance >= 0.999;
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

      const textureIndices = this.canvas.getColorIndicesForCoord(
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

      canvasIndice += this.canvas.width * 4;
    }
    return canvasIndice;
  }

  private drawFloor(
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
    target: ImageData,
    canvasIndice: number,
  ) {
    let xPos: number;
    let yPos: number;
    // let xPos: number;

    for (let y = drawPoints.drawEnd + 1; y < this.canvas.height; y++) {
      let yAdjusted = y + -Math.min(0, drawPoints.drawEnd);
      const floorDistance =
        (this.canvas.height * playerZ) / (yAdjusted - verticalSlide - this.canvas.height / 2.0);
      xPos = rayResult.xa + rayResult.xd * floorDistance;
      yPos = rayResult.ya + rayResult.yd * floorDistance;

      // Get texture
      let mapX = Math.min(this.map.mapSize - 1, Math.max(0, Math.floor(xPos)));
      let mapY = Math.min(this.map.mapSize - 1, Math.max(0, Math.floor(yPos)));
      const mapSection = this.map.mapData[mapX][mapY];
      const floorTexture = this.textures.textureList[mapSection.floorTexture].data;

      // Do light rays - can I make this a common bit of code so it's not duplicated for walls?
      let lightRed = this.ambientRed / (floorDistance + 1);
      let lightGreen = this.ambientGreen / (floorDistance + 1);
      let lightBlue = this.ambientBlue / (floorDistance + 1);
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
          let lightHit =
            !light.castShadows ||
            Math.pow(light.mapX - mapX, 2) + Math.pow(light.mapY - mapY, 2) <= 1;

          if (!lightHit) {
            lightHit = this.rays.castRay(xa, ya, xd, yd, this.map.mapData).distance >= 0.999;
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

      const textureIndices = this.canvas.getColorIndicesForCoord(
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

      canvasIndice += this.canvas.width * 4;
    }
    return canvasIndice;
  }

  drawSprites(
    playerX: number,
    playerY: number,
    playerR: number,
    playerZ: number,
    verticalSlide: number,
    target: ImageData,
  ) {
    // order them all by distance (Distance squared)
    let spriteOrdered: { sprite: Sprite; dx: number; dy: number; distance: number }[] = [];

    this.map.sprites.forEach((sprite) => {
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
        let rayDistance = relativePosition.x / this.canvas.projectionLength;

        // find the location on the ground for this point - use X as that's the direction we are facing
        let verticalPoints = this.getWallDrawingPoints(rayDistance, playerZ, verticalSlide);

        let spriteWidth =
          (this.canvas.projectionLength * this.canvas.height) /
          rayDistance /
          this.canvas.aspectRatio; // scale the width
        // maybe do the halving here for easeas

        const spriteTexture = this.textures.textureList[sprite.sprite.texture].data;

        let spriteX =
          (2 * (relativePosition.y * this.canvas.projectionLength * this.canvas.height)) /
            rayDistance /
            this.canvas.aspectRatio +
          this.canvas.width / 2.0;

        let leftX = spriteX - spriteWidth;
        let rightX = spriteX + spriteWidth;
        let drawLeftX = Math.floor(Math.min(this.canvas.width - 1, Math.max(0, leftX)));
        let drawRightX = Math.floor(Math.min(this.canvas.width - 1, Math.max(0, rightX)));
        let differenceX = rightX - leftX;

        // lighting? Perhaps only bother to work this out IF a single part of the sprite is visible
        // As in leave default and only set at the first X column that is worth doing - but later on
        let lightRed = 1.0;
        let lightGreen = 1.0;
        let lightBlue = 1.0;

        for (let x = drawLeftX; x < drawRightX; x++) {
          //console.log(depthList[x] + ' - ' + rayDistance);
          if (this.depthList[x] > rayDistance) {
            // only draw if the depth of the main walls is greater than this one
            let canvasIndice = this.canvas.getColorIndicesForCoord(
              Math.round(x),
              Math.round(verticalPoints.drawStart),
            ).red;

            let xTextureCoord = Math.floor(spriteTexture.width * ((x - leftX) / differenceX));

            for (let y = verticalPoints.drawStart; y <= verticalPoints.drawEnd; y++) {
              let yTextureCoord = Math.floor(
                spriteTexture.height *
                  ((y - verticalPoints.heightStart) / verticalPoints.heightDifference),
              );

              const textureIndices = this.canvas.getColorIndicesForCoord(
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

              canvasIndice += this.canvas.width * 4;
            }
          }
        }
      }
    });
  }

  private getWallDrawingPoints(distance: number, playerZ: number, verticalSlide: number) {
    const cameraHeight = playerZ * this.canvas.height;

    // If we round these off, we can make the low precision Kens Labyrinth texture effect
    const heightStart =
      verticalSlide + (-this.canvas.height + cameraHeight) / distance + this.canvas.height / 2.0;
    const heightEnd = verticalSlide + cameraHeight / distance + this.canvas.height / 2.0;
    const heightDifference = (heightEnd - heightStart) * 1.0;

    const drawStart = Math.round(Math.max(0, heightStart));
    const drawEnd = Math.round(Math.min(this.canvas.height, heightEnd));

    return {
      heightStart: heightStart,
      heightEnd: heightEnd,
      drawStart: drawStart,
      drawEnd: drawEnd,
      heightDifference: heightDifference,
    };
  }
}
