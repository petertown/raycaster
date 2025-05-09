// interface that needs to be implemented by every game state
import { ImageStore } from '@utilities/image-store';
import { RendererCanvas } from '@utilities/renderer-canvas.util';
import { ImageRequest } from './image.model';

// Probably move it into some model file
export interface GameState {
  // Init functions
  // One to return a list of images this state needs
  getImageList(): ImageRequest[];
  // Textures are not used at all in the game states - only the renderer
  // One to set up the map but only if needed ...

  // After loading the image, the Controller sends this back just the images it needs
  setImageList(imageStoreNew: ImageStore): void;

  // Run game state logic using a deltaTime as input
  doLogic(deltaTime: number): void;

  // Run game state render of the map
  // doRender(): void;

  // Run game state render to the canvas if it needs it
  doCanvas(renderer: RendererCanvas): void;

  // TODO: Run game state DOM stuff? Like buttons etc?
  // Maybe some kind of interface pattern

  // TODO: function to be called by the GameController to say whether it needs to swap to a new state OR remove itself, OR push some new state onto the list
  // Should that still run a draw on it? Or not?
}
