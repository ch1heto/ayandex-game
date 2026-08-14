// Integer zoom levels are intentional. Phaser disables renderRoundPixels for
// fractional camera zoom, which makes high-contrast ground details change
// sampling phase while the camera follows the player.
export const CAMERA_ZOOM_PRESETS = [1, 2, 3] as const;

export type CameraZoomLevel = 'far' | 'medium' | 'close';

const CAMERA_ZOOM_STORAGE_KEY = 'ashvale-camera-zoom';
const DEFAULT_ZOOM_INDEX = 1;

export function loadCameraZoomIndex(): number {
  try {
    const saved = localStorage.getItem(CAMERA_ZOOM_STORAGE_KEY);
    const index = saved === null ? Number.NaN : Number.parseInt(saved, 10);
    if (Number.isInteger(index) && index >= 0 && index < CAMERA_ZOOM_PRESETS.length) return index;
  } catch (error) {
    console.warn('Camera zoom preference could not be loaded.', error);
  }
  return DEFAULT_ZOOM_INDEX;
}

export function saveCameraZoomIndex(index: number): void {
  try {
    localStorage.setItem(CAMERA_ZOOM_STORAGE_KEY, String(index));
  } catch (error) {
    console.warn('Camera zoom preference could not be saved.', error);
  }
}
