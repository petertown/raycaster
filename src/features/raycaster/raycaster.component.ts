import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RaycasterCanvas } from './utilities/raycaster-canvas';
import { RaycasterMap } from './utilities/raycaster-map';
import { RaycasterRays } from './utilities/raycaster-ray';
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

  // Real size of screen (for aspect ratio calculations)
  renderWidth = 320;
  renderHeight = 200;
  displayWidth = 640;
  displayHeight = 480;
  displayRatio = 640.0 / 480.0;

  // Player position
  playerX = this.mapSize / 2.0;
  playerY = this.mapSize / 2.0;
  playerZ = 0.5;
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
  textures: RaycasterTextures;

  // Timing
  timeDelta = 0;
  timeLast = new Date().getTime();
  timeRate = 0;
  timeMin = 33; // 33 for Approx 30FPS, 15 for about 60
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
      const timeStart = new Date().getTime();

      this.canvas = new RaycasterCanvas();
      this.map = new RaycasterMap(this.mapSize);
      this.rays = new RaycasterRays(this.map);
      this.renderer2d = new RaycasterRenderer2D(this.map, this.canvas, this.rays);
      this.renderer3d = new RaycasterRenderer3D(this.map, this.canvas, this.rays);
      this.textures = new RaycasterTextures();

      this.initControls();

      const timeEnd = new Date().getTime();
      const timeDelta = timeEnd - timeStart;
      console.log('init time: ' + timeDelta);

      resolve();
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
    this.playerZ = (0.2 * -this.mouseY + 1.0) / 2.0;

    this.playerX += Math.cos(this.playerR) * forwardSpeed * 0.0025 * this.timeDelta;
    this.playerY += Math.sin(this.playerR) * forwardSpeed * 0.0025 * this.timeDelta;
  }

  private gameLogic() {
    // Do the logic of other creatures here
    // this.playerR += 0.001 * this.timeDelta;
  }
}
