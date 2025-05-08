interface TextureData {
  name: string;
  width: number;
  height: number;
  data: ImageData;
}

export class RaycasterTextures {
  // List of images - use ".data" to get the raw data out of the ImageData we store
  // Or... should we convert them to something better? Like a simple array?
  textureList: TextureData[];

  constructor() {
    this.textureList = [];
  }

  public loadTexture(
    textureName: string,
    fileName: string,
    width: number,
    height: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.buildTexture(fileName, width, height)
        .then((imageData) => {
          this.textureList.push({
            name: textureName,
            width: width,
            height: height,
            data: imageData,
          });
          resolve();
        })
        .catch(() => {
          reject(new Error("Couldn't store texture " + textureName));
        });
    });
  }

  // Don't directly use this elsewhere, call specific types instead
  private buildTexture(fileName: string, width: number, height: number): Promise<ImageData> {
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
          reject(new Error("Couldn't load texture " + fileName));
        }
      });
    });
  }

  public getTextureId(textureName: string): number {
    let textureId = this.textureList.findIndex((element) => {
      return element.name === textureName;
    });

    if (textureId < 0) {
      console.log("couldn't find texture: " + textureName);
    }

    return textureId;
  }
}
