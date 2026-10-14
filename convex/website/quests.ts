import type { QueryCtx } from "../_generated/server";
import { rewardKeyOf } from "../quests/crates";
import { questsApplyIn } from "../quests/flag";
import { projectedJourneyOf, type ProjectedJourneyStep } from "../quests/journey";
import { journeyCopyOf } from "../quests/journeyCopy";
import { questOf, type PoolQuest } from "../quests/pool";
import type { JourneyQuest, Quest, WeeklyQuest } from "../quests/step";
import { drawnWeekOf, waitingCratesOf, type DrawnWeek, type UnopenedCrate } from "../quests/weekly";
import { workspaceLink } from "../slack/workspaceLink";
import { scheduled } from "../unlocks/schedule";
import { followTheClock } from "./clock";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { seenKeyOf } from "./seen";
import { unlockPathOf } from "./unlockPath";

export type QuestKind = "Say why" | "Reach out" | "Join in";

export type QuestSlot = {
  slot: number;
  kind: QuestKind;
  goal: string;
  progress: { done: number; target: number };
  reward: { xp: number };
  state: "in-progress" | "finished" | "opened";
  swapped: boolean;
  crate: WeeklyQuest | null;
  seen: string | null;
};

export type WaitingCrate = { goal: string; reward: { xp: number }; crate: WeeklyQuest; seen: string };

export type QuestsAnswer = { kind: "not-found" } | { kind: "locked"; level: number } | { kind: "ready" } | { kind: "quests"; slots: QuestSlot[]; waiting: WaitingCrate[]; chatUrl: string };

export type JourneyStep = {
  step: JourneyQuest["step"];
  goal: string;
  hint: string | null;
  reward: { xp: number };
  state: "active" | "finished" | "opened";
  crate: JourneyQuest | null;
  seen: string | null;
};

type CrateFacts = { finishedAt: number | null; openedAt: number | null };

const kindLabels: Record<PoolQuest["kind"], QuestKind> = { thoughtfulness: "Say why", breadth: "Reach out", participation: "Join in" };

export const getQuests = memberQuery(async (ctx, me): Promise<QuestsAnswer> => {
  if (!(await questsApplyIn(ctx, me.workspace))) return { kind: "not-found" };
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
    waiting: await Promise.all((await waitingCratesOf(ctx, me.member, at)).map((crate) => waitingCrateOf(me, crate))),
    chatUrl: workspaceLink(me.workspace),
  };
});

export async function journeyStepsOf(ctx: QueryCtx, me: VerifiedMember): Promise<JourneyStep[] | null> {
  if (!(await questsApplyIn(ctx, me.workspace))) return null;
  return Promise.all((await projectedJourneyOf(ctx, me.member)).map((step) => journeyStepOf(me, step)));
}

async function questSlotOf(me: VerifiedMember, { swap }: DrawnWeek, facts: DrawnWeek["slots"][number]): Promise<QuestSlot> {
  const { slot, quest, goal, progress, target, reward, crate } = facts;
  const state = crateStateOf(facts, "in-progress");
  return {
    slot,
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

async function waitingCrateOf(me: VerifiedMember, { crate, goal, reward }: UnopenedCrate): Promise<WaitingCrate> {
  return { goal, reward: { xp: reward.xp }, crate, seen: await seenKeyOfCrate(me, crate) };
}

async function journeyStepOf(me: VerifiedMember, facts: ProjectedJourneyStep): Promise<JourneyStep> {
  const { step, reward, crate } = facts;
  const state = crateStateOf(facts, "active");
  return {
    step,
    ...journeyCopyOf(step),
    reward: { xp: reward.xp },
    state,
    crate: state === "finished" ? crate : null,
    seen: state === "active" ? null : await seenKeyOfCrate(me, crate),
  };
}

function crateStateOf<Unfinished extends string>({ finishedAt, openedAt }: CrateFacts, unfinished: Unfinished): Unfinished | "finished" | "opened" {
  if (finishedAt === null) return unfinished;
  return openedAt === null ? "finished" : "opened";
}

function seenKeyOfCrate(me: VerifiedMember, crate: Quest) {
  return seenKeyOf(me.member, `quest:${rewardKeyOf(crate)}`);
}
