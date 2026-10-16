import { v } from "convex/values";
import { runCommand } from "../commands/commands";
import { republish } from "../feedback/homes";
import { countingGroupsOf, groupsShownTo, primaryGroupOf } from "../groups/groups";
import { messageSettingsOnFor } from "../messageSettings/flag";
import { messageKindValidator, messagePlaceValidator, type MessageKind, type MessagePlace } from "../messageSettings/kinds";
import { kindAppliesTo, placeOf, placesOf } from "../messageSettings/messageSettings";
import { isOnTheBoards } from "../leaderboard/visibility";
import { crateStoreOf, openedCrateDropOf } from "../hoggies/boughtCrates";
import { dropsAHoggie } from "../hoggies/crateKey";
import { dropOf, type Drop } from "../hoggies/drops";
import { hoggiesShownTo } from "../hoggies/flag";
import { crateOpeningOf, rewardKeyOf } from "../quests/crates";
import { loadoutOf } from "../store/inventory";
import { slotValidator, type Slot } from "../store/rows";
import type { Refusal } from "../progression/purchases";
import type { AppliedReward, StandingWithCoins } from "../progression/rewards";
import { perkValidator } from "../progression/tree";
import { journeyStartedFor, questsApplyTo } from "../quests/flag";
import { questValidator, weeklyQuestValidator } from "../quests/step";
import { swappedSlotIn } from "../quests/weekly";
import type { CrateRefusal } from "../hoggies/records";
import type { ItemRefusal } from "../store/rows";
import { slotsRetiredFor, storeVisibleTo } from "../store/visibility";
import { featureValidator } from "../unlocks/feature";
import { unlockPathShownTo } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import { coinsVisibleTo } from "../wallet/visibility";
import { userGroupsOf } from "../workspace/userGroups";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { workspaceLaunchDueIn } from "./flag";
import { memberMutation } from "./memberMutation";
import { skillPointsOf } from "./skillTree";
import type { VerifiedMember } from "./memberQuery";
import { featurePageOf, leaderboardStateOf, unlockPathOf } from "./unlockPath";

export type CommandAnswer = { kind: "opened"; drop?: Drop | null } | { kind: "refused" };

export type CrateAnswer = { kind: "opened"; applied: AppliedReward | null; drop?: Drop | null } | { kind: "refused" };

export type SwapAnswer = { kind: "swapped" } | { kind: "refused" };

export type PurchaseRefusal = "owned" | "level" | "requires" | "points" | "coins" | "coins-not-open" | "not-open";

export type PurchaseAnswer = { kind: "bought" } | { kind: "refused"; reason: PurchaseRefusal | null };

export type ItemPurchaseRefusal = ItemRefusal["reason"];

export type ItemPurchaseAnswer = { kind: "bought"; item: string } | { kind: "refused"; reason: ItemPurchaseRefusal | null };

export type CratePurchaseAnswer = { kind: "bought"; crate: string } | { kind: "refused"; reason: CrateRefusal["reason"] } | null;

export type CrateOpenAnswer = { kind: "opened"; drop: Drop } | { kind: "refused" };

export type VisibilityAnswer = { kind: "set"; visible: boolean } | { kind: "refused" };

export type MessageSettingAnswer = { kind: "set"; place: MessagePlace } | { kind: "refused" };

export type GroupPickAnswer = { kind: "picked"; group: string } | { kind: "refused" };

export type LoadoutAnswer = { kind: "equipped"; slot: Slot; item: string } | { kind: "takenOff"; slot: Slot } | { kind: "refused" };

const refused = { kind: "refused" } as const;

export const openFeature = memberMutation({
  args: { feature: featureValidator },
  handler: async (ctx, me, person, { feature }): Promise<CommandAnswer> => {
    if (!(await launchesRecordedFor(ctx, me))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openUnlock", feature }, `website:openFeature:${me.member}:${feature}`);
    if ((await stateOf(ctx, me.member, feature)) !== "open") return refused;
    await republish(ctx, me.member);
    return { kind: "opened", ...(await dropShownTo(ctx, me, `unlock:${feature}`)) };
  },
});

export const openQuestCrate = memberMutation({
  args: { quest: questValidator },
  handler: async (ctx, me, person, { quest }): Promise<CrateAnswer> => {
    if (!(await questsLaunchedFor(ctx, me))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openQuestCrate", quest }, `website:openQuestCrate:${me.member}:${rewardKeyOf(quest)}`);
    const opening = await crateOpeningOf(ctx, me.member, rewardKeyOf(quest));
    if (opening === null) return refused;
    await republish(ctx, me.member);
    return { kind: "opened", applied: await appliedShownTo(queryOnly(ctx), me, opening.applied), ...(await dropShownTo(ctx, me, rewardKeyOf(quest))) };
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

const longestItemId = 128;

const itemRefusedAtTheGate: ItemPurchaseAnswer = { kind: "refused", reason: null };

export const buyItem = memberMutation({
  args: { item: v.string(), request: v.string() },
  handler: async (ctx, me, person, { item, request }): Promise<ItemPurchaseAnswer> => {
    if (!isUuid(request)) throw new Error("A purchase's request must be a UUID.");
    if (item.length > longestItemId) throw new Error("A purchase's item is longer than any item ID.");
    if (!(await storeOpenWithEveryLaunchRecorded(queryOnly(ctx), me))) return itemRefusedAtTheGate;
    const outcome = await runCommand(ctx, me.workspace, person, { type: "buyItem", item }, `website:${me.member}:${request}`);
    if (outcome === null || !("item" in outcome)) return itemRefusedAtTheGate;
    if (outcome.kind === "refused") return { kind: "refused", reason: outcome.reason };
    await republish(ctx, me.member);
    return { kind: "bought", item: outcome.item };
  },
});

export const buyCrate = memberMutation({
  args: { next: v.number() },
  handler: async (ctx, me, person, { next }): Promise<CratePurchaseAnswer> => {
    if (!(await noLaunchWaitsFor(ctx, me))) return null;
    const before = await crateStoreOf(ctx, me.member);
    const outcome = await runCommand(ctx, me.workspace, person, { type: "buyCrate", next }, `website:buyCrate:${me.member}:${next}`);
    if (outcome === null || !("crate" in outcome)) return null;
    if (outcome.kind === "refused") return { kind: "refused", reason: outcome.reason };
    if ((await crateStoreOf(ctx, me.member))?.next !== before?.next) await republish(ctx, me.member);
    return { kind: "bought", crate: outcome.crate };
  },
});

export const openCrate = memberMutation({
  args: { crate: v.string() },
  handler: async (ctx, me, person, { crate }): Promise<CrateOpenAnswer> => {
    if (!(await noLaunchWaitsFor(ctx, me))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openCrate", crate }, `website:openCrate:${me.member}:${crate}`);
    const drop = await openedCrateDropOf(ctx, me.member, crate);
    if (drop === null) return refused;
    await republish(ctx, me.member);
    return { kind: "opened", drop };
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

export const equip = memberMutation({
  args: { item: v.string(), slot: slotValidator },
  handler: async (ctx, me, person, { item, slot }): Promise<LoadoutAnswer> => {
    if (!(await slotsOpenWithEveryLaunchRecorded(queryOnly(ctx), me))) return refused;
    const held = await itemIn(ctx, me, slot);
    await runCommand(ctx, me.workspace, person, { type: "equip", item, slot }, `website:equip:${me.member}:${slot}`);
    if ((await itemIn(ctx, me, slot)) !== item) return refused;
    if (held !== item) await republish(ctx, me.member);
    return { kind: "equipped", slot, item };
  },
});

export const takeOff = memberMutation({
  args: { slot: slotValidator },
  handler: async (ctx, me, person, { slot }): Promise<LoadoutAnswer> => {
    if (!(await slotsOpenWithEveryLaunchRecorded(queryOnly(ctx), me))) return refused;
    const held = await itemIn(ctx, me, slot);
    await runCommand(ctx, me.workspace, person, { type: "takeOff", slot }, `website:takeOff:${me.member}:${slot}`);
    if ((await itemIn(ctx, me, slot)) !== null) return refused;
    if (held !== null) await republish(ctx, me.member);
    return { kind: "takenOff", slot };
  },
});

async function itemIn(ctx: QueryCtx, me: VerifiedMember, slot: Slot) {
  return (await loadoutOf(ctx, me.member)).find((each) => each.slot === slot)?.item ?? null;
}

async function dropShownTo(ctx: MutationCtx, me: VerifiedMember, crate: string): Promise<{ drop?: Drop | null }> {
  if (!(await hoggiesShownTo(ctx, me.member))) return {};
  return { drop: dropsAHoggie(crate) ? await dropOf(ctx, me.member, crate) : null };
}

async function appliedShownTo(ctx: QueryCtx, me: VerifiedMember, applied: AppliedReward | undefined): Promise<AppliedReward | null> {
  if (applied === undefined) return null;
  const coinsShown = await coinsVisibleTo(ctx, me.member);
  const skillPointsShown = (await skillPointsOf(ctx, me, await unlockPathOf(ctx, me))) !== null;
  const shown = (value: number, isShown: boolean) => (isShown ? value : 0);
  const standingShown = ({ coins, skillPoints, ...standing }: StandingWithCoins) => ({ ...standing, coins: shown(coins, coinsShown), skillPoints: shown(skillPoints, skillPointsShown) });
  return { xp: applied.xp, coins: shown(applied.coins, coinsShown), from: standingShown(applied.from), to: standingShown(applied.to) };
}

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

async function storeOpenWithEveryLaunchRecorded(ctx: QueryCtx, me: VerifiedMember) {
  return (await storeVisibleTo(ctx, me.member)) && (await noLaunchWaitsFor(ctx, me));
}

async function slotsOpenWithEveryLaunchRecorded(ctx: QueryCtx, me: VerifiedMember) {
  return (await storeOpenWithEveryLaunchRecorded(ctx, me)) && !(await slotsRetiredFor(ctx, me.member));
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
  return (await isStillAmong(ctx, me, group)) && (await noLaunchWaitsFor(ctx, me));
}

async function isStillAmong(ctx: QueryCtx, me: VerifiedMember, group: string) {
  const offered = (await countingGroupsOf(ctx, me.member)).find((each) => each.group === group);
  const row = offered === undefined ? null : await ctx.db.get(offered.group);
  return row !== null && (await userGroupsOf(ctx, me.workspace, me.user)).some((membership) => membership.group === row.group);
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
