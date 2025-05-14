/// <reference lib="webworker" />

export enum RayCastMessageType {
  Init, // Initial setup with no map or anything, can't be used yet that'll throw an error
  New, // Send through Map and texture data to the worker to entirely replace what it has
  Update, // Update what it has
  Draw, // Draw the current held map data, with a render position, angle, and aspectRatio
}

export interface RaycastMessageInit {
  messageType: RayCastMessageType;
  target: ImageData;
  renderWidth: number;
  renderHeight: number;
}
export interface RaycastMessageInitResponse {
  messageType: RayCastMessageType;
}

export interface RaycastMessageDraw {
  messageType: RayCastMessageType;
  aspectRatio: number;
}
export interface RaycastMessageDrawResponse {
  messageType: RayCastMessageType;
  target: ImageData;
}

// These are variables specific for a single instance of a Web Worker
let target: ImageData;

addEventListener('message', ({ data }) => {
  if (data.messageType === RayCastMessageType.Draw) {
    postMessage(drawScene(data));
  } else if (data.messageType === RayCastMessageType.Init) {
    postMessage(initScene(data));
  }
});

function initScene(initMessage: RaycastMessageInit): RaycastMessageInitResponse {
  target = initMessage.target;

  return {
    messageType: initMessage.messageType,
  };
}

function drawScene(initMessage: RaycastMessageDraw): RaycastMessageDrawResponse {
  // Make the entire scene a silly colour

  return {
    messageType: initMessage.messageType,
    target: target,
  };
}
