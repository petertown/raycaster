export enum BlockType {
  Empty, // Just a floor
  Wall, // Solid block
  XWall, // Semi transparent wall in middle along X axis
  YWall, // Semi transparent wall in middle along Y axis
  Door, // A wall which can be
}

export interface Block {
  type: BlockType;
  // textures for wall OR textures for the walls around (As in, if it were the last block hit before the next block)
  wallTexture: number; // index of wall texture
  // textures for the half wall
  open: number; // How open is the half wall - from -1 to 1 (So which side does it slide to)
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
}

export class RaycasterMap {
  // Always do [x] [y] consistently
  mapSize: number;
  mapData!: Block[][];
  lights!: Light[];

  constructor(mapSize: number) {
    this.mapSize = mapSize;

    // Populate the map
    this.buildMap();

    // randomly make lights in empty blocks
    this.createLights();
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
          type: BlockType.Empty,
          open: 0.0,
          wallTexture: 0,
        });
      }
      collisionData.push(row);
    }

    // use real map data and add in collision map
    // Center on player, so do -1 to 1 where 0 is the playerX
    // Just do solid walls, doors come later (when they can open and close)
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        let coordX = x + mapX;
        let coordY = y + mapY;

        let solid = false;
        let extend = 0;
        if (coordX < 0 || coordX >= this.mapSize || coordY < 0 || coordY >= this.mapSize) {
          solid = true;
        } else {
          let blockType = this.mapData[coordX][coordY].type;
          if (blockType === BlockType.Wall) {
            solid = true;
            extend = 1;
          } else if (blockType === BlockType.XWall || blockType === BlockType.YWall) {
            solid = true;
            extend = 0;
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

  private createLights() {
    let lightSize = 5;
    this.lights = [];
    for (let lightIdx = 0; lightIdx < lightSize; lightIdx++) {
      let clash = true;
      let tryidx = 0;
      let lightX = 0;
      let lightY = 0;
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

      this.lights.push({
        x: lightX + 0.4 + Math.random() * 0.2,
        y: lightY + 0.4 + Math.random() * 0.2,
        red: Math.random(),
        green: Math.random(),
        blue: Math.random(),
        radius: Math.random() * 5 + 5,
      });
    }
  }

  private buildMap() {
    this.mapData = [];
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
            type = x - halfSize === 2 ? BlockType.YWall : BlockType.Empty;
          } else if (Math.abs(x - halfSize) === 0 && Math.abs(y - halfSize) === 2) {
            type = BlockType.XWall;
          } else if (Math.abs(x - halfSize) === 2 || Math.abs(y - halfSize) === 2) {
            type = BlockType.Wall;
          }
        }

        let newBlock: Block = {
          type: type,
          open: 0.0,
          wallTexture: 0,
        };

        row.push(newBlock);
      }
      this.mapData.push(row);
    }
  }
}
