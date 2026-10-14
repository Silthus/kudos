import type { QueryCtx } from "../_generated/server";
import { awardsReceivedNewestFirst, messagesGivenNewestFirst, type Before, type GivenMessageAwards, type ReceivedAward } from "../engine/awards";
import { timeZoneOf, type MemberId } from "../workspace/directory";
import type { Activity, ActivityEntry, KudosGiven, KudosReceived, RecentKudos } from "./entries";
import { kudosFactsOf, personOf } from "./kudos";
import { beforeFor, decodePosition, encodePosition, newestFirst, ranks, type Position, type Rank } from "./position";

export type Filter = "all" | "received" | "given";

export type Direction = Exclude<Filter, "all">;

type Pending = { position: Position; entry: () => Promise<ActivityEntry> };

type Source = { rank: Rank; read: (ctx: QueryCtx, member: MemberId, before: Before, take: number) => Promise<Pending[]> };

type PageSize = { min: number; max: number; usual: number };

const activityPage: PageSize = { min: 1, max: 50, usual: 20 };
const recentPage: PageSize = { min: 1, max: 10, usual: 5 };

const kudosReceived: Source = {
  rank: ranks.kudosReceived,
  read: async (ctx, member, before, take) =>
    (await firstOf(awardsReceivedNewestFirst(ctx, member, before), take)).map((award) => ({
      position: { at: award.at, rank: ranks.kudosReceived, created: award.created },
      entry: () => receivedEntryOf(ctx, award),
    })),
};

const kudosGiven: Source = {
  rank: ranks.kudosGiven,
  read: async (ctx, member, before, take) =>
    (await firstOf(messagesGivenNewestFirst(ctx, member, before), take)).map((given) => ({
      position: { at: given.at, rank: ranks.kudosGiven, created: given.created },
      entry: () => givenEntryOf(ctx, given),
    })),
};

const sourcesOf: Record<Filter, Source[]> = {
  all: [kudosGiven, kudosReceived],
  received: [kudosReceived],
  given: [kudosGiven],
};

export async function activityOf(ctx: QueryCtx, member: MemberId, { filter, cursor, limit }: { filter: Filter; cursor: string | null; limit?: number }): Promise<Activity> {
  const { entries, after } = await pageOf(ctx, member, filter, cursor === null ? null : decodePosition(cursor), sizeOf(limit, activityPage));
  return { kind: "activity", entries, cursor: after, timeZone: await timeZoneOf(ctx, member) };
}

export async function recentKudosOf(ctx: QueryCtx, member: MemberId, { direction, limit }: { direction: Direction; limit?: number }): Promise<RecentKudos> {
  const { entries } = await pageOf(ctx, member, direction, null, sizeOf(limit, recentPage));
  return { kind: "recent", entries: entries.filter(isKudos) };
}

async function pageOf(ctx: QueryCtx, member: MemberId, filter: Filter, after: Position | null, size: number) {
  const read = await Promise.all(sourcesOf[filter].map(({ rank, read }) => read(ctx, member, beforeFor(rank, after), size + 1)));
  const pending = read.flat().sort((one, other) => newestFirst(one.position, other.position));
  const page = pending.slice(0, size);
  const entries = await Promise.all(page.map(({ entry }) => entry()));
  const last = page.at(-1);
  return { entries, after: pending.length > size && last !== undefined ? encodePosition(last.position) : null };
}

async function receivedEntryOf(ctx: QueryCtx, { award, message, giver, at, created }: ReceivedAward): Promise<KudosReceived> {
  const [person, facts] = await Promise.all([personOf(ctx, giver), kudosFactsOf(ctx, message, award)]);
  return { kind: "kudosReceived", key: encodePosition({ at, rank: ranks.kudosReceived, created }), at, giver: person, ...facts };
}

async function givenEntryOf(ctx: QueryCtx, { first, message, awards, at, created }: GivenMessageAwards): Promise<KudosGiven> {
  const [recipients, facts] = await Promise.all([Promise.all(awards.map(({ recipient }) => personOf(ctx, recipient))), kudosFactsOf(ctx, message, first)]);
  return { kind: "kudosGiven", key: encodePosition({ at, rank: ranks.kudosGiven, created }), at, recipients, kudos: awards[0]?.kudos ?? 0, ...facts, earned: null };
}

function isKudos(entry: ActivityEntry): entry is KudosReceived | KudosGiven {
  return entry.kind === "kudosReceived" || entry.kind === "kudosGiven";
}

function sizeOf(limit: number | undefined, { min, max, usual }: PageSize) {
  if (limit === undefined || !Number.isFinite(limit)) return usual;
  return Math.min(max, Math.max(min, Math.floor(limit)));
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
