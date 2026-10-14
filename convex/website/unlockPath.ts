import type { QueryCtx } from "../_generated/server";
import { everyoneBoardOnFor } from "../leaderboard/flag";
import { unlockPathShownTo } from "../unlocks/launch";
import { scheduled, type ScheduledFeature } from "../unlocks/schedule";
import type { Feature } from "../unlocks/feature";
import { unlocksOf, type MemberUnlock } from "../unlocks/unlocks";
import type { VerifiedMember } from "./memberQuery";
import { seenKeyOf } from "./seen";

export type UnlockPath = MemberUnlock[] | null;

export type FeaturePage = { kind: "off" } | { kind: "locked"; level: number } | { kind: "ready" } | { kind: "open" };

export type PageWaits = Extract<FeaturePage, { kind: "locked" | "ready" }>;

export type FeatureCard = MemberUnlock & Pick<ScheduledFeature, "name" | "opens" | "level"> & { seen: string };

export async function unlockPathOf(ctx: QueryCtx, me: VerifiedMember): Promise<UnlockPath> {
  if (!(await unlockPathShownTo(ctx, me.member))) return null;
  return unlocksOf(ctx, me.member);
}

export function featurePageOf(path: UnlockPath, feature: Feature): FeaturePage {
  const state = path?.find((unlock) => unlock.feature === feature)?.state;
  if (state === undefined) return { kind: "off" };
  if (state === "locked") return { kind: "locked", level: scheduled(feature).level };
  return { kind: state };
}

export async function leaderboardStateOf(ctx: QueryCtx, me: VerifiedMember, path: UnlockPath): Promise<FeaturePage> {
  if (path === null) return (await everyoneBoardOnFor(ctx, me.member)) ? { kind: "open" } : { kind: "off" };
  return featurePageOf(path, "leaderboard");
}

export async function openFeaturesOf(ctx: QueryCtx, me: VerifiedMember): Promise<Feature[]> {
  const path = await unlockPathOf(ctx, me);
  if (path !== null) return path.filter(({ state }) => state === "open").map(({ feature }) => feature);
  return (await leaderboardStateOf(ctx, me, path)).kind === "open" ? ["leaderboard"] : [];
}

export async function featureCardsOf(me: VerifiedMember, path: UnlockPath): Promise<FeatureCard[] | null> {
  if (path === null) return null;
  return Promise.all(path.map((unlock) => featureCardOf(me, unlock)));
}

async function featureCardOf(me: VerifiedMember, unlock: MemberUnlock): Promise<FeatureCard> {
  const { name, opens, level } = scheduled(unlock.feature);
  return { ...unlock, name, opens, level, seen: await seenKeyOf(me.member, `feature:${unlock.feature}`) };
}
