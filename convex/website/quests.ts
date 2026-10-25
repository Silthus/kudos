import type { QueryCtx } from "../_generated/server";
import { reportQuestsViewed } from "../analytics/isolatedUsage";
import { questsSurfaceValidator } from "../analytics/projections";
import { rewardOf } from "../progression/rewards";
import { rewardKeyOf } from "../quests/crates";
import { onTheMondayPath, questsApplyTo, questsFor } from "../quests/flag";
import { earlierGroupCratesOf, groupQuestAppliesTo, groupQuestFor, type WaitingGroupCrate } from "../quests/groupQuest";
import { projectedJourneyOf, type ProjectedJourneyStep, type Reward } from "../quests/journey";
import { journeyCopyFor } from "../quests/journeyCopy";
import { questOf, type PoolQuest } from "../quests/pool";
import { featureOpening, type GroupQuestCrate, type JourneyQuest, type Quest, type WeeklyQuest } from "../quests/step";
import type { WeekKey } from "../quests/week";
import { drawnWeekOf, unopenedCratesOf, type DrawnWeek, type UnopenedCrate } from "../quests/weekly";
import { workspaceLink } from "../slack/workspaceLink";
import type { Feature } from "../unlocks/feature";
import { scheduled } from "../unlocks/schedule";
import { coinsVisibleTo } from "../wallet/visibility";
import { followTheClock } from "./clock";
import { memberMutation } from "./memberMutation";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { mondayQuestsOf, type MondayQuests } from "./mondayQuests";
import { seenKeyOf } from "./seen";
import { unlockPathOf } from "./unlockPath";

export type QuestKind = "Say why" | "Reach out" | "Join in";

export type QuestReward = { xp: number; coins?: number };

export type QuestSlot = {
  slot: number;
  quest: WeeklyQuest;
  kind: QuestKind;
  goal: string;
  progress: { done: number; target: number };
  reward: QuestReward;
  state: "in-progress" | "finished" | "opened";
  waiting: boolean;
  swapped: boolean;
  crate: WeeklyQuest | null;
  seen: string | null;
};

export type WaitingCrate = { goal: string; group: string | null; week: WeekKey; reward: QuestReward; crate: WeeklyQuest | GroupQuestCrate; seen: string; waiting: boolean };

export type GroupQuestCard = {
  group: string;
  goal: string;
  progress: { done: number; target: number };
  you: boolean;
  reward: QuestReward;
  state: "in-progress" | "finished" | "opened";
  waiting: boolean;
  crate: GroupQuestCrate | null;
  seen: string | null;
};

export type WeekSwap = { used: boolean; available: boolean };

export type { DrawnQuest, GettingStartedStep, MondayQuests, QuestItemState } from "./mondayQuests";

export type QuestsAnswer = MondayQuests | { kind: "not-found" } | { kind: "locked"; level: number } | { kind: "ready" } | { kind: "quests"; slots: QuestSlot[]; swap: WeekSwap; group: GroupQuestCard | null; waiting: WaitingCrate[]; bonus: JourneyStep | null; chatUrl: string };

export type JourneyStep = {
  step: JourneyQuest["step"];
  goal: string;
  hint: string | null;
  reward: QuestReward;
  state: "active" | "finished" | "opened";
  waiting: boolean;
  crate: JourneyQuest | null;
  seen: string | null;
  feature: Feature | null;
};

type CrateFacts = { finishedAt: number | null; openedAt: number | null };

type Shown = { me: VerifiedMember; coins: boolean };

const kindLabels: Record<PoolQuest["kind"], QuestKind> = { thoughtfulness: "Say why", breadth: "Reach out", participation: "Join in" };

export type QuestsViewAnswer = { kind: "viewed" } | { kind: "refused" };

export const getQuests = memberQuery(async (ctx, me): Promise<QuestsAnswer> => {
  const path = await questsFor(ctx, me.member);
  if (path === "monday") return mondayQuestsOf(ctx, me);
  if (path === null) return { kind: "not-found" };
  const quests = (await unlockPathOf(ctx, me))?.find(({ feature }) => feature === "quests");
  if (quests === undefined) return { kind: "not-found" };
  if (quests.state === "locked") return { kind: "locked", level: scheduled("quests").level };
  if (quests.state === "ready") return { kind: "ready" };
  await followTheClock(ctx);
  const at = Date.now();
  const week = await drawnWeekOf(ctx, me.member, at);
  const shown = await shownTo(ctx, me);
  return {
    kind: "quests",
    slots: week === null ? [] : await Promise.all(week.slots.map((slot) => questSlotOf(shown, week, slot))),
    swap: { used: week?.swap != null, available: week?.swapAvailable ?? false },
    group: await groupQuestCardOf(ctx, shown, at),
    waiting: [...(await Promise.all((await unopenedCratesOf(ctx, me.member, at)).map((crate) => waitingCrateOf(shown, crate)))), ...(await waitingGroupCratesOf(ctx, shown, at))].sort((one, other) => one.week.localeCompare(other.week)),
    bonus: await bonusStepOf(ctx, shown),
    chatUrl: workspaceLink(me.workspace),
  };
});

export const viewQuests = memberMutation({
  args: { surface: questsSurfaceValidator },
  handler: async (ctx, me, _person, { surface }): Promise<QuestsViewAnswer> => {
    if (!(await onTheMondayPath(ctx, me.member))) return { kind: "refused" };
    await reportQuestsViewed(ctx, { workspace: me.workspace, member: me.member, surface, at: Date.now() });
    return { kind: "viewed" };
  },
});

export async function journeyStepsOf(ctx: QueryCtx, me: VerifiedMember): Promise<JourneyStep[] | null> {
  if (!(await questsApplyTo(ctx, me.member))) return null;
  const shown = await shownTo(ctx, me);
  return Promise.all((await projectedJourneyOf(ctx, me.member)).map((step) => journeyStepOf(ctx, shown, step)));
}

async function shownTo(ctx: QueryCtx, me: VerifiedMember): Promise<Shown> {
  return { me, coins: await coinsVisibleTo(ctx, me.member) };
}

function rewardShown({ xp, coins }: Reward, shown: Shown): QuestReward {
  return { xp, ...(shown.coins && coins > 0 && { coins }) };
}

async function bonusStepOf(ctx: QueryCtx, shown: Shown): Promise<JourneyStep | null> {
  const steps = await projectedJourneyOf(ctx, shown.me.member);
  if (!steps.some(hasJoined)) return null;
  const next = steps.find(({ openedAt }) => openedAt === null);
  return next === undefined ? null : journeyStepOf(ctx, shown, next);
}

function hasJoined({ step, activatedAt }: ProjectedJourneyStep) {
  return step === "first-thanks" && activatedAt !== null;
}

async function questSlotOf(shown: Shown, { swap }: DrawnWeek, facts: DrawnWeek["slots"][number]): Promise<QuestSlot> {
  const { slot, quest, goal, progress, target, reward, crate, waiting } = facts;
  const state = crateStateOf(facts, "in-progress");
  return {
    slot,
    quest: crate,
    kind: kindLabels[questOf(quest).kind],
    goal,
    progress: { done: progress, target },
    reward: rewardShown(reward, shown),
    state,
    waiting,
    swapped: swap?.slot === slot,
    crate: state === "finished" ? crate : null,
    seen: state === "in-progress" ? null : await seenKeyOfCrate(shown.me, crate),
  };
}

async function waitingCrateOf(shown: Shown, { crate, week, goal, reward, waiting }: UnopenedCrate): Promise<WaitingCrate> {
  return { goal, group: null, week, reward: rewardShown(reward, shown), crate, seen: await seenKeyOfCrate(shown.me, crate), waiting };
}

async function groupQuestCardOf(ctx: QueryCtx, shown: Shown, at: number): Promise<GroupQuestCard | null> {
  if (!(await groupQuestAppliesTo(ctx, shown.me.member))) return null;
  const facts = await groupQuestFor(ctx, shown.me.member, at);
  if (facts === null) return null;
  const { group, goal, week, tookPart, target, you, done, reward, crate } = facts;
  const quest: GroupQuestCrate = { kind: "group", group: group.group, week };
  const state = crate?.opened ? "opened" : done ? "finished" : "in-progress";
  const claimable = state === "finished" && crate !== null;
  return {
    group: group.name,
    goal,
    progress: { done: tookPart, target },
    you,
    reward: rewardShown(reward, shown),
    state,
    waiting: claimable && (await isHeld(ctx, shown, quest)),
    crate: claimable ? quest : null,
    seen: crate === null ? null : await seenKeyOfCrate(shown.me, quest),
  };
}

async function waitingGroupCratesOf(ctx: QueryCtx, shown: Shown, at: number): Promise<WaitingCrate[]> {
  if (!(await groupQuestAppliesTo(ctx, shown.me.member))) return [];
  return Promise.all((await earlierGroupCratesOf(ctx, shown.me.member, at)).map((crate) => waitingGroupCrateOf(ctx, shown, crate)));
}

async function waitingGroupCrateOf(ctx: QueryCtx, shown: Shown, { crate, group, goal }: WaitingGroupCrate): Promise<WaitingCrate> {
  const { xp, coins, held } = (await rewardOf(ctx, shown.me.member, rewardKeyOf(crate)))!;
  return { goal, group, week: crate.week, reward: rewardShown({ xp, coins, item: null }, shown), crate, seen: await seenKeyOfCrate(shown.me, crate), waiting: held === true };
}

async function isHeld(ctx: QueryCtx, shown: Shown, crate: GroupQuestCrate) {
  return (await rewardOf(ctx, shown.me.member, rewardKeyOf(crate)))?.held === true;
}

async function journeyStepOf(ctx: QueryCtx, shown: Shown, facts: ProjectedJourneyStep): Promise<JourneyStep> {
  const { step, reward, crate, waiting } = facts;
  const state = crateStateOf(facts, "active");
  return {
    step,
    ...(await journeyCopyFor(ctx, shown.me.member, step)),
    reward: rewardShown(reward, shown),
    state,
    waiting,
    crate: state === "finished" ? crate : null,
    seen: state === "active" ? null : await seenKeyOfCrate(shown.me, crate),
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
