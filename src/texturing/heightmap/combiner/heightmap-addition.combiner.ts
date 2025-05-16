// Going to break if they are different sizes
// Solution: Do not do that
export function heightmapAdditionCombiner(heightMap1: number[][], heightMap2: number[][]) {
  let heightmapWidth = heightMap1.length;
  let heightmapHeight = heightMap1[0].length;

  // Create a new heightmap which is the two of those added together
  let combinedHeightmap: number[][] = [];
  for (let x = 0; x < heightmapWidth; x++) {
    let combinedColumn: number[] = [];
    for (let y = 0; y < heightmapHeight; y++) {
      combinedColumn.push(heightMap1[x][y] + heightMap2[x][y]);
    }
    combinedHeightmap.push(combinedColumn);
  }

  return combinedHeightmap;
}
