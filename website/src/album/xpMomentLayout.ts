export type Viewport = { width: number; height: number; top: number };

export type Placed<T> = { item: T; index: number };

const phoneWidth = 640;

const mostTilt = 2;

export function isPhone({ width }: Viewport) {
  return width < phoneWidth;
}

export function columnsOf<T>(items: T[], viewport: Viewport): Placed<T>[][] {
  const placed = items.map((item, index) => ({ item, index }));
  if (isPhone(viewport)) return [placed];
  const leftHalf = Math.ceil(placed.length / 2);
  return [placed.slice(0, leftHalf), placed.slice(leftHalf)];
}

export function tiltOf(index: number) {
  return jitter(index, 3) * mostTilt;
}

function jitter(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}
