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
  collisionData!: Block[][];
  lights!: Light[];

  collisionMapScale = 4;
  collisionSize: number;

  constructor(mapSize: number) {
    this.mapSize = mapSize;
    this.collisionSize = mapSize * this.collisionMapScale;

    // Populate the map
    this.buildMap();

    // randomly make lights in empty blocks
    this.createLights();

    // make collision map 4x the size of the real map, at least for now, so it's more detailed for handling collisions
    this.buildCollisionMap();
  }

  private buildCollisionMap() {
    this.collisionData = [];
    // Make an empty map first - the entire edge is solid even bordering the sky
    for (let x = 0; x < this.collisionSize; x++) {
      const row: Block[] = [];
      for (let y = 0; y < this.collisionSize; y++) {
        row.push({
          type:
            x === 0 || y === 0 || x === this.collisionSize - 1 || y === this.collisionSize - 1
              ? BlockType.Wall
              : BlockType.Empty,
          open: 0.0,
        });
      }
      this.collisionData.push(row);
    }

    // use real map data and add in collision map
    for (let x = 0; x < this.mapSize; x++) {
      const row = this.mapData[x];
      for (let y = 0; y < this.mapSize; y++) {
        const block = row[y];

        // top left collision point
        let colX = x * this.collisionMapScale;
        let colY = y * this.collisionMapScale;

        // We want to set the points that map to it to true, plus one point around it
        for (let xc = colX - 1; xc < colX + 1 + this.collisionMapScale; xc++) {
          for (let yc = colY - 1; yc < colY + 1 + this.collisionMapScale; yc++) {
            if (xc >= 0 && xc < this.collisionMapScale && yc >= 0 && yc < this.collisionMapScale) {
              //this.collisionData[xc][yc].type = BlockType.Wall;
            }
          }
        }
      }
    }
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
        lightX = Math.floor(Math.random() * this.mapSize);
        lightY = Math.floor(Math.random() * this.mapSize);
        if (this.mapData[lightX][lightY].type === BlockType.Empty) {
          clash = false;
        }
        tryidx++;
        if (tryidx > 100) {
          clash = false; // give up and just put it in a block who cares I mean ya know
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
            type = BlockType.YWall;
          } else if (Math.abs(x - halfSize) === 0 && Math.abs(y - halfSize) === 2) {
            type = BlockType.XWall;
          } else if (Math.abs(x - halfSize) === 2 || Math.abs(y - halfSize) === 2) {
            type = BlockType.Wall;
          }
        }

        let newBlock: Block = {
          type: type,
          open: 0.0,
        };

        row.push(newBlock);
      }
      this.mapData.push(row);
    }
  }
}
