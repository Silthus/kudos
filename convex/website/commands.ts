import { v } from "convex/values";
import { runCommand, type Command } from "../commands/commands";
import type { AdminLinkRefusal } from "../companyProfiles/admin";
import type { SelfLinkRefusal } from "../companyProfiles/links";
import { republish, type HomeMember } from "../feedback/homes";
import { countingGroupsOf, groupsShownTo, primaryGroupOf } from "../groups/groups";
import { messageSettingsOnFor } from "../messageSettings/flag";
import { messageKindValidator, messagePlaceValidator, type MessageKind, type MessagePlace } from "../messageSettings/kinds";
import { kindAppliesTo, placeOf, placesOf } from "../messageSettings/messageSettings";
import { isOnTheBoards } from "../leaderboard/visibility";
import { avatarOf, type Avatar } from "../hoggies/avatar";
import { boughtCrateOpened, crateStoreOf, openedCrateDropOf } from "../hoggies/boughtCrates";
import { crateKindOf, dropsAHoggie, type CrateKey } from "../hoggies/crateKey";
import { dropOf, packOf, type Drop } from "../hoggies/drops";
import { avatarShownTo, hoggiesShownTo, packsShownTo } from "../hoggies/flag";
import { crateOpeningOf, questOfRewardKey, rewardKeyOf } from "../quests/crates";
import type { Refusal } from "../progression/purchases";
import { rewardOf, type AppliedReward, type StandingWithCoins } from "../progression/rewards";
import { perkValidator } from "../progression/tree";
import { questsApplyTo } from "../quests/flag";
import { questValidator, weeklyQuestValidator, type Quest } from "../quests/step";
import { swappedSlotIn } from "../quests/weekly";
import type { CrateRefusal } from "../hoggies/records";
import type { ItemRefusal } from "../store/rows";
import { storeVisibleTo } from "../store/visibility";
import { featureCrateKeyOf, featureOfCrateKey, featureValidator, type Feature } from "../unlocks/feature";
import { unlockPathShownTo } from "../unlocks/launch";
import { stateOf, type UnlockState } from "../unlocks/unlocks";
import { coinsVisibleTo } from "../wallet/visibility";
import { userGroupsOf } from "../workspace/userGroups";
import { maintainerSettingsApplyTo, type WorkspaceSettingsRefusal } from "../workspace/workspaceSettings";
import { mondayPostSwitchReadBy } from "../leaderboard/mondayPost";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { noLaunchWaitsFor } from "./flag";
import { memberMutation } from "./memberMutation";
import { teammateOfKey } from "./teammateKeys";
import { skillPointsOf } from "./skillTree";
import type { VerifiedMember } from "./memberQuery";
import { featurePageOf, leaderboardStateOf, unlockPathOf } from "./unlockPath";

export type CommandAnswer = { kind: "opened"; applied?: AppliedReward | null; drop?: Drop | null } | { kind: "refused" };

export type CrateAnswer = { kind: "opened"; applied: AppliedReward | null; drop?: Drop | null } | { kind: "refused" };

export type SwapAnswer = { kind: "swapped" } | { kind: "refused" };

export type PurchaseRefusal = "owned" | "level" | "requires" | "points" | "coins" | "coins-not-open" | "not-open";

export type PurchaseAnswer = { kind: "bought" } | { kind: "refused"; reason: PurchaseRefusal | null };

export type ItemPurchaseRefusal = ItemRefusal["reason"];

export type ItemPurchaseAnswer = { kind: "bought"; item: string } | { kind: "refused"; reason: ItemPurchaseRefusal | null };

export type CratePurchaseAnswer = { kind: "bought"; crate: string } | { kind: "refused"; reason: CrateRefusal["reason"] } | null;

export type CrateOpenAnswer = { kind: "opened"; applied?: AppliedReward | null; drop: Drop | null } | { kind: "refused" };

export type VisibilityAnswer = { kind: "set"; visible: boolean } | { kind: "refused" };

export type MessageSettingAnswer = { kind: "set"; place: MessagePlace } | { kind: "refused" };

export type GroupPickAnswer = { kind: "picked"; group: string } | { kind: "refused" };

export type CompanyProfileLinkAnswer = { kind: "linked" } | { kind: "refused"; reason: SelfLinkRefusal | null };

export type AdminProfileLinkAnswer = { kind: "linked" } | { kind: "refused"; reason: AdminLinkRefusal | null };

export type WorkspaceSettingsAnswer = { kind: "set" } | { kind: "refused"; reason: WorkspaceSettingsRefusal | null };

export type WeeklyPostAnswer = { kind: "set" } | { kind: "refused" };

export type AvatarAnswer = { kind: "set"; avatar: Avatar | null } | { kind: "refused" };

const refused = { kind: "refused" } as const;

export const openFeature = memberMutation({
  args: { feature: featureValidator },
  handler: async (ctx, me, person, { feature }): Promise<CommandAnswer> => {
    if (!(await launchesRecordedFor(ctx, me))) return refused;
    await runFromWebsite(ctx, me, person, { type: "openUnlock", feature }, `website:openFeature:${me.member}:${feature}`);
    if ((await stateOf(ctx, me.member, feature)) !== "open") return refused;
    await republish(ctx, me.member);
    const crate = featureCrateKeyOf(feature);
    return { kind: "opened", ...(await packAppliedShownTo(ctx, me, crate)), ...(await dropShownTo(ctx, me, crate)) };
  },
});

export const openQuestCrate = memberMutation({
  args: { quest: questValidator },
  handler: async (ctx, me, person, { quest }): Promise<CrateAnswer> => {
    if (!(await questsLaunchedFor(ctx, me))) return refused;
    await runFromWebsite(ctx, me, person, { type: "openQuestCrate", quest }, `website:openQuestCrate:${me.member}:${rewardKeyOf(quest)}`);
    const opening = await crateOpeningOf(ctx, me.member, rewardKeyOf(quest));
    if (opening === null) return refused;
    await republish(ctx, me.member);
    const crate = rewardKeyOf(quest);
    return { kind: "opened", applied: await appliedShownTo(queryOnly(ctx), me, await wholeOpenOf(ctx, me, crate, opening.applied)), ...(await dropShownTo(ctx, me, crate)) };
  },
});

export const swapQuest = memberMutation({
  args: { quest: weeklyQuestValidator },
  handler: async (ctx, me, person, { quest }): Promise<SwapAnswer> => {
    if (!(await questsOpenWithEveryLaunchRecorded(queryOnly(ctx), me))) return refused;
    await runFromWebsite(ctx, me, person, { type: "rerollQuest", quest }, `website:swapQuest:${me.member}:${quest.week}:${quest.slot}`);
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
    const outcome = await runFromWebsite(ctx, me, person, { type: "buyPerk", perk }, `website:${me.member}:${request}`);
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
    const outcome = await runFromWebsite(ctx, me, person, { type: "buyItem", item }, `website:${me.member}:${request}`);
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
    const outcome = await runFromWebsite(ctx, me, person, { type: "buyCrate", next }, `website:buyCrate:${me.member}:${next}`);
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
    if (await packsShownTo(ctx, me.member)) return openPack(ctx, me, person, crate);
    await runFromWebsite(ctx, me, person, { type: "openCrate", crate }, openCrateKeyOf(me, crate));
    const drop = await openedCrateDropOf(ctx, me.member, crate);
    if (drop === null) return refused;
    await republish(ctx, me.member);
    return { kind: "opened", drop };
  },
});

type PackRoute = {
  crate: CrateKey;
  command: Command;
  isOpenableBy: (ctx: QueryCtx, me: VerifiedMember) => Promise<boolean>;
  openingOf: (ctx: QueryCtx, me: VerifiedMember) => Promise<{ held?: AppliedReward } | null>;
};

async function openPack(ctx: MutationCtx, me: VerifiedMember, person: HomeMember, crate: string): Promise<CrateOpenAnswer> {
  const route = packRouteOf(queryOnly(ctx), crate);
  if (route === null || !(await route.isOpenableBy(queryOnly(ctx), me))) return refused;
  await runFromWebsite(ctx, me, person, route.command, openCrateKeyOf(me, crate));
  const opening = await route.openingOf(queryOnly(ctx), me);
  if (opening === null) return refused;
  await republish(ctx, me.member);
  const applied = await appliedShownTo(queryOnly(ctx), me, await wholeOpenOf(ctx, me, route.crate, opening.held));
  return { kind: "opened", applied, drop: await dropOf(ctx, me.member, route.crate) };
}

function packRouteOf(ctx: QueryCtx, crate: string): PackRoute | null {
  const quest = questOfRewardKey(ctx, crate);
  if (quest !== null) return questCrateRoute(quest);
  const feature = featureOfCrateKey(crate);
  if (feature !== null) return featureCrateRoute(feature);
  return dropsAHoggie(crate) && crateKindOf(crate) === "bought" ? boughtCrateRoute(crate) : null;
}

function questCrateRoute(quest: Quest): PackRoute {
  const crate = rewardKeyOf(quest);
  return {
    crate,
    command: { type: "openQuestCrate", quest },
    isOpenableBy: async (ctx, me) => (await questsLaunchedFor(ctx, me)) && (await rewardOf(ctx, me.member, crate)) !== null,
    openingOf: async (ctx, me) => {
      const opening = await crateOpeningOf(ctx, me.member, crate);
      return opening === null ? null : { ...(opening.applied && { held: opening.applied }) };
    },
  };
}

function featureCrateRoute(feature: Feature): PackRoute {
  const isReadyOrOpen = (state: UnlockState) => state === "ready" || state === "open";
  return {
    crate: featureCrateKeyOf(feature),
    command: { type: "openUnlock", feature },
    isOpenableBy: async (ctx, me) => (await launchesRecordedFor(ctx, me)) && isReadyOrOpen(await stateOf(ctx, me.member, feature)),
    openingOf: async (ctx, me) => ((await stateOf(ctx, me.member, feature)) === "open" ? {} : null),
  };
}

function boughtCrateRoute(crate: CrateKey): PackRoute {
  return {
    crate,
    command: { type: "openCrate", crate },
    isOpenableBy: async () => true,
    openingOf: async (ctx, me) => ((await boughtCrateOpened(ctx, me.member, crate)) ? {} : null),
  };
}

function runFromWebsite(ctx: MutationCtx, me: VerifiedMember, person: HomeMember, command: Command, idempotencyKey: string) {
  return runCommand(ctx, me.workspace, person, command, { surface: "website", idempotencyKey });
}

function openCrateKeyOf(me: VerifiedMember, crate: string) {
  return `website:openCrate:${me.member}:${crate}`;
}

export const setBoardVisibility = memberMutation({
  args: { visible: v.boolean() },
  handler: async (ctx, me, person, { visible }): Promise<VisibilityAnswer> => {
    if (!(await boardOpenWithEveryLaunchRecorded(queryOnly(ctx), me))) return refused;
    const before = await isOnTheBoards(ctx, me.member);
    await runFromWebsite(ctx, me, person, { type: "setLeaderboardVisibility", visible }, `website:setBoardVisibility:${me.member}`);
    const stored = await isOnTheBoards(ctx, me.member);
    if (stored !== before) await republish(ctx, me.member);
    return { kind: "set", visible: stored };
  },
});

export const setAvatar = memberMutation({
  args: { hoggie: v.union(v.string(), v.null()) },
  handler: async (ctx, me, person, { hoggie }): Promise<AvatarAnswer> => {
    if (!(await noLaunchWaitsFor(ctx, me))) return refused;
    const before = await avatarOf(ctx, me.member);
    await runFromWebsite(ctx, me, person, { type: "setAvatar", hoggie }, `website:setAvatar:${me.member}`);
    if (!(await avatarShownTo(ctx, me.member))) return refused;
    const after = await avatarOf(ctx, me.member);
    if (after?.hoggie !== before?.hoggie) await republish(ctx, me.member);
    return (after?.hoggie ?? null) === hoggie ? { kind: "set", avatar: after } : refused;
  },
});

async function dropShownTo(ctx: MutationCtx, me: VerifiedMember, crate: string): Promise<{ drop?: Drop | null }> {
  if (!(await hoggiesShownTo(ctx, me.member))) return {};
  return { drop: dropsAHoggie(crate) ? await dropOf(ctx, me.member, crate) : null };
}

async function packAppliedShownTo(ctx: MutationCtx, me: VerifiedMember, crate: string): Promise<{ applied?: AppliedReward | null }> {
  if (!(await packsShownTo(ctx, me.member))) return {};
  return { applied: await appliedShownTo(queryOnly(ctx), me, await packOf(ctx, me.member, crate)) };
}

async function wholeOpenOf(ctx: MutationCtx, me: VerifiedMember, crate: string, held: AppliedReward | undefined): Promise<AppliedReward | undefined> {
  const pack = (await packsShownTo(ctx, me.member)) ? await packOf(ctx, me.member, crate) : null;
  if (pack === null) return held;
  return held === undefined ? pack : { xp: held.xp + pack.xp, coins: held.coins + pack.coins, from: held.from, to: pack.to };
}

export async function appliedShownTo(ctx: QueryCtx, me: VerifiedMember, applied: AppliedReward | null | undefined): Promise<AppliedReward | null> {
  if (applied === null || applied === undefined) return null;
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
    await runFromWebsite(ctx, me, person, { type: "setMessageSetting", kind, place }, `website:setMessageSetting:${me.member}:${kind}`);
    const stored = await placeOf(ctx, me.member, kind);
    if (stored !== before) await republish(ctx, me.member);
    return stored === place ? { kind: "set", place } : refused;
  },
});

export const linkMyCompanyProfile = memberMutation({
  args: { profile: v.union(v.number(), v.null()) },
  handler: async (ctx, me, person, { profile }): Promise<CompanyProfileLinkAnswer> => {
    const outcome = await runFromWebsite(ctx, me, person, { type: "linkMyCompanyProfile", profile }, `website:linkMyCompanyProfile:${me.member}`);
    if (outcome === null || !("profile" in outcome)) return { kind: "refused", reason: null };
    return outcome.kind === "linked" ? { kind: "linked" } : { kind: "refused", reason: outcome.reason };
  },
});

export const linkCompanyProfile = memberMutation({
  args: { member: v.string(), profile: v.union(v.number(), v.literal("none"), v.null()) },
  handler: async (ctx, me, person, { member: key, profile }): Promise<AdminProfileLinkAnswer> => {
    const member = await teammateOfKey(ctx, me, key);
    const outcome = await runFromWebsite(ctx, me, person, { type: "linkCompanyProfile", member, profile }, `website:linkCompanyProfile:${me.member}`);
    if (outcome === null || !("member" in outcome)) return { kind: "refused", reason: null };
    return outcome.kind === "linked" ? { kind: "linked" } : { kind: "refused", reason: outcome.reason };
  },
});

export const setWorkspaceSettings = memberMutation({
  args: { baseAllowance: v.number(), kudosEmoji: v.string(), hugBudget: v.number() },
  handler: async (ctx, me, person, settings): Promise<WorkspaceSettingsAnswer> => {
    const outcome = await runFromWebsite(ctx, me, person, { type: "setWorkspaceSettings", ...settings }, `website:setWorkspaceSettings:${me.member}`);
    if (outcome === null || !("saved" in outcome)) return { kind: "refused", reason: null };
    return outcome.kind === "set" ? { kind: "set" } : { kind: "refused", reason: outcome.reason };
  },
});

export const setWeeklyPost = memberMutation({
  args: { on: v.boolean() },
  handler: async (ctx, me, person, { on }): Promise<WeeklyPostAnswer> => {
    if (!(await maintainerSettingsApplyTo(ctx, me.member)) || (await mondayPostSwitchReadBy(ctx, me.workspace, person)) === null) return refused;
    await runFromWebsite(ctx, me, person, { type: "setMondayPost", on }, `website:setWeeklyPost:${me.member}`);
    return (await mondayPostSwitchReadBy(ctx, me.workspace, person))?.on === on ? { kind: "set" } : refused;
  },
});

export const pickPrimaryGroup = memberMutation({
  args: { group: v.string() },
  handler: async (ctx, me, person, { group }): Promise<GroupPickAnswer> => {
    if (!(await groupOfferedWithEveryLaunchRecorded(queryOnly(ctx), me, group))) return refused;
    const before = await primaryGroupOf(ctx, me.member);
    await runFromWebsite(ctx, me, person, { type: "pickPrimaryGroup", group, surface: "website" }, `website:pickPrimaryGroup:${me.member}`);
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

async function questsOpenWithEveryLaunchRecorded(ctx: QueryCtx, me: VerifiedMember) {
  return (await questsLaunchedFor(ctx, me)) && (await stateOf(ctx, me.member, "quests")) === "open";
}

async function questsLaunchedFor(ctx: QueryCtx, me: VerifiedMember) {
  return (await questsApplyTo(ctx, me.member)) && (await noLaunchWaitsFor(ctx, me));
}
