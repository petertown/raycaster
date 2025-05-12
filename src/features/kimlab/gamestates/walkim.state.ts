import { RendererCanvas } from '@utilities/renderer-canvas.util';
import { GameState, RenderMode, StateAction, StateActionType } from 'src/abstract/game-state.abstract';
import { ImageRequest } from 'src/model/image.model';

export class WalKimState extends GameState {
  getImageList(): ImageRequest[] {
    return [];
  }

  doInit() {}

  doLogic(deltaTime: number, keyboard: Map<string, boolean>): RenderMode {
    return RenderMode.Raycast;
  }

  doCanvas(renderer: RendererCanvas): void {}

  updateState(): StateAction {
    return { action: StateActionType.None, newState: null };
  }
}
