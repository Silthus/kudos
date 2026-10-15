import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { catalogue, hoggieNamed, type Rarity } from "./catalogue";
import { drawOf } from "./draw";
import { hoggiesDropFor } from "./flag";
import type { CrateKey } from "./crateKey";
import type { DropRecord } from "./records";

export type HoggieArt = { kind: "hoggie"; slug: string };

export type Drop = { hoggie: string; name: string; rarity: Rarity; art: HoggieArt; copy: number; isNew: boolean };

export type DroppedAt = { at: number; n: number; drop: Drop };

export type DropBefore = { at: number; n: number };

export const fromTheNewestDrop: DropBefore = { at: Infinity, n: Infinity };

export async function dropFor(ctx: MutationCtx, member: MemberId, crate: CrateKey, at: number): Promise<void> {
  if ((await dropRecordOf(ctx, member, crate)) !== null || !(await hoggiesDropFor(ctx, member))) return;
  const { hoggie, rarity } = await drawOf({ secret: drawSecret(), member, crate, version: catalogue.version });
  const n = await countDrop(ctx, member);
  const copy = await countCopy(ctx, member, hoggie, at, n);
  await ctx.db.insert("drops", { member, crate, hoggie, rarity, n, copy, catalogueVersion: catalogue.version, at });
  const { workspace } = await chatUserOf(ctx, member);
  await publish(ctx, { type: "hoggieDropped", workspace, member, crate, hoggie, rarity, copy, at });
}

export async function dropOf(ctx: QueryCtx, member: MemberId, crate: CrateKey): Promise<Drop | null> {
  const record = await dropRecordOf(ctx, member, crate);
  return record === null ? null : shownDrop(record);
}

export async function* dropsNewestFirst(ctx: QueryCtx, member: MemberId, before: DropBefore): AsyncGenerator<DroppedAt> {
  const sameInstant = ctx.db
    .query("drops")
    .withIndex("by_member_at", (q) => q.eq("member", member).eq("at", before.at).lt("n", before.n))
    .order("desc");
  const older = ctx.db
    .query("drops")
    .withIndex("by_member_at", (q) => (before.at === Infinity ? q.eq("member", member) : q.eq("member", member).lt("at", before.at)))
    .order("desc");
  for (const rows of before.at === Infinity ? [older] : [sameInstant, older]) for await (const record of rows) yield { at: record.at, n: record.n, drop: shownDrop(record) };
}

function shownDrop({ hoggie, rarity, copy }: DropRecord): Drop {
  return { hoggie, name: hoggieNamed(hoggie)?.name ?? hoggie, rarity, art: { kind: "hoggie", slug: hoggie }, copy, isNew: copy === 1 };
}

async function countDrop(ctx: MutationCtx, member: MemberId) {
  const tally = await ctx.db
    .query("dropTallies")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  const drops = (tally?.drops ?? 0) + 1;
  if (tally === null) await ctx.db.insert("dropTallies", { member, drops });
  else await ctx.db.patch(tally._id, { drops });
  return drops;
}

async function countCopy(ctx: MutationCtx, member: MemberId, hoggie: string, at: number, n: number) {
  const tally = await ctx.db
    .query("hoggieTallies")
    .withIndex("by_member_hoggie", (q) => q.eq("member", member).eq("hoggie", hoggie))
    .unique();
  if (tally === null) {
    await ctx.db.insert("hoggieTallies", { member, hoggie, count: 1, firstAt: at, firstN: n });
    return 1;
  }
  await ctx.db.patch(tally._id, { count: tally.count + 1 });
  return tally.count + 1;
}

function dropRecordOf(ctx: QueryCtx, member: MemberId, crate: string): Promise<Doc<"drops"> | null> {
  return ctx.db
    .query("drops")
    .withIndex("by_member_crate", (q) => q.eq("member", member).eq("crate", crate))
    .unique();
}

function drawSecret() {
  return process.env.HOGGIE_DRAW_SECRET ?? "";
}
