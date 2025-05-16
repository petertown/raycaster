// To store a loaded image
export interface ImageContainer {
  name: string;
  width: number;
  height: number;
  bitmap: ImageBitmap;
}

// To request an image load
export interface ImageRequest {
  name: string;
  filename: string;
}
