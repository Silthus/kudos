import { v } from "convex/values";
import { achievementsApplyIn, bookLaunchedAt } from "../achievements/flag";
import { runCommand } from "../commands/commands";
import { republish } from "../feedback/homes";
import { crateOpeningOf, rewardKeyOf } from "../quests/crates";
import { journeyShippedAt, questsApplyIn } from "../quests/flag";
import type { Refusal } from "../progression/purchases";
import { perkValidator } from "../progression/tree";
import { questValidator } from "../quests/step";
import { featureValidator } from "../unlocks/feature";
import { unlockPathShownIn } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { memberMutation } from "./memberMutation";
import type { VerifiedMember } from "./memberQuery";
import { featurePageOf, unlockPathOf } from "./unlockPath";

export type CommandAnswer = { kind: "opened" } | { kind: "refused" };

export type PurchaseRefusal = "owned" | "level" | "requires" | "points" | "not-open";

export type PurchaseAnswer = { kind: "bought" } | { kind: "refused"; reason: PurchaseRefusal | null };

const opened: CommandAnswer = { kind: "opened" };
const refused: CommandAnswer = { kind: "refused" };

export const openFeature = memberMutation({
  args: { feature: featureValidator },
  handler: async (ctx, me, person, { feature }): Promise<CommandAnswer> => {
    if (!(await launchesRecordedIn(ctx, me.workspace))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openUnlock", feature }, `website:openFeature:${me.member}:${feature}`);
    if ((await stateOf(ctx, me.member, feature)) !== "open") return refused;
    await republish(ctx, me.member);
    return opened;
  },
});

export const openQuestCrate = memberMutation({
  args: { quest: questValidator },
  handler: async (ctx, me, person, { quest }): Promise<CommandAnswer> => {
    if (!(await questsLaunchedIn(ctx, me.workspace))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openQuestCrate", quest }, `website:openQuestCrate:${me.member}:${rewardKeyOf(quest)}`);
    if ((await crateOpeningOf(ctx, me.member, rewardKeyOf(quest))) === null) return refused;
    await republish(ctx, me.member);
    return opened;
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
};

export const buyPerk = memberMutation({
  args: { perk: perkValidator, request: v.string() },
  handler: async (ctx, me, person, { perk, request }): Promise<PurchaseAnswer> => {
    if (!isUuid(request)) throw new Error("A purchase's request must be a UUID.");
    if (!(await treeOpenWithEveryLaunchRecorded(queryOnly(ctx), me))) return refusedAtTheGate;
    const outcome = await runCommand(ctx, me.workspace, person, { type: "buyPerk", perk }, `website:${me.member}:${request}`);
    if (outcome === null) return refusedAtTheGate;
    if (outcome.kind === "refused") return { kind: "refused", reason: purchaseRefusals[outcome.reason] };
    await republish(ctx, me.member);
    return { kind: "bought" };
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
  if (featurePageOf(await unlockPathOf(ctx, me), "skillTree").kind !== "open") return false;
  return (await journeyRecordedWhereQuestsApply(ctx, me.workspace)) && (await bookRecordedWhereAchievementsApply(ctx, me.workspace));
}

async function launchesRecordedIn(ctx: MutationCtx, workspace: string) {
  if (!(await unlockPathShownIn(ctx, workspace))) return false;
  return (await journeyRecordedWhereQuestsApply(ctx, workspace)) && (await bookRecordedWhereAchievementsApply(ctx, workspace));
}

async function journeyRecordedWhereQuestsApply(ctx: QueryCtx, workspace: string) {
  return !(await questsApplyIn(ctx, workspace)) || (await journeyLaunchedIn(ctx, workspace));
}

async function bookRecordedWhereAchievementsApply(ctx: QueryCtx, workspace: string) {
  return !(await achievementsApplyIn(ctx, workspace)) || (await bookLaunchedAt(ctx, workspace)) !== null;
}

async function questsLaunchedIn(ctx: MutationCtx, workspace: string) {
  return (await questsApplyIn(ctx, workspace)) && (await journeyLaunchedIn(ctx, workspace)) && (await bookRecordedWhereAchievementsApply(ctx, workspace));
}

async function journeyLaunchedIn(ctx: QueryCtx, workspace: string) {
  return (await journeyShippedAt(ctx, workspace)) !== null;
}
