import { RaycasterTextures } from './raycaster-textures';

export enum BlockType {
  Empty, // Just a floor
  Wall, // Solid block
  XDoor, // Door in middle along X axis (to be renamed later)
  YDoor, // Door in middle along Y axis
}

export interface Block {
  x: number;
  y: number;
  type: BlockType;
  // textures for wall OR textures for the walls around (As in, if it were the last block hit before the next block)
  wallTexture: number; // index of wall texture OR door texture for doors
  innerWallTexture: number; // texture used on next block if it comes from a door
  floorTexture: number; // index of texture for floor
  // textures for the half wall
  open: number; // How open is the half wall - from 0 closed to 1 open
  // Perhaps a time for when it was opened, and after that time passes, it's closed and no longer passable
}

export interface Light {
  x: number;
  y: number;
  // Lights are multipliers, as in 0.0 - 1.0
  red: number;
  green: number;
  blue: number;
  // 0 distance is full bright, and radius distance is full dark, beyond that doesn't even trace to the light
  radius: number;
  // Should we do shadows?
  castShadows: boolean;
}

export interface Sprite {
  x: number;
  y: number;
  texture: number;
}

// door holds a link to a door Block and when it was last opened
export interface Door {
  block: Block;
  timeOpened: number; // Set to 0 when it is opened, and count up the deltaTime
  isOpen: boolean;
}

export class RaycasterMap {
  // Make an empty map first - the entire edge is solid even bordering the sky
  // Always do [x] [y] consistently
  mapSize: number;
  mapData!: Block[][];
  lights!: Light[];
  sprites!: Sprite[];

  doors!: Door[];
  doorTime = 5000; // 5 seconds
  doorSpeed = 0.001; // this much per delta time
  doorOpenPassable = 0.5; // How open does a door have to be to be passable

  textures: RaycasterTextures;

  specialCentreLit = false;

  constructor(mapSize: number, textures: RaycasterTextures) {
    this.mapSize = mapSize;
    this.textures = textures;

    // Populate the map
    this.buildMap();

    // randomly make lights in empty blocks (temp until sprites work)
    this.createLights();

    // Make sprites (lamps etc)
    this.createSprites();
  }

  createSprites() {
    // just make a bunch of lights for now
    let spriteCount = 5; // How many random dim environmental lights with no shadows
    this.sprites = [];
    for (let spriteIdx = 0; spriteIdx < spriteCount; spriteIdx++) {
      let clash = true;
      let tryidx = 0;
      let spriteX = 0;
      let spriteY = 0;

      if (spriteIdx === 0) {
        spriteX = Math.floor(this.mapSize / 2.0);
        spriteY = Math.floor(this.mapSize / 2.0);
      } else {
        while (clash) {
          spriteX = Math.floor(Math.random() * (this.mapSize - 1));
          spriteY = Math.floor(Math.random() * (this.mapSize - 1));
          if (this.mapData[spriteX][spriteY].type === BlockType.Empty) {
            clash = false;
          }
          tryidx++;
          if (tryidx > 100) {
            clash = false; // give up and just put it in a block who cares I mean ya know
          }
        }
      }

      this.sprites.push({
        x: spriteX + 0.5,
        y: spriteY + 0.5,
        texture: this.textures.getTextureId('light'),
      });

      // also push an appropriate light at the same time we make these lamps

      this.lights.push({
        x: spriteX + 0.5,
        y: spriteY + 0.5,
        red: 0.8,
        green: 1.0,
        blue: 0.8,
        radius: 5.0,
        castShadows: true,
      });
    }
  }

  private createLights() {
    let lightSize = 10; // How many random dim environmental lights with no shadows
    this.lights = [];
    for (let lightIdx = 0; lightIdx < lightSize; lightIdx++) {
      let clash = true;
      let tryidx = 0;
      let lightX = 0;
      let lightY = 0;
      let radius = 0;

      let brightnessMultipler = 0.25;
      let shadowCast = false;

      if (this.specialCentreLit && lightIdx === 0) {
        // first light makes a shadow, just the one
        lightX = Math.floor(this.mapSize / 2.0);
        lightY = Math.floor(this.mapSize / 2.0);
        radius = 10.0;
        shadowCast = true;
        brightnessMultipler = 1.0;
      } else {
        while (clash) {
          lightX = Math.floor(Math.random() * (this.mapSize - 1));
          lightY = Math.floor(Math.random() * (this.mapSize - 1));
          if (this.mapData[lightX][lightY].type === BlockType.Empty) {
            clash = false;
          }
          tryidx++;
          if (tryidx > 100) {
            clash = false; // give up and just put it in a block who cares I mean ya know
          }
        }
        radius = Math.random() * 5 + 5;
      }

      this.lights.push({
        x: lightX + 0.4 + Math.random() * 0.2,
        y: lightY + 0.4 + Math.random() * 0.2,
        red: Math.random() * brightnessMultipler,
        green: Math.random() * brightnessMultipler,
        blue: Math.random() * brightnessMultipler,
        radius: radius,
        castShadows: shadowCast,
      });
    }
  }

  private buildMap() {
    this.mapData = [];
    this.doors = [];
    const halfSize = this.mapSize / 2;
    for (let x = 0; x < this.mapSize; x++) {
      const row: Block[] = [];
      for (let y = 0; y < this.mapSize; y++) {
        const changeX = x - halfSize;
        const changeY = y - halfSize;
        const distance = Math.sqrt(changeX * changeX + changeY * changeY);

        // Some blocks randomly are blocks, and the edges ALWAYS are
        // Later we'll cater for the end of the map
        let isBlock = x === 0 || y === 0 || x === this.mapSize - 1 || y === this.mapSize - 1;

        if (Math.random() > 0.85) {
          isBlock = !isBlock;
        }
        if (distance < 4) {
          isBlock = false;
        }

        let type = isBlock ? BlockType.Wall : BlockType.Empty;

        if (distance < 3) {
          type = BlockType.Empty;
          if (Math.abs(x - halfSize) === 2 && Math.abs(y - halfSize) === 0) {
            type = BlockType.YDoor;
          } else if (Math.abs(x - halfSize) === 0 && Math.abs(y - halfSize) === 2) {
            type = BlockType.XDoor;
          } else if (Math.abs(x - halfSize) === 2 || Math.abs(y - halfSize) === 2) {
            type = BlockType.Wall;
          }
        }

        let wallTexture = 0;
        let innerWallTexture = 0;
        let floorTexture =
          Math.random() > 0.5
            ? this.textures.getTextureId('tilefloor')
            : this.textures.getTextureId('grassfloor');

        switch (type) {
          case BlockType.Wall:
            wallTexture = this.textures.getTextureId('wolfwood1');
            if (Math.random() > 0.9) {
              // Pick a special wall
              let rand = Math.floor(Math.random() * 4);
              if (rand === 0) {
                wallTexture = this.textures.getTextureId('wolfwood2');
              } else if (rand === 1) {
                wallTexture = this.textures.getTextureId('wolfwood3');
              } else if (rand === 2) {
                wallTexture = this.textures.getTextureId('wolfwood4');
              } else if (rand === 3) {
                wallTexture = this.textures.getTextureId('wolfwood5');
              }
            }
            floorTexture = wallTexture;
            break;
          case BlockType.XDoor:
          case BlockType.YDoor:
            wallTexture = this.textures.getTextureId('wolfdoor');
            innerWallTexture = this.textures.getTextureId('wolfdoorside');
            break;
        }

        let newBlock: Block = {
          x: x,
          y: y,
          type: type,
          open: 0.0,
          wallTexture: wallTexture,
          floorTexture: floorTexture,
          innerWallTexture: innerWallTexture,
        };
        row.push(newBlock);

        if (type === BlockType.XDoor || type === BlockType.YDoor) {
          // As we are making a door, make a link to this block in the "doors" array
          this.doors.push({
            block: newBlock,
            timeOpened: 0,
            isOpen: false,
          });
        }
      }
      this.mapData.push(row);
    }
  }

  // Build a small map to raytrace with to find out where we can walk
  // So make a sectin of map from the 3x3 around the player, but with more detail
  // if we are making spots outside of the map, simply make them impassible totally
  public buildCollisionMap(playerX: number, playerY: number) {
    let mapX = Math.floor(playerX);
    let mapY = Math.floor(playerY);

    let collisionBase = 3; // It actually doesn't work with anything but 3
    let collisionData: Block[][] = [];
    let collisionScale = 4; // we should take the region we
    let collisionSize = collisionBase * collisionScale; // 3x3 centered on the player position, BUT we
    // Make an empty map first - the entire edge is solid even bordering the sky
    for (let x = 0; x < collisionSize; x++) {
      const row: Block[] = [];
      for (let y = 0; y < collisionSize; y++) {
        row.push({
          x: x,
          y: y,
          type: BlockType.Empty,
          open: 0.0,
          wallTexture: 0,
          floorTexture: 0,
          innerWallTexture: 0,
        });
      }
      collisionData.push(row);
    }

    // use real map data and add in collision map
    // Center on player, so do -1 to 1 where 0 is the playerX
    // Perhaps change it so that we just check if the space is "passable"
    // Can dynamically adjust that
    let extend = 1;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        let coordX = x + mapX;
        let coordY = y + mapY;

        let solid = false;
        if (coordX < 0 || coordX >= this.mapSize || coordY < 0 || coordY >= this.mapSize) {
          solid = true;
        } else {
          let block = this.mapData[coordX][coordY];
          if (
            block.type === BlockType.Wall ||
            ((block.type === BlockType.XDoor || block.type === BlockType.YDoor) &&
              block.open < this.doorOpenPassable)
          ) {
            solid = true;
          }
        }

        if (solid) {
          // top left of the collision array
          let colX = (x + 1) * collisionScale;
          let colY = (y + 1) * collisionScale;

          // We want to set the points that map to it to true, plus one point around it
          for (let xc = colX - extend; xc < colX + extend + collisionScale; xc++) {
            for (let yc = colY - extend; yc < colY + extend + collisionScale; yc++) {
              if (xc >= 0 && xc < collisionSize && yc >= 0 && yc < collisionSize) {
                collisionData[xc][yc].type = BlockType.Wall;
              }
            }
          }
        }
      }
    }
    return collisionData;
  }

  // Get the door that holds that block
  getDoor(actionCoord: Block) {
    return this.doors.find((door) => {
      return door.block === actionCoord;
    });
  }

  updateDoors(timeDelta: number, mapX: number, mapY: number) {
    this.doors.forEach((door) => {
      if (door.isOpen) {
        door.block.open = Math.min(1, door.block.open + this.doorSpeed * timeDelta);
        door.timeOpened += timeDelta;
        if (door.timeOpened > this.doorTime) {
          door.isOpen = false;
        }
      } else {
        door.block.open = Math.max(0, door.block.open - this.doorSpeed * timeDelta);
      }

      if (mapX === door.block.x && mapY === door.block.y) {
        // If the player is in, or walks back into the door when it's closing, open it again
        door.timeOpened = 0;
        door.isOpen = true;
      }
    });
  }
}
