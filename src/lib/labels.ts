/**
 * Vertical positions for direct labels anchored at `{x, y}` (text starts at x): labels whose boxes
 * overlap sideways and sit closer than `gap` are spread apart around their middle. Returns one y per
 * label, in input order.
 */
export function nudgeLabels(labels: { x: number; y: number }[], { gap, width }: { gap: number; width: number }): number[] {
  const ys = labels.map((l) => l.y);
  const order = labels.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  for (let k = 1; k < order.length; k++) {
    const above = order[k - 1];
    const below = order[k];
    const overlapsSideways = Math.abs(labels[above].x - labels[below].x) < width;
    if (overlapsSideways && ys[below] - ys[above] < gap) {
      const mid = (ys[above] + ys[below]) / 2;
      ys[above] = mid - gap / 2;
      ys[below] = mid + gap / 2;
    }
  }
  return ys;
}
