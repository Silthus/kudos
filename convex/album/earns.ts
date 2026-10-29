import type { KudosGivenEvent } from "../bus/events";

export function earnsPacks({ giver, awards }: KudosGivenEvent): boolean {
  return awards.some(({ recipient }) => recipient !== giver);
}
