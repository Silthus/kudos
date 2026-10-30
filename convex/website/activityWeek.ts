import type { QueryCtx } from "../_generated/server";
import type { Message } from "../activity/entries";
import { kudosWordsOf, mentionsOfOnePage, permalinkOfMessage } from "../activity/kudos";
import { loopLessonIn, type LoopLesson } from "../album/items/welcome";
import { allowanceDay, weekOf, type DayKey } from "../engine/allowance";
import { newestReceivedBy, type NewestReceived } from "../engine/awards";
import { takenBackInSlack } from "../engine/kudosText";
import { hugRewardsShownTo } from "../hugs/flag";
import { hugsLeftOf } from "../hugs/hugs";
import { hasHuggedBefore, hugOf } from "../hugs/records";
import { workspaceLink } from "../slack/workspaceLink";
import { isMember, timeZoneOf } from "../workspace/directory";
import { faceIn, type AlbumPersonFace } from "./albumPages";
import type { VerifiedMember } from "./memberQuery";

export type NextStep = { kind: "thanked"; giver: AlbumPersonFace; words: Message; permalink: string; at: number } | { kind: "empty" } | { kind: "quiet"; firstHugPaysExtra: boolean };

export type ActivityWeek = { kind: "week"; next: NextStep; kudos: LoopLesson; slack: string };

export const kudosReadForAHugBack = 20;

const dayMs = 24 * 60 * 60 * 1000;

type HugBack = Extract<NextStep, { kind: "thanked" }>;

export async function activityWeekOf(ctx: QueryCtx, me: VerifiedMember, now: number): Promise<ActivityWeek> {
  return { kind: "week", next: await nextStepOf(ctx, me, now), kudos: await loopLessonIn(ctx, me.workspace), slack: workspaceLink(me.workspace) };
}

type Today = { now: number; day: DayKey; timeZone: string | undefined };

async function nextStepOf(ctx: QueryCtx, me: VerifiedMember, now: number): Promise<NextStep> {
  const timeZone = (await timeZoneOf(ctx, me.member)) ?? undefined;
  const hugBack = await newestHugBackOf(ctx, me, { now, day: allowanceDay(now, timeZone), timeZone });
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
