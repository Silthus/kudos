import { v, type Infer } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { unlockOpenedEventValidator } from "../bus/events";
import { lastThankedBy } from "../engine/awards";
import { republish } from "../feedback/homes";
import type { MemberId } from "../workspace/directory";
import { questsApplyIn } from "./flag";
import { rewardValidator } from "./journey";
import { feasibility, feasibleBecauseValidator, questIdValidator, questOf, questPool, type DrawFacts, type Quest } from "./pool";
import { daysLeftInWeek, weekKeyOf, type WeekKey } from "./week";

const questsPerWeek = 3;
const notThankedForMs = 30 * 24 * 60 * 60 * 1000;

const slotValidator = v.object({
  slot: v.number(),
  quest: questIdValidator,
  reward: rewardValidator,
  catalogueVersion: v.string(),
  feasibleBecause: feasibleBecauseValidator,
});

export const questDrawValidator = v.object({ member: v.id("members"), week: v.string(), drawnAt: v.number(), slots: v.array(slotValidator) });

type Slot = Infer<typeof slotValidator>;

export type WeeklyQuests = { week: WeekKey; drawnAt: number; slots: Array<Slot & { goal: string }> };

export const drawWeeklyQuests = internalMutation({
  args: { event: unlockOpenedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (event.feature !== "quests" || !(await questsApplyIn(ctx, event.workspace))) return;
    if ((await drawFor(ctx, event.member, event.at)) === "drawn") await republish(ctx, event.member);
  },
});

export async function weeklyQuestsOf(ctx: QueryCtx, member: MemberId, at: number): Promise<WeeklyQuests | null> {
  const draw = await drawOf(ctx, member, weekKeyOf(at, await timeZoneOf(ctx, member)));
  if (draw === null) return null;
  const { week, drawnAt, slots } = draw;
  return { week, drawnAt, slots: slots.map((slot) => ({ ...slot, goal: questOf(slot.quest).goal })) };
}

export async function drawFactsOf(ctx: QueryCtx, member: MemberId, at: number): Promise<DrawFacts> {
  const teammates = await teammatesOf(ctx, member);
  const lastThanked = await lastThankedBy(ctx, member, at);
  const notThankedSince = (since: number) => teammates.filter((teammate) => (lastThanked.get(teammate) ?? -Infinity) <= since).length;
  return {
    daysLeft: daysLeftInWeek(at, await timeZoneOf(ctx, member)),
    peopleLeft: {
      anyone: teammates.length,
      "someone-new": teammates.filter((teammate) => !lastThanked.has(teammate)).length,
      "someone-not-thanked-in-30-days": notThankedSince(at - notThankedForMs),
    },
  };
}

async function drawFor(ctx: MutationCtx, member: MemberId, at: number): Promise<"drawn" | "nothing to draw"> {
  const week = weekKeyOf(at, await timeZoneOf(ctx, member));
  if ((await drawOf(ctx, member, week)) !== null) return "nothing to draw";
  const slots = drawFrom(member, week, await drawFactsOf(ctx, member, at));
  if (slots.length === 0) return "nothing to draw";
  await ctx.db.insert("questDraws", { member, week, drawnAt: at, slots });
  return "drawn";
}

function drawFrom(member: MemberId, week: WeekKey, facts: DrawFacts): Slot[] {
  const shuffled = [...questPool.quests].sort((one, other) => rankOf(member, week, one) - rankOf(member, week, other));
  const feasible = shuffled.flatMap((quest) => {
    const feasibleBecause = feasibility(quest, facts);
    return feasibleBecause === null ? [] : [{ quest, feasibleBecause }];
  });
  return feasible.slice(0, questsPerWeek).map(({ quest: { quest, reward }, feasibleBecause }, slot) => ({
    slot,
    quest,
    reward,
    catalogueVersion: questPool.version,
    feasibleBecause,
  }));
}

function rankOf(member: MemberId, week: WeekKey, { quest }: Quest) {
  let hash = 0x811c9dc5;
  for (const character of `${member}:${week}:${quest}`) hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
}

async function teammatesOf(ctx: QueryCtx, member: MemberId): Promise<MemberId[]> {
  const row = await ctx.db.get(member);
  const everyone = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", row!.workspace))
    .collect();
  return everyone.filter(({ _id, kind }) => kind === "member" && _id !== member).map(({ _id }) => _id);
}

async function timeZoneOf(ctx: QueryCtx, member: MemberId) {
  return (await ctx.db.get(member))?.timeZone;
}

function drawOf(ctx: QueryCtx, member: MemberId, week: WeekKey) {
  return ctx.db
    .query("questDraws")
    .withIndex("by_member_week", (q) => q.eq("member", member).eq("week", week))
    .unique();
}
