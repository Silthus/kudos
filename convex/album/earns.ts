import type { KudosGivenEvent } from "../bus/events";
import { saysWhy } from "../progression/gate";

export function earnsPacks(event: KudosGivenEvent): boolean {
  return saysWhy(event.annotations);
}
