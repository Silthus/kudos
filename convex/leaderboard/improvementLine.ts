import type { GroupImprovement } from "./groupsBoard";
import type { Improvement } from "./improvement";
import type { ComparedPeriod } from "./periods";

export function improvementLine(improvement: Improvement, period: ComparedPeriod): string {
  if ("best" in improvement) return `Your best ${period} so far: ${improvement.best} kudos.`;
  return `▲ ${improvement.gain} more kudos than this time last ${period}${placesClimbedPart(improvement.places)}`;
}

export function groupImprovementLine(improvement: GroupImprovement, group: string, period: ComparedPeriod): string {
  if ("best" in improvement) return `${group}'s best ${period} so far: ${improvement.best.toFixed(1)} per person.`;
  return `▲ ${improvement.gain.toFixed(1)} more per person than this time last ${period}${placesClimbedPart(improvement.places)}`;
}

export function placesClimbedPart(places: number | undefined): string {
  if (places === undefined) return "";
  return ` · ▲ ${places} ${places === 1 ? "place" : "places"}`;
}
