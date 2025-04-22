import { RaycasterCanvas } from './raycaster-canvas';
import { BlockType, RaycasterMap } from './raycaster-map';
import { mod } from './raycaster-math';
import { RaycasterRays, RayResult } from './raycaster-ray';

export class RaycasterRenderer2D {
  // Collision ray: hits a bit of the wall but further out, but then casts extra rays to do the "sliding" until the length of the movement ray is exhausted
  //    TEST: Can I just "shift" the ray origin by 0.1 or so to the left for each axis if the ray points right, and right if it goes left
  //    then there's no "expanding" out the collision
  // Reflected ray (in case I want reflections)
  // Ray from point to lights in scene

  map: RaycasterMap;
  canvas: RaycasterCanvas;
  rays: RaycasterRays;

  drawVisible = false; // single line for where we lookin
  drawCollision = false;
  drawLights = false;
  drawCone = true;

  backgroundColour = '#00000099';
  blockColour = '#cccccc';
  coneColour = '#ffffff';

  constructor(map: RaycasterMap, canvas: RaycasterCanvas, rays: RaycasterRays) {
    this.map = map;
    this.canvas = canvas;
    this.rays = rays;
  }

  public drawMap(playerX: number, playerY: number, playerR: number) {
    // get area to draw in based on current aspect ratio
    const drawArea = this.getDrawArea();

    // Clear the image first? Maybe take this out later if we are drawing it on top of the 3d render
    // this.canvas.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    let topLeft = this.getMapDrawPosition(0, 0, drawArea);
    let blockSize = this.getMapDrawPosition(this.map.mapSize, this.map.mapSize, drawArea, true);
    this.canvas.context.fillStyle = this.backgroundColour;
    this.canvas.context.beginPath();
    this.canvas.context.fillRect(topLeft.x, topLeft.y, blockSize.x, blockSize.y);
    this.canvas.context.stroke();

    // Draw the entire map, just the blocks that are walls
    this.drawBlocks(drawArea);

    if (this.drawCollision) {
      this.drawCollisionRays(playerX, playerY, playerR, drawArea);
    }

    // Draw player field of view
    if (this.drawCone) {
      this.drawCones(playerX, playerY, playerR, drawArea);
    }

    // Draw lights
    if (this.drawLights) {
      for (let light of this.map.lights) {
        let colour = 'green';
        this.drawCircle(light.x, light.y, 0.1, drawArea, colour);
      }
    }

    // Draw rays cast for a single column
    this.drawRays(playerX, playerY, drawArea, playerR);

    // Draw the player on top of everything
    this.drawPlayer(playerX, playerY, drawArea);
  }

  drawCones(
    playerX: number,
    playerY: number,
    playerR: number,
    drawArea: { x1: number; y1: number; x2: number; y2: number },
  ) {
    // one for each column of the canvas
    let screenRays = this.rays.getScreenRayVectors(
      this.canvas.aspectRatio,
      this.canvas.width,
      this.canvas.height,
      playerR,
    );

    for (let x = 0; x < this.canvas.width; x++) {
      // make the field of view
      const xdBase = 1.0;
      const ydBase = this.canvas.aspectRatio * ((x - this.canvas.width / 2.0) / this.canvas.width);

      // Rotate this ray by the player angle
      const cos = Math.cos(playerR);
      const sin = Math.sin(playerR);
      const xd = xdBase * cos - ydBase * sin;
      const yd = xdBase * sin + ydBase * cos;

      const screenRay = screenRays[x];

      let rayResult = this.rays.castRay(
        playerX,
        playerY,
        screenRay.x,
        screenRay.y,
        this.map.mapData,
      );

      this.drawRay(drawArea, rayResult, this.coneColour);
    }
  }

  private drawRays(
    playerX: number,
    playerY: number,
    drawArea: { x1: number; y1: number; x2: number; y2: number },
    playerR: number,
  ) {
    // calculate the ray
    let xa = playerX;
    let ya = playerY;
    let xd = Math.cos(playerR);
    let yd = Math.sin(playerR);

    let rayResult = this.rays.castRay(xa, ya, xd, yd, this.map.mapData);

    let colour = 'red';
    if (this.drawVisible) {
      this.drawRay(drawArea, rayResult, colour);
    }

    // Save the area hit by that first ray
    let xHit = rayResult.xHit;
    let yHit = rayResult.yHit;

    for (let reflect = 0; reflect < 0; reflect++) {
      rayResult = this.rays.reflectRay(rayResult, this.map.mapData);
      colour = 'blue';
      this.drawRay(drawArea, rayResult, colour);
    }

    // Light rays
    if (this.drawLights) {
      for (let light of this.map.lights) {
        xd = xHit - light.x;
        yd = yHit - light.y;
        xa = light.x;
        ya = light.y;

        rayResult = this.rays.castRay(xa, ya, xd, yd, this.map.mapData);
        colour = 'green';
        if (rayResult.distance >= 0.999) {
          this.canvas.context.lineWidth = 5;
        }
        this.drawRay(drawArea, rayResult, colour);
        this.canvas.context.lineWidth = 1;
      }
    }
  }

  private drawRay(
    drawArea: { x1: number; y1: number; x2: number; y2: number },
    rayResult: RayResult,
    colour: string,
  ) {
    let rayStart = this.getMapDrawPosition(rayResult.xa, rayResult.ya, drawArea);
    let rayEnd = this.getMapDrawPosition(
      rayResult.distance * rayResult.xd + rayResult.xa,
      rayResult.distance * rayResult.yd + rayResult.ya,
      drawArea,
    );

    //let rayEnd = this.getMapDrawPosition(rayResult.xHit, rayResult.yHit, drawArea);

    this.drawLine(rayStart, rayEnd, colour);
  }

  private drawLine(
    rayStart: { x: number; y: number },
    rayEnd: { x: number; y: number },
    colour: string,
  ) {
    this.canvas.context.strokeStyle = colour;
    this.canvas.context.beginPath();
    this.canvas.context.moveTo(rayStart.x, rayStart.y);
    this.canvas.context.lineTo(rayEnd.x, rayEnd.y);
    this.canvas.context.stroke();
    this.canvas.context.closePath();
  }

  private drawPlayer(
    playerX: number,
    playerY: number,
    drawArea: { x1: number; y1: number; x2: number; y2: number },
  ) {
    // draw a circle for the player
    let colour = 'red';
    this.drawCircle(playerX, playerY, 0.1, drawArea, colour);
  }

  private drawCircle(
    xc: number,
    yc: number,
    size: number,
    drawArea: { x1: number; y1: number; x2: number; y2: number },
    colour: string,
  ) {
    let p1 = this.getMapDrawPosition(xc, yc, drawArea);
    let ellipse = this.getMapDrawPosition(size, size, drawArea, true);
    this.canvas.context.fillStyle = colour;
    this.canvas.context.beginPath();
    this.canvas.context.ellipse(p1.x, p1.y, ellipse.x, ellipse.y, 0, 0, 2 * Math.PI);
    this.canvas.context.fill();
    this.canvas.context.closePath();
  }

  private drawCollisionRays(
    playerX: number,
    playerY: number,
    playerR: number,
    drawArea: { x1: number; y1: number; x2: number; y2: number },
  ) {
    // get collision data
    let collisionMap = this.map.buildCollisionMap(playerX, playerY);
    let collisionSize = collisionMap.length;
    let collisionMapScale = 4;

    // draw this map centered on the players map element
    let mapX = Math.floor(playerX);
    let mapY = Math.floor(playerY);

    let mapColour = '#ff999966';

    let blockSize = this.getMapDrawPosition(
      1,
      1,
      drawArea,
      true,
      this.map.mapSize * collisionMapScale,
    );
    for (let x = 0; x < collisionSize; x++) {
      let row = collisionMap[x];
      for (let y = 0; y < collisionSize; y++) {
        let block = row[y];
        if (block.type === BlockType.Wall) {
          this.canvas.context.fillStyle = mapColour;
          this.canvas.context.beginPath();
          let topLeft = this.getMapDrawPosition(
            x + (mapX - 1) * collisionMapScale,
            y + (mapY - 1) * collisionMapScale,
            drawArea,
            false,
            this.map.mapSize * collisionMapScale,
          );
          this.canvas.context.fillRect(topLeft.x, topLeft.y, blockSize.x, blockSize.y);
          this.canvas.context.stroke();
        }
      }
    }

    // Draw border so it's easier to understand
    let drawTL = this.getMapDrawPosition(
      (mapX - 1) * collisionMapScale,
      (mapY - 1) * collisionMapScale,
      drawArea,
      false,
      this.map.mapSize * collisionMapScale,
    );
    let drawBL = this.getMapDrawPosition(
      collisionSize,
      collisionSize,
      drawArea,
      true,
      this.map.mapSize * collisionMapScale,
    );
    this.canvas.context.strokeStyle = 'black';
    this.canvas.context.beginPath();
    this.canvas.context.rect(drawTL.x, drawTL.y, drawBL.x, drawBL.y);
    this.canvas.context.stroke();
    this.canvas.context.closePath();

    // Fire a ray into this using this player position in the ray
    let movementAmount = 1.0;
    let colX = collisionMapScale * (1 + mod(playerX, 1));
    let colY = collisionMapScale * (1 + mod(playerY, 1));
    let rayX = Math.cos(playerR) * movementAmount * collisionMapScale;
    let rayY = Math.sin(playerR) * movementAmount * collisionMapScale;

    // Do one ray, then do another
    // and at the end we don't care about the actual rayResults, we care about the difference between start and end
    // divided by 4 of course
    let rayResult1 = this.rays.capRay(this.rays.castRay(colX, colY, rayX, rayY, collisionMap));
    let rayResult2: RayResult | null = null;

    // If we have ray left, we should do a second ray
    let secondRay = rayResult1.distance < 1.0;

    if (secondRay) {
      // Do the test a little further back, so we don't just collide with the next square
      rayResult2 = this.rays.capRay(this.rays.slideRay(rayResult1, collisionMap));
    }
    rayResult1.yHit = rayResult1.yHit / 4.0 - 1 + mapX;
    rayResult1.xa = rayResult1.xa / 4.0 - 1 + mapX;
    rayResult1.ya = rayResult1.ya / 4.0 - 1 + mapY;
    rayResult1.distance = rayResult1.distance / 4.0;

    this.drawRay(drawArea, rayResult1, 'red');

    if (rayResult2) {
      rayResult2.xHit = rayResult2.xHit / 4.0 - 1 + mapX;
      rayResult2.yHit = rayResult2.yHit / 4.0 - 1 + mapX;
      rayResult2.xa = rayResult2.xa / 4.0 - 1 + mapX;
      rayResult2.ya = rayResult2.ya / 4.0 - 1 + mapY;
      rayResult2.distance = rayResult2.distance / 4.0;
      this.drawRay(drawArea, rayResult2, 'green');
    }
  }

  private drawBlocks(drawArea: { x1: number; y1: number; x2: number; y2: number }) {
    let map = this.map.mapData;

    let mapColour = this.blockColour;

    let blockSize = this.getMapDrawPosition(1, 1, drawArea, true);
    for (let x = 0; x < this.map.mapSize; x++) {
      let row = map[x];
      for (let y = 0; y < this.map.mapSize; y++) {
        let block = row[y];
        if (block.type === BlockType.Wall) {
          this.canvas.context.fillStyle = mapColour;
          this.canvas.context.beginPath();
          let topLeft = this.getMapDrawPosition(x, y, drawArea);
          this.canvas.context.fillRect(topLeft.x, topLeft.y, blockSize.x, blockSize.y);
          this.canvas.context.stroke();
        } else if (block.type === BlockType.XWall) {
          let left = this.getMapDrawPosition(x, y + 0.5, drawArea);
          let right = this.getMapDrawPosition(x + 1.0, y + 0.5, drawArea);
          this.drawLine(left, right, mapColour);
        } else if (block.type === BlockType.YWall) {
          let left = this.getMapDrawPosition(x + 0.5, y, drawArea);
          let right = this.getMapDrawPosition(x + 0.5, y + 1.0, drawArea);
          this.drawLine(left, right, mapColour);
        }
      }
    }

    // Draw border
    this.canvas.context.strokeStyle = 'black';
    this.canvas.context.beginPath();
    this.canvas.context.rect(
      drawArea.x1,
      drawArea.y1,
      drawArea.x2 - drawArea.x1,
      drawArea.y2 - drawArea.y1,
    );
    this.canvas.context.stroke();
    this.canvas.context.closePath();
  }

  private getDrawArea() {
    // Get the aspect ratio and use that, scale it up till it fits in the canvas

    // how many x and y fit into the real canvas
    const xRatio = this.canvas.dataAspectRatio / this.canvas.aspectRatio;
    const yRatio = 1;

    // how many vertical multiply?
    const yMultiply = this.canvas.height / yRatio;
    const xMultiply = this.canvas.width / xRatio;
    const multiply = Math.min(xMultiply, yMultiply);

    // Which is the smallest?
    const xSize = xRatio * multiply;
    const ySize = yRatio * multiply;

    // move to center
    const xGap = Math.max(0, (this.canvas.width - xSize) / 2.0);
    const yGap = Math.max(0, (this.canvas.height - ySize) / 2.0);

    return { x1: xGap, y1: yGap, x2: xSize + xGap, y2: ySize + yGap };
  }

  private getMapDrawPosition(
    x: number,
    y: number,
    drawArea: { x1: number; y1: number; x2: number; y2: number },
    scaleOnly = false,
    mapSize = this.map.mapSize,
  ) {
    // Work out the percentage of this X from the bounding box
    let xMult = x / mapSize;
    let yMult = y / mapSize;

    let xVal = (drawArea.x2 - drawArea.x1) * xMult;
    let yVal = (drawArea.y2 - drawArea.y1) * yMult;

    if (scaleOnly) {
      xVal += 1;
      yVal += 1;
    } else {
      xVal += drawArea.x1;
      yVal += drawArea.y1;
    }

    return { x: xVal, y: yVal };
  }
}
