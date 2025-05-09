import { ImageStore } from '@utilities/image-store';
import { GameState } from 'src/model/game-state.model';
import { ImageRequest } from 'src/model/image.model';

export class IntroState implements GameState {
  imageStore!: ImageStore;

  getImageList(): ImageRequest[] {
    return [
      {
        name: 'logo-kimlab',
        type: 'logo',
        filename: '/images/logo/kimlab.jpg',
        width: 1920,
        height: 1080,
      },
    ];
  }

  // Can we extend a class that has a lot of this implemented - is it posible to have a class with abstract and non abstract functions?
  setImageList(imageStoreNew: ImageStore): void {
    this.imageStore = imageStoreNew;
  }

  doLogic(deltaTime: number): void {}

  doCanvas(ctx: CanvasRenderingContext2D): void {
    // draw the image

    //start with a test box

    // How will I handle the aspect ratios/screen sizes? I might need a Drawing function that handles aspect ratios, sliding images to top or bottom while fitting it in etc
  }
}
