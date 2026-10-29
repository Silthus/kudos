import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import { putDropIn } from "./hoggies/drops";
import { markTurned } from "./items/ledger";
import type { MemberId } from "../workspace/directory";
import { recordMilestonesOf } from "./milestones";
import { shownTrayItem, trayKeyOf, type TrayItem } from "./opening";
import { crateKeyOf } from "./packs";
import { recordPackSticker } from "./stickers";
import { tallyHoggieFound, tallyNewFace } from "./tallies";
import { teamPagesOf, type PageOwner, type TeamPage } from "./teamPages";

export const mostPutInACall = 25;

export type PutIn = { items: TrayItem[]; more: boolean };

type Stored = Doc<"trayItems">;

type StoredSticker = Extract<Stored, { kind: "sticker" }>;

export async function putItemIn(ctx: MutationCtx, owner: PageOwner, item: Id<"trayItems">, at: number): Promise<TrayItem | null> {
  const stored = await ctx.db.get(item);
  if (stored?.member !== owner.member || stored.putInAt !== undefined) return null;
  await placeFromTheTray(ctx, owner.workspace, stored, at);
  await recordMilestonesOf(ctx, owner, at);
  return shownTrayItem(stored);
}

export async function putEveryItemIn(ctx: MutationCtx, owner: PageOwner, at: number): Promise<PutIn> {
  const inPutInOrder = await putInOrderOf(ctx, owner);
  const placing = inPutInOrder.slice(0, mostPutInACall);
  for (const item of placing) await placeFromTheTray(ctx, owner.workspace, item, at);
  if (placing.length > 0) await recordMilestonesOf(ctx, owner, at);
  return { items: placing.map(shownTrayItem), more: inPutInOrder.length > placing.length };
}

async function putInOrderOf(ctx: QueryCtx, owner: PageOwner): Promise<Stored[]> {
  const hoggies = await waitingInTheTray(ctx, owner.member, "hoggie").take(mostPutInACall + 1);
  if (hoggies.length > mostPutInACall) return hoggies;
  const stickers = (await waitingInTheTray(ctx, owner.member, "sticker").collect()) as StoredSticker[];
  return [...hoggies, ...byTeamPage(stickers, await teamPagesOf(ctx, owner))];
}

function waitingInTheTray(ctx: QueryCtx, member: MemberId, kind: Stored["kind"]) {
  return ctx.db.query("trayItems").withIndex("by_member_put_in_kind", (q) => q.eq("member", member).eq("putInAt", undefined).eq("kind", kind));
}

function byTeamPage(stickers: StoredSticker[], pages: TeamPage[]): StoredSticker[] {
  const pageOf = (person: MemberId) => {
    const page = pages.findIndex(({ people }) => people.includes(person));
    return page === -1 ? pages.length : page;
  };
  return stickers
    .map((sticker, opened) => ({ sticker, opened, page: pageOf(sticker.person) }))
    .sort((one, other) => one.page - other.page || one.opened - other.opened)
    .map(({ sticker }) => sticker);
}

export async function placeFromTheTray(ctx: MutationCtx, workspace: string, item: Stored, at: number): Promise<void> {
  await ctx.db.patch(item._id, { putInAt: at });
  if (item.kind === "hoggie") return putHoggieIn(ctx, item, at);
  await markTurned(ctx, item.member, "sticker", item.pack, at);
  await putStickerIn(ctx, { workspace, member: item.member }, item.person, item.pack, at);
}

export async function putStickerIn(ctx: MutationCtx, { workspace, member }: PageOwner, person: MemberId, pack: Id<"thoughtfulPacks">, at: number): Promise<boolean> {
  if (!(await recordPackSticker(ctx, member, person, pack, at))) return false;
  await tallyNewFace(ctx, member, person, at);
  await publish(ctx, { type: "stickerPutIn", workspace, member, person, at });
  return true;
}

export async function markTrayStickerPutIn(ctx: MutationCtx, pack: Id<"thoughtfulPacks">, at: number): Promise<void> {
  const waiting = await ctx.db
    .query("trayItems")
    .withIndex("by_pack_kind", (q) => q.eq("pack", pack).eq("kind", "sticker"))
    .first();
  if (waiting !== null && waiting.putInAt === undefined) await ctx.db.patch(waiting._id, { putInAt: at });
}

async function putHoggieIn(ctx: MutationCtx, { _id, member, pack, hoggie, rarity }: Extract<Stored, { kind: "hoggie" }>, at: number) {
  await markTurned(ctx, member, "hoggie", trayKeyOf(_id), at);
  await putDropIn(ctx, member, crateKeyOf(pack), at);
  await tallyHoggieFound(ctx, member, { hoggie, rarity }, at);
}
