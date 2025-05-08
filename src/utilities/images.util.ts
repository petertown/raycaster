// Use this to define what folder it looks in
export enum ImageType {
  Logo,
  Texture,
}

interface Image {
  name: string;
  type: ImageType;
  width: number;
  height: number;
  data: ImageData;
}

// This is to get the raw images and store them in memory
// But don't send it direct to the Web Worker - it's too big
// Build texture data using the
export class Images {
  imageList: Image[];

  constructor() {
    this.imageList = [];
  }

  // TODO: A version of this to load a list of textures
  public loadTexture(
    imageName: string,
    type: ImageType,
    fileName: string,
    width: number,
    height: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.buildImage(fileName, width, height)
        .then((imageData) => {
          this.imageList.push({
            name: imageName,
            type: type,
            width: width,
            height: height,
            data: imageData,
          });
          resolve();
        })
        .catch(() => {
          reject(new Error("Couldn't store texture " + imageName));
        });
    });
  }

  // building the stored image is async
  private buildImage(fileName: string, width: number, height: number): Promise<ImageData> {
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
          let imageData = textureContext.getImageData(0, 0, width, height);

          // Do I need to do this?
          textureCanvas.remove();

          resolve(imageData);
        } else {
          reject(new Error("Couldn't load texture " + fileName));
        }
      });
    });
  }

  public getImageId(textureName: string): number {
    let textureId = this.imageList.findIndex((element) => {
      return element.name === textureName;
    });

    if (textureId < 0) {
      console.log("couldn't find texture: " + textureName);
    }

    return textureId;
  }

  // textureData: number[][]; // Convert the texture image into an array of [x][y] so it's easier to get the texture data out of it
  // A function to get a version of all these images that is simplified to send to a web worker and made for the raycaster
}
