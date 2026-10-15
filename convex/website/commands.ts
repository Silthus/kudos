import { v } from "convex/values";
import { runCommand } from "../commands/commands";
import { republish } from "../feedback/homes";
import { countingGroupsOf, groupsShownTo, primaryGroupOf } from "../groups/groups";
import { messageSettingsOnFor } from "../messageSettings/flag";
import { messageKindValidator, messagePlaceValidator, type MessageKind, type MessagePlace } from "../messageSettings/kinds";
import { kindAppliesTo, placeOf, placesOf } from "../messageSettings/messageSettings";
import { isOnTheBoards } from "../leaderboard/visibility";
import { crateOpeningOf, rewardKeyOf } from "../quests/crates";
import type { Refusal } from "../progression/purchases";
import { perkValidator } from "../progression/tree";
import { journeyStartedFor, questsApplyTo } from "../quests/flag";
import { questValidator, weeklyQuestValidator } from "../quests/step";
import { swappedSlotIn } from "../quests/weekly";
import { featureValidator } from "../unlocks/feature";
import { unlockPathShownTo } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { workspaceLaunchDueIn } from "./flag";
import { memberMutation } from "./memberMutation";
import type { VerifiedMember } from "./memberQuery";
import { featurePageOf, leaderboardStateOf, unlockPathOf } from "./unlockPath";

export type CommandAnswer = { kind: "opened" } | { kind: "refused" };

export type SwapAnswer = { kind: "swapped" } | { kind: "refused" };

export type PurchaseRefusal = "owned" | "level" | "requires" | "points" | "coins" | "coins-not-open" | "not-open";

export type PurchaseAnswer = { kind: "bought" } | { kind: "refused"; reason: PurchaseRefusal | null };

export type VisibilityAnswer = { kind: "set"; visible: boolean } | { kind: "refused" };

export type MessageSettingAnswer = { kind: "set"; place: MessagePlace } | { kind: "refused" };

export type GroupPickAnswer = { kind: "picked"; group: string } | { kind: "refused" };

const opened: CommandAnswer = { kind: "opened" };
const refused: CommandAnswer = { kind: "refused" };

export const openFeature = memberMutation({
  args: { feature: featureValidator },
  handler: async (ctx, me, person, { feature }): Promise<CommandAnswer> => {
    if (!(await launchesRecordedFor(ctx, me))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openUnlock", feature }, `website:openFeature:${me.member}:${feature}`);
    if ((await stateOf(ctx, me.member, feature)) !== "open") return refused;
    await republish(ctx, me.member);
    return opened;
  },
});

export const openQuestCrate = memberMutation({
  args: { quest: questValidator },
  handler: async (ctx, me, person, { quest }): Promise<CommandAnswer> => {
    if (!(await questsLaunchedFor(ctx, me))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openQuestCrate", quest }, `website:openQuestCrate:${me.member}:${rewardKeyOf(quest)}`);
    if ((await crateOpeningOf(ctx, me.member, rewardKeyOf(quest))) === null) return refused;
    await republish(ctx, me.member);
    return opened;
  },
});

export const swapQuest = memberMutation({
  args: { quest: weeklyQuestValidator },
  handler: async (ctx, me, person, { quest }): Promise<SwapAnswer> => {
    if (!(await questsOpenWithEveryLaunchRecorded(queryOnly(ctx), me))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "rerollQuest", quest }, `website:swapQuest:${me.member}:${quest.week}:${quest.slot}`);
    if ((await swappedSlotIn(ctx, me.member, quest.week)) !== quest.slot) return refused;
    await republish(ctx, me.member);
    return { kind: "swapped" };
  },
});

const refusedAtTheGate: PurchaseAnswer = { kind: "refused", reason: null };

const purchaseRefusals: Record<Refusal, PurchaseRefusal | null> = {
  owned: "owned",
  "below-row": "level",
  "needs-prerequisite": "requires",
  "no-skill-points": "points",
  "tree-locked": "not-open",
  "tree-ready": "not-open",
  retired: null,
  "coins-not-open": "coins-not-open",
  "no-coins": "coins",
};

export const buyPerk = memberMutation({
  args: { perk: perkValidator, request: v.string() },
  handler: async (ctx, me, person, { perk, request }): Promise<PurchaseAnswer> => {
    if (!isUuid(request)) throw new Error("A purchase's request must be a UUID.");
    if (!(await treeOpenWithEveryLaunchRecorded(queryOnly(ctx), me))) return refusedAtTheGate;
    const outcome = await runCommand(ctx, me.workspace, person, { type: "buyPerk", perk }, `website:${me.member}:${request}`);
    if (outcome === null || !("perk" in outcome)) return refusedAtTheGate;
    if (outcome.kind === "refused") return { kind: "refused", reason: purchaseRefusals[outcome.reason] };
    await republish(ctx, me.member);
    return { kind: "bought" };
  },
});

export const setBoardVisibility = memberMutation({
  args: { visible: v.boolean() },
  handler: async (ctx, me, person, { visible }): Promise<VisibilityAnswer> => {
    if (!(await boardOpenWithEveryLaunchRecorded(queryOnly(ctx), me))) return refused;
    const before = await isOnTheBoards(ctx, me.member);
    await runCommand(ctx, me.workspace, person, { type: "setLeaderboardVisibility", visible }, `website:setBoardVisibility:${me.member}`);
    const stored = await isOnTheBoards(ctx, me.member);
    if (stored !== before) await republish(ctx, me.member);
    return { kind: "set", visible: stored };
  },
});

export const setMessageSetting = memberMutation({
  args: { kind: messageKindValidator, place: messagePlaceValidator },
  handler: async (ctx, me, person, { kind, place }): Promise<MessageSettingAnswer> => {
    if (!(await placeOfferedWithEveryLaunchRecorded(queryOnly(ctx), me, kind, place))) return refused;
    const before = await placeOf(ctx, me.member, kind);
    await runCommand(ctx, me.workspace, person, { type: "setMessageSetting", kind, place }, `website:setMessageSetting:${me.member}:${kind}`);
    const stored = await placeOf(ctx, me.member, kind);
    if (stored !== before) await republish(ctx, me.member);
    return stored === place ? { kind: "set", place } : refused;
  },
});

export const pickPrimaryGroup = memberMutation({
  args: { group: v.string() },
  handler: async (ctx, me, person, { group }): Promise<GroupPickAnswer> => {
    if (!(await groupOfferedWithEveryLaunchRecorded(queryOnly(ctx), me, group))) return refused;
    const before = await primaryGroupOf(ctx, me.member);
    await runCommand(ctx, me.workspace, person, { type: "pickPrimaryGroup", group, surface: "website" }, `website:pickPrimaryGroup:${me.member}`);
    const picked = await primaryGroupOf(ctx, me.member);
    if (picked?.group !== before?.group) await republish(ctx, me.member);
    return picked?.group === group ? { kind: "picked", group } : refused;
  },
});

function queryOnly({ db, ...rest }: MutationCtx): QueryCtx {
  return { ...rest, db: { get: db.get.bind(db), query: db.query.bind(db), normalizeId: db.normalizeId.bind(db), system: db.system } };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(request: string) {
  return uuid.test(request);
}

async function treeOpenWithEveryLaunchRecorded(ctx: QueryCtx, me: VerifiedMember) {
  return featurePageOf(await unlockPathOf(ctx, me), "skillTree").kind === "open" && (await noLaunchWaitsFor(ctx, me));
}

async function boardOpenWithEveryLaunchRecorded(ctx: QueryCtx, me: VerifiedMember) {
  return (await leaderboardStateOf(ctx, me, await unlockPathOf(ctx, me))).kind === "open" && (await noLaunchWaitsFor(ctx, me));
}

async function placeOfferedWithEveryLaunchRecorded(ctx: QueryCtx, me: VerifiedMember, kind: MessageKind, place: MessagePlace) {
  if (!(await messageSettingsOnFor(ctx, me.member)) || !(await kindAppliesTo(ctx, me.member, kind))) return false;
  return (await placesOf(ctx, me.member, kind)).includes(place) && (await noLaunchWaitsFor(ctx, me));
}

async function groupOfferedWithEveryLaunchRecorded(ctx: QueryCtx, me: VerifiedMember, group: string) {
  if (!(await groupsShownTo(ctx, me.member))) return false;
  return (await countingGroupsOf(ctx, me.member)).some((offered) => offered.group === group) && (await noLaunchWaitsFor(ctx, me));
}

async function launchesRecordedFor(ctx: QueryCtx, me: VerifiedMember) {
  return (await unlockPathShownTo(ctx, me.member)) && (await noLaunchWaitsFor(ctx, me));
}

async function noLaunchWaitsFor(ctx: QueryCtx, me: VerifiedMember) {
  if (await workspaceLaunchDueIn(ctx, me.workspace)) return false;
  return !(await questsApplyTo(ctx, me.member)) || (await journeyStartedFor(ctx, me.member)) !== null;
}

async function questsOpenWithEveryLaunchRecorded(ctx: QueryCtx, me: VerifiedMember) {
  return (await questsLaunchedFor(ctx, me)) && (await stateOf(ctx, me.member, "quests")) === "open";
}

async function questsLaunchedFor(ctx: QueryCtx, me: VerifiedMember) {
  return (await questsApplyTo(ctx, me.member)) && (await noLaunchWaitsFor(ctx, me));
}
