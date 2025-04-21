import { RaycasterCanvas } from './raycaster-canvas';
import { RaycasterMap } from './raycaster-map';
import { RaycasterRays } from './raycaster-ray';

export class RaycasterRenderer3D {
  map: RaycasterMap;
  canvas: RaycasterCanvas;
  rays: RaycasterRays;

  verticalLookMax = 200;
  wallHeight = 1.0;

  constructor(map: RaycasterMap, canvas: RaycasterCanvas, rays: RaycasterRays) {
    this.map = map;
    this.canvas = canvas;
    this.rays = rays;
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
      const rayResult = this.rays.castRay(playerX, playerY, screenRay.x, screenRay.y, this.map.mapData);

      const drawPoints = this.getWallDrawingPoints(rayResult.distance, playerZ, playerV);
      
      if(rayResult.edge) {
        drawPoints.drawStart = drawPoints.drawEnd;
      }

      let target = this.canvas.target;

      let canvasIndice = this.canvas.getColorIndicesForCoord(x, 0).red;

      // draw sky
      let red = 128;
      let green = 255;
      let blue = 255;
      for (let y = 0; y < drawPoints.drawStart; y++) {
        target.data[canvasIndice] = red;
        target.data[canvasIndice + 1] = green;
        target.data[canvasIndice + 2] = blue;

        canvasIndice += this.canvas.width * 4;
      }

      // wall colour
      red = 128;
      green = 128;
      blue = 128;
      if (rayResult.wallX) {
        red = 192;
        green = 192;
        blue = 192;
      }
      for (let y = drawPoints.drawStart; y < drawPoints.drawEnd; y++) {
        target.data[canvasIndice] = red;
        target.data[canvasIndice + 1] = green;
        target.data[canvasIndice + 2] = blue;

        canvasIndice += this.canvas.width * 4;
      }

      // Draw floor
      red = 255;
      green = 192;
      blue = 255;
      for (let y = drawPoints.drawEnd; y < this.canvas.height; y++) {
        target.data[canvasIndice] = red;
        target.data[canvasIndice + 1] = green;
        target.data[canvasIndice + 2] = blue;

        canvasIndice += this.canvas.width * 4;
      }
    }
  }

  private getWallDrawingPoints(distance: number, playerZ: number, playerV: number) {
    let cameraHeight = playerZ * this.canvas.height;

    const verticalSlide = this.verticalLookMax * playerV;

    let heightStart = Math.round(
      verticalSlide +
        (-this.canvas.height * this.wallHeight + cameraHeight) / distance +
        this.canvas.height / 2.0,
    );
    const heightEnd = Math.round(
      verticalSlide + cameraHeight / distance + this.canvas.height / 2.0,
    );
    const heightDifference = (heightEnd - heightStart) * 1.0;

    const drawStart = Math.max(0, heightStart);
    const drawEnd = Math.min(this.canvas.height, heightEnd);

    return {
      heightStart: heightStart,
      heightEnd: heightEnd,
      drawStart: drawStart,
      drawEnd: drawEnd,
      heightDifference: heightDifference,
    };
  }
}
