export function heightmapNormaliseFilter(
  heightMap: number[][],
  minValue: number,
  maxValue: number,
) {
  let heightmapWidth = heightMap.length;
  let heightmapHeight = heightMap[0].length;

  // Create a new depth array copy of the first one and keep track of the min/max values
  let minHeight = 999999999; // Some massive number
  let maxHeight = 0;
  let normalisedHeightmap: number[][] = [];
  for (let x = 0; x < heightmapWidth; x++) {
    let normalisedColumn: number[] = [];
    for (let y = 0; y < heightmapHeight; y++) {
      const height = heightMap[x][y];

      minHeight = Math.min(height, minHeight);
      maxHeight = Math.max(height, maxHeight);

      normalisedColumn.push(height);
    }
    normalisedHeightmap.push(normalisedColumn);
  }

  // Normalise so that it's a value between minSurfaceHeight and maxSurfaceHeight
  for (let x = 0; x < heightmapWidth; x++) {
    for (let y = 0; y < heightmapHeight; y++) {
      let percentValue = (normalisedHeightmap[x][y] - minHeight) / (maxHeight - minHeight);
      normalisedHeightmap[x][y] = minValue + (maxValue - minValue) * percentValue;
    }
  }

  return normalisedHeightmap;
}
