// ============================================================
// DONJONFLASH — Dynamic Dimensions
// The play space scales to fill the screen.
// ============================================================

export const dims = {
  w: 1280,
  h: 720,
  pad: 64, // wall thickness
  pillarSize: 52,
};

export function aspect(): number {
  return dims.w / dims.h;
}
