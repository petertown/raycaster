interface TextureData {
  width: number;
  height: number;
  data: ImageData;
}

export class RaycasterTextures {
  // List of images - use ".data" to get the raw data out of the ImageData we store
  // Or... should we convert them to something better? Like a simple array?
  wallTextures: TextureData[];
  floorTextures: TextureData[];

  constructor() {
    this.wallTextures = [];
    this.floorTextures = [];
  }

  public loadWallTexture(fileName: string, width: number, height: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loadTexture(fileName, width, height)
        .then((imageData) => {
          this.wallTextures.push({
            width: width,
            height: height,
            data: imageData,
          });
          resolve();
        })
        .catch(() => {
          reject();
        });
    });
  }

  public loadFloorTexture(fileName: string, width: number, height: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loadTexture(fileName, width, height)
        .then((imageData) => {
          this.floorTextures.push({
            width: width,
            height: height,
            data: imageData,
          });
          resolve();
        })
        .catch(() => {
          reject();
        });
    });
  }

  // Don't directly use this elsewhere, call specific types instead
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
}
