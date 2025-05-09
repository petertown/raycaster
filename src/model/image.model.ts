export enum ImageType {
  Image,
  Logo,
  Texture,
}

// To store a loaded image
export interface ImageContainer {
  name: string;
  type: ImageType;
  width: number;
  height: number;
  data: ImageData;
}

// To request an image load
export interface ImageRequest {
  name: string;
  type: string; // type in JSON is a string which we need to map to
  filename: string;
  width: number;
  height: number;
}
