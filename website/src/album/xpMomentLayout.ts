export type Viewport = { width: number; height: number; top: number };

export type Placed<T> = { item: T; index: number };

const twoColumnsFrom = 960;

export function isNarrow({ width }: Viewport) {
  return width < twoColumnsFrom;
}

export function columnsOf<T>(items: T[], viewport: Viewport): Placed<T>[][] {
  const placed = items.map((item, index) => ({ item, index }));
  if (isNarrow(viewport)) return [placed];
  const leftHalf = Math.ceil(placed.length / 2);
  return [placed.slice(0, leftHalf), placed.slice(leftHalf)];
}
