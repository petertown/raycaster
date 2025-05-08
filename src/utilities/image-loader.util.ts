import ImageListJson from '@public/data/imageList.json';

// Use this to define what folder it looks in
export enum ImageType {
  Image,
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

interface ImageLoadRequest {
  name: string;
  type: string; // type in JSON is a string which we need to map to
  filename: string;
  width: number;
  height: number;
}

// This is to get the raw images and store them in memory
// But don't send it direct to the Web Worker - don't want to send EVERY image
// Definitely not all the big images I have
export class ImageLoader {
  imageList: Image[];

  constructor() {
    this.imageList = [];
  }

  // Load the standard images - images that will be used all over the game
  // I could just load the textures here, they will be tiny, it's not like it'll impact performance
  // We could also have a "deleteTextures" function later
  public loadImages() {
    // get the JSON file with every image we want to get
    const imagesToLoad: ImageLoadRequest[] = ImageListJson;
    let loadList: Promise<void>[] = [];
    imagesToLoad.forEach((loadImage) => {
      loadList.push(this.loadImage(loadImage));
    });

    // Return a promise to load them all
    return Promise.all(loadList);
  }

  public loadImage(imageLoad: ImageLoadRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      // If we already HAVE an image with that name skip loading it as it's a clash
      if (
        this.imageList.findIndex((image) => {
          return image.name === imageLoad.name;
        }) >= 0
      ) {
        // we found it so resolve immediately
        resolve();
      } else {
        // Otherwise continue loading the image
        this.buildImage(imageLoad.filename, imageLoad.width, imageLoad.height)
          .then((imageData) => {
            this.imageList.push({
              name: imageLoad.name,
              type: this.mapType(imageLoad.type),
              width: imageLoad.width, // Can I get the size from the loaded image?
              height: imageLoad.height,
              data: imageData,
            });
            resolve();
          })
          .catch(() => {
            reject(new Error("Couldn't store texture " + imageLoad.name));
          });
      }
    });
  }

  private mapType(stringType: string) {
    switch (stringType) {
      case 'texture':
        return ImageType.Texture;
      case 'logo':
        return ImageType.Logo;
      default:
        return ImageType.Image;
    }
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

  // I might not use this one - this might go into a texture container
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
