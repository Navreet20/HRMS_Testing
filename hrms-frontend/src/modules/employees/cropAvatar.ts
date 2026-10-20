/** Client-side avatar crop helpers for the profile photo editor. */

export const AVATAR_CROP_OUTPUT_SIZE = 512;
export const AVATAR_CROP_MIN_ZOOM = 1;
export const AVATAR_CROP_MAX_ZOOM = 3;

export interface AvatarCropState {
  readonly zoom: number;
  /** Image-center offset from viewport center, in viewport pixels. */
  readonly offsetX: number;
  readonly offsetY: number;
}

export function coverScale(
  naturalWidth: number,
  naturalHeight: number,
  viewportSize: number,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0 || viewportSize <= 0) {
    return 1;
  }
  return Math.max(viewportSize / naturalWidth, viewportSize / naturalHeight);
}

export function displaySize(
  naturalWidth: number,
  naturalHeight: number,
  viewportSize: number,
  zoom: number,
): { width: number; height: number } {
  const scale = coverScale(naturalWidth, naturalHeight, viewportSize) * zoom;
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  };
}

/** Keep the circular viewport fully covered by the image. */
export function clampAvatarOffset(
  naturalWidth: number,
  naturalHeight: number,
  viewportSize: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): { offsetX: number; offsetY: number } {
  const { width, height } = displaySize(
    naturalWidth,
    naturalHeight,
    viewportSize,
    zoom,
  );
  const maxX = Math.max(0, (width - viewportSize) / 2);
  const maxY = Math.max(0, (height - viewportSize) / 2);
  return {
    offsetX: Math.min(maxX, Math.max(-maxX, offsetX)) || 0,
    offsetY: Math.min(maxY, Math.max(-maxY, offsetY)) || 0,
  };
}

export function clampAvatarZoom(zoom: number): number {
  return Math.min(
    AVATAR_CROP_MAX_ZOOM,
    Math.max(AVATAR_CROP_MIN_ZOOM, zoom),
  );
}

/**
 * Draw the framed circular crop into a square canvas and return a JPEG File.
 */
export function exportCroppedAvatarFile(
  image: CanvasImageSource & { naturalWidth?: number; width?: number },
  naturalWidth: number,
  naturalHeight: number,
  viewportSize: number,
  crop: AvatarCropState,
  fileName = "avatar.jpg",
): Promise<File> {
  const zoom = clampAvatarZoom(crop.zoom);
  const { offsetX, offsetY } = clampAvatarOffset(
    naturalWidth,
    naturalHeight,
    viewportSize,
    zoom,
    crop.offsetX,
    crop.offsetY,
  );
  const scale = coverScale(naturalWidth, naturalHeight, viewportSize) * zoom;
  const out = AVATAR_CROP_OUTPUT_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvas is not available"));
  }

  // Map viewport center → image natural coords, then take a square of
  // viewportSize/scale on each side.
  const centerX = naturalWidth / 2 - offsetX / scale;
  const centerY = naturalHeight / 2 - offsetY / scale;
  const sourceSize = viewportSize / scale;
  const sx = centerX - sourceSize / 2;
  const sy = centerY - sourceSize / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, out, out);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not export cropped photo"));
          return;
        }
        resolve(new File([blob], fileName, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}
