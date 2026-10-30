import type { QueryCtx } from "../_generated/server";
import { hypeEarnedBy } from "../album/earnedEmojis";
import { emojiNameOf } from "../album/emojiNames";
import { rarityCapsShownTo } from "../album/hoggies/rarityCaps";
import type { Nudge } from "../album/hypeReactions";
import type { Week } from "../engine/allowance";
import { awardsInWeekNewestDaysFirst } from "../engine/awards";
import { hugRewardsShownTo } from "../hugs/flag";
import { peopleHuggedIn } from "../hugs/records";
import { totalsOf } from "../leaderboard/counts";
import { keyOf } from "../leaderboard/periods";
import { isMember, type MemberId } from "../workspace/directory";
import { hugBackThisWeekOf } from "./activityWeek";
import { faceIn, type AlbumPersonFace } from "./albumPages";
import type { VerifiedMember } from "./memberQuery";

export type BoardsNextStep =
  | { kind: "lively"; teammate: AlbumPersonFace; collectsHype: boolean; epicHoggiesByKudos: boolean }
  | { kind: "quiet"; giver: AlbumPersonFace; permalink: string; at: number }
  | { kind: "empty"; firstHugPaysExtra: boolean };

export const thanksReadForTheNextStep = 100;

type Thanked = { person: MemberId; at: number };

type Tally = { times: number; newest: number };

export async function boardsNextStepOf(ctx: QueryCtx, me: VerifiedMember, week: Week, nudge: Nudge | null): Promise<BoardsNextStep> {
  const teammate = await teammateToThankOf(ctx, me.member, week, nudge);
  if (teammate !== null) return livelyStepOf(ctx, me, teammate);
  const hugBack = await hugBackThisWeekOf(ctx, me, Date.now());
  if (hugBack !== null) return { kind: "quiet", giver: hugBack.giver, permalink: hugBack.permalink, at: hugBack.at };
  return { kind: "empty", firstHugPaysExtra: await hugRewardsShownTo(ctx, me.member) };
}

async function teammateToThankOf(ctx: QueryCtx, member: MemberId, week: Week, nudge: Nudge | null): Promise<MemberId | null> {
  if (!(await gaveIn(ctx, member, week))) return null;
  return nudge?.person ?? (await mostThankedIn(ctx, member, week));
}

async function gaveIn(ctx: QueryCtx, member: MemberId, { monday }: Week): Promise<boolean> {
  return (await totalsOf(ctx, member, keyOf("week", monday))).firstDay !== null;
}

async function mostThankedIn(ctx: QueryCtx, member: MemberId, week: Week): Promise<MemberId | null> {
  const hugged = await peopleHuggedIn(ctx, member, week, thanksReadForTheNextStep);
  const thanked = (await awardsInWeekNewestDaysFirst(ctx, member, "given", week, thanksReadForTheNextStep)).map(({ recipient, at }) => ({ person: recipient, at }));
  for (const person of mostThankedFirst([...hugged, ...thanked].filter(({ person }) => person !== member))) {
    if (await isMember(ctx, person)) return person;
  }
  return null;
}

function mostThankedFirst(thanks: Thanked[]): MemberId[] {
  const tallies = new Map<MemberId, Tally>();
  for (const { person, at } of thanks) {
    const { times, newest } = tallies.get(person) ?? { times: 0, newest: at };
    tallies.set(person, { times: times + 1, newest: Math.max(newest, at) });
  }
  return [...tallies].toSorted(([, one], [, other]) => other.times - one.times || other.newest - one.newest).map(([person]) => person);
}

async function livelyStepOf(ctx: QueryCtx, { workspace, member }: VerifiedMember, teammate: MemberId): Promise<BoardsNextStep> {
  return { kind: "lively", teammate: await faceIn(ctx, workspace, teammate), collectsHype: await collectsHypeOf(ctx, workspace, member, teammate), epicHoggiesByKudos: await rarityCapsShownTo(ctx, member) };
}

async function collectsHypeOf(ctx: QueryCtx, workspace: string, member: MemberId, teammate: MemberId): Promise<boolean> {
  return (await emojiNameOf(ctx, workspace, `hype:${teammate}`)) !== null && !(await hypeEarnedBy(ctx, member, teammate));
}
