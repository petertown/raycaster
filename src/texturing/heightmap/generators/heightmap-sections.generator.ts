import { DistanceCoord } from './heightmap-points.generator';

// Randomly choose the heights for each section and then apply that to a heightmap
export function generateSectionsHeightmap(
  distanceMap: DistanceCoord[][],
  minSectionHeight: number,
  maxSectionHeight: number,
) {
  let heightmapWidth = distanceMap.length;
  let heightmapHeight = distanceMap[0].length;

  // make a new list with random heights for the section heights
  let sectionHeights: number[] = [];

  let sectionArray: number[][] = [];
  for (let x = 0; x < heightmapWidth; x++) {
    let sectionArrayColumn: number[] = [];
    for (let y = 0; y < heightmapHeight; y++) {
      // Check which section
      let closestPoint = distanceMap[x][y].closestPoint;
      while (closestPoint >= sectionHeights.length) {
        // We need to make more points to get this one
        sectionHeights.push(
          Math.random() * (maxSectionHeight - minSectionHeight) + minSectionHeight,
        );
      }

      sectionArrayColumn.push(sectionHeights[closestPoint]);
    }
    sectionArray.push(sectionArrayColumn);
  }
  return sectionArray;
}
