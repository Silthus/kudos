import type { QueryCtx } from "../_generated/server";
import { storedCompanyMatchOf } from "../companyProfiles/storedFaces";
import { companyTeamsOf, type TeamCrestArt } from "../companyProfiles/teams";
import { isAPersonOf, type MemberId } from "../workspace/directory";
import { hypeEarnedBy, hypeEmojiOf as shownHypeEmojiOf, hypeUnlockedByReactions } from "./earnedEmojis";
import { hypeByReactionsShownTo } from "./flag";
import { reactionsToward, type ReactionsToward } from "./hypeCollections";
import type { PageOwner } from "./teamPages";
import { inTheAlbumOf } from "./stickers";
import { anEmptyPair, pairTallyFor, type PairTally } from "./tallies";

export type PersonTeam = { team: string; name: string; art: TeamCrestArt };

export type HypeEmoji = { earned: boolean; name: string | null; picture: string | null; inSlack: boolean; reactions?: ReactionsToward; byReactions?: true };

export type PersonPage = PairTally & { held: boolean; teams: PersonTeam[]; hype: HypeEmoji };

export async function personPageOf(ctx: QueryCtx, owner: PageOwner, person: MemberId): Promise<PersonPage | null> {
  if (!(await isAPersonOf(ctx, owner.workspace, person))) return null;
  return {
    ...((await pairTallyFor(ctx, owner.member, person)) ?? anEmptyPair()),
    held: owner.member === person || (await inTheAlbumOf(ctx, owner.member, person)),
    teams: await personTeamsOf(ctx, owner.workspace, person),
    hype: await hypeEmojiOf(ctx, owner, person),
  };
}

export async function personTeamsOf(ctx: QueryCtx, workspace: string, person: MemberId): Promise<PersonTeam[]> {
  const profile = (await storedCompanyMatchOf(ctx, workspace, person))?.profile ?? null;
  if (profile === null) return [];
  return (await companyTeamsOf(ctx))
    .filter(({ people }) => people.includes(profile))
    .map(({ team, name, crest }) => ({ team, name, art: crest }))
    .sort((one, other) => one.name.localeCompare(other.name) || one.team.localeCompare(other.team));
}

async function hypeEmojiOf(ctx: QueryCtx, { workspace, member }: PageOwner, person: MemberId): Promise<HypeEmoji> {
  const shown = await shownHypeEmojiOf(ctx, workspace, person);
  const earned = await hypeEarnedBy(ctx, member, person);
  return { earned, name: shown?.name ?? null, picture: shown?.picture ?? null, inSlack: shown?.inSlack ?? false, ...(await collectingByReactionsOf(ctx, member, person, earned)) };
}

async function collectingByReactionsOf(ctx: QueryCtx, member: MemberId, person: MemberId, earned: boolean): Promise<Pick<HypeEmoji, "reactions" | "byReactions">> {
  if (member === person || !(await hypeByReactionsShownTo(ctx, member))) return {};
  const reactions = await reactionsToward(ctx, member, person);
  return earned && (await hypeUnlockedByReactions(ctx, member, person)) ? { reactions, byReactions: true } : { reactions };
}
