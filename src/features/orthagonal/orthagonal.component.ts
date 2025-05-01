import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

interface MapElement {
  // todo: change to use this instead of "texture" etc, and have a "dark side" tex and a "lit side" tex
}

interface MapCoord {
  x: number; // x position on map
  y: number; // y position on map
  type: number; // 0 wall, 1 empty, 2 halfwall X, 3 halfwall Y (I might get these wrong order)
  wallTexture: number; // index of texture for wall
  floorTexture: number; // index of texture for floor
  passable: boolean; // should we collide with it?
  sprite: number; // index of texture for the sprite to draw here
}

// format of ray response
interface RayResult {
  distance: number;
  rayX: number;
  rayY: number;
  textureCoord: number; //coordinate of texture (should we wrap it here?)
  wallX: boolean; // deprecate this, and just darken the texture on the opposite sides in the lighting function?
  edge: boolean;
  mapCoords: MapCoord[]; // make a list of EVERY square we went through so we can draw the "static" sprites in those sections
  // and it also orders them nicely for us, so we can draw back to front
  // and allows us to also draw the "half walls" in order too
  // The last one is the texture to be drawn to the wall it finds (unless the previous wall was a half wall, in which case we use that texture)
  // It might also help with the floor texturing but we'll worry about that later
}

interface Colour {
  red: number;
  green: number;
  blue: number;
}

interface Light {
  x: number;
  y: number;
  red: number;
  green: number;
  blue: number;
  radius: number;
}

@Component({
  selector: 'app-orthagonal',
  imports: [ReactiveFormsModule],
  templateUrl: './orthagonal.component.html',
  styleUrl: './orthagonal.component.scss',
})
export class OrthagonalComponent {
  // Settings
  protected canvasWidth = 320;
  protected canvasHeight = 200;
  private playerHeight = 0.5;
  private hovertankShearing = 0.0;
  private monoLit = false;
  private smallLit = false;
  private mapSize = 32;
  private lightSize = 30;

  // If it fails to load
  error = false;
  errorMessage = '';

  // Timing
  timeDelta = 0;
  timeLast = new Date().getTime();
  timeRate = 0;
  timeMin = 30;
  stillDrawing = false;

  // Config
  formPerspective = new FormControl(true, { nonNullable: true });
  formPerspectiveSkew = new FormControl(false, { nonNullable: true });
  formWallTextures = new FormControl(false, { nonNullable: true });
  formFloorTextures = new FormControl(false, { nonNullable: true });
  formSkyTexture = new FormControl(false, { nonNullable: true });
  formVerticalLook = new FormControl(false, { nonNullable: true });
  formWallHeight = new FormControl(1, { nonNullable: true });
  formLighting = new FormControl(false, { nonNullable: true });
  formHovertank = new FormControl(false, { nonNullable: true });

  // controls
  mouseX = 0;
  mouseY = 0;
  keyup = false;
  keydown = false;
  keyleft = false;
  keyright = false;

  // canvas
  private canvas!: HTMLCanvasElement;
  private canvasContext!: CanvasRenderingContext2D;

  // ALL TEXTURES SHOULD BE SAME SIZE - CURRENTLY 64X64, always square
  private textureSize = 64;
  // Except skies of course
  private skyTextureWidth = 256;
  private skyTextureHeight = 400;
  // List of images - use ".data" to get the raw data
  private textures!: ImageData[];
  private specialTextures!: ImageData[];

  // Lighting config
  private ambientColour: Colour = {
    red: 64,
    green: 41,
    blue: 12,
  };
  private playerLightColour: Colour = {
    red: 255,
    green: 255,
    blue: 255,
  };

  // Render settings
  private wallHeight = 1.0; // Like ROTT style walls
  private skyYScale = 3.0; // How much to extend the sky
  private skyXScale = 3.0; // how much to scale the X texture of the sky
  private projectionWidth = 640.0 / 400.0; // aspect ratio! Whew
  private projectionDistance = 1.0; // Probably 1, but it really makes a fun effect, it's like a weird FOV effect
  private verticalLookMax = 400; // How much to slide the screen up or down for fake vertical look

  // For calculating if we need to change
  private realCanvasWidth = 640;
  private realCanvasHeight = 480;

  // Map is just going to be a 2D array, later could be better but for now get it to work
  private map: MapCoord[][] = [];
  private lights: Light[] = [];

  // Player will just be position and angle
  playerX = 0.0;
  playerY = 0.0;
  playerAngle = 0.0; // probably radians
  playerVertical = 0.0; // How much vertical look from -1 to 1

  // Draw from a slightly modified angle
  renderX = 0.0;
  renderY = 0.0;
  renderAngle = 0.0; // probably radians
  renderVertical = 0.0; // How much vertical look from -1 to 1

  ngAfterViewInit(): void {
    this.initGame().then(() => {
      // now that it's loaded, we can make a repeated event to keep triggering
      setInterval(this.drawLoop, 1);
    });
  }

  drawLoop = () => {
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
      this.sizeCanvas();
      this.drawScreen();

      this.stillDrawing = false;
    }
  };

  initGame(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.initCanvas()) {
        this.error = true;
        this.errorMessage = 'Canvas could not be init';
        reject();
      }

      if (!this.initMap()) {
        this.error = true;
        this.errorMessage = 'Map failed to generate';
        reject();
      }

      // We have made the canvas so we can try and load the texture
      this.loadTextures()
        .then(() => {
          this.clearCanvas();
          this.initControls();
          resolve();
        })
        .catch(() => {
          reject();
        });
    });
  }

  initControls() {
    this.canvas.onmousemove = (event) => {
      // subtract the offsetX and Y from the real canvas size and make mouse from -1 to 1
      this.mouseX = 2.0 * (event.offsetX / this.realCanvasWidth - 0.5);
      this.mouseY = 2.0 * (event.offsetY / this.realCanvasHeight - 0.5);
    };

    this.canvas.addEventListener('keydown', (e: KeyboardEvent) => {
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
      }
    });

    this.canvas.addEventListener('keyup', (e: KeyboardEvent) => {
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

  private initCanvas() {
    const canvasElement = document.getElementById('orthagonal-canvas') as HTMLCanvasElement;

    if (canvasElement) {
      const canvasContext = canvasElement.getContext('2d', { willReadFrequently: true });

      if (canvasContext) {
        this.canvas = canvasElement;
        this.canvasContext = canvasContext;
        return true;
      }
    }
    return false;
  }

  initMap(): boolean {
    const halfSize = this.mapSize / 2;
    for (let x = 0; x < this.mapSize; x++) {
      const row: MapCoord[] = [];
      for (let y = 0; y < this.mapSize; y++) {
        let type = 1;
        let passable = true;

        // possible make a wall if there's a gap of greater than 10 from the center
        const changeX = x - halfSize;
        const changeY = y - halfSize;
        const distance = Math.sqrt(changeX * changeX + changeY * changeY);

        if (distance > 6) {
          let wall = Math.random() > 1.0 - distance / halfSize;
          if (wall) {
            type = 0;
            passable = false;
          }
        } else if (Math.abs(x - halfSize) === 2 && Math.abs(y - halfSize) === 0) {
          type = 3;
        } else if (Math.abs(x - halfSize) === 0 && Math.abs(y - halfSize) === 2) {
          type = 2;
        } else if (Math.abs(x - halfSize) === 2 || Math.abs(y - halfSize) === 2) {
          type = 0;
          passable = false;
        }

        let wallTextureId = 0;
        let floorTextureId = Math.random() > 0.5 ? 2 : 4;

        if (type === 2 || type === 3) {
          wallTextureId = 5;
        }

        let mapCoord: MapCoord = {
          x: x,
          y: y,
          type: type,
          wallTexture: wallTextureId,
          floorTexture: floorTextureId,
          passable: passable,
          sprite: 0,
        };

        row.push(mapCoord);
      }
      this.map.push(row);
    }

    // randomly make lights
    for (let lightIdx = 0; lightIdx < this.lightSize; lightIdx++) {
      let clash = true;
      let tryidx = 0;
      let lightX = 0;
      let lightY = 0;
      while (clash) {
        lightX = Math.floor(Math.random() * this.mapSize);
        lightY = Math.floor(Math.random() * this.mapSize);
        if (this.map[lightX][lightY].passable) {
          clash = false;
        }
        tryidx++;
        if (tryidx > 100) {
          clash = false;
        }
      }

      this.lights.push({
        x: lightX + 0.5,
        y: lightY + 0.5,
        red: Math.floor(255 * Math.random()),
        green: Math.floor(255 * Math.random()),
        blue: Math.floor(255 * Math.random()),
        radius: Math.random() * 7 + 1,
      });
    }

    this.playerX = halfSize + 0.5;
    this.playerY = halfSize + 0.5;

    return true;
  }

  private loadTextures(): Promise<void> {
    return new Promise((resolve, reject) => {
      Promise.all([
        this.loadTexture('/textures/walls/texture_wall_lit.png', 64, 64),
        this.loadTexture('/textures/walls/texture_wall_dark.png', 64, 64),
        this.loadTexture('/textures/floors/texture_floor_tile.png', 64, 64),
        this.loadTexture('/textures/skies/sky_rott.png', 256, 400),
        this.loadTexture('/textures/floors/texture_floor_grass.png', 64, 64),
        this.loadTexture('/textures/half/texture_half_arch.png', 64, 64),
      ])
        .then((textures) => {
          this.textures = textures;

          resolve();
        })
        .catch(() => {
          reject();
        });
    });
  }

  private loadTexture(fileName: string, width: number, height: number): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const textureImage = new Image();
      textureImage.src = fileName;
      textureImage.addEventListener('load', () => {
        // we need to make this a canvas, so we can pick colours from it

        const textureCanvas = document.createElement('canvas');
        textureCanvas.width = textureImage.width;
        textureCanvas.height = textureImage.height;
        const textureContext = textureCanvas.getContext('2d');

        if (textureContext) {
          textureContext.drawImage(textureImage, 0, 0);
          // Return the raw data of that to use later
          resolve(textureContext.getImageData(0, 0, width, height));
        } else {
          reject();
        }
      });
    });
  }

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

    this.playerAngle += turnSpeed * 0.0025 * this.timeDelta;
    this.renderAngle = this.playerAngle + this.mouseX;

    this.playerX += Math.sin(this.renderAngle) * forwardSpeed * 0.0025 * this.timeDelta;
    this.playerY += Math.cos(this.renderAngle) * forwardSpeed * 0.0025 * this.timeDelta;

    if (this.formHovertank.value) {
      this.hovertankShearing = 0.05;
      this.timeMin = 45;
    } else {
      this.hovertankShearing = 0.0;
      this.timeMin = 30;
    }

    if (this.formVerticalLook.value) {
      this.renderVertical = -this.mouseY;
    } else {
      this.renderVertical = Math.sin(this.timeLast / 1000.0) * this.hovertankShearing;
    }

    // shift the camera behind the player
    let shift = 0.0;

    if (this.formPerspectiveSkew.value) {
      shift = 0.5;
      this.projectionDistance = 2.5;
    } else {
      this.projectionDistance = 1.0;
    }
    this.renderX = this.playerX - Math.sin(this.renderAngle) * shift;
    this.renderY = this.playerY - Math.cos(this.renderAngle) * shift;

    // update settings
    this.wallHeight = this.formWallHeight.value;
  }

  // If the canvas element resizes change the aspect ratio
  sizeCanvas() {
    // get aspect ratio of canvas element and change the renderer to match
    const canvasElementWidth = this.canvas.offsetWidth;
    const canvasElementHeight = this.canvas.offsetHeight;

    if (
      this.realCanvasWidth !== canvasElementWidth ||
      this.realCanvasHeight !== canvasElementHeight
    ) {
      this.realCanvasWidth = canvasElementWidth;
      this.realCanvasHeight = canvasElementHeight;

      this.projectionWidth = (1.0 * canvasElementWidth) / canvasElementHeight; // aspect ratio
      // this.projectionDistance = 1.0 / this.projectionWidth;
    }
  }

  // Clear the canvas by setting every pixel to black and fully opaque
  private clearCanvas() {
    const imageData = this.canvasContext.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0; // red
      data[i + 1] = 0; // green
      data[i + 2] = 0; // blue
      data[i + 3] = 255; // alpha - always set to 255! It is by default 0, and so nothing shows
    }

    this.canvasContext.putImageData(imageData, 0, 0);
  }

  // Now just do the horizontal stuff
  private drawScreen() {
    // Maybe there's a way to not have to get this data every time?
    const imageData = this.canvasContext.getImageData(0, 0, this.canvasWidth, this.canvasHeight);

    for (let x = 0; x < this.canvasWidth; x++) {
      // Calualate where the ray hits (distance)
      const result = this.screenRay(x);

      // Send that to be drawn
      this.drawVertical(x, result, imageData);
    }

    this.canvasContext.putImageData(imageData, 0, 0);
  }

  // maybe make this more generic later so we can use it for other kinds of rays like lights etc
  // so maybe two functions, one to take the ray and use it, and one to build the rays
  // maybe a simpler ray function that just goes to get the distance only
  private screenRay(x: number): RayResult {
    // CHANGE IT SO THAT THERE'S NO REF TO THE RENDERX and RENDERY beyond this point
    let xa = this.renderX;
    let ya = this.renderY;
    // THATS WHY THE LIGHT RAYS NEVER WORKED

    let xd: number;
    let yd: number;

    let rayDiff = 0;

    if (this.formPerspective.value) {
      // Work out the ray based on the projection
      const xdBase = this.projectionWidth * ((x - this.canvasWidth / 2.0) / this.canvasWidth);
      const ydBase = this.projectionDistance;

      // Rotate this ray by the player angle
      const cos = Math.cos(-this.renderAngle);
      const sin = Math.sin(-this.renderAngle);
      xd = xdBase * cos - ydBase * sin;
      yd = xdBase * sin + ydBase * cos;
    } else {
      // figure out the angle of the ray in radians - old method can be used to demonstrate the problems
      let fov = Math.PI * this.projectionWidth * 0.25;

      rayDiff = fov * ((x - this.canvasWidth / 2.0) / this.canvasWidth);

      const angleBase =
        -this.renderAngle + Math.PI / 2 - fov * ((x - this.canvasWidth / 2.0) / this.canvasWidth);

      // And now the actual vector of the array (starting at player position)
      xd = Math.cos(angleBase); //  / Math.cos(rayDiff);
      yd = Math.sin(angleBase); // / Math.cos(rayDiff);
      // uncomment that to demo the compressed edges and stretched center
    }

    // get the real ray length
    // const rayLength = Math.sqrt(xd * xd + yd * yd);

    // Which wall do we hit?
    let wallX = false; // if not this, then Y wall
    let hitEdge = false;
    let mapCoordHit: MapCoord;

    // now we start the hard part - go from that position until we hit a wall of some kind (or leave the map, we return the distance of 999999 I think for that)

    // find the distance of when the horizontal grid is hit, and the distance to the vertical grid
    // (probably 0 as we are exactly on the gridline but we need to handle that case anyway)
    let nextX: number;
    let changeX: number;
    let distanceX: number;
    let nextY: number;
    let changeY: number;
    let distanceY: number;

    // start from player and trace the ray using these params
    let currentX = this.renderX;
    let currentY = this.renderY;

    let currentLength = 0; // How many rays were needed to hit the wall/edge

    mapCoordHit = this.map[Math.floor(currentX)][Math.floor(currentY)];

    // Make a list of mapCoords, starting with where we are now
    let mapCoords: MapCoord[] = [mapCoordHit];

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

      // If we hit the edge, stop as well
      hitEdge =
        currentX <= 1 ||
        currentX >= this.mapSize - 1 ||
        currentY <= 0 ||
        currentY >= this.mapSize - 1;

      // If we haven't hit the edge, is it bordering any walls?
      let hitWall = false;
      if (!hitEdge) {
        // get the floor of where we are, then see what we need to do to check from there

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

        mapCoordHit = this.map[mapX][mapY];
        if (mapCoordHit.type === 0) {
          hitWall = true;
        }
        // add it to the list of mapCoords to check for sprites later
        mapCoords.push(mapCoordHit);
      }

      // use the "tests" check to make sure I don't break something and loop forever
      if (hitEdge || hitWall || tests > 1000) {
        hit = true;
      }
    }

    let textureCoord = wallX ? -currentY * changeX : currentX * changeY;

    return {
      distance: currentLength,
      rayX: xd,
      rayY: yd,
      textureCoord: textureCoord,
      wallX: wallX,
      edge: hitEdge,
      mapCoords: mapCoords,
    };
  }

  private drawVertical(x: number, rayResult: RayResult, image: ImageData) {
    let xTextureCoord = Math.round(64 * rayResult.textureCoord);

    let cameraHeight = this.playerHeight * this.canvasHeight;

    const verticalSlide = this.verticalLookMax * this.renderVertical;

    let heightStart = Math.round(
      verticalSlide +
        (-this.canvasHeight * this.wallHeight + cameraHeight) / rayResult.distance +
        this.canvasHeight / 2.0,
    );
    let heightEnd = Math.round(
      verticalSlide + cameraHeight / rayResult.distance + this.canvasHeight / 2.0,
    );
    if (rayResult.edge) {
      heightStart = heightEnd;
    }
    const heightDifference = (heightEnd - heightStart) * 1.0;

    const drawStart = Math.max(0, heightStart);
    const drawEnd = Math.min(this.canvasHeight, heightEnd);

    // Start with the top indice, then add from there (the red indice on the top of the image)
    let canvasIndice = this.getColorIndicesForCoord(
      x,
      0,
      this.canvasWidth,
      this.canvasHeight,
      false,
    ).red;

    // draw sky
    // skew the sky a bit so the edges are a bit further - and make it so that the sky of 256 wide is for a PI worth
    // TODO: Make it so that the ray also detects where in a circle just around the player at a large distance is hit by the same ray
    // And then return the distance to that and the angle of that part of the circle
    // To do a nicer sky (but make it an option to toggle)
    const skyTextureColumn = x - this.canvasWidth / 2.0;
    let skyTextureAdd: number;
    if (this.formPerspective.value) {
      skyTextureAdd =
        this.skyTextureWidth * Math.sin((Math.PI * skyTextureColumn) / this.canvasWidth);
    } else {
      skyTextureAdd = skyTextureColumn * 0.85 * (640.0 / this.canvasWidth); // I optimised it for one res... and it breaks for all others
    }
    const skyTextureX = Math.floor(
      (skyTextureAdd * this.projectionWidth * 0.5 +
        this.renderAngle * this.skyTextureWidth * 1.35) /
        this.skyXScale,
    );
    for (let y = 0; y < drawStart; y++) {
      if (this.formSkyTexture.value) {
        let skyTextureY = Math.floor(
          (this.skyTextureHeight * (y - verticalSlide - this.canvasHeight / 2.0)) /
            (this.canvasHeight * this.skyYScale) +
            this.skyTextureHeight / 2.0,
        );

        const textureIndices = this.getColorIndicesForCoord(
          skyTextureX,
          skyTextureY,
          this.skyTextureWidth,
          this.skyTextureHeight,
          true,
        );

        // sky texture
        const texture = this.textures[3];

        image.data[canvasIndice] = texture.data[textureIndices.red];
        image.data[canvasIndice + 1] = texture.data[textureIndices.green];
        image.data[canvasIndice + 2] = texture.data[textureIndices.blue];
      } else {
        image.data[canvasIndice] = 128;
        image.data[canvasIndice + 1] = 255;
        image.data[canvasIndice + 2] = 255;
      }
      canvasIndice += this.canvasWidth * 4;
    }

    // Draw wall

    // get wall lit once for the entire column
    const wallLit = this.getAreaColour(
      rayResult.rayX * rayResult.distance + this.renderX,
      rayResult.rayY * rayResult.distance + this.renderY,
    );

    // set texture - assuming that we have mapCoords to get data from! Otherwise just skip drawing this
    let mapCoord = rayResult.mapCoords[rayResult.mapCoords.length - 1];
    let wallTexture: ImageData;
    if (mapCoord) {
      let textureId = rayResult.mapCoords[rayResult.mapCoords.length - 1].wallTexture;

      if (textureId === 0 && rayResult.wallX) {
        textureId = 1;
      }

      wallTexture = this.textures[textureId];
      for (let y = drawStart; y <= drawEnd; y++) {
        // Im sure there's a better way to calculate the texture coord - but we will use a really inefficient way for now
        // It's really not the reason this runs slow, drawing the pixel itself is the reason
        let yTextureCoord = Math.round(
          this.wallHeight * this.textureSize * ((y - heightStart) / heightDifference),
        );
        if (!this.formWallTextures.value) {
          yTextureCoord = 32;
          xTextureCoord = 32;
        }

        const textureIndices = this.getColorIndicesForCoord(
          xTextureCoord,
          yTextureCoord,
          this.textureSize,
          this.textureSize,
          true,
        );

        if (this.formLighting.value) {
          const newlit = this.changePixelLit(
            wallTexture.data[textureIndices.red],
            wallTexture.data[textureIndices.green],
            wallTexture.data[textureIndices.blue],
            wallLit,
          );
          image.data[canvasIndice] = newlit.red;
          image.data[canvasIndice + 1] = newlit.green;
          image.data[canvasIndice + 2] = newlit.blue;
        } else {
          image.data[canvasIndice] = wallTexture.data[textureIndices.red];
          image.data[canvasIndice + 1] = wallTexture.data[textureIndices.green];
          image.data[canvasIndice + 2] = wallTexture.data[textureIndices.blue];
        }
        canvasIndice += this.canvasWidth * 4;
      }
    } else {
      canvasIndice += this.canvasWidth * 4 * (drawEnd - drawStart);
    }

    // draw floor
    for (let y = drawEnd + 1; y < this.canvasHeight; y++) {
      // Can't avoid duplicating for roof/floor as heights are now rather arbitrary
      // Have to add this value on to the y value
      let yAdjusted = y + -Math.min(0, drawEnd);
      const floorDistance = cameraHeight / (yAdjusted - verticalSlide - this.canvasHeight / 2.0);
      let xPos = this.renderX + rayResult.rayX * floorDistance;
      let yPos = this.renderY + rayResult.rayY * floorDistance;

      let floorR = 255;
      let floorG = 192;
      let floorB = 255;

      if (this.formFloorTextures.value) {
        let xTextureCoord = Math.floor(this.textureSize * xPos);
        let yTextureCoord = Math.floor(this.textureSize * yPos);

        // get map point
        const mapCoord = this.map[Math.floor(xPos)][Math.floor(yPos)];

        const texture = this.textures[mapCoord.floorTexture];

        const textureIndices = this.getColorIndicesForCoord(
          xTextureCoord,
          yTextureCoord,
          this.textureSize,
          this.textureSize,
          true,
        );

        floorR = texture.data[textureIndices.red];
        floorG = texture.data[textureIndices.green];
        floorB = texture.data[textureIndices.blue];
      }

      if (this.formLighting.value) {
        const floorLit = this.getAreaColour(xPos, yPos);
        const newlit = this.changePixelLit(floorR, floorG, floorB, floorLit);
        image.data[canvasIndice] = newlit.red;
        image.data[canvasIndice + 1] = newlit.green;
        image.data[canvasIndice + 2] = newlit.blue;
      } else {
        image.data[canvasIndice] = floorR;
        image.data[canvasIndice + 1] = floorG;
        image.data[canvasIndice + 2] = floorB;
      }
      canvasIndice += this.canvasWidth * 4;
    }

    // Now for half walls and fixed sprites (TODO)
    // Go from last found to first, and draw in that order
    // types to look for are 2 = halfwall X, 3 = halfwall Y
    // Can I put these in other methods? I might have to omg look at it
    // But for now, it's trash and I know it's trash
    for (let coord = rayResult.mapCoords.length - 1; coord >= 0; coord--) {
      let coordObj = rayResult.mapCoords[coord];
      if (coordObj.type === 2) {
        // Halfwall X (so along X axis so Y is always the same)
        let startX = this.renderX;
        let startY = this.renderY;
        let vectX = rayResult.rayX;
        let vectY = rayResult.rayY;

        let wallY = coordObj.y + 0.5; // always the same
        let wallX1 = coordObj.x;
        let wallX2 = coordObj.x + 1;

        // so when does the Y meet?
        let rayDistance = (wallY - startY) / vectY;
        // where is X then?
        let hitX = startX + vectX * rayDistance;

        if (hitX >= wallX1 && hitX <= wallX2) {
          // draw that wall!
          let drawValues = this.getStartAndEndForDistance(rayDistance);
          const halfTexture = this.textures[coordObj.wallTexture];
          let xTextureCoord = Math.floor(this.textureSize * (hitX - wallX1));

          const halfLit = this.getAreaColour(hitX, wallY);

          let canvasIndice = this.getColorIndicesForCoord(
            x,
            drawValues.drawStart,
            this.canvasWidth,
            this.canvasHeight,
            false,
          ).red;

          for (let y = drawValues.drawStart; y <= drawValues.drawEnd; y++) {
            let yTextureCoord = Math.floor(
              this.wallHeight *
                this.textureSize *
                ((y - drawValues.heightStart) / drawValues.heightDifference),
            );
            if (!this.formWallTextures.value) {
              yTextureCoord = 32;
              xTextureCoord = 32;
            }

            const textureIndices = this.getColorIndicesForCoord(
              xTextureCoord,
              yTextureCoord,
              this.textureSize,
              this.textureSize,
              true,
            );

            let redT = halfTexture.data[textureIndices.red];
            let greenT = halfTexture.data[textureIndices.green];
            let blueT = halfTexture.data[textureIndices.blue];

            if (!(redT === 168 && greenT === 0 && blueT === 168)) {
              if (this.formLighting.value) {
                const newlit = this.changePixelLit(redT, greenT, blueT, halfLit);
                image.data[canvasIndice] = newlit.red;
                image.data[canvasIndice + 1] = newlit.green;
                image.data[canvasIndice + 2] = newlit.blue;
              } else {
                image.data[canvasIndice] = redT;
                image.data[canvasIndice + 1] = greenT;
                image.data[canvasIndice + 2] = blueT;
              }
            }

            canvasIndice += this.canvasWidth * 4;
          }
        }
      } else if (coordObj.type === 3) {
        // Halfwall Y (so along Y axis so X is always the same)
        let startX = this.renderX;
        let startY = this.renderY;
        let vectX = rayResult.rayX;
        let vectY = rayResult.rayY;

        let wallX = coordObj.x + 0.5; // always the same
        let wallY1 = coordObj.y;
        let wallY2 = coordObj.y + 1;

        // so when does the X meet?
        let rayDistance = (wallX - startX) / vectX;
        // where is Y then?
        let hitY = startY + vectY * rayDistance;

        if (hitY >= wallY1 && hitY <= wallY2) {
          // draw that wall!
          let drawValues = this.getStartAndEndForDistance(rayDistance);
          const halfTexture = this.textures[coordObj.wallTexture];
          let xTextureCoord = Math.floor(this.textureSize * (hitY - wallY1));

          const halfLit = this.getAreaColour(wallX, hitY);

          let canvasIndice = this.getColorIndicesForCoord(
            x,
            drawValues.drawStart,
            this.canvasWidth,
            this.canvasHeight,
            false,
          ).red;

          for (let y = drawValues.drawStart; y <= drawValues.drawEnd; y++) {
            let yTextureCoord = Math.floor(
              this.wallHeight *
                this.textureSize *
                ((y - drawValues.heightStart) / drawValues.heightDifference),
            );
            if (!this.formWallTextures.value) {
              yTextureCoord = 32;
              xTextureCoord = 32;
            }

            const textureIndices = this.getColorIndicesForCoord(
              xTextureCoord,
              yTextureCoord,
              this.textureSize,
              this.textureSize,
              true,
            );

            let redT = halfTexture.data[textureIndices.red];
            let greenT = halfTexture.data[textureIndices.green];
            let blueT = halfTexture.data[textureIndices.blue];

            if (!(redT === 168 && greenT === 0 && blueT === 168)) {
              if (this.formLighting.value) {
                const newlit = this.changePixelLit(redT, greenT, blueT, halfLit);
                image.data[canvasIndice] = newlit.red;
                image.data[canvasIndice + 1] = newlit.green;
                image.data[canvasIndice + 2] = newlit.blue;
              } else {
                image.data[canvasIndice] = redT;
                image.data[canvasIndice + 1] = greenT;
                image.data[canvasIndice + 2] = blueT;
              }
            }

            canvasIndice += this.canvasWidth * 4;
          }
        }
      }
    }
  }

  // Perhaps also a function to draw a wall segment from top to bottom! One for sky, one for wall, one for floor
  // This is just getting unwieldy
  private getStartAndEndForDistance(distance: number) {
    let cameraHeight = this.playerHeight * this.canvasHeight;

    const verticalSlide = this.verticalLookMax * this.renderVertical;

    let heightStart = Math.round(
      verticalSlide +
        (-this.canvasHeight * this.wallHeight + cameraHeight) / distance +
        this.canvasHeight / 2.0,
    );
    let heightEnd = Math.round(verticalSlide + cameraHeight / distance + this.canvasHeight / 2.0);
    const heightDifference = (heightEnd - heightStart) * 1.0;

    const drawStart = Math.max(0, heightStart);
    const drawEnd = Math.min(this.canvasHeight, heightEnd);

    return {
      heightStart: heightStart,
      heightEnd: heightEnd,
      drawStart: drawStart,
      drawEnd: drawEnd,
      heightDifference: heightDifference,
    };
  }

  // Use this to get the colour indices for a canvas/image - also wrap this number to width and height
  private getColorIndicesForCoord = (
    x: number,
    y: number,
    width: number,
    height: number,
    wrap: boolean,
  ) => {
    if (wrap) {
      // first wrap the x and y coords to the width/height
      x = this.mod(x, width);
      y = this.mod(y, height);
    }
    const red = y * (width * 4) + x * 4;
    // return R G B A
    return { red: red, green: red + 1, blue: red + 2, alpha: red + 3 };
  };

  private mod(n: number, m: number) {
    return ((n % m) + m) % m;
  }

  fullscreen() {
    if (this.canvas.requestFullscreen) {
      this.canvas.requestFullscreen();
      this.canvas.focus();

      this.canvas.requestPointerLock = this.canvas.requestPointerLock;
      // Ask the browser to lock the pointer
      this.canvas.requestPointerLock();
    }
  }

  // I don't think this is what I want
  private changePixelLit(red: number, green: number, blue: number, areaLit: Colour) {
    return {
      red: Math.floor(red * areaLit.red),
      green: Math.floor(green * areaLit.green),
      blue: Math.floor(blue * areaLit.blue),
    };
  }

  private getAreaColour(x: number, y: number): Colour {
    // calculate distance from viewpoint for diminishing lighting
    let xd = x - this.renderX;
    let yd = y - this.renderY;

    let multiplier = 0.5 / 255.0;

    let distance = 1.0 / Math.sqrt(xd * xd + yd * yd);

    let redLight = distance * this.playerLightColour.red + this.ambientColour.red;
    let greenLight = distance * this.playerLightColour.green + this.ambientColour.green;
    let blueLight = distance * this.playerLightColour.blue + this.ambientColour.blue;

    // add the light from the lit areas
    for (let lightIdx = 0; lightIdx < this.lightSize; ++lightIdx) {
      let light = this.lights[lightIdx];

      // only do it if we are close enough
      let xDist = light.x - x;
      let yDist = light.y - y;
      let lightDistance = Math.sqrt(xDist * xDist + yDist * yDist);

      let radius = this.smallLit ? 2 : light.radius;

      if (lightDistance < radius) {
        let intencity = (radius - lightDistance) / radius;

        if (this.monoLit) {
          redLight += 255 * intencity;
          greenLight += 255 * intencity;
          blueLight += 255 * intencity;
        } else {
          redLight += light.red * intencity;
          blueLight += light.blue * intencity;
          greenLight += light.green * intencity;
        }
      }
    }

    redLight *= multiplier;
    greenLight *= multiplier;
    blueLight *= multiplier;

    return {
      red: redLight,
      green: greenLight,
      blue: blueLight,
    };
  }
}
