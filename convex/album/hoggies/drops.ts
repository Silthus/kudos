import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { publish } from "../../bus/publish";
import type { Surface } from "../../commands/surface";
import { decidedBelow, fromTheNewestDecided, type DecidedBelow } from "../../engine/awards";
import { chatUserOf, type MemberId } from "../../workspace/directory";
import { applyGain } from "../../progression/progression";
import type { AppliedReward } from "../../progression/rewards";
import { catalogue, crestNamed, crestWith, firstVersionWithCrests, hoggieNamed, type Rarity } from "./catalogue";
import { drawOf, packBonusOf, type Drawn } from "./draw";
import { crestsShownFor, crestsShownTo, hoggiesDropFor, packsPayFor } from "./flag";
import { crateKindOf, type CrateKey } from "./crateKey";
import { rarityRangeFor, type RarityRange, type SourceRarities } from "./rarityCaps";
import type { DropRecord } from "./records";

export type HoggieArt = { kind: "hoggie"; slug: string };

export type CrestArt = { kind: "crest"; slug: string };

export type CompletedCrest = { crest: string; name: string; art: CrestArt };

export type Drop = { hoggie: string; name: string; rarity: Rarity; art: HoggieArt; copy: number; isNew: boolean; crest?: CompletedCrest | null };

export type CrestsShown = { crests: boolean };

export type DroppedAt = { at: number; n: number; decided: number; drop: Drop };

export type DropContext = RarityRange & { rarities?: SourceRarities; surface?: Surface; unowned?: boolean; waits?: boolean };

export type FindContext = { surface?: Surface; waits?: boolean };

export async function dropFor(ctx: MutationCtx, member: MemberId, crate: CrateKey, at: number, { floor, cap, weights, rarities, unowned = false, ...context }: DropContext): Promise<void> {
  if ((await dropRecordOf(ctx, member, crate)) !== null || !(await hoggiesDropFor(ctx, member))) return;
  const range = rarities === undefined ? { floor, cap, weights } : await rarityRangeFor(ctx, member, rarities);
  const owned = unowned ? await ownedBy(ctx, member) : undefined;
  await recordFind(ctx, member, crate, await drawOf({ secret: drawSecret(), member, crate, version: catalogue.version, ...range, owned }), at, context);
}

export async function recordFind(ctx: MutationCtx, member: MemberId, crate: CrateKey, { hoggie, rarity }: Drawn, at: number, { surface, waits = false }: FindContext): Promise<void> {
  const n = await countDrop(ctx, member);
  const copy = waits ? await nextCopyOf(ctx, member, hoggie) : await countFound(ctx, member, hoggie, at, n);
  const crest = waits ? crestDecidedAtThePutIn() : await crestRecordedFor(ctx, member, hoggie, copy);
  const { workspace } = await chatUserOf(ctx, member);
  const pack = await packPaidFor(ctx, workspace, member, crate, at);
  await ctx.db.insert("drops", { member, crate, hoggie, rarity, n, copy, catalogueVersion: catalogue.version, at, ...crest, ...(pack && { pack }) });
  if (waits) await ctx.db.insert("trayDrops", { member, crate });
  if (crest.crest) await crestsShownFor(ctx, member);
  await publish(ctx, { type: "hoggieDropped", workspace, member, crate, hoggie, rarity, copy, at, ...(pack && { pack: { xp: pack.xp, coins: pack.coins } }), ...(surface && { surface }) });
}

async function packPaidFor(ctx: MutationCtx, workspace: string, member: MemberId, crate: CrateKey, at: number): Promise<AppliedReward | null> {
  const bonus = await packBonusOf({ secret: drawSecret(), member, crate });
  if (bonus === null || !(await packsPayFor(ctx, member))) return null;
  return applyGain(ctx, workspace, { member, ...bonus }, at);
}

export async function putDropIn(ctx: MutationCtx, member: MemberId, crate: CrateKey, at: number): Promise<void> {
  const waiting = await trayDropOf(ctx, member, crate);
  const drop = await dropRecordOf(ctx, member, crate);
  if (waiting === null || waiting.putInAt !== undefined || drop === null) return;
  const copy = await countFound(ctx, member, drop.hoggie, at, await countDrop(ctx, member));
  const crest = await crestRecordedFor(ctx, member, drop.hoggie, copy);
  await ctx.db.patch(waiting._id, { putInAt: at, ...crest });
}

export async function lastFoundBy(ctx: QueryCtx, member: MemberId): Promise<Drop | null> {
  const shown = { crests: false };
  const newest = await newestFoundOf(ctx, member, shown);
  const putIn = await lastPutInOf(ctx, member);
  if (putIn === null || (newest !== null && newest.at >= putIn.at)) return newest?.drop ?? null;
  return shownDrop(putIn.record, shown);
}

async function newestFoundOf(ctx: QueryCtx, member: MemberId, shown: CrestsShown): Promise<DroppedAt | null> {
  for await (const dropped of dropsByDecision(ctx, member, fromTheNewestDecided, shown)) return dropped;
  return null;
}

async function lastPutInOf(ctx: QueryCtx, member: MemberId): Promise<{ at: number; record: DropRecord } | null> {
  const latest = await ctx.db
    .query("trayDrops")
    .withIndex("by_member_put_in", (q) => q.eq("member", member))
    .order("desc")
    .first();
  if (latest?.putInAt === undefined) return null;
  const record = await dropRecordOf(ctx, member, latest.crate);
  return record === null ? null : { at: latest.putInAt, record };
}

function crestDecidedAtThePutIn(): { crest?: null } {
  return catalogue.version < firstVersionWithCrests ? {} : { crest: null };
}

function mayHaveWaitedInTheTray(crate: string) {
  return crateKindOf(crate) === "thoughtful";
}

async function cratesWaitingInTheTrayOf(ctx: QueryCtx, member: MemberId): Promise<Set<string>> {
  const waiting = await ctx.db
    .query("trayDrops")
    .withIndex("by_member_put_in", (q) => q.eq("member", member).eq("putInAt", undefined))
    .collect();
  return new Set(waiting.map(({ crate }) => crate));
}

async function asFound(ctx: QueryCtx, record: DropRecord, shown: CrestsShown): Promise<DropRecord> {
  if (!shown.crests || !mayHaveWaitedInTheTray(record.crate)) return record;
  const putIn = await trayDropOf(ctx, record.member, record.crate);
  return putIn?.crest === undefined ? record : { ...record, crest: putIn.crest };
}

function trayDropOf(ctx: QueryCtx, member: MemberId, crate: string): Promise<Doc<"trayDrops"> | null> {
  return ctx.db
    .query("trayDrops")
    .withIndex("by_member_crate", (q) => q.eq("member", member).eq("crate", crate))
    .unique();
}

export async function packOf(ctx: QueryCtx, member: MemberId, crate: string): Promise<AppliedReward | null> {
  return (await dropRecordOf(ctx, member, crate))?.pack ?? null;
}

export async function droppedIn(ctx: QueryCtx, member: MemberId, crate: CrateKey): Promise<boolean> {
  return (await dropRecordOf(ctx, member, crate)) !== null;
}

export async function dropOf(ctx: MutationCtx, member: MemberId, crate: CrateKey): Promise<Drop | null> {
  const record = await dropRecordOf(ctx, member, crate);
  if (record === null) return null;
  const crests = record.crest ? await crestsShownFor(ctx, member) : await crestsShownTo(ctx, member);
  return shownDrop(record, { crests });
}

export async function foundIn(ctx: QueryCtx, member: MemberId, crate: CrateKey, shown: CrestsShown): Promise<Drop | null> {
  const record = await dropRecordOf(ctx, member, crate);
  return record === null ? null : shownDrop(record, shown);
}

export async function* dropsByDecision(ctx: QueryCtx, member: MemberId, below: DecidedBelow, shown: CrestsShown): AsyncGenerator<DroppedAt> {
  const rows = ctx.db
    .query("drops")
    .withIndex("by_member", (q) => decidedBelow(q.eq("member", member), below))
    .order("desc");
  const waiting = await cratesWaitingInTheTrayOf(ctx, member);
  for await (const record of rows) if (!waiting.has(record.crate)) yield { at: record.at, n: record.n, decided: record._creationTime, drop: shownDrop(await asFound(ctx, record, shown), shown) };
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

async function nextCopyOf(ctx: QueryCtx, member: MemberId, hoggie: string) {
  return ((await tallyOf(ctx, member, hoggie))?.count ?? 0) + 1;
}

async function countFound(ctx: MutationCtx, member: MemberId, hoggie: string, at: number, n: number) {
  const tally = await tallyOf(ctx, member, hoggie);
  if (tally === null) {
    await ctx.db.insert("hoggieTallies", { member, hoggie, count: 1, firstAt: at, firstN: n });
    return 1;
  }
  await ctx.db.patch(tally._id, { count: tally.count + 1 });
  return tally.count + 1;
}

async function ownedBy(ctx: QueryCtx, member: MemberId): Promise<Set<string>> {
  const tallies = await ctx.db
    .query("hoggieTallies")
    .withIndex("by_member_hoggie", (q) => q.eq("member", member))
    .take(catalogue.hoggies.length);
  return new Set(tallies.map(({ hoggie }) => hoggie));
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

export function drawSecret() {
  return process.env.HOGGIE_DRAW_SECRET ?? "";
}
