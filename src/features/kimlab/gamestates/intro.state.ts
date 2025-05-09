import { RenderAlignment, RendererCanvas } from '@utilities/renderer-canvas.util';
import { GameState, RenderType, StateAction, StateActionType } from 'src/abstract/game-state.abstract';
import { ImageContainer, ImageRequest } from 'src/model/image.model';
import { WalKimState } from './walkim.state';

export class IntroState extends GameState {
  logoImage!: ImageContainer;

  animationTime = 0.0;
  logoAnimationTime = 0.0;
  textAnimationTime = 0.0;

  // Always do the fadeout, but in future can go to different end points
  fadeOut = false;
  fadeOutTime = 0.0;

  getImageList(): ImageRequest[] {
    return [
      {
        name: 'logo-kimlab',
        filename: '/images/logo/kimlab.jpg',
      },
    ];
  }

  doInit() {
    // Store the bitmap logo in an easier to get to place
    this.logoImage = this.imageStore.imageList[this.imageStore.getImageId('logo-kimlab')];
  }

  doLogic(deltaTime: number, keyboard: Map<string, boolean>): RenderType {
    this.animationTime += deltaTime / 10000.0;
    this.logoAnimationTime = Math.min(this.animationTime, 1.0);
    this.textAnimationTime = Math.max(0.0, Math.min((this.animationTime - 1.0) * 10.0, 1.0));

    if (this.fadeOut) {
      this.fadeOutTime += deltaTime / 1000.0;
    }

    // if text animation time is 1.0, then we are ready to test for the enter key
    if (keyboard.get('ENTER')) {
      this.fadeOut = true;
    }

    return RenderType.None;
  }

  doCanvas(renderer: RendererCanvas): void {
    // blank the image
    renderer.clearImage();

    // Get the fade out alpha to multiply all this with
    const fadeOutAlpha = Math.max(1.0 - this.fadeOutTime, 0.0);

    // Get the alpha for the anim time
    const alpha = this.logoAnimationTime * fadeOutAlpha;
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

    const textAlpha = this.textAnimationTime * fadeOutAlpha;
    renderer.drawText(
      'Press enter to start',
      RenderAlignment.Center,
      RenderAlignment.End,
      textAlpha,
    );
  }

  updateState(): StateAction {
    if (this.fadeOutTime < 1.0) {
      return { action: StateActionType.None, newState: null };
    } else {
      // make the new state - just recreate this one for now TEMP
      const walkState = new WalKimState();
      return { action: StateActionType.Swap, newState: walkState };
    }
  }
}
