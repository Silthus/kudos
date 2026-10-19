import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { hugGivenEventValidator, kudosGivenEventValidator } from "../bus/events";
import { allowanceDay, type DayKey } from "../engine/allowance";
import { givenFactsOf, storedAnnotationsOf, type AwardId } from "../engine/awards";
import type { Annotations, MessageRef } from "../engine/messageEvent";
import { hugOf, hugPeopleAfter, hugWithId, type Hug } from "../hugs/records";
import { hugsOnTheMessage } from "../hugs/weeks";
import { gateDecisionOf, wordCountOf } from "../progression/gate";
import { givingWeekOf } from "../progression/progress";
import { timeZoneOf, type MemberId } from "../workspace/directory";
import { countOnTheBoards } from "./boards";
import { recordMilestonesOf } from "./milestones";
import { pairTallyValidator, weekTallyValidator, type HoggieFound, type HugPick, type KudosPick, type WeekList } from "./records";

export const awardsPerTally = 50;
export const peoplePerHugTally = 50;
export const peopleListed = 12;

export type KudosAward = { award: AwardId; message: MessageRef; giver: MemberId; recipient: MemberId; kudos: number; day: DayKey; at: number };

export type KudosWeight = { words: number; thoughtful: boolean; hugs: number };

const pairTallyAnswer = pairTallyValidator.omit("member", "person");

const weekTallyAnswer = weekTallyValidator.omit("member", "week");

export type PairTally = Infer<typeof pairTallyAnswer>;

export type WeekTally = Infer<typeof weekTallyAnswer>;

type PairChange = { kudosGiven?: number; kudosReceived?: number; hugsGiven?: number; hugsReceived?: number; thankedAt?: number; best?: KudosPick };

type WeekChange = {
  kudosGiven?: number;
  kudosReceived?: number;
  thoughtfulGiven?: number;
  thoughtfulReceived?: number;
  hugsGiven?: number;
  hugsReceived?: number;
  listed?: { list: WeekList; person: MemberId };
  pick?: HugPick;
  on?: DayKey;
  opened?: number;
  newFace?: MemberId;
  hoggie?: HoggieFound;
};

type PeopleList = { people: MemberId[]; more: number };

type HoggiesList = { hoggies: HoggieFound[]; more: number };

type KudosOfTheWeek = { giver: MemberId; week: DayKey; pick: HugPick };

const daysInAWeek = 7;
const nobody: PeopleList = { people: [], more: 0 };
const noHoggies: HoggiesList = { hoggies: [], more: 0 };
const dayMs = 24 * 60 * 60 * 1000;

export const tallyKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator, from: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { event, from = 0 }) => {
    const next = from + awardsPerTally;
    const weight = await kudosWeightOf(ctx, event.message, event.annotations);
    for (const { award, giver, recipient, kudos } of event.awards.slice(from, next)) {
      await tallyAward(ctx, { award, message: event.message, giver, recipient, kudos, day: event.day, at: event.at }, weight);
    }
    if (weight.thoughtful) await recordMilestonesOf(ctx, { workspace: event.workspace, member: event.giver }, Date.now());
    if (next < event.awards.length) await ctx.scheduler.runAfter(0, internal.album.tallies.tallyKudosGiven, { event, from: next });
    return null;
  },
});

export const tallyHugGiven = internalMutation({
  args: { event: hugGivenEventValidator },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    const hug = await hugOf(ctx, event.message, event.giver);
    if (hug !== null) await tallyHugFrom(ctx, hug, null);
    return null;
  },
});

export const tallyHug = internalMutation({
  args: { hug: v.id("hugs"), after: v.id("members") },
  returns: v.null(),
  handler: async (ctx, { hug, after }) => {
    const found = await hugWithId(ctx, hug);
    if (found !== null) await tallyHugFrom(ctx, found, after);
    return null;
  },
});

export const pairTallyOf = internalQuery({
  args: { member: v.id("members"), person: v.id("members") },
  returns: v.union(pairTallyAnswer, v.null()),
  handler: (ctx, { member, person }) => pairTallyFor(ctx, member, person),
});

export const weekTallyOf = internalQuery({
  args: { member: v.id("members"), week: v.string() },
  returns: v.union(weekTallyAnswer, v.null()),
  handler: async (ctx, { member, week }): Promise<WeekTally | null> => {
    const row = await weekRowOf(ctx, member, week);
    return row === null ? null : weekTallyIn(row);
  },
});

export async function pairTallyFor(ctx: QueryCtx, member: MemberId, person: MemberId): Promise<PairTally | null> {
  const row = await pairRowOf(ctx, member, person);
  if (row === null) return null;
  const { _id, _creationTime, member: _member, person: _person, ...tally } = row;
  return tally;
}

export function weekTallyIn({ _id, _creationTime, member: _member, week: _week, ...tally }: Doc<"weekTallies">): WeekTally {
  return tally;
}

export async function tallyPackOpened(ctx: MutationCtx, member: MemberId, at: number) {
  await changeWeek(ctx, member, await weekAt(ctx, member, at), { opened: 1 });
}

export async function tallyNewFace(ctx: MutationCtx, member: MemberId, person: MemberId, at: number) {
  await changeWeek(ctx, member, await weekAt(ctx, member, at), { newFace: person });
}

export async function tallyHoggieFound(ctx: MutationCtx, member: MemberId, hoggie: HoggieFound, at: number) {
  await changeWeek(ctx, member, await weekAt(ctx, member, at), { hoggie });
}

export async function weekAt(ctx: QueryCtx, member: MemberId, at: number): Promise<DayKey> {
  return givingWeekOf(allowanceDay(at, (await timeZoneOf(ctx, member)) ?? undefined));
}

async function kudosWeightOf(ctx: QueryCtx, message: MessageRef, annotations: Annotations): Promise<KudosWeight> {
  return { words: wordCountOf(annotations) ?? 0, thoughtful: gateDecisionOf(annotations)?.thoughtful === true, hugs: await hugsOnTheMessage(ctx, message) };
}

export async function storedKudosWeightOf(ctx: QueryCtx, message: MessageRef): Promise<KudosWeight> {
  return kudosWeightOf(ctx, message, await storedAnnotationsOf(ctx, message));
}

export async function tallyAward(ctx: MutationCtx, award: KudosAward, { words, thoughtful, hugs }: KudosWeight) {
  if ((await talliedAwardOf(ctx, award.award)) !== null) return;
  await ctx.db.insert("talliedAwards", { award: award.award, countedOnTheBoards: true });
  const { message, giver, recipient, kudos, day, at } = award;
  const week = givingWeekOf(day);
  const pick = { message, hugs, words, at };
  await changePair(ctx, giver, recipient, { kudosGiven: kudos, thankedAt: at, ...(thoughtful && { best: { message, words, at } }) });
  await changePair(ctx, recipient, giver, { kudosReceived: kudos });
  await changeWeek(ctx, giver, week, { kudosGiven: kudos, thoughtfulGiven: thoughtful ? 1 : 0, listed: { list: "thanked", person: recipient }, pick, on: day });
  await changeWeek(ctx, recipient, week, { kudosReceived: kudos, thoughtfulReceived: thoughtful ? 1 : 0, listed: { list: "thankedBy", person: giver }, pick, on: day });
  if (thoughtful) await countOnTheBoards(ctx, { workspace: message.workspace, giver, day });
}

export type HugPeopleTallied = { tallied: number; last: MemberId | null };

export async function tallyHugPeople(ctx: MutationCtx, hug: Hug, after: MemberId | null, atMost: number): Promise<HugPeopleTallied> {
  const kudos = hug.onKudos ? await kudosOfTheWeekOf(ctx, hug) : null;
  if (after === null && kudos !== null) await changeWeek(ctx, kudos.giver, kudos.week, { pick: kudos.pick });
  if (after === null) await tallyHugGiverSide(ctx, hug);
  const { people, last } = await hugPeopleAfter(ctx, hug, after, atMost);
  for (const person of people) await tallyHugTo(ctx, hug, person, kudos);
  return { tallied: people.length, last };
}

async function tallyHugFrom(ctx: MutationCtx, hug: Hug, after: MemberId | null) {
  const { last } = await tallyHugPeople(ctx, hug, after, peoplePerHugTally);
  if (last !== null) await ctx.scheduler.runAfter(0, internal.album.tallies.tallyHug, { hug: hug._id, after: last });
}

async function kudosOfTheWeekOf(ctx: QueryCtx, hug: Hug): Promise<KudosOfTheWeek | null> {
  const message = { workspace: hug.workspace, conversation: hug.conversation, message: hug.message };
  const given = await givenFactsOf(ctx, message);
  if (given === null) return null;
  const { words, hugs } = await storedKudosWeightOf(ctx, message);
  return { giver: given.giver, week: givingWeekOf(given.day), pick: { message, hugs, words, at: given.at } };
}

async function tallyHugGiverSide(ctx: MutationCtx, hug: Hug) {
  if (await isHugTallied(ctx, hug, hug.giver)) return;
  await ctx.db.insert("talliedHugs", { hug: hug._id, person: hug.giver });
  await changeWeek(ctx, hug.giver, givingWeekOf(hug.day), { hugsGiven: 1, on: hug.day });
}

async function tallyHugTo(ctx: MutationCtx, hug: Hug, person: MemberId, kudos: KudosOfTheWeek | null) {
  if (person === hug.giver) return;
  if (kudos !== null) await changeWeek(ctx, person, kudos.week, { pick: kudos.pick });
  if (await isHugTallied(ctx, hug, person)) return;
  await ctx.db.insert("talliedHugs", { hug: hug._id, person });
  const week = givingWeekOf(hug.day);
  await changePair(ctx, hug.giver, person, { hugsGiven: 1 });
  await changePair(ctx, person, hug.giver, { hugsReceived: 1 });
  await changeWeek(ctx, hug.giver, week, { listed: { list: "hugged", person } });
  await changeWeek(ctx, person, week, { hugsReceived: 1, listed: { list: "huggedBy", person: hug.giver }, on: hug.day });
}

async function changePair(ctx: MutationCtx, member: MemberId, person: MemberId, change: PairChange) {
  const row = await pairRowOf(ctx, member, person);
  const tally = row ?? { member, person, ...anEmptyPair() };
  const changed = {
    ...tally,
    kudosGiven: tally.kudosGiven + (change.kudosGiven ?? 0),
    kudosReceived: tally.kudosReceived + (change.kudosReceived ?? 0),
    hugsGiven: tally.hugsGiven + (change.hugsGiven ?? 0),
    hugsReceived: tally.hugsReceived + (change.hugsReceived ?? 0),
    firstThankedAt: earliestOf(tally.firstThankedAt, change.thankedAt),
    best: change.best === undefined ? tally.best : bestOf(tally.best, change.best),
  };
  if (row === null) await ctx.db.insert("pairTallies", changed);
  else await ctx.db.replace(row._id, changed);
}

async function changeWeek(ctx: MutationCtx, member: MemberId, week: DayKey, change: WeekChange) {
  const row = await weekRowOf(ctx, member, week);
  const tally = row ?? emptyWeekOf(member, week);
  const changed = {
    ...tally,
    kudosGiven: tally.kudosGiven + (change.kudosGiven ?? 0),
    kudosReceived: tally.kudosReceived + (change.kudosReceived ?? 0),
    thoughtfulGiven: tally.thoughtfulGiven + (change.thoughtfulGiven ?? 0),
    thoughtfulReceived: tally.thoughtfulReceived + (change.thoughtfulReceived ?? 0),
    hugsGiven: tally.hugsGiven + (change.hugsGiven ?? 0),
    hugsReceived: tally.hugsReceived + (change.hugsReceived ?? 0),
    ...(change.listed !== undefined && { [change.listed.list]: await listedIn(ctx, tally, change.listed) }),
    kudosOfWeek: change.pick === undefined ? tally.kudosOfWeek : kudosOfTheWeek(tally.kudosOfWeek, change.pick),
    days: change.on === undefined ? tally.days : countedOn(tally.days, week, change.on),
    ...(change.opened !== undefined && { packsOpened: (tally.packsOpened ?? 0) + change.opened }),
    ...(change.newFace !== undefined && { newFaces: withOneMore(tally.newFaces ?? nobody, change.newFace) }),
    ...(change.hoggie !== undefined && { hoggiesFound: withHoggie(tally.hoggiesFound ?? noHoggies, change.hoggie) }),
  };
  if (row === null) await ctx.db.insert("weekTallies", changed);
  else await ctx.db.replace(row._id, changed);
}

export function anEmptyPair(): PairTally {
  return { firstThankedAt: null, kudosGiven: 0, kudosReceived: 0, hugsGiven: 0, hugsReceived: 0, best: null };
}

function emptyWeekOf(member: MemberId, week: DayKey) {
  return { member, week, ...anEmptyWeek() };
}

export function anEmptyWeek(): WeekTally {
  return {
    kudosGiven: 0,
    kudosReceived: 0,
    thoughtfulGiven: 0,
    thoughtfulReceived: 0,
    hugsGiven: 0,
    hugsReceived: 0,
    thanked: nobody,
    thankedBy: nobody,
    hugged: nobody,
    huggedBy: nobody,
    kudosOfWeek: null,
    days: Array.from({ length: daysInAWeek }, () => 0),
  };
}

async function listedIn(ctx: MutationCtx, tally: { member: MemberId; week: DayKey } & Record<WeekList, { people: MemberId[]; more: number }>, { list, person }: { list: WeekList; person: MemberId }) {
  const listed = tally[list];
  const already = await ctx.db
    .query("weekPeople")
    .withIndex("by_member_week_list_person", (q) => q.eq("member", tally.member).eq("week", tally.week).eq("list", list).eq("person", person))
    .unique();
  if (already !== null) return listed;
  await ctx.db.insert("weekPeople", { member: tally.member, week: tally.week, list, person });
  return withOneMore(listed, person);
}

function withOneMore({ people, more }: PeopleList, person: MemberId): PeopleList {
  return people.length < peopleListed ? { people: [...people, person], more } : { people, more: more + 1 };
}

function withHoggie({ hoggies, more }: HoggiesList, hoggie: HoggieFound): HoggiesList {
  return hoggies.length < peopleListed ? { hoggies: [...hoggies, hoggie], more } : { hoggies, more: more + 1 };
}

function earliestOf(current: number | null, at: number | undefined) {
  if (at === undefined) return current;
  return current === null ? at : Math.min(current, at);
}

function bestOf(current: KudosPick | null, candidate: KudosPick): KudosPick {
  if (current === null) return candidate;
  if (candidate.words !== current.words) return candidate.words > current.words ? candidate : current;
  return candidate.at >= current.at ? candidate : current;
}

function kudosOfTheWeek(current: HugPick | null, candidate: HugPick): HugPick {
  if (current === null || sameMessage(current.message, candidate.message)) return candidate;
  if (candidate.hugs !== current.hugs) return candidate.hugs > current.hugs ? candidate : current;
  if (candidate.words !== current.words) return candidate.words > current.words ? candidate : current;
  return candidate.at >= current.at ? candidate : current;
}

function sameMessage(one: MessageRef, other: MessageRef) {
  return one.workspace === other.workspace && one.conversation === other.conversation && one.message === other.message;
}

function countedOn(days: number[], week: DayKey, day: DayKey) {
  const index = Math.round((Date.parse(day) - Date.parse(week)) / dayMs);
  return days.map((count, each) => (each === index ? count + 1 : count));
}

function pairRowOf(ctx: QueryCtx, member: MemberId, person: MemberId) {
  return ctx.db
    .query("pairTallies")
    .withIndex("by_member_person", (q) => q.eq("member", member).eq("person", person))
    .unique();
}

export function weekRowOf(ctx: QueryCtx, member: MemberId, week: DayKey) {
  return ctx.db
    .query("weekTallies")
    .withIndex("by_member_week", (q) => q.eq("member", member).eq("week", week))
    .unique();
}

export function talliedAwardOf(ctx: QueryCtx, award: AwardId) {
  return ctx.db
    .query("talliedAwards")
    .withIndex("by_award", (q) => q.eq("award", award))
    .unique();
}

async function isHugTallied(ctx: QueryCtx, hug: Hug, person: MemberId) {
  const tallied = await ctx.db
    .query("talliedHugs")
    .withIndex("by_hug_person", (q) => q.eq("hug", hug._id).eq("person", person))
    .unique();
  return tallied !== null;
}
