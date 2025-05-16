import { mod } from '@functions/math.functions';
import { DistanceCoord } from '../generators/heightmap-points.generator';

// Make a heightMap where 0 is the edges, and 1 is not the edges
// Perfect for multiplying another heightmap with
export function heightmapEdgeFilter(
  distanceMap: DistanceCoord[][],
  edgeSize: number,
) {
  let heightmapWidth = distanceMap.length;
  let heightmapHeight = distanceMap[0].length;
  let edgeSizeSquared = edgeSize * edgeSize;

  let edgeArray: number[][] = [];
  for (let x = 0; x < heightmapWidth; x++) {
    let edgeArrayColumn: number[] = [];
    for (let y = 0; y < heightmapHeight; y++) {
      // Check for edges
      let pixelCoord = distanceMap[x][y];

      // For that point, are we on an edge? We are on an edge if the pixels around it have different closest points
      let edge = false;
      for (let x2 = -edgeSize; x2 <= edgeSize; x2++) {
        for (let y2 = -edgeSize; y2 <= edgeSize; y2++) {
          if (!(x2 === 0 && y2 === 0)) {
            // check distance squared against the distance
            let distSquared = x2 * x2 + y2 * y2;

            if (
              distSquared <= edgeSizeSquared &&
              distanceMap[mod(x + x2, heightmapWidth)][mod(y + y2, heightmapHeight)]
                .closestPoint !== pixelCoord.closestPoint
            ) {
              edge = true;
            }
          }
        }
      }

      edgeArrayColumn.push(edge ? 0 : 1);
    }
    edgeArray.push(edgeArrayColumn);
  }

  return edgeArray;
}
