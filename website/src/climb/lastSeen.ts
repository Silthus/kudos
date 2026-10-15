import type { MemberProfile } from "../shell";

export type Totals = { xp: number; skillPoints: number | null };

export type LastSeen = Totals & { at: number };

const prefix = "hedgehug.lastSeen.";

export function totalsOf({ progression, skillPoints }: MemberProfile): Totals | undefined {
  return progression === null ? undefined : { xp: progression.xp, skillPoints };
}

export function memberKeysOf({ features }: MemberProfile) {
  return features?.map(({ seen }) => seen) ?? [];
}

export function lastSeenBy(keys: string[]): LastSeen | undefined {
  const remembered = keys.flatMap((key) => readAt(prefix + key) ?? []);
  return remembered.sort((one, other) => other.at - one.at)[0];
}

export function rememberSeen(keys: string[], seen: LastSeen) {
  for (const key of keys) writeAt(prefix + key, seen);
}

function readAt(key: string): LastSeen | undefined {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return isLastSeen(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

function writeAt(key: string, seen: LastSeen) {
  try {
    localStorage.setItem(key, JSON.stringify(seen));
  } catch {
    return;
  }
}

function isLastSeen(stored: unknown): stored is LastSeen {
  if (typeof stored !== "object" || stored === null) return false;
  const { xp, skillPoints, at } = stored as Record<string, unknown>;
  return typeof xp === "number" && typeof at === "number" && (skillPoints === null || typeof skillPoints === "number");
}
