// interface that needs to be implemented by every game state
import { ImageStore } from 'src/utils/image-store.util';
import { RendererCanvas } from 'src/renderers/canvas.renderer';
import { ImageRequest } from '../models/image.model';

export enum StateActionType {
  None,
  Swap,
  Push,
  Pop,
}

export interface StateAction {
  action: StateActionType;
  newState: GameState | null;
}

export enum RenderMode {
  None,
  Map,
  Raycast,
  Table,
}

// Probably move it into some model file
export abstract class GameState {
  imageStore!: ImageStore;

  // Return a list of images this state needs
  abstract getImageList(): ImageRequest[];

  // After loading the image, the Controller sends an ImageStore to access those images
  setImageList(imageStoreNew: ImageStore): void {
    this.imageStore = imageStoreNew;
  }

  abstract doInit(): void;

  // Run game state logic using a deltaTime as input and return the RenderType we want
  abstract doLogic(deltaTime: number, keyboard: Map<string, boolean>): RenderMode;

  // Run game state render of the map
  // doRender(): void;

  // Run game state render to the canvas if it needs it
  abstract doCanvas(renderer: RendererCanvas): void;

  // TODO: Run game state DOM stuff? Like buttons etc?
  // Maybe some kind of interface pattern

  // Function to be called by the GameController to say whether it needs to swap to a new state OR remove itself, OR push some new state onto the list
  abstract updateState(): StateAction;
}
