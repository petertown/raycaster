import { mod } from '@functions/math.functions';
import { CoordinateXY } from '@models/coordinates.model';

// Make some random "lumps" or "craters" in a heightmap
// Make the maxSurface less than the minSurface if that's what you want
// Might also be a good one to "smooth" so it more cleanly maps to the surface
// Might not be the most useful but I think I could do something with it
export function generateSurfaceSpotsHeightmap(
  imageWidth: number,
  imageHeight: number,
  bumpList: CoordinateXY[],
  bumpWidth: number,
) {
  let surfaceHeights: number[][] = [];
  for (let x = 0; x < imageWidth; x++) {
    let surfaceColumn: number[] = [];
    for (let y = 0; y < imageHeight; y++) {
      let height = 0;
      for (let bump of bumpList) {
        const distanceX = mod(bump.x - x + imageWidth / 2.0, imageWidth) - imageWidth / 2.0;
        const distanceY = mod(bump.y - y + imageWidth / 2.0, imageWidth) - imageWidth / 2.0;

        let distForPixel = Math.sqrt(Math.pow(distanceX, 2) + Math.pow(distanceY, 2));
        height += Math.max(0, 1 - distForPixel / bumpWidth);
      }

      surfaceColumn.push(height);
    }
    surfaceHeights.push(surfaceColumn);
  }

  return surfaceHeights;
}
