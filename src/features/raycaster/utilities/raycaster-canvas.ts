export class RaycasterCanvas {
  width: number;
  height: number;
  dataAspectRatio!: number;
  realWidth!: number;
  realHeight!: number;
  aspectRatio!: number;
  projectionLength: number;

  // Store all the canvas data, so we can give it to the renderers and have them able to use it
  element!: HTMLCanvasElement;
  context!: CanvasRenderingContext2D;

  targetACurrent = true; // true if we are drawing to targetA, false if we are drawing to targetB
  target!: ImageData; // The image data of the canvas, only need one, can draw to same one over and over (I hope)
  newImageReady = false;

  constructor() {
    const canvasElement = document.getElementById('draw-canvas') as HTMLCanvasElement;
    this.width = canvasElement.width;
    this.height = canvasElement.height;
    this.dataAspectRatio = (1.0 * this.width) / this.height;
    this.projectionLength = 0.8;

    if (canvasElement) {
      const canvasContext = canvasElement.getContext('2d', { willReadFrequently: true });

      if (canvasContext) {
        this.element = canvasElement;
        this.context = canvasContext;

        // clear the canvas first so that everything is fully opaque
        this.clearCanvas();

        // save the render target (twice) with the cleared canvas!
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
  public finishDraw(updatedTarget: ImageData) {
    this.target = updatedTarget;
    this.targetACurrent = !this.targetACurrent;
    this.newImageReady = true;
  }

  // draw the canvas that's not being drawn to right now
  public screenDraw() {
    if (this.newImageReady) {
      this.context.putImageData(this.target, 0, 0);
    }
  }

  fullscreen() {
    this.element.requestFullscreen();
    this.element.focus();
    // Ask the browser to lock the pointer
    this.element.requestPointerLock();
  }
}
