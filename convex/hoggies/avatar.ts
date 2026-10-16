import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { catalogue, hoggieNamed, type CatalogueHoggie, type Rarity } from "./catalogue";
import { talliesOf } from "./collection";
import { tallyOf, type HoggieArt } from "./drops";
import { avatarOpenFor, avatarShownTo } from "./flag";

export type Avatar = { hoggie: string; name: string; rarity: Rarity; art: HoggieArt };

export type AvatarShown = { avatar?: Avatar | null };

export type AvatarChoice = { avatar: Avatar | null; held: Avatar[] };

export async function setAvatar(ctx: MutationCtx, member: MemberId, hoggie: string | null): Promise<void> {
  if (!(await avatarOpenFor(ctx, member))) return;
  if (hoggie !== null && !(await holds(ctx, member, hoggie))) return;
  const row = await avatarRowOf(ctx, member);
  if (hoggie === null) {
    if (row !== null) await ctx.db.delete(row._id);
  } else if (row === null) await ctx.db.insert("hoggieAvatars", { member, hoggie });
  else if (row.hoggie !== hoggie) await ctx.db.patch(row._id, { hoggie });
}

export async function avatarShownOn(ctx: QueryCtx, viewer: MemberId, member: MemberId): Promise<AvatarShown> {
  if (!(await avatarShownTo(ctx, viewer)) || (viewer !== member && !(await avatarShownTo(ctx, member)))) return {};
  return { avatar: await avatarOf(ctx, member) };
}

export async function avatarOf(ctx: QueryCtx, member: MemberId): Promise<Avatar | null> {
  const row = await avatarRowOf(ctx, member);
  const entry = row === null ? undefined : hoggieNamed(row.hoggie);
  return entry === undefined ? null : avatarFrom(entry);
}

export async function avatarChoiceOf(ctx: QueryCtx, member: MemberId): Promise<AvatarChoice | null> {
  if (!(await avatarShownTo(ctx, member))) return null;
  const tallies = await talliesOf(ctx, member);
  return { avatar: await avatarOf(ctx, member), held: catalogue.hoggies.filter(({ hoggie }) => tallies.has(hoggie)).map(avatarFrom) };
}

function avatarFrom({ hoggie, name, rarity }: CatalogueHoggie): Avatar {
  return { hoggie, name, rarity, art: { kind: "hoggie", slug: hoggie } };
}

async function holds(ctx: QueryCtx, member: MemberId, hoggie: string) {
  return hoggieNamed(hoggie) !== undefined && (await tallyOf(ctx, member, hoggie)) !== null;
}

function avatarRowOf(ctx: QueryCtx, member: MemberId): Promise<Doc<"hoggieAvatars"> | null> {
  return ctx.db
    .query("hoggieAvatars")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
