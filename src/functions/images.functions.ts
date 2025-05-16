// May want to add "clamp" "wrap" for texture coordinates later
export function getIndicesForCoord(x: number, y: number, width: number, height: number) {
  // return index for red only
  // Old style: return all of it!
  // const red = y * (width * 4) + x * 4;
  // return { red: red, green: red + 1, blue: red + 2, alpha: red + 3 };

  return y * (width * 4) + x * 4;
}
