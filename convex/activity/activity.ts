import type { QueryCtx } from "../_generated/server";
import { awardsReceivedNewestFirst, messagesGivenNewestFirst, type Before, type GivenMessageAwards, type MessageAward, type ReceivedAward } from "../engine/awards";
import { dropsNewestFirst } from "../hoggies/drops";
import { crestsShownTo, hoggiesShownTo } from "../hoggies/flag";
import { bonusRecordedWith } from "../progression/effects";
import { bonusGainsShownTo, questGainsShownTo, xpGainsShownTo } from "../progression/gainsView";
import { catalogue } from "../progression/catalogue";
import { giverXpOf } from "../progression/progression";
import { perkOf } from "../progression/tree";
import { questsFinishedByMessage } from "../quests/finishedBy";
import { hugsShownTo } from "../hugs/flag";
import { withoutSkinTone } from "../slack/reactions";
import { hugsGivenNewestFirst, hugsReceivedNewestFirst, hugsReceivedSnapshot, type GivenHug, type ReceivedHugs, type TimelineHug } from "../hugs/records";
import { hugXp } from "../hugs/xp";
import { levelUpsNewestFirst } from "../unlocks/unlocks";
import { chatUserOf, timeZoneOf, type MemberId } from "../workspace/directory";
import type { MessageRef } from "../engine/messageEvent";
import type { Activity, ActivityEntry, BonusEarned, Found, KudosGiven, KudosReceived, LevelUp, Message, RecentKudos, HugGiven, HugReceived } from "./entries";
import { kudosFactsOf, kudosWordsOf, mentionsOfOnePage, permalinkOfMessage, personOf, type Mentions } from "./kudos";
import { beforeFor, decodeCursor, encodeCursor, encodePosition, newestFirst, ranks, type Cursor, type Position, type Rank } from "./position";

export type Filter = "all" | "received" | "given";

export type Direction = Exclude<Filter, "all">;

type GainsShown = { xp: boolean; quests: boolean; bonuses: boolean };

type Viewer = { member: MemberId; gainsShown: () => Promise<GainsShown>; hugsShown: () => Promise<boolean>; hugsAsOf: number | undefined };

type Pending = { position: Position; recipients?: number; entry: (mentions: Mentions) => Promise<ActivityEntry> };

type Read = { pending: Pending[]; cut: boolean };

type Source = { rank: Rank; read: (ctx: QueryCtx, viewer: Viewer, before: Before, take: number) => Promise<Read> };

type PageSize = { min: number; max: number; usual: number };

const activityPage: PageSize = { min: 1, max: 50, usual: 20 };
const recentPage: PageSize = { min: 1, max: 10, usual: 5 };

export const recipientsPerPage = 700;

const levelUps: Source = {
  rank: ranks.levelUp,
  read: async (ctx, { member, gainsShown }, before, take) => {
    if (!(await gainsShown()).xp) return { pending: [], cut: false };
    return whole(
      (await firstOf(levelUpsNewestFirst(ctx, member, before), take)).map(({ level, at, created }) => ({
        position: { at, rank: ranks.levelUp, created },
        entry: async (): Promise<LevelUp> => ({ kind: "levelUp", at, level }),
      })),
    );
  },
};

const kudosReceived: Source = {
  rank: ranks.kudosReceived,
  read: async (ctx, { member }, before, take) =>
    whole(
      (await firstOf(awardsReceivedNewestFirst(ctx, member, before), take)).map((award) => ({
        position: { at: award.at, rank: ranks.kudosReceived, created: award.created },
        entry: (mentions) => receivedEntryOf(ctx, mentions, award),
      })),
    ),
};

const kudosGiven: Source = {
  rank: ranks.kudosGiven,
  read: async (ctx, viewer, before, take) => {
    const { taken, cut } = await firstWithinRecipients(messagesGivenNewestFirst(ctx, viewer.member, before), take, ({ awards }) => awards.length);
    return {
      pending: taken.map((given) => ({
        position: { at: given.at, rank: ranks.kudosGiven, created: given.created },
        recipients: given.awards.length,
        entry: (mentions) => givenEntryOf(ctx, viewer, mentions, given),
      })),
      cut,
    };
  },
};

const found: Source = {
  rank: ranks.found,
  read: async (ctx, { member }, { at, created }, take) => {
    if (!(await hoggiesShownTo(ctx, member))) return whole([]);
    const shown = { crests: await crestsShownTo(ctx, member) };
    return whole(
      (await firstOf(dropsNewestFirst(ctx, member, { at, n: created }, shown), take)).map(({ at, n, drop }) => {
        const position: Position = { at, rank: ranks.found, created: n };
        return { position, entry: async (): Promise<Found> => ({ kind: "found", at, key: encodePosition(position), drop }) };
      }),
    );
  },
};

const hugsGiven: Source = {
  rank: ranks.hugGiven,
  read: async (ctx, viewer, before, take) => {
    if (!(await viewer.hugsShown())) return whole([]);
    const { taken, cut } = await firstWithinRecipients(hugsGivenNewestFirst(ctx, viewer.member, before), take, ({ people }) => people.length);
    return {
      pending: taken.map((given) => ({
        position: { at: given.at, rank: ranks.hugGiven, created: given.created },
        recipients: given.people.length,
        entry: (mentions) => hugGivenEntryOf(ctx, viewer, mentions, given),
      })),
      cut,
    };
  },
};

const hugsReceived: Source = {
  rank: ranks.hugReceived,
  read: async (ctx, viewer, before, take) => {
    if (!(await viewer.hugsShown())) return whole([]);
    return whole(
      (await firstOf(hugsReceivedNewestFirst(ctx, viewer.member, before, viewer.hugsAsOf), take)).map((received) => ({
        position: { at: received.at, rank: ranks.hugReceived, created: received.created },
        entry: (mentions) => hugReceivedEntryOf(ctx, viewer, mentions, received),
      })),
    );
  },
};

const sourcesOf: Record<Filter, Source[]> = {
  all: [levelUps, kudosGiven, kudosReceived, found, hugsGiven, hugsReceived],
  received: [kudosReceived],
  given: [kudosGiven],
};

export async function activityOf(ctx: QueryCtx, member: MemberId, { filter, cursor, limit }: { filter: Filter; cursor: string | null; limit?: number }): Promise<Activity> {
  const { entries, after } = await pageOf(ctx, member, filter, cursor === null ? null : decodeCursor(cursor), sizeOf(limit, activityPage));
  return { kind: "activity", entries, cursor: after, timeZone: await timeZoneOf(ctx, member) };
}

export async function recentKudosOf(ctx: QueryCtx, member: MemberId, { direction, limit }: { direction: Direction; limit?: number }): Promise<RecentKudos> {
  const { entries } = await pageOf(ctx, member, direction, null, sizeOf(limit, recentPage));
  return { kind: "recent", entries: entries.filter(isKudos) };
}

async function pageOf(ctx: QueryCtx, member: MemberId, filter: Filter, cursor: Cursor | null, size: number) {
  const hugsShown = once(() => hugsShownTo(ctx, member));
  const hugsAsOf = await hugsSnapshotOf(ctx, member, filter, hugsShown, cursor);
  const viewer: Viewer = { member, gainsShown: once(() => gainsShownTo(ctx, member)), hugsShown, hugsAsOf };
  const after = cursor?.after ?? null;
  const reads = await Promise.all(sourcesOf[filter].map(({ rank, read }) => read(ctx, viewer, beforeFor(rank, after), size + 1)));
  const pending = reads.flatMap((read) => read.pending).sort((one, other) => newestFirst(one.position, other.position));
  const page = withinRecipients(completeUpTo(pending, cutPositionOf(reads)).slice(0, size));
  const mentions = mentionsOfOnePage(ctx);
  const entries = await Promise.all(page.map(({ entry }) => entry(mentions)));
  const last = page.at(-1);
  const more = pending.length > page.length || reads.some((read) => read.cut);
  return { entries, after: more && last !== undefined ? encodeCursor({ after: last.position, hugsAsOf }) : null };
}

async function hugsSnapshotOf(ctx: QueryCtx, member: MemberId, filter: Filter, hugsShown: () => Promise<boolean>, cursor: Cursor | null): Promise<number | undefined> {
  if (filter !== "all" || !(await hugsShown())) return undefined;
  return cursor?.hugsAsOf ?? hugsReceivedSnapshot(ctx, member);
}

function cutPositionOf(reads: Read[]): Position | undefined {
  return reads
    .filter((read) => read.cut)
    .map((read) => read.pending.at(-1)!.position)
    .sort(newestFirst)[0];
}

function completeUpTo(pending: Pending[], cutAt: Position | undefined) {
  return cutAt === undefined ? pending : pending.filter(({ position }) => newestFirst(position, cutAt) <= 0);
}

function withinRecipients(pending: Pending[]): Pending[] {
  const kept: Pending[] = [];
  let recipients = 0;
  for (const one of pending) {
    const more = one.recipients ?? 0;
    if (more > 0 && recipients > 0 && recipients + more > recipientsPerPage) break;
    kept.push(one);
    recipients += more;
  }
  return kept;
}

async function receivedEntryOf(ctx: QueryCtx, mentions: Mentions, { award, message, giver, at, created }: ReceivedAward): Promise<KudosReceived> {
  const [person, facts] = await Promise.all([personOf(ctx, giver), kudosFactsOf(ctx, mentions, message, award)]);
  return { kind: "kudosReceived", key: encodePosition({ at, rank: ranks.kudosReceived, created }), at, giver: person, ...facts };
}

async function givenEntryOf(ctx: QueryCtx, viewer: Viewer, mentions: Mentions, given: GivenMessageAwards): Promise<KudosGiven> {
  const { first, message, awards, at, created } = given;
  const [recipients, facts, earned] = await Promise.all([Promise.all(awards.map(({ recipient }) => personOf(ctx, recipient))), kudosFactsOf(ctx, mentions, message, first), earnedBy(ctx, viewer, given)]);
  return { kind: "kudosGiven", key: encodePosition({ at, rank: ranks.kudosGiven, created }), at, recipients, kudos: awards[0]?.kudos ?? 0, ...facts, earned };
}

async function hugReceivedEntryOf(ctx: QueryCtx, viewer: Viewer, mentions: Mentions, received: ReceivedHugs): Promise<HugReceived> {
  const { givers, emoji, hugs, at } = received;
  const [persons, xp, facts] = await Promise.all([Promise.all(givers.map((giver) => personOf(ctx, giver))), hugXpShownTo(viewer, hugs), hugFactsOf(ctx, mentions, received)]);
  return { kind: "hugReceived", key: facts.on, at, givers: persons, emoji, hugs, xp, ...facts };
}

async function hugGivenEntryOf(ctx: QueryCtx, viewer: Viewer, mentions: Mentions, given: GivenHug): Promise<HugGiven> {
  const { people, emoji, at, created } = given;
  const [persons, xp, facts] = await Promise.all([Promise.all(people.map((person) => personOf(ctx, person))), hugXpShownTo(viewer, 1), hugFactsOf(ctx, mentions, given)]);
  return { kind: "hugGiven", key: encodePosition({ at, rank: ranks.hugGiven, created }), at, people: persons, emoji, xp, ...facts };
}

type HugFacts = { emojiImage?: string; on: string; permalink: string | null; kudos: Message | null };

async function hugFactsOf(ctx: QueryCtx, mentions: Mentions, { message, onKudos, emoji }: TimelineHug): Promise<HugFacts> {
  const [emojiImage, permalink, kudos] = await Promise.all([mentions.emojiImage(message.workspace, withoutSkinTone(emoji)), permalinkOfMessage(ctx, message), onKudos ? kudosWordsOf(ctx, mentions, message) : null]);
  return { ...(emojiImage !== undefined && { emojiImage }), on: onKeyOf(message), permalink, kudos };
}

function onKeyOf({ conversation, message }: MessageRef): string {
  return `${conversation}/${message}`;
}

async function hugXpShownTo({ gainsShown }: Viewer, hugs: number): Promise<number | null> {
  return (await gainsShown()).xp ? hugs * hugXp : null;
}

async function earnedBy(ctx: QueryCtx, { member, gainsShown }: Viewer, { message, awards }: GivenMessageAwards): Promise<KudosGiven["earned"]> {
  const shown = await gainsShown();
  if (!shown.xp && !shown.quests && !shown.bonuses) return null;
  const [questsDone, bonuses] = await Promise.all([shown.quests ? questsFinishedByMessage(ctx, member, message) : [], shown.bonuses ? bonusesEarnedBy(ctx, awards) : []]);
  return { xp: shown.xp ? giverXpOf(awards) : null, questsDone, bonuses };
}

async function bonusesEarnedBy(ctx: QueryCtx, awards: MessageAward[]): Promise<BonusEarned[]> {
  const paid = await bonusRecordedWith(ctx, awards.map(({ award }) => award));
  return paid.map(({ source, xp }) => ({ perk: { id: source, name: perkOf(source).name }, why: catalogue.bonuses[source].why, xp }));
}

async function gainsShownTo(ctx: QueryCtx, member: MemberId): Promise<GainsShown> {
  const { workspace } = await chatUserOf(ctx, member);
  const [xp, quests, bonuses] = await Promise.all([xpGainsShownTo(ctx, workspace, member), questGainsShownTo(ctx, workspace, member), bonusGainsShownTo(ctx, workspace, member)]);
  return { xp, quests, bonuses };
}

function once<T>(compute: () => Promise<T>): () => Promise<T> {
  let computed: Promise<T> | undefined;
  return () => (computed ??= compute());
}

function isKudos(entry: ActivityEntry): entry is KudosReceived | KudosGiven {
  return entry.kind === "kudosReceived" || entry.kind === "kudosGiven";
}

function sizeOf(limit: number | undefined, { min, max, usual }: PageSize) {
  if (limit === undefined || !Number.isFinite(limit)) return usual;
  return Math.min(max, Math.max(min, Math.floor(limit)));
}

function whole(pending: Pending[]): Read {
  return { pending, cut: false };
}

async function firstWithinRecipients<T>(items: AsyncIterable<T>, take: number, recipientsOf: (item: T) => number): Promise<{ taken: T[]; cut: boolean }> {
  const taken: T[] = [];
  let recipients = 0;
  for await (const given of items) {
    if (taken.length > 0 && recipients + recipientsOf(given) > recipientsPerPage) return { taken, cut: true };
    taken.push(given);
    recipients += recipientsOf(given);
    if (taken.length === take) break;
  }
  return { taken, cut: false };
}

async function firstOf<T>(items: AsyncIterable<T>, take: number): Promise<T[]> {
  const taken: T[] = [];
  if (take <= 0) return taken;
  for await (const item of items) {
    taken.push(item);
    if (taken.length === take) break;
  }
  return taken;
}
