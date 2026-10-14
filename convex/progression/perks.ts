import { v } from "convex/values";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import type { Annotations } from "../engine/messageEvent";
import { stateOf, type UnlockState } from "../unlocks/unlocks";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { catalogue } from "./catalogue";
import { gateDecisionOf } from "./gate";
import { spendSkillPoints, standingOf } from "./progression";
import type { PurchaseOutcome, Refusal } from "./purchases";
import { ownedPerksOf, skillTreeAppliesIn, type OwnedPerk } from "./skillTree";
import { perkOf, type Perk, type PerkId } from "./tree";

export type PerkState = "buyable" | Refusal;

export type MemberPerks = { skillPoints: number; owned: OwnedPerk[]; perks: Array<Perk & { state: PerkState; boughtAt: number | null }> };

export async function couldEarnMoreBySayingWhy(ctx: QueryCtx, member: MemberId, annotations: Annotations): Promise<boolean> {
  if (gateDecisionOf(annotations)?.thoughtful !== false) return false;
  const { workspace } = await chatUserOf(ctx, member);
  return (await skillTreeAppliesIn(ctx, workspace)) && (await ownsAPerk(ctx, member));
}

async function ownsAPerk(ctx: QueryCtx, member: MemberId) {
  const owned = await ctx.db
    .query("perksOwned")
    .withIndex("by_member_perk", (q) => q.eq("member", member))
    .first();
  return owned !== null;
}

export async function buyPerk(ctx: MutationCtx, member: MemberId, perk: PerkId, idempotencyKey: string): Promise<PurchaseOutcome | null> {
  const { workspace } = await chatUserOf(ctx, member);
  if (!(await skillTreeAppliesIn(ctx, workspace))) return null;
  const earlier = await purchaseOf(ctx, member, idempotencyKey);
  if (earlier !== null) return earlier.outcome;
  const outcome = await purchase(ctx, { workspace, member, at: Date.now() }, perkOf(perk));
  await ctx.db.insert("perkPurchases", { member, key: idempotencyKey, outcome });
  return outcome;
}

export const perksOf = internalQuery({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<MemberPerks | null> => {
    const { workspace } = await chatUserOf(ctx, member);
    return (await skillTreeAppliesIn(ctx, workspace)) ? memberPerksOf(ctx, member) : null;
  },
});

export async function memberPerksOf(ctx: QueryCtx, member: MemberId): Promise<MemberPerks> {
  const facts = await treeFactsOf(ctx, member);
  return {
    skillPoints: facts.skillPoints,
    owned: facts.owned,
    perks: catalogue.tree.map((perk) => ({ ...perk, state: perkStateOf(perk, facts), boughtAt: facts.owned.find((owned) => owned.perk === perk.perk)?.boughtAt ?? null })),
  };
}

type Purchase = { workspace: string; member: MemberId; at: number };

async function purchase(ctx: MutationCtx, { workspace, member, at }: Purchase, perk: Perk): Promise<PurchaseOutcome> {
  const state = perkStateOf(perk, await treeFactsOf(ctx, member));
  if (state !== "buyable") return { kind: "refused", perk: perk.perk, reason: state };
  await spendSkillPoints(ctx, member, perk.skillPoints);
  await ctx.db.insert("perksOwned", { member, perk: perk.perk, boughtAt: at, catalogueVersion: catalogue.version });
  await publish(ctx, { type: "perkBought", workspace, member, perk: perk.perk, at });
  return { kind: "bought", perk: perk.perk };
}

type TreeFacts = { tree: "locked" | "ready" | "open"; level: number; skillPoints: number; owned: OwnedPerk[] };

async function treeFactsOf(ctx: QueryCtx, member: MemberId): Promise<TreeFacts> {
  const { level, skillPoints } = await standingOf(ctx, member);
  return { tree: treeStateOf(await stateOf(ctx, member, "skillTree")), level, skillPoints, owned: await ownedPerksOf(ctx, member) };
}

function treeStateOf(unlock: UnlockState): TreeFacts["tree"] {
  return unlock === "open" || unlock === "ready" ? unlock : "locked";
}

function perkStateOf({ perk, row, skillPoints, requires, retired }: Perk, facts: TreeFacts): PerkState {
  const owns = (id: PerkId) => facts.owned.some((owned) => owned.perk === id);
  if (facts.tree !== "open") return `tree-${facts.tree}`;
  if (owns(perk)) return "owned";
  if (retired === true) return "retired";
  if (facts.level < row) return "below-row";
  if (requires !== null && !owns(requires)) return "needs-prerequisite";
  if (facts.skillPoints < skillPoints) return "no-skill-points";
  return "buyable";
}

export function ownsEveryPerk({ owned, perks }: MemberPerks): boolean {
  return perks.every(({ perk, retired }) => retired === true || owned.some((each) => each.perk === perk));
}

function purchaseOf(ctx: QueryCtx, member: MemberId, key: string) {
  return ctx.db
    .query("perkPurchases")
    .withIndex("by_member_key", (q) => q.eq("member", member).eq("key", key))
    .unique();
}
