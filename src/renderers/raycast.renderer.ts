export class RendererRaycast {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  aspectRatio = 1.0;

  constructor(canvasIn: HTMLCanvasElement, ctxIn: CanvasRenderingContext2D) {
    this.canvas = canvasIn;
    this.ctx = ctxIn;
  }

  // Update every frame
  setAspectRatio(aspectRatioNew: number) {
    this.aspectRatio = aspectRatioNew;
  }
}
