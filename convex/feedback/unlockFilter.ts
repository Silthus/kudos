import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { featureValidator, type Feature } from "../unlocks/feature";
import { unlocksLiveIn, unlocksShownTo } from "../unlocks/launch";
import { slotsRetiredFor, storeShownAndExposedTo } from "../store/visibility";
import { namedFor, scheduled, shippedIn, withoutTheStore, type ScheduledFeature, type StoreNaming } from "../unlocks/schedule";
import { stateOf, type UnlockState } from "../unlocks/unlocks";
import { lookup, type MemberId } from "../workspace/directory";
import type { Line } from "./segments";

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
    if (person !== undefined || !(await xpLevelsShownIn(ctx, workspace))) return { lines: null, shownToUnknownViewer: null };
    const shown = await unlocksLiveIn(ctx, workspace);
    const lines = shown ? replyOf(feature, await strangerStateOf(ctx, workspace, feature), withoutTheStore) : null;
    return { lines, shownToUnknownViewer: shown };
  },
});

export function renderUnopenedReply(feature: ScheduledFeature, state: "ready" | "locked"): Line[] {
  return [[{ text: unopenedTextOf(feature, state) }]];
}

export function unopenedTextOf({ name, level }: ScheduledFeature, state: "ready" | "locked") {
  return state === "ready" ? `${name} is ready for you. Open it in App Home.` : `${name} opens at level ${level}.`;
}

async function memberReplyOf(ctx: MutationCtx, member: MemberId, feature: Feature) {
  if (!(await unlocksShownTo(ctx, member))) return null;
  const storeShown = feature === "coins" && (await storeShownAndExposedTo(ctx, member));
  return replyOf(feature, await stateOf(ctx, member, feature), { storeShown, slotsRetired: storeShown && (await slotsRetiredFor(ctx, member)) });
}

function replyOf(feature: Feature, state: UnlockState, naming: StoreNaming): Line[] | null {
  return state === "ready" || state === "locked" ? renderUnopenedReply(namedFor(scheduled(feature), naming), state) : null;
}

async function strangerStateOf(ctx: QueryCtx, workspace: string, feature: Feature): Promise<UnlockState> {
  const shipped = (await shippedIn(ctx, workspace)).some((entry) => entry.feature === feature);
  return shipped ? "locked" : "unshipped";
}
