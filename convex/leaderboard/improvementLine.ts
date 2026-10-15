import type { Improvement } from "./improvement";
import type { ComparedPeriod } from "./periods";

export function improvementLine(improvement: Improvement, period: ComparedPeriod): string {
  if ("best" in improvement) return `Your best ${period} so far: ${improvement.best} kudos.`;
  return `▲ ${improvement.gain} more kudos than this time last ${period}${placesClimbedPart(improvement.places)}`;
}

export function placesClimbedPart(places: number | undefined): string {
  if (places === undefined) return "";
  return ` · ▲ ${places} ${places === 1 ? "place" : "places"}`;
}
