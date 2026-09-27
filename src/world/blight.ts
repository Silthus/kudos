import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Toast } from "./life";

/**
 * What a blight (#164, `api.blights.current`) means for the world: the sky tinged while one is at
 * the tree, its patches on the canopy, the lanterns burning low for a week after a defeat, the HUD's
 * tag and the toasts of its coming and going. Pure; the world, the HUD and the stone's window use it.
 */

type Current = FunctionReturnType<typeof api.blights.current>;
type Blight = Pick<NonNullable<NonNullable<Current>["blight"]>, "status" | "arrivesAt" | "endsAt" | "hp" | "damage">;
export type BlightState = { blight: Blight | null; lanternsDimUntil: number | null } | null | undefined;

const DAY_MS = 86_400_000;

/**
 * Whether the blight is at the tree now: arrived (the server says so when it comes), and its days not
 * over (the server may not have said so yet).
 */
export function atTheTree(b: Blight | null | undefined, now: number): boolean {
  return !!b && b.status === "active" && now < b.endsAt;
}

export type BlightMood = { sky: boolean; blighted: boolean; dim: boolean };

/** The world's mood: a tinged sky and a spotted canopy while a blight is here, dim lanterns after a defeat. */
export function blightMood(state: BlightState, now: number): BlightMood {
  const here = atTheTree(state?.blight, now);
  return { sky: here, blighted: here, dim: (state?.lanternsDimUntil ?? 0) > now };
}

/** Whole days until `at`, counting a part day as one. */
const daysUntil = (at: number, now: number) => Math.max(0, Math.ceil((at - now) / DAY_MS));

/** "3 days left", or on its last day, "Its last day". */
export function daysLeftText(endsAt: number, now: number): string {
  const days = daysUntil(endsAt, now);
  return days <= 1 ? "Its last day" : `${days} days left`;
}

/** The hit points a blight has left. */
export const hpLeft = (b: Pick<Blight, "hp" | "damage">) => Math.max(0, b.hp - b.damage);

/** The HUD's tag: the blight at the tree and how much of it is left, or one on its way. Null otherwise. */
export function blightTag(state: BlightState, now: number): { text: string; left: number | null; hp: number | null } | null {
  const b = state?.blight;
  if (b && atTheTree(b, now)) {
    const days = daysLeftText(b.endsAt, now);
    return { text: `Blight: ${hpLeft(b)} of ${b.hp} left, ${days.charAt(0).toLowerCase()}${days.slice(1)}`, left: hpLeft(b), hp: b.hp };
  }
  if (b?.status === "announced" && b.arrivesAt > now) {
    const days = daysUntil(b.arrivesAt, now);
    return { text: days <= 1 ? "A blight comes tomorrow" : `A blight comes in ${days} days`, left: null, hp: null };
  }
  return null;
}

const TOASTS: Record<string, Omit<Toast, "kind">> = {
  blight_announced: { title: "A blight is coming", body: "It reaches the tree in two days. Every thoughtful kudos will wear it down.", link: { to: "/blight", label: "The blight stone" } },
  blight_arrived: {
    title: "A blight has come to the tree",
    body: "Wear it down together: thoughtful kudos, rooms cleared in the ruins, and the raid at the blight stone.",
    link: { to: "/blight", label: "Join the raid" },
  },
  blight_won: { title: "The blight is beaten", body: "Everyone who fought it gets a crest and 20 Hog coins, and a bonus day is called.", link: { to: "/blight", label: "The blight stone" } },
  blight_lost: { title: "The blight outlasted us", body: "Nothing is lost. The lanterns burn low for a week, and the next blight will be smaller." },
};

/**
 * The toasts for blight events that came since the last look at the tree's log (`api.tree.state`'s
 * events, newest first). Arriving, with no earlier look, is no moment.
 */
export function blightToasts(before: { _id: string; kind: string }[] | undefined, after: { _id: string; kind: string }[]): Toast[] {
  if (!before) return [];
  const seen = new Set(before.map((e) => e._id));
  return after
    .filter((e) => !seen.has(e._id) && Object.hasOwn(TOASTS, e.kind))
    .reverse()
    .map((e) => ({ kind: "tree" as const, ...TOASTS[e.kind] }));
}
