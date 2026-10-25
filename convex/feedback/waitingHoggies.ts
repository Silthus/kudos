import type { WaitingCount } from "../items/ledger";

const spelledOut = ["", "An", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export function waitingHoggiesLineOf(waiting: WaitingCount): string | null {
  if (waiting === 0) return null;
  if (waiting === 1) return "An unidentified Hoggie for your collection is waiting for you.";
  return `${typeof waiting === "number" ? (spelledOut[waiting] ?? String(waiting)) : waiting} unidentified Hoggies for your collection are waiting for you.`;
}
