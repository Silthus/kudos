import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import { decidedBelow, type DecidedBelow } from "../engine/awards";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { catalogue, crestNamed, crestWith, firstVersionWithCrests, hoggieNamed, type Rarity } from "./catalogue";
import { drawOf } from "./draw";
import { crestsShownFor, crestsShownTo, hoggiesDropFor } from "./flag";
import type { CrateKey } from "./crateKey";
import type { DropRecord } from "./records";

export type HoggieArt = { kind: "hoggie"; slug: string };

export type CrestArt = { kind: "crest"; slug: string };

export type CompletedCrest = { crest: string; name: string; art: CrestArt };

export type Drop = { hoggie: string; name: string; rarity: Rarity; art: HoggieArt; copy: number; isNew: boolean; crest?: CompletedCrest | null };

export type CrestsShown = { crests: boolean };

export type DroppedAt = { at: number; n: number; decided: number; drop: Drop };

export async function dropFor(ctx: MutationCtx, member: MemberId, crate: CrateKey, at: number): Promise<void> {
  if ((await dropRecordOf(ctx, member, crate)) !== null || !(await hoggiesDropFor(ctx, member))) return;
  const { hoggie, rarity } = await drawOf({ secret: drawSecret(), member, crate, version: catalogue.version });
  const n = await countDrop(ctx, member);
  const copy = await countCopy(ctx, member, hoggie, at, n);
  const crest = await crestRecordedFor(ctx, member, hoggie, copy);
  await ctx.db.insert("drops", { member, crate, hoggie, rarity, n, copy, catalogueVersion: catalogue.version, at, ...crest });
  if (crest.crest) await crestsShownFor(ctx, member);
  const { workspace } = await chatUserOf(ctx, member);
  await publish(ctx, { type: "hoggieDropped", workspace, member, crate, hoggie, rarity, copy, at });
}

export async function dropOf(ctx: MutationCtx, member: MemberId, crate: CrateKey): Promise<Drop | null> {
  const record = await dropRecordOf(ctx, member, crate);
  if (record === null) return null;
  const crests = record.crest ? await crestsShownFor(ctx, member) : await crestsShownTo(ctx, member);
  return shownDrop(record, { crests });
}

export async function* dropsNewestFirst(ctx: QueryCtx, member: MemberId, below: DecidedBelow, shown: CrestsShown): AsyncGenerator<DroppedAt> {
  const rows = ctx.db
    .query("drops")
    .withIndex("by_member", (q) => decidedBelow(q.eq("member", member), below))
    .order("desc");
  for await (const record of rows) yield { at: record.at, n: record.n, decided: record._creationTime, drop: shownDrop(record, shown) };
}

function shownDrop({ hoggie, rarity, copy, crest }: DropRecord, shown: CrestsShown): Drop {
  const drop: Drop = { hoggie, name: hoggieNamed(hoggie)?.name ?? hoggie, rarity, art: { kind: "hoggie", slug: hoggie }, copy, isNew: copy === 1 };
  return shown.crests ? { ...drop, crest: crest ? completedCrestOf(crest) : null } : drop;
}

export function completedCrestOf(crest: string): CompletedCrest {
  return { crest, name: crestNamed(crest)?.name ?? crest, art: { kind: "crest", slug: crest } };
}

async function crestRecordedFor(ctx: MutationCtx, member: MemberId, hoggie: string, copy: number): Promise<{ crest?: string | null }> {
  if (catalogue.version < firstVersionWithCrests) return {};
  const team = crestWith(hoggie);
  if (copy !== 1 || team === undefined) return { crest: null };
  const others = team.roster.filter((onRoster) => onRoster !== hoggie);
  const held = await Promise.all(others.map((other) => tallyOf(ctx, member, other)));
  return { crest: held.every((tally) => tally !== null) ? team.crest : null };
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
  const tally = await tallyOf(ctx, member, hoggie);
  if (tally === null) {
    await ctx.db.insert("hoggieTallies", { member, hoggie, count: 1, firstAt: at, firstN: n });
    return 1;
  }
  await ctx.db.patch(tally._id, { count: tally.count + 1 });
  return tally.count + 1;
}

export function tallyOf(ctx: QueryCtx, member: MemberId, hoggie: string): Promise<Doc<"hoggieTallies"> | null> {
  return ctx.db
    .query("hoggieTallies")
    .withIndex("by_member_hoggie", (q) => q.eq("member", member).eq("hoggie", hoggie))
    .unique();
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
