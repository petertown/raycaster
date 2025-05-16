import { mod } from '@functions/math.functions';
import { CoordinateXY } from '@models/coordinates.model';

export interface DistanceCoord {
  distanceClosest: number; // closest point to the pixel
  distanceSecond: number; // second closest point
  closestPoint: number; // index of the point closest to the pixel
}

// Generate points to be used in a texture generator
// Keep them somewhat apart from each other
// Return both the generated points, but also the generated distances/closest points
export function generateHeightmapPointsAndDistances(
  imageWidth: number,
  imageHeight: number,
  pointMaxCount: number,
  pointMinDistance: number,
) {
  let distanceArray = makeEmptyDistanceArray(imageWidth, imageHeight);

  // Pick a spot for the first one to go and to update for the next one
  let largestDistancesList: { x: number; y: number }[];
  let nextX = Math.random() * imageWidth;
  let nextY = Math.random() * imageHeight;

  // Place the point from the last loop, smallestX/Y, and then recalculate the distance and find the furthest point (It'll be one of the corners first time)
  let pointList: CoordinateXY[] = [];
  let point = 0;
  let canMakeMore = true;
  while (canMakeMore) {
    pointList.push({
      x: nextX,
      y: nextY,
    });
    let lastX = nextX;
    let lastY = nextY;

    // Find the largest possible distance for this pixel to place the next one
    largestDistancesList = findLargestDistanceForNextPoint(
      imageWidth,
      imageHeight,
      lastX,
      lastY,
      distanceArray,
      point,
      pointMinDistance,
    );

    // pick something random off the largestDistancesList
    if (largestDistancesList.length > 0) {
      let nextPosition =
        largestDistancesList[Math.floor(Math.random() * (largestDistancesList.length - 1))];
      nextX = nextPosition.x;
      nextY = nextPosition.y;
    } else {
      canMakeMore = false;
    }

    if (point > pointMaxCount) {
      canMakeMore = false;
    }

    point++;
  }

  return { points: pointList, distances: distanceArray };
}

function findLargestDistanceForNextPoint(
  imageWidth: number,
  imageHeight: number,
  lastX: number,
  lastY: number,
  distanceArray: DistanceCoord[][],
  point: number,
  pointMinDistance: number,
) {
  let largestDistancesList = []; // keep a list of the last largestDistancesAmount largest distances we've found

  // Update the distances based on how far it is from the new point, and find the smallest we have
  for (let x = 0; x < imageWidth; x++) {
    for (let y = 0; y < imageHeight; y++) {
      // Adjust the X and Y so that we wrap the texture, so we test against points on the other side too
      const adjustedDistanceX = mod(lastX - x + imageWidth / 2.0, imageWidth) - imageWidth / 2.0;
      const adjustedDistanceY = mod(lastY - y + imageHeight / 2.0, imageHeight) - imageHeight / 2.0;

      let distForPixel = Math.sqrt(Math.pow(adjustedDistanceX, 2) + Math.pow(adjustedDistanceY, 2));

      // Compare that to what's already in the space
      const currentCalculation = distanceArray[x][y];
      if (distForPixel < currentCalculation.distanceClosest) {
        currentCalculation.closestPoint = point;
        currentCalculation.distanceSecond = currentCalculation.distanceClosest;
        currentCalculation.distanceClosest = distForPixel;
      } else {
        distForPixel = currentCalculation.distanceClosest;
      }

      // also check if it's eligible for a thing
      if (distForPixel > pointMinDistance) {
        largestDistancesList.push({ x: x, y: y });
      }
    }
  }
  return largestDistancesList;
}

function makeEmptyDistanceArray(imageWidth: number, imageHeight: number) {
  let pointMaxDistance = Math.sqrt(Math.pow(imageWidth, 2) + Math.pow(imageHeight, 2));
  // Create texture points to make the distances not touch
  let distanceArray: DistanceCoord[][] = [];
  for (let x = 0; x < imageWidth; x++) {
    let distanceArrayColumn: DistanceCoord[] = [];
    for (let y = 0; y < imageHeight; y++) {
      distanceArrayColumn.push({
        distanceClosest: pointMaxDistance,
        distanceSecond: pointMaxDistance,
        closestPoint: -1,
      });
    }
    distanceArray.push(distanceArrayColumn);
  }
  return distanceArray;
}
