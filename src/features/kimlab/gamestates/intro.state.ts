import { ImageStore } from '@utilities/image-store';
import { RenderAlignment, RendererCanvas } from '@utilities/renderer-canvas.util';
import { GameState } from 'src/model/game-state.model';
import { ImageContainer, ImageRequest } from 'src/model/image.model';

export class IntroState implements GameState {
  imageStore!: ImageStore;

  logoImage!: ImageContainer;

  logoAnimationTime = 0.0;

  getImageList(): ImageRequest[] {
    return [
      {
        name: 'logo-kimlab',
        filename: '/images/logo/kimlab.jpg',
      },
    ];
  }

  // Can we extend a class that has a lot of this implemented - is it posible to have a class with abstract and non abstract functions?
  setImageList(imageStoreNew: ImageStore): void {
    this.imageStore = imageStoreNew;

    // Store the bitmap in an easier to get to place
    this.logoImage = this.imageStore.imageList[this.imageStore.getImageId('logo-kimlab')];
  }

  doLogic(deltaTime: number): void {
    this.logoAnimationTime = Math.min(1.0, this.logoAnimationTime + deltaTime / 10000.0);
  }

  doCanvas(renderer: RendererCanvas): void {
    // blank the image
    renderer.clearImage();

    // Get the alpha for the anim time
    const alpha = this.logoAnimationTime;
    const yPos = 1.0 - this.logoAnimationTime;

    // draw the entire image full screen
    renderer.drawImage(
      this.logoImage,
      RenderAlignment.Center,
      RenderAlignment.Center,
      {
        x: 0.0,
        y: yPos,
      },
      alpha,
    );

    //start with a test box
    // How will I handle the aspect ratios/screen sizes? I might need a Drawing function that handles aspect ratios, sliding images to top or bottom while fitting it in etc
  }
}
