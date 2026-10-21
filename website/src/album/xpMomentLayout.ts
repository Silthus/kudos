export type Viewport = { width: number; height: number; top: number };

export type Spot = { x: number; y: number; rot: number; width: number };

type Area = { top: number; bottom: number; left: number; right: number };

export const ring = { rx: 370, ry: 196, tilt: 7, wobble: 0.12, cardWidth: 290 } as const;

const phoneWidth = 640;

const edge = 16;

const orbRoom = 150;

export function isPhone({ width }: Viewport) {
  return width < phoneWidth;
}

export function orbSpotOf(viewport: Viewport) {
  if (isPhone(viewport)) return { x: viewport.width / 2, y: viewport.height - orbRoom - 75 };
  const { left, right, top, bottom } = canvasAreaOf(viewport);
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

export function spotsOf(count: number, viewport: Viewport): Spot[] {
  return isPhone(viewport) ? gridOf(count, viewport) : ringOf(count, canvasAreaOf(viewport));
}

function canvasAreaOf({ width, height, top }: Viewport): Area {
  return { top: top + 24, bottom: height - (isPhone({ width, height, top }) ? orbRoom : 120), left: edge, right: width - edge };
}

function ringOf(count: number, area: Area): Spot[] {
  const cx = (area.left + area.right) / 2;
  const cy = (area.top + area.bottom) / 2;
  const rx = Math.min(ring.rx, (area.right - area.left) / 2 - ring.cardWidth / 2 - 8);
  const ry = Math.min(ring.ry, (area.bottom - area.top) / 2 - 70);
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2 + (count % 2 === 0 ? Math.PI / count : 0) + jitter(index, 5) * ring.wobble;
    const reach = 1 + jitter(index, 6) * ring.wobble * 0.5;
    return { x: cx + Math.cos(angle) * rx * reach, y: cy + Math.sin(angle) * ry * reach, rot: jitter(index, 3) * ring.tilt, width: ring.cardWidth };
  });
}

function gridOf(count: number, viewport: Viewport): Spot[] {
  const area = { ...canvasAreaOf(viewport), bottom: canvasAreaOf(viewport).bottom - orbRoom };
  const columns = Math.max(1, Math.min(2, count));
  const rows = Math.ceil(count / columns);
  const cellWidth = (area.right - area.left) / columns;
  const cellHeight = (area.bottom - area.top) / Math.max(1, rows);
  const cardWidth = Math.min(178, cellWidth * 0.86);
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const inRow = Math.min(columns, count - row * columns);
    const offset = ((columns - inRow) * cellWidth) / 2;
    return { x: area.left + offset + ((index % columns) + 0.5) * cellWidth + jitter(index, 1) * cellWidth * 0.13, y: area.top + (row + 0.5) * cellHeight + jitter(index, 2) * cellHeight * 0.16, rot: jitter(index, 3) * 5, width: cardWidth };
  });
}

function jitter(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}
