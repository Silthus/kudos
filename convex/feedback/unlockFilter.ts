import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
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

export const unopenedReplyOf = internalMutation({
  args: { workspace: v.string(), user: v.string(), feature: featureValidator },
  handler: async (ctx, { workspace, user, feature }): Promise<Line[] | null> => {
    const person = await lookup(ctx, workspace, user);
    const member = person?.kind === "member" ? person.member : undefined;
    if (!(await unlocksShownTo(ctx, workspace, member))) return null;
    const state = member === undefined ? await strangerStateOf(ctx, workspace, feature) : await stateOf(ctx, member, feature);
    if (state === "ready" || state === "locked") return renderUnopenedReply(scheduled(feature), state);
    return null;
  },
});

export function renderUnopenedReply({ name, level }: ScheduledFeature, state: "ready" | "locked"): Line[] {
  const text = state === "ready" ? `${name} is ready for you. Open it in App Home.` : `${name} opens at level ${level}.`;
  return [[{ text }]];
}

function unlocksShownTo(ctx: MutationCtx, workspace: string, member: MemberId | undefined) {
  return member === undefined ? xpLevelsShownIn(ctx, workspace) : xpLevelsShownTo(ctx, member);
}

async function strangerStateOf(ctx: QueryCtx, workspace: string, feature: Feature): Promise<UnlockState> {
  const shipped = (await shippedIn(ctx, workspace)).some((entry) => entry.feature === feature);
  return shipped ? "locked" : "unshipped";
}
