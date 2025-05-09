import { Component } from '@angular/core';
import { ImageStore } from '@utilities/image-store';
import { RendererCanvas } from '@utilities/renderer-canvas.util';
import { GameState } from 'src/model/game-state.model';
import { ImageLoader } from '../../utilities/image-loader.util';
import { IntroState } from './gamestates/intro.state';

@Component({
  selector: 'app-kimlab',
  imports: [],
  templateUrl: './kimlab.component.html',
  styleUrl: './kimlab.component.scss',
})
export class KimlabComponent {
  images: ImageLoader = new ImageLoader();

  // canvas data and context
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  stateList: GameState[] = [];

  lastDrawTime: number = 0;

  // Render mode
  // An enum here to say wether we are showing the 3D scene, the tabletop scene, or a closeup of the table map view
  // And of course, a view where it just calls the state to draw to the canvas
  // Each game state can switch between them, a callback in a gamestate for logic says which mode to show
  // There should be a quick fade between them
  // Only the active one should be being rendered too at the one time

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

  // Need to do a few things
  // Start with a menu
  // new game, continue, settings
  // So that's first thing to do
  // Menu's should be html overlaid over the top of the canvas, and should be able to be opened as a game state
  // So, start with a main menu animation on the canvas
  // Then when that menu animation ends, swap to the main menu over the top of it
  /// This was an idea but I don't like it now
  /* export enum GameStateType {
    MainMenu, // Just sitting on the menu
    GameInit, // Do the stuff to initialise a new game, then navigate to the GameRun
    GameRun, // Run game logic, and stop when there's a choice to be done, will show the 3D scene from the players POV
    GamePlayerChoice, // Stopped to make a choice, shows the available options in a clickable menu, hovering over them should look at the choice
    GameFriendChoice, // Stopped so that the other players can make a choice and say it in dialog, then navigates to GameDialog to actually say it
    GameDialog, // Plays a set of dialog, then goes back to GameRun afterwards
    GameMenu, // Player has pressed escape and opened the menu - pressing escape again afterwards will go back to the previous gamestate
  }
 */

  constructor() {}

  // Still need an INIT before the game starts to load everything in
  ngAfterViewInit(): void {
    // Get canvas element and context
    this.canvas = document.getElementById('draw-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d', {
      willReadFrequently: true,
    }) as CanvasRenderingContext2D;

    // Make our renderer instances
    this.rendererCanvas = new RendererCanvas(this.canvas, this.ctx);

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
    const currentState = this.stateList[this.stateList.length - 1];

    // Do game logic
    currentState.doLogic(deltaTime);

    // Switch to render mode and draw it
    // TODO

    // Draw 2D elements
    currentState.doCanvas(this.rendererCanvas);

    // Do the next loop
    requestAnimationFrame(this.gameLoop);
  };

  // Run the async initialisation of the state by loading in all the images it needs
  initState<T extends GameState>(newState: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const imageList = newState.getImageList();
      if (imageList.length > 0) {
        this.images.loadImages(imageList).then((imageStore) => {
          // Give these images to the state
          newState.setImageList(imageStore);

          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
