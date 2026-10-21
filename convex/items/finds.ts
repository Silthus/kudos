import type { QueryCtx } from "../_generated/server";
import { crateKeyOf } from "../album/packs";
import type { MessageRef } from "../engine/messageEvent";
import type { Rarity } from "../hoggies/catalogue";
import { foundIn } from "../hoggies/drops";
import type { MemberId } from "../workspace/directory";
import { isTurned } from "./ledger";

export const mostPacksOfAKudosRead = 50;

const sharedRaritiesRarestFirst = ["legendary", "epic"] as const satisfies Rarity[];

export type SharedRarity = (typeof sharedRaritiesRarestFirst)[number];

export type Find = { name: string; rarity: SharedRarity };

export type GrantedKudos = { giver: MemberId; message: MessageRef; at: number };

export async function turnedFindOf(ctx: QueryCtx, kudos: GrantedKudos): Promise<Find | null> {
  let rarest: Find | null = null;
  for (const crate of await cratesOf(ctx, kudos)) {
    const find = await turnedSharedFindIn(ctx, kudos.giver, crate);
    if (find !== null && (rarest === null || isRarer(find, rarest))) rarest = find;
  }
  return rarest;
}

async function cratesOf(ctx: QueryCtx, { giver, message, at }: GrantedKudos) {
  const packs = await ctx.db
    .query("thoughtfulPacks")
    .withIndex("by_giver_at", (q) => q.eq("giver", giver).eq("at", at))
    .take(mostPacksOfAKudosRead);
  return packs.filter((pack) => pack.message.conversation === message.conversation && pack.message.message === message.message).map(({ _id }) => crateKeyOf(_id));
}

async function turnedSharedFindIn(ctx: QueryCtx, giver: MemberId, crate: ReturnType<typeof crateKeyOf>): Promise<Find | null> {
  if (!(await isTurned(ctx, giver, "hoggie", crate))) return null;
  const drop = await foundIn(ctx, giver, crate, { crests: false });
  return drop !== null && isShared(drop.rarity) ? { name: drop.name, rarity: drop.rarity } : null;
}

function isShared(rarity: Rarity): rarity is SharedRarity {
  return (sharedRaritiesRarestFirst as readonly Rarity[]).includes(rarity);
}

function isRarer(one: Find, other: Find) {
  return sharedRaritiesRarestFirst.indexOf(one.rarity) < sharedRaritiesRarestFirst.indexOf(other.rarity);
}
