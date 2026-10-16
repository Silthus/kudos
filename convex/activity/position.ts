import type { Before } from "../engine/awards";

export type Rank = 0 | 1 | 2 | 3 | 4 | 5;

export const ranks = { levelUp: 0, kudosGiven: 1, kudosReceived: 2, found: 3, hugGiven: 4, hugReceived: 5 } as const satisfies Record<string, Rank>;

export type Position = { at: number; rank: Rank; created: number };

export type Cursor = { after: Position; hugsAsOf?: number };

const encoded = /^(-?\d+(?:\.\d+)?)_([0-5])_(\d+(?:\.\d+)?)(?:_(\d+(?:\.\d+)?))?$/;

export function encodePosition({ at, rank, created }: Position): string {
  return `${at}_${rank}_${created}`;
}

export function encodeCursor({ after, hugsAsOf }: Cursor): string {
  return hugsAsOf === undefined ? encodePosition(after) : `${encodePosition(after)}_${hugsAsOf}`;
}

export function decodeCursor(cursor: string): Cursor {
  const parts = encoded.exec(cursor);
  if (parts === null) throw new Error("unreadable activity cursor");
  const after = { at: Number(parts[1]), rank: Number(parts[2]) as Rank, created: Number(parts[3]) };
  return parts[4] === undefined ? { after } : { after, hugsAsOf: Number(parts[4]) };
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
