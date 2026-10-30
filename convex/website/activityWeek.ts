import type { QueryCtx } from "../_generated/server";
import { permalinkOfMessage } from "../activity/kudos";
import { loopLessonIn, type LoopLesson } from "../album/items/welcome";
import { allowanceDay, weekOf, type DayKey } from "../engine/allowance";
import { awardsInWeekNewestDaysFirst, type WeekAward } from "../engine/awards";
import { takenBackInSlack } from "../engine/kudosText";
import { hugRewardsShownTo } from "../hugs/flag";
import { hugsLeftOf } from "../hugs/hugs";
import { hasHuggedBefore, hugOf } from "../hugs/records";
import { givingWeekOf } from "../progression/progress";
import { workspaceLink } from "../slack/workspaceLink";
import { timeZoneOf } from "../workspace/directory";
import { faceIn, type AlbumPersonFace } from "./albumPages";
import type { VerifiedMember } from "./memberQuery";

export type NextStep = { kind: "thanked"; giver: AlbumPersonFace; permalink: string; at: number } | { kind: "empty" } | { kind: "quiet"; firstHugPaysExtra: boolean };

export type ActivityWeek = { kind: "week"; next: NextStep; kudos: LoopLesson; slack: string };

export const kudosReadForAHugBack = 20;

const dayMs = 24 * 60 * 60 * 1000;

type HugBack = Extract<NextStep, { kind: "thanked" }>;

export async function activityWeekOf(ctx: QueryCtx, me: VerifiedMember, now: number): Promise<ActivityWeek> {
  return { kind: "week", next: await nextStepOf(ctx, me, now), kudos: await loopLessonIn(ctx, me.workspace), slack: workspaceLink(me.workspace) };
}

async function nextStepOf(ctx: QueryCtx, me: VerifiedMember, now: number): Promise<NextStep> {
  const today = allowanceDay(now, (await timeZoneOf(ctx, me.member)) ?? undefined);
  const hugBack = await newestHugBackOf(ctx, me, today, now);
  if (hugBack !== null) return hugBack;
  if (!(await hasHuggedBefore(ctx, me.member))) return { kind: "empty" };
  return { kind: "quiet", firstHugPaysExtra: await hugRewardsShownTo(ctx, me.member) };
}

async function newestHugBackOf(ctx: QueryCtx, me: VerifiedMember, today: DayKey, now: number): Promise<HugBack | null> {
  if ((await hugsLeftOf(ctx, me.member, me.workspace, today)) === 0) return null;
  const received = await awardsInWeekNewestDaysFirst(ctx, me.member, "received", weekOf(givingWeekOf(today)), kudosReadForAHugBack);
  for (const kudos of received.filter((award) => isStillHuggable(award, now))) {
    const hugBack = await hugBackOf(ctx, me, kudos);
    if (hugBack !== null) return hugBack;
  }
  return null;
}

async function hugBackOf(ctx: QueryCtx, me: VerifiedMember, { message, giver, at }: WeekAward): Promise<HugBack | null> {
  if ((await hugOf(ctx, message, me.member)) !== null || (await takenBackInSlack(ctx, message))) return null;
  const permalink = await permalinkOfMessage(ctx, message);
  return permalink === null ? null : { kind: "thanked", giver: await faceIn(ctx, me.workspace, giver), permalink, at };
}

function isStillHuggable({ message }: WeekAward, now: number) {
  return now - Number(message.message) * 1000 < dayMs;
}
