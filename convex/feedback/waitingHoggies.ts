import type { WaitingCount } from "../items/ledger";

const spelledOut = ["", "An", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export function waitingLineOf(count: WaitingCount): string | null {
  if (count === 0) return null;
  if (count === 1) return "An unidentified Hoggie for your collection is waiting for you.";
  return `${typeof count === "number" ? (spelledOut[count] ?? count) : count} unidentified Hoggies for your collection are waiting for you.`;
}
