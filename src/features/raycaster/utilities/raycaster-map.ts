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
  open: number; // How open is the half wall - from 0 closed to 1 open - managed by the "Door" interface
  // What lights can be hit in this zone? (Could be none)
  lights: Light[];
}

export interface Light {
  x: number;
  y: number;
  mapX: number;
  mapY: number;
  // Lights are multipliers, as in 0.0 - 1.0
  red: number;
  green: number;
  blue: number;
  // 0 distance is full bright, and radius distance is full dark, beyond that doesn't even trace to the light
  radius: number;
  // Should we do shadows?
  castShadows: boolean;
}

// Each vertex of the map should have an ambient light colour, to simulate light bounding around the place
// This is a TODO we don't even have a list for it
export interface LightAmbient {
  red: number;
  green: number;
  blue: number;
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

  constructor(mapSize: number, textures: RaycasterTextures) {
    this.mapSize = mapSize;
    this.textures = textures;

    // Populate the map
    this.buildMap();

    // randomly make lights in empty blocks (temp until sprites work)
    // Now that sprites work and we make lights from those, we probably want to make am ambient light level for every vertex
    // That way don't need to do any "checking" of all those lights and adding them together - can do it at the start
    this.createLights();

    // Make sprites (lamps etc)
    this.createSprites();

    // Post process the map to find out where the lights can reach
    // For now do it to ALL lights, to test wether it works
    // Later, do it only to shadowed lights
    this.processLights();
  }

  processLights() {
    // for each light we'll start in the map point it's in, and travel as far as we can through the grid until we hit a solid unmoving wall
    // Doors wont count, as they are dynamic so can't block that at all
    // Do a shortest path, even though it'll go around corners where the light is blocked, might be able to optimise this later
    // Perhaps for each light, find the point at the leftmost angle, and the point at the rightmost angle
    //    and use the dot product of those lines and the four points on every gridpoint to see if positive or negative
    //    then can work out what blocks are totally covered by the light
    //       might be just an excuse to learn dot product again

    // This method can be slow, as it runs once and wont really impact anything

    // Also, process the non-shadowed lights to not add them to the block lights, but to instead add them to a seperate array of
    // prebaked lighting, to simulate indirect lighting in a silly way

    const diagonalDistance = Math.sqrt(2);

    for (let light of this.lights) {
      // what mapX and Y is the light in?
      let mapX = light.mapX;
      let mapY = light.mapY;

      // make a map of numbers, as in distance from the light source
      let mapTest: number[][] = [];
      for (let x = 0; x < this.mapSize; x++) {
        let column: number[] = [];
        for (let y = 0; y < this.mapSize; y++) {
          column.push(this.mapData[x][y].type === BlockType.Wall ? -1 : 100000);
          // push a negative if it's a wall - negatives will be ignored
        }
        mapTest.push(column);
      }

      // Now we have this, do a loop until we run out of spaces in this grid
      // As in, for each square, check distance, so start with the position we are in
      // This is awful, surely it can be done better, so much nesting, like a birds nest of code
      let squaresToCheck = [{ x: mapX, y: mapY, distance: 0 }];
      while (squaresToCheck.length > 0) {
        // get the first and remove it
        let element = squaresToCheck.shift(); // Gets first element, removing it from the list
        if (element) {
          let currentDist = mapTest[element.x][element.y];
          if (currentDist > element.distance) {
            mapTest[element.x][element.y] = element.distance;

            // now add in the squares all around it except obviously edge ones - is there a cleaner way of doing it?
            // I feel dirty looking at this code
            for (let nx = -1; nx <= 1; nx++) {
              for (let ny = -1; ny <= 1; ny++) {
                // only do it if they are directly left or right or up or down
                // so at least one is 0 but not both
                // so not the center either (if both are 0 skip)
                if (!(nx === 0 && ny === 0)) {
                  const newMapX = element.x + nx;
                  const newMapY = element.y + ny;
                  const dist = nx === 0 || ny === 0 ? 1 : diagonalDistance;

                  if (
                    newMapX >= 0 &&
                    newMapX < this.mapSize &&
                    newMapY >= 0 &&
                    newMapY < this.mapSize
                  ) {
                    // Add this square as an element to test
                    squaresToCheck.push({
                      x: newMapX,
                      y: newMapY,
                      distance: element.distance + dist,
                    });
                  }
                }
              }
            }
          }
        }
      }

      // We now have an array with "-1" for each square with a wall, otherwise a number indicating how far it is from the light sources
      // Loop through it, and for each square with a distance less than the radius of the light, add it into that squares light list
      for (let x = 0; x < this.mapSize; x++) {
        for (let y = 0; y < this.mapSize; y++) {
          let distance = mapTest[x][y];
          if (distance >= 0 && distance < Math.ceil(light.radius + 1)) {
            this.mapData[x][y].lights.push(light);
          }
        }
      }
    }

    // Get some light stats, as clearly this is the performance hog
    // this.lightingStats();
  }

  private lightingStats() {
    let totalLightCount = 0;
    let maxLightCount = 0;
    let maxLightX = 0;
    let maxLightY = 0;
    let minLightCount = 99999999;
    let minLightX = 0;
    let minLightY = 0;
    let mapTest2: number[][] = [];
    for (let x = 0; x < this.mapSize; x++) {
      let column: number[] = [];

      for (let y = 0; y < this.mapSize; y++) {
        // keep track of the highest count
        let lightCount = this.mapData[x][y].lights.length;
        if (lightCount > maxLightCount) {
          maxLightCount = lightCount;
          maxLightX = x;
          maxLightY = y;
        }

        if (lightCount < minLightCount) {
          minLightCount = lightCount;
          minLightX = x;
          minLightY = y;
        }
        totalLightCount += this.mapData[x][y].lights.length;

        column.push(lightCount);
      }
      mapTest2.push(column);
    }
    let averageLightCount = totalLightCount / Math.pow(this.mapSize, 2);
    console.log(
      'section with max lights: ' + maxLightCount + ' x: ' + maxLightX + ' y: ' + maxLightY
    );
    console.log(
      'section with min lights: ' + minLightCount + ' x: ' + minLightX + ' y: ' + minLightY
    );
    console.log('Average lights: ' + averageLightCount);
    let centerPoint = this.mapSize / 2;
    console.log(
      'lights at ' +
      centerPoint +
      ',' +
      centerPoint +
      ': ' +
      this.mapData[centerPoint][centerPoint].lights.length
    );
  }

  createSprites() {
    // just make a bunch of lamps for now
    let spriteCount = 3;
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
        mapX: spriteX,
        mapY: spriteY,
        red: 0.8,
        green: 1.0,
        blue: 0.8,
        radius: 4.0,
        castShadows: true,
      });
    }
  }

  private createLights() {
    let lightSize = 0; // How many random dim environmental lights with no shadows
    this.lights = [];
    for (let lightIdx = 0; lightIdx < lightSize; lightIdx++) {
      let clash = true;
      let tryidx = 0;
      let lightX = 0;
      let lightY = 0;
      let radius = 0;

      let brightnessMultipler = 0.5;

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
      radius = Math.random() * 1 + 1;

      this.lights.push({
        x: lightX + 0.4 + Math.random() * 0.2,
        y: lightY + 0.4 + Math.random() * 0.2,
        mapX: lightX,
        mapY: lightY,
        red: Math.random() * brightnessMultipler,
        green: Math.random() * brightnessMultipler,
        blue: Math.random() * brightnessMultipler,
        radius: radius,
        castShadows: false,
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

        if (Math.random() > 0.75) {
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
          lights: [],
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
          lights: [],
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
