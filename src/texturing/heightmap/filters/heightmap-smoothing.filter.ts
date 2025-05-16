import { mod } from '@functions/math.functions';

// It's not really a gaussian curve but like, I don't care, don't ask me about no gaussian curves
export function heightmapSmoothFilter(heightMap: number[][], blurAmount: number) {
  let heightmapWidth = heightMap.length;
  let heightmapHeight = heightMap[0].length;

  let gaussianCurve: number[] = getGaussianFilterArray(blurAmount);

  // Create a depth array for doing the horizontal blur
  let depthSmoothArrayHorizontal: number[][] = [];
  for (let x = 0; x < heightmapWidth; x++) {
    let depthSmoothArrayColumn: number[] = [];
    for (let y = 0; y < heightmapHeight; y++) {
      // blur with the existing array horizontally
      let sum = 0;
      for (let gx = -blurAmount; gx <= blurAmount; gx++) {
        sum += gaussianCurve[Math.abs(gx)] * heightMap[mod(x + gx, heightmapWidth)][y];
      }
      depthSmoothArrayColumn.push(sum);
    }
    depthSmoothArrayHorizontal.push(depthSmoothArrayColumn);
  }

  // Use that to vertical blur in another new array
  let depthSmoothArrayVertical: number[][] = [];
  for (let x = 0; x < heightmapWidth; x++) {
    let depthSmoothArrayColumn: number[] = [];
    for (let y = 0; y < heightmapHeight; y++) {
      // blur with the temp array vertically
      let sum = 0;
      for (let gy = -blurAmount; gy <= blurAmount; gy++) {
        sum +=
          gaussianCurve[Math.abs(gy)] * depthSmoothArrayHorizontal[x][mod(y + gy, heightmapHeight)];
      }
      depthSmoothArrayColumn.push(sum);
    }
    depthSmoothArrayVertical.push(depthSmoothArrayColumn);
  }

  return depthSmoothArrayVertical;
}
function getGaussianFilterArray(blurAmount: number) {
  let gaussianCurve: number[] = [];
  if (blurAmount === 0) {
    gaussianCurve.push(1.0);
  } else {
    for (let gv = 0; gv <= blurAmount; gv++) {
      const fakeRads = (gv / (blurAmount + 1)) * (Math.PI / 2.0);
      gaussianCurve.push(Math.cos(fakeRads));
    }
    // Normalise it - find the sum
    let sum = 0;
    for (let gv = -blurAmount; gv <= blurAmount; gv++) {
      sum += gaussianCurve[Math.abs(gv)];
    }
    let multiply = 1.0 / sum;
    for (let gv = 0; gv <= blurAmount; gv++) {
      gaussianCurve[gv] = gaussianCurve[gv] * multiply;
    }
  }
  return gaussianCurve;
}
