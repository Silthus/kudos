import type { QueryCtx } from "../_generated/server";
import { everyoneBoardShownIn } from "../leaderboard/flag";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { unlocksAppliedIn } from "../unlocks/launch";
import { scheduled, type ScheduledFeature } from "../unlocks/schedule";
import { unlocksOf, type MemberUnlock } from "../unlocks/unlocks";
import type { VerifiedMember } from "./memberQuery";
import { seenKeyOf } from "./seen";

export type UnlockPath = MemberUnlock[] | null;

export type LeaderboardState = { kind: "off" } | { kind: "locked"; level: number } | { kind: "ready" } | { kind: "open" };

export type LeaderboardWaits = Extract<LeaderboardState, { kind: "locked" | "ready" }>;

export type FeatureCard = MemberUnlock & Pick<ScheduledFeature, "name" | "opens" | "level"> & { seen: string };

export async function unlockPathOf(ctx: QueryCtx, me: VerifiedMember): Promise<UnlockPath> {
  if (!(await unlocksApplyIn(ctx, me.workspace))) return null;
  return unlocksOf(ctx, me.member);
}

export async function leaderboardStateOf(ctx: QueryCtx, me: VerifiedMember, path: UnlockPath): Promise<LeaderboardState> {
  if (path === null) return (await everyoneBoardShownIn(ctx, me.workspace)) ? { kind: "open" } : { kind: "off" };
  const state = path.find(({ feature }) => feature === "leaderboard")?.state;
  if (state === undefined) return { kind: "off" };
  if (state === "locked") return { kind: "locked", level: scheduled("leaderboard").level };
  return { kind: state };
}

export async function featureCardsOf(me: VerifiedMember, path: UnlockPath): Promise<FeatureCard[] | null> {
  if (path === null) return null;
  return Promise.all(path.map((unlock) => featureCardOf(me, unlock)));
}

async function featureCardOf(me: VerifiedMember, unlock: MemberUnlock): Promise<FeatureCard> {
  const { name, opens, level } = scheduled(unlock.feature);
  return { ...unlock, name, opens, level, seen: await seenKeyOf(me.member, `feature:${unlock.feature}`) };
}

export async function unlocksApplyIn(ctx: QueryCtx, workspace: string) {
  return (await xpLevelsShownIn(ctx, workspace)) && (await unlocksAppliedIn(ctx, workspace));
}
