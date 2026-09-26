import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { FRUITS, type FruitId } from "./lib/fruits";
import { GEAR, GEAR_IDS, isGearId, type GearId } from "./lib/rpg";

/**
 * A member's inventory (#157, #162): what they hold of each tree fruit and each piece of gear, one
 * row per kind with a count, deleted at zero. Only this module writes the `inventory` table. Fruit
 * comes from claims at the tree and the ruins and goes at the stall; gear comes from the ruins and
 * the stall and is worn from here (`players.equipped`, rpg.ts). All of it is state, never replayed.
 */

/** Every kind there is: a member's rows never outnumber it. */
const KINDS = FRUITS.length + GEAR_IDS.length;

type Item = { fruit: FruitId } | { gear: GearId };

async function rowOf(ctx: QueryCtx, memberId: Id<"members">, item: Item) {
  return "fruit" in item
    ? await ctx.db
        .query("inventory")
        .withIndex("by_member_fruit", (q) => q.eq("memberId", memberId).eq("fruit", item.fruit))
        .unique()
    : await ctx.db
        .query("inventory")
        .withIndex("by_member_gear", (q) => q.eq("memberId", memberId).eq("gear", item.gear))
        .unique();
}

const nameOf = (item: Item) => ("fruit" in item ? FRUITS.find((f) => f.id === item.fruit)!.name : GEAR[item.gear].name).toLowerCase();

/** Adds (or, negative, takes) `delta` of one kind; taking more than is held throws and changes nothing. */
async function add(ctx: MutationCtx, workspaceId: Id<"workspaces">, memberId: Id<"members">, item: Item, delta: number) {
  const row = await rowOf(ctx, memberId, item);
  const count = (row?.count ?? 0) + delta;
  if (count < 0) throw new ConvexError(`You have no ${nameOf(item)} left.`);
  if (row && count === 0) await ctx.db.delete(row._id);
  else if (row) await ctx.db.patch(row._id, { count });
  else if (count > 0) await ctx.db.insert("inventory", { workspaceId, memberId, ...item, count });
}

export async function addFruit(ctx: MutationCtx, workspaceId: Id<"workspaces">, memberId: Id<"members">, fruit: FruitId, delta: number) {
  await add(ctx, workspaceId, memberId, { fruit }, delta);
}

export async function addGear(ctx: MutationCtx, workspaceId: Id<"workspaces">, memberId: Id<"members">, gear: GearId, delta: number) {
  await add(ctx, workspaceId, memberId, { gear }, delta);
}

/** What a member holds: fruit by kind and gear by id, each with its count. */
export async function held(ctx: QueryCtx, memberId: Id<"members">) {
  const rows = await ctx.db
    .query("inventory")
    .withIndex("by_member_fruit", (q) => q.eq("memberId", memberId))
    .take(KINDS);
  const fruit = new Map<FruitId, number>();
  const gear = new Map<GearId, number>();
  for (const r of rows) {
    if (r.fruit) fruit.set(r.fruit, r.count);
    else if (r.gear && isGearId(r.gear)) gear.set(r.gear, r.count);
  }
  return { fruit, gear };
}
