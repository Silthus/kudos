import { v } from "convex/values";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import type { Annotations } from "../engine/messageEvent";
import { stateOf, type UnlockState } from "../unlocks/unlocks";
import { coinsShownTo, coinsVisibleTo, isCoinsOpenFor } from "../wallet/visibility";
import { balanceOf, spend } from "../wallet/wallet";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { catalogue } from "./catalogue";
import { gateDecisionOf } from "./gate";
import { spendSkillPoints, standingOf } from "./progression";
import type { PurchaseOutcome, Refusal } from "./purchases";
import { ownedPerksOf, skillTreeAppliesIn, type OwnedPerk } from "./skillTree";
import { isCoinPerk, perkOf, type Perk, type PerkId } from "./tree";

export type PerkState = "buyable" | Refusal;

export type MemberPerks = { skillPoints: number; owned: OwnedPerk[]; perks: Array<Perk & { state: PerkState; boughtAt: number | null }> };

type TreePerk = MemberPerks["perks"][number];

export async function couldEarnMoreBySayingWhy(ctx: QueryCtx, member: MemberId, annotations: Annotations): Promise<boolean> {
  if (gateDecisionOf(annotations)?.thoughtful !== false) return false;
  return sayingWhyEarnsMore(ctx, member);
}

export async function sayingWhyEarnsMore(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await coinsVisibleTo(ctx, member)) || (await ownedPerksPayIn(ctx, member));
}

async function ownedPerksPayIn(ctx: QueryCtx, member: MemberId) {
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
  const bought = perkOf(perk);
  if (isCoinPerk(bought) && !(await coinsShownTo(ctx, member))) return null;
  const earlier = await purchaseOf(ctx, member, idempotencyKey);
  if (earlier !== null) return earlier.outcome;
  const outcome = await purchase(ctx, { workspace, member, at: Date.now() }, bought);
  await ctx.db.insert("perkPurchases", { member, key: idempotencyKey, outcome });
  return outcome;
}

export const perksOf = internalQuery({
  args: { member: v.id("members") },
  handler: (ctx, { member }) => treePerksOf(ctx, member),
});

export async function treePerksOf(ctx: QueryCtx, member: MemberId): Promise<MemberPerks | null> {
  const { workspace } = await chatUserOf(ctx, member);
  return (await skillTreeAppliesIn(ctx, workspace)) ? memberPerksOf(ctx, member) : null;
}

export async function memberPerksOf(ctx: QueryCtx, member: MemberId): Promise<MemberPerks> {
  const facts = await treeFactsOf(ctx, member);
  const perks = catalogue.tree.map((perk): TreePerk => ({ ...perk, state: perkStateOf(perk, facts), boughtAt: facts.owned.find((owned) => owned.perk === perk.perk)?.boughtAt ?? null }));
  return { skillPoints: facts.skillPoints, owned: facts.owned, perks: (await coinsVisibleTo(ctx, member)) ? perks : withoutCoinsShown(perks) };
}

function withoutCoinsShown(perks: TreePerk[]): TreePerk[] {
  return perks.flatMap((perk) => {
    if (!isCoinPerk(perk)) return [perk];
    return perk.state === "owned" ? [{ ...perk, coins: 0 }] : [];
  });
}

type Purchase = { workspace: string; member: MemberId; at: number };

async function purchase(ctx: MutationCtx, { workspace, member, at }: Purchase, perk: Perk): Promise<PurchaseOutcome> {
  const state = perkStateOf(perk, await treeFactsOf(ctx, member));
  if (state !== "buyable") return { kind: "refused", perk: perk.perk, reason: state };
  if ((await spend(ctx, { member, coins: perk.coins, for: { perk: perk.perk }, at })) === "no-coins") return { kind: "refused", perk: perk.perk, reason: "no-coins" };
  await spendSkillPoints(ctx, member, perk.skillPoints);
  await ctx.db.insert("perksOwned", { member, perk: perk.perk, boughtAt: at, catalogueVersion: catalogue.version });
  await publish(ctx, { type: "perkBought", workspace, member, perk: perk.perk, at });
  return { kind: "bought", perk: perk.perk };
}

type TreeFacts = { tree: "locked" | "ready" | "open"; level: number; skillPoints: number; owned: OwnedPerk[]; coins: { open: boolean; balance: number } };

async function treeFactsOf(ctx: QueryCtx, member: MemberId): Promise<TreeFacts> {
  const { level, skillPoints } = await standingOf(ctx, member);
  const coins = { open: await isCoinsOpenFor(ctx, member), balance: await balanceOf(ctx, member) };
  return { tree: treeStateOf(await stateOf(ctx, member, "skillTree")), level, skillPoints, owned: await ownedPerksOf(ctx, member), coins };
}

function treeStateOf(unlock: UnlockState): TreeFacts["tree"] {
  return unlock === "open" || unlock === "ready" ? unlock : "locked";
}

function perkStateOf(treePerk: Perk, facts: TreeFacts): PerkState {
  const { perk, row, skillPoints, coins, requires, retired } = treePerk;
  const owns = (id: PerkId) => facts.owned.some((owned) => owned.perk === id);
  if (facts.tree !== "open") return `tree-${facts.tree}`;
  if (owns(perk)) return "owned";
  if (retired === true) return "retired";
  if (facts.level < row) return "below-row";
  if (requires !== null && !owns(requires)) return "needs-prerequisite";
  if (facts.skillPoints < skillPoints) return "no-skill-points";
  if (isCoinPerk(treePerk) && !facts.coins.open) return "coins-not-open";
  if (facts.coins.balance < coins) return "no-coins";
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
