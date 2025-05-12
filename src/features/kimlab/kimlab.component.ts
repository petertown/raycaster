import { Component } from '@angular/core';
import { RendererCanvas } from '@utilities/renderer-canvas.util';
import {
  GameState,
  RenderMode,
  StateAction,
  StateActionType,
} from 'src/abstract/game-state.abstract';
import { ImageLoader } from '../../utilities/image-loader.util';
import { IntroState } from './gamestates/intro.state';
import { RayCastMessageType } from './workers/raycaster.worker';

@Component({
  selector: 'app-kimlab',
  imports: [],
  templateUrl: './kimlab.component.html',
  styleUrl: './kimlab.component.scss',
})
export class KimlabComponent {
  // Utility to load images (Not for textures)
  images: ImageLoader = new ImageLoader();

  // canvas data and context
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  target!: ImageData;

  // States
  stateList: GameState[] = [];
  stateCurrent!: GameState;

  // Last timestamp when a draw started
  lastDrawTime: number = 0;

  // Keyboard and mouse
  controlMap = new Map<string, boolean>();
  mouseX = 0;
  mouseY = 0;

  // Render mode
  renderMode: RenderMode = RenderMode.None;

  // Web Workers, to handle multi threading - start with just one
  private worker!: Worker;

  // Render data
  // Keep the data that the renderer needs - so it can give it to the renderers as they need it
  // This also helps if we need to reinit the Web Workers at some point
  // Any updates to these should be handled with functions that both this and the Web Worker can use so it does the same things
  // export function replaceSprites(renderData: data to be modified, spriteList: List of sprites to totally replace those sprites with)
  // For example

  // 3D renderer (raycaster)

  // Table renderer (Pan and zoom over our players at the table)
  // Hopefully we can have the thing the map renders

  // Map renderer (Flat image)
  // We should have this one draw every time the data changes
  // Draw it to a texture, so we can use it to draw on the table

  // Renderer Utilities
  rendererCanvas!: RendererCanvas;

  // Button renderer
  // Need some way to render text and buttons - Can have a <div> on top of the canvas with a good layout for the buttons
  // Game states should request a button with a name and be told when that button is hovered or clicked
  // So that when Kim asks you what you want to do, it can show a bunch of button options and when you hover the 3D scene can point at it
  // Also, when drawing it, it should organise the options based on the aspect ratio
  // Should clear when a state is changed

  // Dialog renderer
  // Something to show a text box with text in it
  // Should clear when a state is changed

  // Still need an INIT before the game starts to load everything in
  ngAfterViewInit(): void {
    // Get canvas element and context
    this.canvas = document.getElementById('draw-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d', {
      willReadFrequently: true,
    }) as CanvasRenderingContext2D;

    // clear the canvas first so that everything is fully opaque
    this.clearCanvas();

    // save the render target (twice) with the cleared canvas!
    this.target = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    // Make our renderer instances
    this.rendererCanvas = new RendererCanvas(this.canvas, this.ctx);

    // Init Web Worker
    this.initWebWorker();

    // Initialise controls
    this.initControls();

    // Start with an IntroGameState which just shows the logo
    const logoState = new IntroState();
    this.initState(logoState).then((state) => {
      this.stateList.push(logoState);

      // start game loop now it's done
      requestAnimationFrame(this.gameLoop);
    });
  }

  private readonly gameLoop = (timeNow: number) => {
    // Timing
    let deltaTime = 0;
    if (this.lastDrawTime > 0) {
      deltaTime = timeNow - this.lastDrawTime;
    }
    this.lastDrawTime = timeNow;

    // Get aspect ratio
    const aspectRatio = (1.0 * this.canvas.offsetWidth) / this.canvas.offsetHeight;
    this.rendererCanvas.setAspectRatio(aspectRatio);

    // Get the top gamestate and run it
    this.stateCurrent = this.stateList[this.stateList.length - 1];

    // Do game logic and get the updated render mode
    this.renderMode = this.stateCurrent.doLogic(deltaTime, this.controlMap);

    // Check if we should change the state
    const stateChange = this.stateCurrent.updateState();
    if (stateChange.action === StateActionType.None) {
      // If we are rendering to raycast, give to the web worker now
      if (this.renderMode === RenderMode.Raycast) {
        this.worker.postMessage({
          messageType: 'draw',
          aspectRatio: aspectRatio,
        });
      } else {
        // Draw to the canvas
        this.doFinalise();
      }
    } else {
      this.handleStateChange(stateChange);
    }
  };

  private doFinalise() {
    this.stateCurrent.doCanvas(this.rendererCanvas);

    // Do the next loop
    requestAnimationFrame(this.gameLoop);
  }

  private handleStateChange(stateChange: StateAction) {
    if (stateChange.action === StateActionType.Pop) {
      this.stateList.pop();
      requestAnimationFrame(this.gameLoop);
    } else if (stateChange.action === StateActionType.Push && stateChange.newState) {
      this.initState(stateChange.newState).then((state) => {
        this.stateList.push(state);
        requestAnimationFrame(this.gameLoop);
      });
    } else if (stateChange.action === StateActionType.Swap && stateChange.newState) {
      this.initState(stateChange.newState).then((state) => {
        this.stateList.pop();
        this.stateList.push(state);
        requestAnimationFrame(this.gameLoop);
      });
    }
  }

  // Run the async initialisation of the state by loading in all the images it needs
  initState<T extends GameState>(newState: T): Promise<T> {
    return new Promise((resolve, reject) => {
      const imageList = newState.getImageList();
      if (imageList.length > 0) {
        this.images.loadImages(imageList).then((imageStore) => {
          // Give these images to the state
          newState.setImageList(imageStore);

          // How to send the new map data to the web worker? 
          newState.doInit();

          resolve(newState);
        });
      } else {
        resolve(newState);
      }
    });
  }

  initControls() {
    this.canvas.onmousemove = (event) => {
      // subtract the offsetX and Y from the real canvas size and make mouse from -1 to 1
      this.mouseX = 2.0 * (event.offsetX / this.canvas.offsetWidth - 0.5);
      this.mouseY = 2.0 * (event.offsetY / this.canvas.offsetHeight - 0.5);
      // I want to figure out the better mouse movement at some point so not using it yet
      // Want to change it to be "relative" mouse movement
    };

    // Have a "map" of buttons pressed, or perhaps I need to also have upper and lower case treated the same?
    this.canvas.addEventListener('keydown', (e: KeyboardEvent) => {
      this.controlMap.set(this.getKeyCode(e.key), true);
    });

    this.canvas.addEventListener('keyup', (e: KeyboardEvent) => {
      this.controlMap.set(this.getKeyCode(e.key), false);
    });
  }

  private getKeyCode(keyCode: string) {
    // We only care about the arrows and the single digits
    if (keyCode.length === 1) {
      return keyCode.toUpperCase();
    } else {
      switch (keyCode) {
        case 'ArrowDown':
          return 'DOWN';
        case 'ArrowUp':
          return 'UP';
        case 'ArrowLeft':
          return 'LEFT';
        case 'ArrowRight':
          return 'RIGHT';
        case 'Enter':
          return 'ENTER';
        case 'Escape':
          return 'ESCAPE';
        default:
          return 'OTHER';
      }
    }
  }

  private initWebWorker() {
    // Create a new Web Worker
    this.worker = new Worker(new URL('./workers/raycaster.worker', import.meta.url));

    this.worker.onmessage = ({ data }) => {
      if (data === RayCastMessageType.Draw) {
        // Draw to the canvas and go to next frame
        this.doFinalise();
      } else if (data === RayCastMessageType.Init) {
        // Nothing to do YET
      }
    };

    // init the worker
    this.worker.postMessage({
      messageType: 'init',
      target: this.target,
      renderWidth: this.canvas.width,
      renderHeight: this.canvas.height,
    });
  }

  // Clear the canvas by setting every pixel to black and fully opaque
  private clearCanvas() {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0; // red
      data[i + 1] = 0; // green
      data[i + 2] = 0; // blue
      data[i + 3] = 255; // alpha - always set to 255! It is by default 0, and so nothing shows
    }

    this.ctx.putImageData(imageData, 0, 0);
  }
}
