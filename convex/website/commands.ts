import { v } from "convex/values";
import { runCommand } from "../commands/commands";
import { republish } from "../feedback/homes";
import { crateOpeningOf, rewardKeyOf } from "../quests/crates";
import type { Refusal } from "../progression/purchases";
import { perkValidator } from "../progression/tree";
import { journeyStartedFor, questsApplyTo } from "../quests/flag";
import { questValidator } from "../quests/step";
import { featureValidator } from "../unlocks/feature";
import { unlockPathShownTo } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { workspaceLaunchDueIn } from "./flag";
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
  return launchesRecordedFor(ctx, me);
}

async function launchesRecordedFor(ctx: QueryCtx, me: VerifiedMember) {
  if ((await workspaceLaunchDueIn(ctx, me.workspace)) || !(await unlockPathShownTo(ctx, me.member))) return false;
  return !(await questsApplyTo(ctx, me.member)) || (await journeyStartedFor(ctx, me.member)) !== null;
}

async function questsLaunchedFor(ctx: QueryCtx, me: VerifiedMember) {
  if (await workspaceLaunchDueIn(ctx, me.workspace)) return false;
  return (await questsApplyTo(ctx, me.member)) && (await journeyStartedFor(ctx, me.member)) !== null;
}
