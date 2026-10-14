import type { Improvement } from "./improvement";
import type { ComparedPeriod } from "./periods";

export function improvementLine(improvement: Improvement, period: ComparedPeriod): string {
  if ("best" in improvement) return `Your best ${period} so far: ${improvement.best} kudos.`;
  const places = improvement.places === undefined ? "" : ` · ▲ ${improvement.places} places`;
  return `▲ ${improvement.gain} more kudos than this time last ${period}${places}`;
}
