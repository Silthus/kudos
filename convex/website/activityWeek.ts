import type { QueryCtx } from "../_generated/server";
import type { Message } from "../activity/entries";
import { kudosWordsOf, kudosWordsStillInSlack, mentionsOfOnePage, permalinkOfMessage, type Mentions } from "../activity/kudos";
import { loopLessonIn, type LoopLesson } from "../album/items/welcome";
import { allowanceDay, wallClockAt, weekOf, type DayKey } from "../engine/allowance";
import { authorOfGiven, awardsReceivedNewestFirst, fromTheNewest, newestReceivedBy, type NewestReceived } from "../engine/awards";
import { takenBackInSlack } from "../engine/kudosText";
import { hugRewardsShownTo } from "../hugs/flag";
import { hugsLeftOf } from "../hugs/hugs";
import { hasHuggedBefore, hugOf, newestHugsReceivedSince, type ReceivedHugs } from "../hugs/records";
import { firstCountedWeekOf, totalsOf } from "../leaderboard/counts";
import { keyOf } from "../leaderboard/periods";
import { workspaceLink } from "../slack/workspaceLink";
import { isMember, timeZoneOf, type MemberId } from "../workspace/directory";
import { faceIn, type AlbumPersonFace } from "./albumPages";
import type { VerifiedMember } from "./memberQuery";

export type NextStep = { kind: "thanked"; giver: AlbumPersonFace; words: Message; permalink: string; at: number } | { kind: "empty" } | { kind: "quiet"; firstHugPaysExtra: boolean };

export type Thanks = { from: AlbumPersonFace; at: number } & ThanksFacts;

export type LastWeek = { week: DayKey; hugsGiven: number; kudosGiven: number; hugsReceived: number };

export type ActivityWeek = { kind: "week"; next: NextStep; thanked: Thanks[]; lastWeek: LastWeek | null; kudos: LoopLesson; slack: string };

export const kudosReadForAHugBack = 20;

export const thanksListed = 30;

const dayMs = 24 * 60 * 60 * 1000;

type HugBack = Extract<NextStep, { kind: "thanked" }>;

type Today = { now: number; day: DayKey; timeZone: string | undefined; weekBegan: number };

type ThanksFacts = { way: "hugged-your-message"; permalink: string | null } | { way: "hugged-your-kudos-back" | "hugged-a-kudos-you-got" | "gave-you-a-kudos"; words: Message | null };

type Thanked = { giver: MemberId; at: number; facts: ThanksFacts };

export async function activityWeekOf(ctx: QueryCtx, me: VerifiedMember, now: number): Promise<ActivityWeek> {
  const today = await todayOf(ctx, me, now);
  return { kind: "week", next: await nextStepOf(ctx, me, today), thanked: await thankedThisWeek(ctx, me, today), lastWeek: await lastWeekOf(ctx, me, today), kudos: await loopLessonIn(ctx, me.workspace), slack: workspaceLink(me.workspace) };
}

async function todayOf(ctx: QueryCtx, me: VerifiedMember, now: number): Promise<Today> {
  const timeZone = (await timeZoneOf(ctx, me.member)) ?? undefined;
  const day = allowanceDay(now, timeZone);
  return { now, day, timeZone, weekBegan: wallClockAt(weekOf(day).monday, 0, timeZone) };
}

async function nextStepOf(ctx: QueryCtx, me: VerifiedMember, today: Today): Promise<NextStep> {
  const hugBack = await newestHugBackOf(ctx, me, today);
  if (hugBack !== null) return hugBack;
  if (!(await hasHuggedBefore(ctx, me.member))) return { kind: "empty" };
  return { kind: "quiet", firstHugPaysExtra: await hugRewardsShownTo(ctx, me.member) };
}

async function newestHugBackOf(ctx: QueryCtx, me: VerifiedMember, today: Today): Promise<HugBack | null> {
  if ((await hugsLeftOf(ctx, me.member, me.workspace, today.day)) === 0) return null;
  const received = await newestReceivedBy(ctx, me.member, kudosReadForAHugBack);
  for (const kudos of received.filter((award) => isStillHuggable(award, today) && isInTheWeekOf(award, today))) {
    const hugBack = await hugBackOf(ctx, me, kudos);
    if (hugBack !== null) return hugBack;
  }
  return null;
}

async function hugBackOf(ctx: QueryCtx, me: VerifiedMember, { message, giver, at }: NewestReceived): Promise<HugBack | null> {
  if (!(await isMember(ctx, giver)) || (await hugOf(ctx, message, me.member)) !== null || (await takenBackInSlack(ctx, message))) return null;
  const permalink = await permalinkOfMessage(ctx, message);
  if (permalink === null) return null;
  return { kind: "thanked", giver: await faceIn(ctx, me.workspace, giver), words: await kudosWordsOf(ctx, mentionsOfOnePage(ctx), message), permalink, at };
}

function isStillHuggable({ message }: NewestReceived, { now }: Today) {
  return now - Number(message.message) * 1000 < dayMs;
}

function isInTheWeekOf({ at }: NewestReceived, { day, timeZone }: Today) {
  return allowanceDay(at, timeZone) >= weekOf(day).monday;
}

async function thankedThisWeek(ctx: QueryCtx, me: VerifiedMember, today: Today): Promise<Thanks[]> {
  const mentions = mentionsOfOnePage(ctx);
  const thanked = [...(await hugsThisWeek(ctx, me, today, mentions)), ...(await kudosThisWeek(ctx, me, today, mentions))];
  const newest = thanked.toSorted((one, other) => other.at - one.at).slice(0, thanksListed);
  return Promise.all(newest.map(async ({ giver, at, facts }) => ({ from: await faceIn(ctx, me.workspace, giver), at, ...facts })));
}

async function hugsThisWeek(ctx: QueryCtx, me: VerifiedMember, { weekBegan }: Today, mentions: Mentions): Promise<Thanked[]> {
  const thanked: Thanked[] = [];
  for (const received of await newestHugsReceivedSince(ctx, me.member, weekBegan, thanksListed)) {
    const facts = await hugFactsOf(ctx, me, mentions, received);
    for (const { giver, at } of received.givers) if (at >= weekBegan) thanked.push({ giver, at, facts });
  }
  return thanked;
}

async function hugFactsOf(ctx: QueryCtx, me: VerifiedMember, mentions: Mentions, { message, onKudos }: ReceivedHugs): Promise<ThanksFacts> {
  if (onKudos) return { way: "hugged-a-kudos-you-got", words: await kudosWordsStillInSlack(ctx, mentions, message) };
  if ((await authorOfGiven(ctx, message)) === me.member) return { way: "hugged-your-kudos-back", words: await kudosWordsStillInSlack(ctx, mentions, message) };
  return { way: "hugged-your-message", permalink: await permalinkOfMessage(ctx, message) };
}

async function kudosThisWeek(ctx: QueryCtx, me: VerifiedMember, { weekBegan }: Today, mentions: Mentions): Promise<Thanked[]> {
  const thanked: Thanked[] = [];
  for await (const { giver, at, message } of awardsReceivedNewestFirst(ctx, me.member, fromTheNewest)) {
    if (at < weekBegan || thanked.length === thanksListed) break;
    thanked.push({ giver, at, facts: { way: "gave-you-a-kudos", words: await kudosWordsStillInSlack(ctx, mentions, message) } });
  }
  return thanked;
}

async function lastWeekOf(ctx: QueryCtx, me: VerifiedMember, { day }: Today): Promise<LastWeek | null> {
  const thisMonday = weekOf(day).monday;
  const firstWeek = await firstCountedWeekOf(ctx, me.member);
  if (firstWeek === null || firstWeek >= thisMonday) return null;
  const week = weekOf(allowanceDay(Date.parse(thisMonday) - dayMs, undefined)).monday;
  const { hugsGiven, kudosGiven, hugsReceived } = await totalsOf(ctx, me.member, keyOf("week", week));
  return { week, hugsGiven, kudosGiven, hugsReceived };
}
