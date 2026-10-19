import type { QueryCtx } from "../_generated/server";
import { storedCompanyMatchOf } from "../companyProfiles/storedFaces";
import { companyTeamsOf, type TeamCrestArt } from "../companyProfiles/teams";
import { isAPersonOf, type MemberId } from "../workspace/directory";
import { emojiNameOf } from "./emojiNames";
import type { PageOwner } from "./teamPages";
import { inTheAlbumOf } from "./stickers";
import { anEmptyPair, pairTallyFor, type PairTally } from "./tallies";

export type PersonTeam = { team: string; name: string; art: TeamCrestArt };

export type HypeEmoji = { earned: boolean; name: string | null };

export type PersonPage = PairTally & { held: boolean; teams: PersonTeam[]; hype: HypeEmoji };

export async function personPageOf(ctx: QueryCtx, owner: PageOwner, person: MemberId): Promise<PersonPage | null> {
  if (!(await isAPersonOf(ctx, owner.workspace, person))) return null;
  return {
    ...((await pairTallyFor(ctx, owner.member, person)) ?? anEmptyPair()),
    held: owner.member === person || (await inTheAlbumOf(ctx, owner.member, person)),
    teams: await teamsOf(ctx, owner.workspace, person),
    hype: await hypeEmojiOf(ctx, owner, person),
  };
}

async function teamsOf(ctx: QueryCtx, workspace: string, person: MemberId): Promise<PersonTeam[]> {
  const profile = (await storedCompanyMatchOf(ctx, workspace, person))?.profile ?? null;
  if (profile === null) return [];
  return (await companyTeamsOf(ctx))
    .filter(({ people }) => people.includes(profile))
    .map(({ team, name, crest }) => ({ team, name, art: crest }))
    .sort((one, other) => one.name.localeCompare(other.name) || one.team.localeCompare(other.team));
}

async function hypeEmojiOf(ctx: QueryCtx, { workspace, member }: PageOwner, person: MemberId): Promise<HypeEmoji> {
  const firstPack = await ctx.db
    .query("thoughtfulPacks")
    .withIndex("by_giver_recipient_week", (q) => q.eq("giver", member).eq("recipient", person))
    .first();
  return { earned: firstPack !== null, name: await emojiNameOf(ctx, workspace, `hype:${person}`) };
}
