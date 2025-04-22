import { mod } from './raycaster-math';

export class RaycasterCanvas {
  width: number;
  height: number;
  dataAspectRatio!: number;
  realWidth!: number;
  realHeight!: number;
  aspectRatio!: number;

  // Store all the canvas data, so we can give it to the renderers and have them able to use it
  element!: HTMLCanvasElement;
  context!: CanvasRenderingContext2D;
  target!: ImageData; // The image data of the canvas, only need one, can draw to same one over and over (I hope)

  constructor() {
    const canvasElement = document.getElementById('draw-canvas') as HTMLCanvasElement;
    this.width = canvasElement.width;
    this.height = canvasElement.height;
    this.dataAspectRatio = (1.0 * this.width) / this.height;

    if (canvasElement) {
      const canvasContext = canvasElement.getContext('2d', { willReadFrequently: true });

      if (canvasContext) {
        this.element = canvasElement;
        this.context = canvasContext;

        // clear the canvas first so that everything is fully opaque
        this.clearCanvas();

        // save the render target with the cleared canvas!
        this.target = this.context.getImageData(0, 0, this.width, this.height);
      }
    }
  }

  // Clear the canvas by setting every pixel to black and fully opaque
  private clearCanvas() {
    const imageData = this.context.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0; // red
      data[i + 1] = 0; // green
      data[i + 2] = 0; // blue
      data[i + 3] = 255; // alpha - always set to 255! It is by default 0, and so nothing shows
    }

    this.context.putImageData(imageData, 0, 0);
  }

  // Call at start to check the aspect ratio hasn't changed
  // If the canvas element resizes change the aspect ratio
  // return true if it changed size
  public startDraw() {
    // get aspect ratio of canvas element and change the renderer to match
    const canvasElementWidth = this.element.offsetWidth;
    const canvasElementHeight = this.element.offsetHeight;

    const changed =
      this.realWidth !== canvasElementWidth || this.realHeight !== canvasElementHeight;

    if (changed) {
      this.realWidth = canvasElementWidth;
      this.realHeight = canvasElementHeight;

      this.aspectRatio = (1.0 * canvasElementWidth) / canvasElementHeight;
    }
  }

  // Call at end to put the render target on the canvas
  public finishDraw() {
    this.context.putImageData(this.target, 0, 0);
  }

  // Use this to get the colour indices for a canvas/image - also wrap this number to width and height
  // By default it doesn't wrap and it is getting the canvas size
  public getColorIndicesForCoord = (
    x: number,
    y: number,
    width = this.element.width,
    height = this.element.height,
    wrap = false,
  ) => {
    if (wrap) {
      // first wrap the x and y coords to the width/height
      x = mod(x, width);
      y = mod(y, height);
    }
    const red = y * (width * 4) + x * 4;
    // return R G B A
    return { red: red, green: red + 1, blue: red + 2, alpha: red + 3 };
  };

  fullscreen() {
    this.element.requestFullscreen();
    this.element.focus();
    // Ask the browser to lock the pointer
    this.element.requestPointerLock();
  }
}
