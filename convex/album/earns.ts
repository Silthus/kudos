import type { KudosGivenEvent } from "../bus/events";
import { gateDecisionOf } from "../progression/gate";

export function earnsPacks(event: KudosGivenEvent): boolean {
  return gateDecisionOf(event.annotations)?.thoughtful === true;
}
