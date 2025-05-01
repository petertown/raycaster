import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { mod } from './utilities/functions-math';
import { castRay } from './utilities/functions-rays';
import { RaycasterCanvas } from './utilities/raycaster-canvas';
import { BlockType, RaycasterMap } from './utilities/raycaster-map';
import { RaycasterRays, RayResult } from './utilities/raycaster-ray';
import { RaycasterRenderer2D } from './utilities/raycaster-renderer-2d';
import { RaycasterRenderer3D } from './utilities/raycaster-renderer-3d';
import { RaycasterTextures } from './utilities/raycaster-textures';

@Component({
  selector: 'app-raycaster',
  imports: [ReactiveFormsModule],
  templateUrl: './raycaster.component.html',
  styleUrl: './raycaster.component.scss',
})
export class RaycasterComponent {
  // Handle the form for configuring and store the canvas, get the image from the game render to draw here

  // Canvas
  canvas!: RaycasterCanvas;

  // Game settings
  mapSize = 32;
  drawMap = false;

  // Player position
  playerX = 0.5 + this.mapSize / 2.0;
  playerY = 0.5 + this.mapSize / 2.0;
  playerZ = 0.6;
  playerR = 0.0;
  playerV = 0.0;
  playerXS = 0.0;
  playerYS = 0.0;
  playerSpeed = 0.0;

  // Render position (Based on player)
  renderX = 0.5 + this.mapSize / 2.0;
  renderY = 0.5 + this.mapSize / 2.0;
  renderZ = 0.5;
  renderR = 0.0;
  renderV = 0.0;
  renderWalkTime = 0.0;

  // Controls
  mouseX = 0;
  mouseY = 0;
  keyup = false;
  keydown = false;
  keyleft = false;
  keyright = false;
  keystrafeleft = false;
  keystraferight = false;
  forwardSpeed = 0.0;
  strafeSpeed = 0.0;
  turnSpeed = 0.0;

  // Components
  // Rendering target
  // Map/game board
  map!: RaycasterMap;
  // 2D renderer (Make this first! I just want to get my ray casting to be accurate)
  renderer2d!: RaycasterRenderer2D;
  // 3D Renderer
  renderer3d!: RaycasterRenderer3D;
  // Ray utility class
  rays!: RaycasterRays;
  // Texture utility
  textures!: RaycasterTextures;
  // Web worker to offload to another thread
  private worker!: Worker;

  // Timing
  timeDelta = 0;
  timeNow = 0;
  timeLast = new Date().getTime();
  timeMin = 13; // 33 for Approx 30FPS, 15 for about 60, 13 for 75, 26 for half rate
  stillDrawing = true;
  frameTimes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // last ten frames time
  frameRate = 0;
  raysCast = 0;

  constructor() {}

  ngAfterViewInit(): void {
    this.initGame().then(() => {
      // now that it's loaded, we can make a repeated event to keep triggering
      setInterval(this.renderLoop, 1);
    });
  }

  private initGame(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.canvas = new RaycasterCanvas();
      this.rays = new RaycasterRays();
      this.textures = new RaycasterTextures();

      this.initControls();

      // Last step, load the textures in, which is async and when it's done we'll start the game loop
      this.loadTextures()
        .then(() => {
          this.map = new RaycasterMap(this.mapSize, this.textures);
          this.renderer2d = new RaycasterRenderer2D(this.map, this.canvas, this.rays);
          this.renderer3d = new RaycasterRenderer3D(
            this.map,
            this.rays,
            this.textures,
            this.canvas.width,
            this.canvas.height,
          );

          this.initWorker();

          resolve();
        })
        .catch(() => {
          reject();
        });
    });
  }

  private initWorker() {
    // start with "stillDrawing" true so it wont try and draw until worker is free
    this.stillDrawing = true;

    if (typeof Worker !== 'undefined') {
      // Create a new
      this.worker = new Worker(new URL('./utilities/raycaster.worker', import.meta.url));

      this.worker.onmessage = ({ data }) => {
        if (data.messageType === 'draw') {
          // data is {raysCast: number, target: ImageData}
          this.raysCast = data.raysCast;

          // Swap to the other render target, so we can start drawing there
          this.canvas.finishDraw(data.target);

          this.canvas.screenDraw();

          // Draw map on top of anything drawn
          if (this.drawMap) {
            this.renderer2d.drawMap(this.playerX, this.playerY, this.playerR);
          }

          // draw FPS
          this.canvas.context.fillStyle = 'white';
          this.canvas.context.font = '10px Arial';
          this.canvas.context.fillText('MS: ' + this.frameRate, 2, 10);
          this.canvas.context.fillText('FPS: ' + Math.round(1000.0 / this.frameRate), 2, 20);
          this.canvas.context.fillText('RAYS: ' + this.raysCast, 2, 30);
          this.canvas.context.fillText(
            'RPP: ' +
              Math.floor((100 * this.raysCast) / (this.canvas.width * this.canvas.height)) / 100.0,
            2,
            40,
          );

          const endRenderTime = new Date().getTime();
          const renderTime = endRenderTime - this.timeLast;

          // average all last 10 frames time
          this.frameRate =
            this.frameTimes.reduce((previousValue: number, currentValue: number) => {
              return previousValue + currentValue;
            }, 0) / 10.0;
          this.frameTimes.shift(); // remove oldest time
          this.frameTimes.push(renderTime); // push newest time
        } else if (data.messageType === 'init') {
          // Probably don't need anything here
        }
        this.stillDrawing = false;
      };

      // init the worker
      this.worker.postMessage({
        messageType: 'init',
        map: this.map,
        textures: this.textures,
        target: this.canvas.target,
        renderWidth: this.canvas.width,
        renderHeight: this.canvas.height,
      });
    } else {
      // Web Workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
      // So we could keep the old methods and use that loop instead of the new loop for a fallback?
    }
  }

  private loadTextures(): Promise<void> {
    return new Promise((resolve, reject) => {
      Promise.all([
        this.textures.loadTexture('wolfwall', '/textures/walls/texture_wall_lit.png', 64, 64),
        this.textures.loadTexture('wolfwood1', '/textures/walls/wolfwood1.png', 64, 64),
        this.textures.loadTexture('wolfwood2', '/textures/walls/wolfwood2.png', 64, 64),
        this.textures.loadTexture('wolfwood3', '/textures/walls/wolfwood3.png', 64, 64),
        this.textures.loadTexture('wolfwood4', '/textures/walls/wolfwood4.png', 64, 64),
        this.textures.loadTexture('wolfwood5', '/textures/walls/wolfwood5.png', 64, 64),
        this.textures.loadTexture('wolfdoor', '/textures/walls/door.png', 64, 64),
        this.textures.loadTexture('wolfdoorside', '/textures/walls/door_side.png', 64, 64),
        this.textures.loadTexture('tilefloor', '/textures/floors/texture_floor_tile.png', 64, 64),
        this.textures.loadTexture('grassfloor', '/textures/floors/texture_floor_grass.png', 64, 64),
        this.textures.loadTexture('light', '/textures/sprites/light.png', 64, 64),
        this.textures.loadTexture('goblin', '/textures/sprites/goblin.png', 64, 64),
        this.textures.loadTexture('white1', '/textures/sprites/white1.png', 64, 64),
        this.textures.loadTexture('white2', '/textures/sprites/white2.png', 64, 64),
        this.textures.loadTexture('white3', '/textures/sprites/white3.png', 64, 64),
        // Slowely replace those with some proper textures
        this.textures.loadTexture('FLATSTONES', '/textures/Rocks/FLATSTONES.png', 32, 32),
        this.textures.loadTexture('DIRT', '/textures/Rocks/DIRT.png', 32, 32),
        this.textures.loadTexture('GRAYROCKS', '/textures/Rocks/GRAYROCKS.png', 32, 32),
        this.textures.loadTexture('BRICKS', '/textures/BuildingTextures/BRICKS.png', 32, 32),
        this.textures.loadTexture('DUNGEONBRICKS', '/textures/Bricks/DUNGEONBRICKS.png', 32, 32),
        this.textures.loadTexture('DUNGEONCELL', '/textures/Bricks/DUNGEONCELL.png', 32, 32),
      ])
        .then(() => {
          resolve();
        })
        .catch(() => {
          reject();
        });
    });
  }

  initControls() {
    this.canvas.element.onmousemove = (event) => {
      // subtract the offsetX and Y from the real canvas size and make mouse from -1 to 1
      this.mouseX = 2.0 * (event.offsetX / this.canvas.realWidth - 0.5);
      this.mouseY = 2.0 * (event.offsetY / this.canvas.realHeight - 0.5);
    };

    this.canvas.element.addEventListener('keydown', (e: KeyboardEvent) => {
      switch (e.key) {
        case 'w':
          this.keyup = true;
          break;
        case 's':
          this.keydown = true;
          break;
        case 'a':
          this.keyleft = true;
          break;
        case 'd':
          this.keyright = true;
          break;
        case 'q':
          this.keystrafeleft = true;
          break;
        case 'e':
          this.keystraferight = true;
          break;
        case 'm':
          this.drawMap = !this.drawMap;
          break;
        case 'f':
          this.canvas.fullscreen(); // doesn't really work
          break;
        case ' ': // space key
          this.doAction();
          break;
      }
    });

    this.canvas.element.addEventListener('keyup', (e: KeyboardEvent) => {
      switch (e.key) {
        case 'w':
          this.keyup = false;
          break;
        case 's':
          this.keydown = false;
          break;
        case 'a':
          this.keyleft = false;
          break;
        case 'd':
          this.keyright = false;
          break;
        case 'q':
          this.keystrafeleft = false;
          break;
        case 'e':
          this.keystraferight = false;
          break;
      }
    });
  }

  private readonly renderLoop = () => {
    // current time
    this.timeNow = new Date().getTime();

    // cap framerate and don't start drawing until the last is done
    const timeDelta = this.timeNow - this.timeLast;
    if (!this.stillDrawing && timeDelta >= this.timeMin) {
      this.stillDrawing = true;

      // time since last frame (delta time)
      this.timeDelta = timeDelta;
      this.timeLast = this.timeNow;

      this.handleInput();
      this.gameLogic();

      // Start drawing
      this.canvas.startDraw(); // fix canvas size and ratio

      // Send the worker off to do the drawing
      // Also, send the updates to the map (not the entire map)
      this.worker.postMessage({
        messageType: 'draw',
        playerX: this.renderX,
        playerY: this.renderY,
        playerZ: this.renderZ,
        playerR: this.renderR,
        playerV: this.renderV,
        aspectRatio: this.canvas.aspectRatio,
        projectionLength: this.canvas.projectionLength,
        updatedMapData: this.map.getUpdatedMapData(),
      });
    }
  };

  handleInput() {
    // Keyboard movement
    this.forwardSpeed = 0;
    this.turnSpeed = 0;
    this.strafeSpeed = 0;
    if (this.keyup) {
      this.forwardSpeed += 1;
    }
    if (this.keydown) {
      this.forwardSpeed -= 1;
    }
    if (this.keyright) {
      this.turnSpeed += 1;
    }
    if (this.keyleft) {
      this.turnSpeed -= 1;
    }
    if (this.keystrafeleft) {
      this.strafeSpeed -= 1;
    }
    if (this.keystraferight) {
      this.strafeSpeed += 1;
    }

    let verticalLook = true;

    this.playerR += this.turnSpeed * 0.0025 * this.timeDelta;
    this.playerV = verticalLook ? -this.mouseY : 0.0;

    // if (this.forwardSpeed !== 0 || this.strafeSpeed !== 0) {
      this.movePlayer(this.forwardSpeed, this.strafeSpeed);
    // }
  }

  // Use the rays to figure out how far the player should move
  private movePlayer(forwardSpeed: number, strafeSpeed: number) {
    // get collision data
    const collisionMap = this.map.buildCollisionMap(this.playerX, this.playerY);
    const collisionMapScale = 4;

    // Fire a ray into this using this player position in the ray
    // But move them back a bit so we don't just go through corners... geez!
    const forwardAmount = forwardSpeed;
    const strafeAmount = strafeSpeed;

    // Adjust the players speed down for friction
    const friction = 0.9;
    const acceleration = 0.00125;
    this.playerXS *= friction;
    this.playerYS *= friction;
    // Add any new speed the player wants
    this.playerXS +=
      this.timeDelta *
      acceleration *
      (Math.cos(this.playerR) * forwardAmount +
        Math.cos(this.playerR + Math.PI / 2.0) * strafeAmount);
    this.playerYS +=
      this.timeDelta *
      acceleration *
      (Math.sin(this.playerR) * forwardAmount +
        Math.sin(this.playerR + Math.PI / 2.0) * strafeAmount);

    // Make a ray that's a normalised length
    /* let rayX =
      Math.cos(this.playerR) * forwardAmount +
      Math.cos(this.playerR + Math.PI / 2.0) * strafeAmount;
    let rayY =
      Math.sin(this.playerR) * forwardAmount +
      Math.sin(this.playerR + Math.PI / 2.0) * strafeAmount;
    const rayLength = Math.sqrt(rayX * rayX + rayY * rayY);
    rayX = this.timeDelta * (rayX / rayLength) * 0.0025 * collisionMapScale;
    rayY = this.timeDelta * (rayY / rayLength) * 0.0025 * collisionMapScale; */

    let rayX = this.playerXS;
    let rayY = this.playerYS;
    this.playerSpeed = Math.sqrt(rayX * rayX + rayY * rayY);
    this.renderWalkTime += this.playerSpeed;

    let colX = collisionMapScale * (1 + mod(this.playerX, 1));
    let colY = collisionMapScale * (1 + mod(this.playerY, 1));

    // Do one ray, then do another
    // and at the end we don't care about the actual rayResults, we care about the difference between start and end
    // divided by 4 of course
    let rayResult1 = this.rays.capRay(castRay(colX, colY, rayX, rayY, collisionMap, false));
    let differenceX = rayResult1.xHit - colX;
    let differenceY = rayResult1.yHit - colY;

    let rayResult2: RayResult | null = null;

    // If we have ray left, we should do a second ray
    if (rayResult1.distance < 1.0) {
      // Do the test a little further back, so we don't just collide with the next square
      rayResult2 = this.rays.capRay(this.rays.slideRay(rayResult1, collisionMap));
      differenceX = rayResult2.xHit - colX;
      differenceY = rayResult2.yHit - colY;
    }

    this.playerX += differenceX / 4.0;
    this.playerY += differenceY / 4.0;

    this.playerXS = differenceX;
    this.playerYS = differenceY;
  }

  private gameLogic() {
    // Logic of doors
    this.map.updateDoors(this.timeDelta, Math.floor(this.playerX), Math.floor(this.playerY));

    // Do walking animation
    this.renderX = this.playerX;
    this.renderY = this.playerY;
    this.renderZ = this.playerZ + Math.cos(this.renderWalkTime) * 0.2 * this.playerSpeed;
    this.renderR = this.playerR;
    this.renderV = this.playerV;
  }

  doAction() {
    // find action from player position by doing a ray from the player and seeing what we hit
    let rayX = Math.cos(this.playerR);
    let rayY = Math.sin(this.playerR);
    let actionResult = castRay(this.playerX, this.playerY, rayX, rayY, this.map.mapData, false);

    // If we got anything back - check before doing anything
    if (actionResult.mapCoords.length > 0) {
      // Get the last mapCoord, where our ray hit
      let actionCoord = actionResult.mapCoords[actionResult.mapCoords.length - 1];
      if (
        actionResult.distance < 1.25 &&
        (actionCoord.type === BlockType.XDoor || actionCoord.type === BlockType.YDoor)
      ) {
        // found a door!
        // Find the door element for this one - bit messy
        let door = this.map.getDoor(actionCoord);
        if (door) {
          door.timeOpened = 0;
          door.isOpen = true;
        }
      }
    }
  }
}
