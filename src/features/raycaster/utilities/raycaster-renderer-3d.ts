import { RaycasterMap } from './raycaster-map';
import { RaycasterRays } from './raycaster-ray';
import { RaycasterTextures } from './raycaster-textures';

// We aren't using this anymore! We're using the web worker to make it threaded
export class RaycasterRenderer3D {
  map: RaycasterMap;
  rays: RaycasterRays;
  textures: RaycasterTextures;

  verticalLookMax = 200;
  ambientRed = 1.0;
  ambientGreen = 1.0;
  ambientBlue = 1.0;
  doLighting = false;

  renderWidth: number;
  renderHeight: number;
  aspectRatio = 1.0; // calculate every frame
  projectionLength = 1.0;
  target!: ImageData;

  // render targets and data
  depthList: number[];

  constructor(
    map: RaycasterMap,
    rays: RaycasterRays,
    textures: RaycasterTextures,
    renderWidth: number,
    renderHeight: number,
  ) {
    this.map = map;
    this.rays = rays;
    this.textures = textures;
    this.renderWidth = renderWidth;
    this.renderHeight = renderHeight;

    // make depth list to be used later - the size of the width of the canvas in pixels
    this.depthList = [];
    for (let i = 0; i < this.renderWidth; i++) {
      this.depthList.push(0);
    }
  }

  // Use this to get the colour indices for a canvas/image - also wrap this number to width and height
  // By default it doesn't wrap and it is getting the canvas size
  public getColorIndicesForCoord = (
    x: number,
    y: number,
    width = this.renderWidth,
    height = this.renderHeight,
  ) => {
    x = Math.min(width - 1, Math.max(0, x));
    y = Math.min(height - 1, Math.max(0, y));
    const red = y * (width * 4) + x * 4;
    // return R G B A
    return { red: red, green: red + 1, blue: red + 2, alpha: red + 3 };
  };
}
