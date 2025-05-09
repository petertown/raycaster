import { ImageContainer, ImageRequest } from 'src/model/image.model';
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
        this.buildImage(imageLoad.filename)
          .then((bitmapData) => {
            imageStore = {
              name: imageLoad.name,
              width: bitmapData.width,
              height: bitmapData.height,
              bitmap: bitmapData,
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

  // building the stored image is async
  private buildImage(fileName: string): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      const workingImage = new Image();
      workingImage.src = fileName;
      workingImage.addEventListener('load', () => {
        createImageBitmap(workingImage).then((bitmap) => {
          resolve(bitmap);
        });
      });
    });
  }
}
