import { ImageContainer } from 'src/model/image.model';

export class ImageStore {
  imageList: ImageContainer[];

  constructor(imageListNew: ImageContainer[]) {
    this.imageList = imageListNew;
  }

  // Get the index in the list of the image by name
  public getImageId(name: string): number {
    let imageId = this.imageList.findIndex((element) => {
      return element.name === name;
    });

    if (imageId < 0) {
      console.error("couldn't find texture: " + name);
    }

    return imageId;
  }
}
