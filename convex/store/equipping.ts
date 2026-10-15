import type { MutationCtx } from "../_generated/server";
import { openedAtOf } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";
import type { ItemId } from "./catalogue";
import { loadoutOf, ownedBy, type LoadoutSlot } from "./inventory";
import type { Slot } from "./rows";
import { storeShownTo } from "./visibility";

export type LoadoutRefusal = { kind: "refused"; reason: "coins-not-open" | "not-owned" };

export type LoadoutOutcome = { kind: "equipped"; slot: Slot; item: ItemId } | { kind: "takenOff"; slot: Slot } | LoadoutRefusal;

export async function equip(ctx: MutationCtx, member: MemberId, item: ItemId, slot: Slot): Promise<LoadoutOutcome | null> {
  if (!(await storeShownTo(ctx, member))) return null;
  if (!(await coinsOpenFor(ctx, member))) return refused("coins-not-open");
  if (!(await ownedBy(ctx, member)).some((owned) => owned.item === item)) return refused("not-owned");
  await changeLoadout(ctx, member, ({ slot: each, item: held }) => (each === slot ? item : held === item ? null : held));
  return { kind: "equipped", slot, item };
}

export async function takeOff(ctx: MutationCtx, member: MemberId, slot: Slot): Promise<LoadoutOutcome | null> {
  if (!(await storeShownTo(ctx, member))) return null;
  if (!(await coinsOpenFor(ctx, member))) return refused("coins-not-open");
  await changeLoadout(ctx, member, ({ slot: each, item: held }) => (each === slot ? null : held));
  return { kind: "takenOff", slot };
}

async function coinsOpenFor(ctx: MutationCtx, member: MemberId) {
  return (await openedAtOf(ctx, member, "coins")) !== null;
}

function refused(reason: LoadoutRefusal["reason"]): LoadoutRefusal {
  return { kind: "refused", reason };
}

async function changeLoadout(ctx: MutationCtx, member: MemberId, itemIn: (current: LoadoutSlot) => ItemId | null) {
  const current = await loadoutOf(ctx, member);
  const changed = current.map((each) => ({ slot: each.slot, item: itemIn(each) }));
  if (changed.every((each, index) => each.item === current[index]!.item)) return;
  const stored = await ctx.db
    .query("loadouts")
    .withIndex("by_member_slot", (q) => q.eq("member", member))
    .collect();
  for (const [index, { slot, item }] of changed.entries()) {
    const row = stored.find((each) => each.slot === slot);
    if (row === undefined) await ctx.db.insert("loadouts", { member, slot, item });
    else if (item !== current[index]!.item) await ctx.db.patch(row._id, { item });
  }
}
