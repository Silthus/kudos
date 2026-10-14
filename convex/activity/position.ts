import type { Before } from "../engine/awards";

export type Rank = 0 | 1 | 2;

export const ranks = { levelUp: 0, kudosGiven: 1, kudosReceived: 2 } as const satisfies Record<string, Rank>;

export type Position = { at: number; rank: Rank; created: number };

const encoded = /^(-?\d+(?:\.\d+)?)_([012])_(\d+(?:\.\d+)?)$/;

export function encodePosition({ at, rank, created }: Position): string {
  return `${at}_${rank}_${created}`;
}

export function decodePosition(cursor: string): Position {
  const parts = encoded.exec(cursor);
  if (parts === null) throw new Error("unreadable activity cursor");
  return { at: Number(parts[1]), rank: Number(parts[2]) as Rank, created: Number(parts[3]) };
}

export function newestFirst(one: Position, other: Position): number {
  return other.at - one.at || one.rank - other.rank || other.created - one.created;
}

export function beforeFor(rank: Rank, after: Position | null): Before {
  if (after === null) return { at: Infinity, created: Infinity };
  if (rank < after.rank) return { at: after.at, created: -Infinity };
  if (rank > after.rank) return { at: after.at, created: Infinity };
  return { at: after.at, created: after.created };
}
