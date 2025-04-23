import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RaycasterCanvas } from './utilities/raycaster-canvas';
import { BlockType, RaycasterMap } from './utilities/raycaster-map';
import { mod } from './utilities/raycaster-math';
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
  mapSize = 16;
  drawMap = false;

  // Player position
  playerX = 0.5 + this.mapSize / 2.0;
  playerY = 0.5 + this.mapSize / 2.0;
  playerZ = 0.6;
  playerR = 0.0;
  playerV = 0.0;

  // Controls
  mouseX = 0;
  mouseY = 0;
  keyup = false;
  keydown = false;
  keyleft = false;
  keyright = false;

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

  // Timing
  timeDelta = 0;
  timeLast = new Date().getTime();
  timeRate = 0;
  timeMin = 26; // 33 for Approx 30FPS, 15 for about 60, 13 for 75, 26 for half rate
  stillDrawing = false;

  constructor() {}

  ngAfterViewInit(): void {
    this.initGame().then(() => {
      // now that it's loaded, we can make a repeated event to keep triggering
      setInterval(this.drawLoop, 1);
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
            this.canvas,
            this.rays,
            this.textures,
          );
          resolve();
        })
        .catch(() => {
          reject();
        });
    });
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
      }
    });
  }

  private drawLoop = () => {
    // current time
    const timeNow = new Date().getTime();

    // cap framerate and don't start drawing until the last is done
    const timeDelta = timeNow - this.timeLast;
    if (!this.stillDrawing && timeDelta >= this.timeMin) {
      this.stillDrawing = true;

      // time since last frame (delta time)
      this.timeDelta = timeDelta;
      this.timeLast = timeNow;
      this.timeRate = Math.floor(1000.0 / this.timeDelta);

      this.handleInput();
      this.gameLogic();

      // Start drawing
      this.canvas.startDraw(); // fix canvas size and ratio

      // Render 3d scene
      this.renderer3d.drawScene(
        this.playerX,
        this.playerY,
        this.playerZ,
        this.playerR,
        this.playerV,
      );

      // Only want to do this if we are drawing the image with imageData
      this.canvas.finishDraw();

      // Draw map on top of anything drawn
      if (this.drawMap) {
        this.renderer2d.drawMap(this.playerX, this.playerY, this.playerR);
      }

      this.stillDrawing = false;
    }
  };

  handleInput() {
    // Keyboard movement
    let forwardSpeed = 0;
    let turnSpeed = 0;
    if (this.keyup) {
      forwardSpeed += 1;
    }
    if (this.keydown) {
      forwardSpeed -= 1;
    }
    if (this.keyright) {
      turnSpeed += 1;
    }
    if (this.keyleft) {
      turnSpeed -= 1;
    }

    this.playerR += turnSpeed * 0.0025 * this.timeDelta;
    this.playerV = -this.mouseY;

    if (forwardSpeed !== 0) {
      this.movePlayer(forwardSpeed);
    }
  }

  // Use the rays to figure out how far the player should move
  private movePlayer(forwardSpeed: number) {
    // get collision data
    let collisionMap = this.map.buildCollisionMap(this.playerX, this.playerY);
    let collisionMapScale = 4;

    // Fire a ray into this using this player position in the ray
    // But move them back a bit so we don't just go through corners... geez!
    let movementAmount = this.timeDelta * forwardSpeed * 0.0025;
    let rayX = Math.cos(this.playerR) * movementAmount * collisionMapScale;
    let rayY = Math.sin(this.playerR) * movementAmount * collisionMapScale;
    let colX = collisionMapScale * (1 + mod(this.playerX, 1));
    let colY = collisionMapScale * (1 + mod(this.playerY, 1));

    // Do one ray, then do another
    // and at the end we don't care about the actual rayResults, we care about the difference between start and end
    // divided by 4 of course
    let rayResult1 = this.rays.capRay(this.rays.castRay(colX, colY, rayX, rayY, collisionMap));
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
  }

  private gameLogic() {
    // Logic of doors
    this.map.updateDoors(this.timeDelta, Math.floor(this.playerX), Math.floor(this.playerY))
  }

  doAction() {
    // find action from player position by doing a ray from the player and seeing what we hit
    let rayX = Math.cos(this.playerR);
    let rayY = Math.sin(this.playerR);
    let actionResult = this.rays.castRay(this.playerX, this.playerY, rayX, rayY, this.map.mapData);

    // If we got anything back - check before doing anything
    if (actionResult.mapCoords.length > 0) {
      // Get the last mapCoord, where our ray hit
      let actionCoord = actionResult.mapCoords[actionResult.mapCoords.length - 1];
      if (
        actionResult.distance < 1.25 &&
        (actionCoord.type === BlockType.XDoor || actionCoord.type === BlockType.YDoor)
      ) {
        // found a door!
        console.log('got a door at ' + actionCoord.x + ', ' + +actionCoord.y);

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
