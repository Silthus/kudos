import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { featureValidator, type Feature } from "../unlocks/feature";
import { unlocksLiveIn, unlocksShownTo } from "../unlocks/launch";
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

export type UnopenedReply = { lines: Line[] | null; shownToUnknownViewer: boolean | null };

export const unopenedReplyOf = internalMutation({
  args: { workspace: v.string(), user: v.string(), feature: featureValidator },
  handler: async (ctx, { workspace, user, feature }): Promise<UnopenedReply> => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind === "member") return { lines: await memberReplyOf(ctx, person.member, feature), shownToUnknownViewer: null };
    if (!(await xpLevelsShownIn(ctx, workspace))) return { lines: null, shownToUnknownViewer: null };
    const shown = await unlocksLiveIn(ctx, workspace);
    const lines = shown ? replyOf(feature, await strangerStateOf(ctx, workspace, feature)) : null;
    return { lines, shownToUnknownViewer: person === undefined ? shown : null };
  },
});

export function renderUnopenedReply({ name, level }: ScheduledFeature, state: "ready" | "locked"): Line[] {
  const text = state === "ready" ? `${name} is ready for you. Open it in App Home.` : `${name} opens at level ${level}.`;
  return [[{ text }]];
}

async function memberReplyOf(ctx: MutationCtx, member: MemberId, feature: Feature) {
  return (await unlocksShownTo(ctx, member)) ? replyOf(feature, await stateOf(ctx, member, feature)) : null;
}

function replyOf(feature: Feature, state: UnlockState): Line[] | null {
  return state === "ready" || state === "locked" ? renderUnopenedReply(scheduled(feature), state) : null;
}

async function strangerStateOf(ctx: QueryCtx, workspace: string, feature: Feature): Promise<UnlockState> {
  const shipped = (await shippedIn(ctx, workspace)).some((entry) => entry.feature === feature);
  return shipped ? "locked" : "unshipped";
}
