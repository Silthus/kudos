import { v } from "convex/values";
import { runCommand } from "../commands/commands";
import { republish } from "../feedback/homes";
import { isOnTheBoards } from "../leaderboard/visibility";
import { crateOpeningOf, rewardKeyOf } from "../quests/crates";
import type { Refusal } from "../progression/purchases";
import type { AppliedReward, StandingWithCoins } from "../progression/rewards";
import { perkValidator } from "../progression/tree";
import { journeyStartedFor, questsApplyTo } from "../quests/flag";
import { questValidator, weeklyQuestValidator } from "../quests/step";
import { swappedSlotIn } from "../quests/weekly";
import { featureValidator } from "../unlocks/feature";
import { unlockPathShownTo } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import { coinsVisibleTo } from "../wallet/visibility";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { workspaceLaunchDueIn } from "./flag";
import { memberMutation } from "./memberMutation";
import type { VerifiedMember } from "./memberQuery";
import { featurePageOf, leaderboardStateOf, unlockPathOf } from "./unlockPath";

export type CommandAnswer = { kind: "opened" } | { kind: "refused" };

export type CrateAnswer = { kind: "opened"; applied: AppliedReward | null } | { kind: "refused" };

export type SwapAnswer = { kind: "swapped" } | { kind: "refused" };

export type PurchaseRefusal = "owned" | "level" | "requires" | "points" | "coins" | "coins-not-open" | "not-open";

export type PurchaseAnswer = { kind: "bought" } | { kind: "refused"; reason: PurchaseRefusal | null };

export type VisibilityAnswer = { kind: "set"; visible: boolean } | { kind: "refused" };

const opened: CommandAnswer = { kind: "opened" };
const refused = { kind: "refused" } as const;

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
  handler: async (ctx, me, person, { quest }): Promise<CrateAnswer> => {
    if (!(await questsLaunchedFor(ctx, me))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openQuestCrate", quest }, `website:openQuestCrate:${me.member}:${rewardKeyOf(quest)}`);
    const opening = await crateOpeningOf(ctx, me.member, rewardKeyOf(quest));
    if (opening === null) return refused;
    await republish(ctx, me.member);
    return { kind: "opened", applied: await appliedShownTo(queryOnly(ctx), me, opening.applied) };
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

async function appliedShownTo(ctx: QueryCtx, me: VerifiedMember, applied: AppliedReward | undefined): Promise<AppliedReward | null> {
  if (applied === undefined) return null;
  const coinsShown = await coinsVisibleTo(ctx, me.member);
  const skillPointsShown = featurePageOf(await unlockPathOf(ctx, me), "skillTree").kind === "open";
  const shown = (value: number, isShown: boolean) => (isShown ? value : 0);
  const standingShown = ({ coins, skillPoints, ...standing }: StandingWithCoins) => ({ ...standing, coins: shown(coins, coinsShown), skillPoints: shown(skillPoints, skillPointsShown) });
  return { xp: applied.xp, coins: shown(applied.coins, coinsShown), from: standingShown(applied.from), to: standingShown(applied.to) };
}

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
