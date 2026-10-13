import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { featureValidator, type Feature } from "../unlocks/feature";
import { scheduled, shippedIn, type ScheduledFeature } from "../unlocks/schedule";
import { stateOf, type UnlockState } from "../unlocks/unlocks";
import { lookup, type MemberId } from "../workspace/directory";
import type { Line } from "./replies";

export async function whenOpened<T>(ctx: QueryCtx, member: MemberId, feature: Feature, told: T): Promise<T | null> {
  return (await isOpened(ctx, member, feature)) ? told : null;
}

export async function isOpened(ctx: QueryCtx, member: MemberId, feature: Feature) {
  return (await stateOf(ctx, member, feature)) === "open";
}

export const unopenedReplyOf = internalQuery({
  args: { workspace: v.string(), user: v.string(), feature: featureValidator },
  handler: async (ctx, { workspace, user, feature }): Promise<Line[] | null> => {
    if (!(await xpLevelsShownIn(ctx, workspace))) return null;
    const state = await viewerStateOf(ctx, workspace, user, feature);
    if (state === "ready" || state === "locked") return renderUnopenedReply(scheduled(feature), state);
    return null;
  },
});

export function renderUnopenedReply({ name, level }: ScheduledFeature, state: "ready" | "locked"): Line[] {
  const text = state === "ready" ? `${name} is ready for you. Open it in App Home.` : `${name} opens at level ${level}.`;
  return [[{ text }]];
}

async function viewerStateOf(ctx: QueryCtx, workspace: string, user: string, feature: Feature): Promise<UnlockState> {
  const person = await lookup(ctx, workspace, user);
  if (person?.kind === "member") return stateOf(ctx, person.member, feature);
  const shipped = (await shippedIn(ctx, workspace)).some((entry) => entry.feature === feature);
  return shipped ? "locked" : "unshipped";
}
