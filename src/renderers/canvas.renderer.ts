import { ImageContainer } from 'src/models/image.model';

// Come up with the others as I need them for now
export enum RenderAlignment {
  Start,
  Center,
  End,
}

export class RendererCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  aspectRatio = 1.0;

  // The top left and bottom right of our render area for the aspect ratio
  renderXS: number;
  renderYS: number;
  renderXE: number;
  renderYE: number;

  constructor(canvasIn: HTMLCanvasElement, ctxIn: CanvasRenderingContext2D) {
    this.canvas = canvasIn;
    this.ctx = ctxIn;

    // Set the default render1 and render2 to be a full screen
    this.renderXS = 0;
    this.renderYS = 0;
    this.renderXE = this.canvas.width;
    this.renderYE = this.canvas.height;
  }

  // Update every frame
  setAspectRatio(aspectRatioNew: number) {
    this.aspectRatio = aspectRatioNew;
  }

  // Call this first to say what the area you want to draw on's dimensions are
  // And how it's aligned
  public setRenderArea(
    drawAspectRatio: number,
    alignmentX: RenderAlignment,
    alignmentY: RenderAlignment,
  ) {
    // Compare the aspect ratios
    const xRatio = drawAspectRatio / this.aspectRatio;
    const yRatio = 1;
    const largest = Math.max(xRatio, yRatio);

    this.renderXE = (this.canvas.width * xRatio) / largest;
    this.renderYE = (this.canvas.height * yRatio) / largest;

    const renderGapX = this.canvas.width - this.renderXE;
    const renderGapY = this.canvas.height - this.renderYE;

    // Handle the alignments
    switch (alignmentX) {
      case RenderAlignment.Center:
        this.renderXS = renderGapX / 2.0;
        this.renderXE += renderGapX / 2.0;
        break;
      case RenderAlignment.End:
        this.renderXS = renderGapX;
        this.renderXE += renderGapX;
        break;
      default: // Start doesn't need to do anything
        break;
    }

    switch (alignmentY) {
      case RenderAlignment.Center:
        this.renderYS = renderGapY / 2.0;
        this.renderYE += renderGapY / 2.0;
        break;
      case RenderAlignment.End:
        this.renderYS = renderGapY;
        this.renderYE += renderGapY;
        break;
      default: // Start doesn't need to do anything
        break;
    }
  }

  clearImage() {
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Numbers are 0 to 1, to map direct to the aspect ratio
  drawImage(
    image: ImageContainer,
    alignmentX: RenderAlignment,
    alignmentY: RenderAlignment,
    offset: { x: number; y: number },
    alpha = 1.0,
  ) {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;

    this.setRenderArea(image.width / image.height, alignmentX, alignmentY);
    // Transform those points into our aspect correct points
    const transformTL = this.transformPoint({ x: offset.x, y: offset.y });
    const transformBR = this.transformPoint({ x: 1.0 + offset.x, y: 1.0 + offset.y });

    this.ctx.drawImage(
      image.bitmap,
      transformTL.x,
      transformTL.y,
      transformBR.x - transformTL.x,
      transformBR.y - transformTL.y,
    );

    this.ctx.restore();
  }

  drawText(content: string, alignmentX: RenderAlignment, alignmentY: RenderAlignment, alpha = 1.0) {
    let textSize = 20; // Not sure if I want to set it all the time

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = 'white';
    this.ctx.font = textSize + 'px Consolas';

    // Scale for the aspect ratio - needs to be countered when positioning it later
    this.ctx.scale(1.0 / this.aspectRatio, 1.0);

    // measure the text (If we want to wrap later)
    // const textRight = this.ctx.measureText(content).actualBoundingBoxRight;

    let textY = textSize;
    switch (alignmentY) {
      case RenderAlignment.Center:
        textY = this.canvas.height / 2.0 + textSize / 2.0;
        break;
      case RenderAlignment.End:
        textY = this.canvas.height - textSize / 2.0;
        break;
      default: // Start doesn't need to do anything
        break;
    }

    let textX = 0.0;
    switch (alignmentX) {
      case RenderAlignment.Center:
        textX = this.aspectRatio * (this.canvas.width / 2.0);
        this.ctx.textAlign = 'center';
        break;
      case RenderAlignment.End:
        textX = this.aspectRatio * this.canvas.width;
        this.ctx.textAlign = 'right';
        break;
      default: // Start doesn't need to do anything
        break;
    }

    this.ctx.fillText(content, textX, textY, this.canvas.width * this.aspectRatio);
    this.ctx.restore();
  }

  // This is currently a raw version to just draw some image data so we can see it loop
  drawImageData(imageData: ImageData) {
    // TODO: Make it draw it with an alignment/offset
    // Though that would take manual drawing as putting image data cannot be scaled
    // So temporary, just loop the texture and I'll make sure my window is the right size
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        this.ctx.putImageData(imageData, imageData.width * x, imageData.height * y);
      }
    }
  }

  private transformPoint(point: { x: number; y: number }) {
    let newPoint = { x: 0, y: 0 };

    newPoint.x = (this.renderXE - this.renderXS) * point.x + this.renderXS;
    newPoint.y = (this.renderYE - this.renderYS) * point.y + this.renderYS;

    return newPoint;
  }
}
