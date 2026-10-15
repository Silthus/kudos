import type { QueryCtx } from "../_generated/server";
import { rewardKeyOf } from "../quests/crates";
import { questsApplyTo } from "../quests/flag";
import { projectedJourneyOf, type ProjectedJourneyStep } from "../quests/journey";
import { journeyCopyFor } from "../quests/journeyCopy";
import { questOf, type PoolQuest } from "../quests/pool";
import { featureOpening, type JourneyQuest, type Quest, type WeeklyQuest } from "../quests/step";
import type { WeekKey } from "../quests/week";
import { drawnWeekOf, unopenedCratesOf, type DrawnWeek, type UnopenedCrate } from "../quests/weekly";
import { workspaceLink } from "../slack/workspaceLink";
import type { Feature } from "../unlocks/feature";
import { scheduled } from "../unlocks/schedule";
import { followTheClock } from "./clock";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { seenKeyOf } from "./seen";
import { unlockPathOf } from "./unlockPath";

export type QuestKind = "Say why" | "Reach out" | "Join in";

export type QuestSlot = {
  slot: number;
  quest: WeeklyQuest;
  kind: QuestKind;
  goal: string;
  progress: { done: number; target: number };
  reward: { xp: number };
  state: "in-progress" | "finished" | "opened";
  swapped: boolean;
  crate: WeeklyQuest | null;
  seen: string | null;
};

export type WaitingCrate = { goal: string; week: WeekKey; reward: { xp: number }; crate: WeeklyQuest; seen: string };

export type WeekSwap = { used: boolean; available: boolean };

export type QuestsAnswer = { kind: "not-found" } | { kind: "locked"; level: number } | { kind: "ready" } | { kind: "quests"; slots: QuestSlot[]; swap: WeekSwap; waiting: WaitingCrate[]; bonus: JourneyStep | null; chatUrl: string };

export type JourneyStep = {
  step: JourneyQuest["step"];
  goal: string;
  hint: string | null;
  reward: { xp: number };
  state: "active" | "finished" | "opened";
  crate: JourneyQuest | null;
  seen: string | null;
  feature: Feature | null;
};

type CrateFacts = { finishedAt: number | null; openedAt: number | null };

const kindLabels: Record<PoolQuest["kind"], QuestKind> = { thoughtfulness: "Say why", breadth: "Reach out", participation: "Join in" };

export const getQuests = memberQuery(async (ctx, me): Promise<QuestsAnswer> => {
  if (!(await questsApplyTo(ctx, me.member))) return { kind: "not-found" };
  const quests = (await unlockPathOf(ctx, me))?.find(({ feature }) => feature === "quests");
  if (quests === undefined) return { kind: "not-found" };
  if (quests.state === "locked") return { kind: "locked", level: scheduled("quests").level };
  if (quests.state === "ready") return { kind: "ready" };
  await followTheClock(ctx);
  const at = Date.now();
  const week = await drawnWeekOf(ctx, me.member, at);
  return {
    kind: "quests",
    slots: week === null ? [] : await Promise.all(week.slots.map((slot) => questSlotOf(me, week, slot))),
    swap: { used: week?.swap != null, available: week?.swapAvailable ?? false },
    waiting: await Promise.all((await unopenedCratesOf(ctx, me.member, at)).map((crate) => waitingCrateOf(me, crate))),
    bonus: await bonusStepOf(ctx, me),
    chatUrl: workspaceLink(me.workspace),
  };
});

export async function journeyStepsOf(ctx: QueryCtx, me: VerifiedMember): Promise<JourneyStep[] | null> {
  if (!(await questsApplyTo(ctx, me.member))) return null;
  return Promise.all((await projectedJourneyOf(ctx, me.member)).map((step) => journeyStepOf(ctx, me, step)));
}

async function bonusStepOf(ctx: QueryCtx, me: VerifiedMember): Promise<JourneyStep | null> {
  const steps = await projectedJourneyOf(ctx, me.member);
  if (!steps.some(hasJoined)) return null;
  const next = steps.find(({ openedAt }) => openedAt === null);
  return next === undefined ? null : journeyStepOf(me, next);
}

function hasJoined({ step, activatedAt }: ProjectedJourneyStep) {
  return step === "first-thanks" && activatedAt !== null;
}

async function questSlotOf(me: VerifiedMember, { swap }: DrawnWeek, facts: DrawnWeek["slots"][number]): Promise<QuestSlot> {
  const { slot, quest, goal, progress, target, reward, crate } = facts;
  const state = crateStateOf(facts, "in-progress");
  return {
    slot,
    quest: crate,
    kind: kindLabels[questOf(quest).kind],
    goal,
    progress: { done: progress, target },
    reward: { xp: reward.xp },
    state,
    swapped: swap?.slot === slot,
    crate: state === "finished" ? crate : null,
    seen: state === "in-progress" ? null : await seenKeyOfCrate(me, crate),
  };
}

async function waitingCrateOf(me: VerifiedMember, { crate, week, goal, reward }: UnopenedCrate): Promise<WaitingCrate> {
  return { goal, week, reward: { xp: reward.xp }, crate, seen: await seenKeyOfCrate(me, crate) };
}

async function journeyStepOf(ctx: QueryCtx, me: VerifiedMember, facts: ProjectedJourneyStep): Promise<JourneyStep> {
  const { step, reward, crate } = facts;
  const state = crateStateOf(facts, "active");
  return {
    step,
    ...(await journeyCopyFor(ctx, me.member, step)),
    reward: { xp: reward.xp },
    state,
    crate: state === "finished" ? crate : null,
    seen: state === "active" ? null : await seenKeyOfCrate(me, crate),
    feature: featureOpening(step),
  };
}

function crateStateOf<Unfinished extends string>({ finishedAt, openedAt }: CrateFacts, unfinished: Unfinished): Unfinished | "finished" | "opened" {
  if (finishedAt === null) return unfinished;
  return openedAt === null ? "finished" : "opened";
}

function seenKeyOfCrate(me: VerifiedMember, crate: Quest) {
  return seenKeyOf(me.member, `quest:${rewardKeyOf(crate)}`);
}
