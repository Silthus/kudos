import { positionOf, type Entry } from "./board";

export type Improvement = { gain: number; places?: number } | { best: number };

export function improvement(now: Entry[], before: Entry[], viewer: string, best: number | null): Improvement | null {
  const gain = givenBy(now, viewer) - givenBy(before, viewer);
  if (gain > 0) return { gain, ...placesClimbed(now, before, viewer) };
  return best === null ? null : { best };
}

function placesClimbed(now: Entry[], before: Entry[], viewer: string) {
  const positionBefore = positionOf(before, viewer);
  const positionNow = positionOf(now, viewer);
  if (positionBefore === null || positionNow === null || positionNow >= positionBefore) return {};
  return { places: positionBefore - positionNow };
}

function givenBy(entries: Entry[], viewer: string) {
  return entries.find((entry) => entry.id === viewer)?.value ?? 0;
}
