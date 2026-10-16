import type { QueryCtx } from "../_generated/server";
import { everyoneBoardOnFor } from "../leaderboard/flag";
import { unlockPathShownTo } from "../unlocks/launch";
import { storeShownTo } from "../store/visibility";
import { namedFor, scheduled, type ScheduledFeature, type StoreNaming } from "../unlocks/schedule";
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

export async function featureCardsOf(ctx: QueryCtx, me: VerifiedMember, path: UnlockPath): Promise<FeatureCard[] | null> {
  if (path === null) return null;
  const naming = await storeNamingOf(ctx, me);
  return Promise.all(path.map((unlock) => featureCardOf(me, unlock, naming)));
}

async function storeNamingOf(ctx: QueryCtx, me: VerifiedMember): Promise<StoreNaming> {
  return { storeShown: await storeShownTo(ctx, me.member) };
}

async function featureCardOf(me: VerifiedMember, unlock: MemberUnlock, naming: StoreNaming): Promise<FeatureCard> {
  const { name, opens, level } = namedFor(scheduled(unlock.feature), naming);
  return { ...unlock, name, opens, level, seen: await seenKeyOf(me.member, `feature:${unlock.feature}`) };
}
