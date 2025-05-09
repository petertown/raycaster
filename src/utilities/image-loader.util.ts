import { ImageContainer, ImageRequest, ImageType } from 'src/model/image.model';
import { ImageStore } from './image-store';

// This is to get the raw images and store them in memory
// But don't send it direct to the Web Worker - don't want to send EVERY image
// Definitely not all the big images I have
export class ImageLoader {
  imageList: ImageContainer[];

  constructor() {
    this.imageList = [];
  }

  // Load a list of images (Skipping those that are already loaded)
  // Should return a class holding them that can be used to get the images out of
  public loadImages(imagesToLoad: ImageRequest[]): Promise<ImageStore> {
    let loadList: Promise<ImageContainer>[] = [];
    imagesToLoad.forEach((loadImage) => {
      loadList.push(this.loadImage(loadImage));
    });

    // Return a promise to load them all and return an ImageStore
    return new Promise((resolve, reject) => {
      Promise.all(loadList)
        .then((images) => {
          resolve(new ImageStore(images));
        })
        .catch(() => {
          reject(new Error("Couldn't load textures"));
        });
    });
  }

  public loadImage(imageLoad: ImageRequest): Promise<ImageContainer> {
    return new Promise((resolve, reject) => {
      // If we already have an image with that name return the one we already have
      let imageStore = this.imageList.find((image) => {
        return image.name === imageLoad.name;
      });
      if (imageStore) {
        // we found it so resolve immediately
        resolve(imageStore);
      } else {
        // Otherwise continue loading the image
        this.buildImage(imageLoad.filename, imageLoad.width, imageLoad.height)
          .then((imageData) => {
            imageStore = {
              name: imageLoad.name,
              type: this.mapType(imageLoad.type),
              width: imageLoad.width, // Can I get the size from the loaded image?
              height: imageLoad.height,
              data: imageData,
            };

            this.imageList.push(imageStore);
            resolve(imageStore);
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
      const workingImage = new Image();
      workingImage.src = fileName;
      workingImage.addEventListener('load', () => {
        // we need to make this a canvas, so we can pick colours from it

        const textureCanvas = document.createElement('canvas');
        textureCanvas.width = workingImage.width;
        textureCanvas.height = workingImage.height;
        const textureContext = textureCanvas.getContext('2d');

        if (textureContext) {
          textureContext.drawImage(workingImage, 0, 0);

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
}
