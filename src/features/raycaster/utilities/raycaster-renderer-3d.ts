import { RaycasterCanvas } from './raycaster-canvas';
import { RaycasterMap } from './raycaster-map';
import { RaycasterRays, RayResult } from './raycaster-ray';
import { RaycasterTextures } from './raycaster-textures';

export class RaycasterRenderer3D {
  map: RaycasterMap;
  canvas: RaycasterCanvas;
  rays: RaycasterRays;
  textures: RaycasterTextures;

  verticalLookMax = 200;
  wallHeight = 1.0;
  ambientRed = 0.25;
  ambientGreen = 0.25;
  ambientBlue = 0.25;

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
  }

  public drawScene(
    playerX: number,
    playerY: number,
    playerZ: number,
    playerR: number,
    playerV: number,
  ) {
    // A list of rays for drawing
    const screenRayList = this.rays.getScreenRayVectors(
      this.canvas.aspectRatio,
      this.canvas.width,
      this.canvas.height,
      playerR,
    );

    for (let x = 0; x < this.canvas.width; x++) {
      const screenRay = screenRayList[x];
      const rayResult = this.rays.castRay(
        playerX,
        playerY,
        screenRay.x,
        screenRay.y,
        this.map.mapData,
      );

      const verticalSlide = this.verticalLookMax * playerV;
      const drawPoints = this.getWallDrawingPoints(rayResult.distance, playerZ, verticalSlide);

      if (rayResult.edge) {
        drawPoints.drawStart = drawPoints.drawEnd;
      }

      let target = this.canvas.target;

      let canvasIndice = this.canvas.getColorIndicesForCoord(x, 0).red;

      // draw the sky, wall and floor
      canvasIndice = this.drawSky(drawPoints, verticalSlide, target, canvasIndice);
      canvasIndice = this.drawWall(rayResult, drawPoints, target, canvasIndice);
      canvasIndice = this.drawFloor(rayResult, drawPoints, playerZ, verticalSlide, target, canvasIndice);
    }
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
    let height = 400;
    //let centerY = (y - drawPoints.heightStart)

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
    target: ImageData,
    canvasIndice: number,
  ) {
    const wallTexture = this.textures.wallTextures[0].data;
    let xTextureCoord = Math.round(rayResult.textureCoord * wallTexture.width);
    let yTextureCoord = 0;

    let lightRed = this.ambientRed;
    let lightGreen = this.ambientGreen;
    let lightBlue = this.ambientBlue;
    for (let light of this.map.lights) {
      const xd = rayResult.xHit - light.x;
      const yd = rayResult.yHit - light.y;
      const xa = light.x;
      const ya = light.y;

      // Squared distance
      let distance = xd * xd + yd * yd;
      if (distance < Math.pow(light.radius, 2)) {
        // testing the distance squared is less than the desired distance squared before casting rays!

        let lightRayResult = this.rays.castRay(xa, ya, xd, yd, this.map.mapData);
        if (lightRayResult.distance >= 0.999) {
          // We hit the ray so now we sqrt the distance
          distance = Math.max(1.0 - Math.sqrt(distance) / light.radius, 0);

          lightRed += light.red * distance;
          lightGreen += light.green * distance;
          lightBlue += light.blue * distance;
        }
      }
    }

    for (let y = drawPoints.drawStart; y < drawPoints.drawEnd; y++) {
      yTextureCoord = Math.round(
        this.wallHeight *
          wallTexture.height *
          ((y - drawPoints.heightStart) / drawPoints.heightDifference),
      );

      const textureIndices = this.canvas.getColorIndicesForCoord(
        xTextureCoord,
        yTextureCoord,
        wallTexture.width,
        wallTexture.height,
        true,
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
    const floorTexture = this.textures.floorTextures[0].data;

    for (let y = drawPoints.drawEnd; y < this.canvas.height; y++) {
      let yAdjusted = y + -Math.min(0, drawPoints.drawEnd);
      const floorDistance =
        (this.canvas.height * playerZ) /
        (yAdjusted - verticalSlide - this.canvas.height / 2.0);
      let xPos = rayResult.xa + rayResult.xd * floorDistance;
      let yPos = rayResult.ya + rayResult.yd * floorDistance;

      // Do light rays
      let lightRed = this.ambientRed;
      let lightGreen = this.ambientGreen;
      let lightBlue = this.ambientBlue;
      for (let light of this.map.lights) {
        const xd = xPos - light.x;
        const yd = yPos - light.y;
        const xa = light.x;
        const ya = light.y;

        // Squared distance
        let distance = xd * xd + yd * yd;
        if (distance < Math.pow(light.radius, 2)) {
          // testing the distance squared is less than the desired distance squared before casting rays!

          let lightRayResult = this.rays.castRay(xa, ya, xd, yd, this.map.mapData);
          if (lightRayResult.distance >= 0.999) {
            // We hit the ray so now we sqrt the distance
            distance = Math.max(1.0 - Math.sqrt(distance) / light.radius, 0);

            lightRed += light.red * distance;
            lightGreen += light.green * distance;
            lightBlue += light.blue * distance;
          }
        }
      }

      let xTextureCoord = Math.round(xPos * floorTexture.width);
      let yTextureCoord = Math.round(yPos * floorTexture.height);

      const textureIndices = this.canvas.getColorIndicesForCoord(
        xTextureCoord,
        yTextureCoord,
        floorTexture.width,
        floorTexture.height,
        true,
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

  private getWallDrawingPoints(distance: number, playerZ: number, verticalSlide: number) {
    const cameraHeight = playerZ * this.canvas.height;

    // If we round these off, we can make the low precision Kens Labyrinth texture effect
    const heightStart =
      verticalSlide +
      (-this.canvas.height * this.wallHeight + cameraHeight) / distance +
      this.canvas.height / 2.0;
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
