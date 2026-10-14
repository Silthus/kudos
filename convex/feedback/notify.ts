import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { achievementsApplyIn } from "../achievements/flag";
import { tierRefValidator } from "../achievements/ladders";
import type { LevelReachedEvent } from "../bus/events";
import { skillTreeLevel } from "../progression/levels";
import { memberPerksOf, type MemberPerks } from "../progression/perks";
import { skillTreeAppliesIn } from "../progression/skillTree";
import { purchaseOutcomeValidator } from "../progression/purchases";
import { progressSettingsOf } from "../progression/settings";
import { xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
import { journeyStepAppliesIn, questsApplyIn } from "../quests/flag";
import { journeyQuestValidator, weeklyQuestValidator, type JourneyQuest, type WeeklyQuest } from "../quests/step";
import { featureValidator, type Feature } from "../unlocks/feature";
import { unlocksAppliedIn, unlocksShownTo } from "../unlocks/launch";
import { scheduled, type ScheduledFeature } from "../unlocks/schedule";
import { stateOf } from "../unlocks/unlocks";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { finishedQuestCrateOf, finishedWeeklyQuestCrateOf, perkOfferOf, purchaseReplyOf, readyCrateOf, tiersEarnedLines, type HomeAction } from "./home";
import { skillPointsOf } from "./naming";
import { isOpened, whenOpened } from "./unlockFilter";

export const notificationValidator = v.union(
  v.object({
    kind: v.literal("level-reached"),
    level: v.number(),
    skillPoints: v.union(v.number(), v.null()),
    xpToNextLevel: v.number(),
    ready: v.array(featureValidator),
  }),
  v.object({ kind: v.literal("features-shipped"), ready: v.array(featureValidator) }),
  v.object({ kind: v.literal("quest-finished"), quest: journeyQuestValidator, xp: v.number() }),
  v.object({ kind: v.literal("journey-joined"), finished: v.array(v.object({ quest: journeyQuestValidator, xp: v.number() })) }),
  v.object({ kind: v.literal("weekly-quest-finished"), quest: weeklyQuestValidator, goal: v.string(), xp: v.number() }),
  v.object({ kind: v.literal("tiers-earned"), tiers: v.array(tierRefValidator) }),
);

export type Notification = Infer<typeof notificationValidator>;

export type NotificationLine = string | { text: string; action: HomeAction };

export async function notifyLevelReached(ctx: MutationCtx, { member, level, skillPoints, xpToNextLevel }: LevelReachedEvent, ready: ScheduledFeature[]) {
  if (!(await xpLevelsShownTo(ctx, member))) return;
  const unlocksShown = await unlocksShownTo(ctx, member);
  await notify(ctx, member, { kind: "level-reached", level, skillPoints, xpToNextLevel, ready: unlocksShown ? featuresOf(ready) : [] });
}

export async function notifyFeaturesShipped(ctx: MutationCtx, member: MemberId, ready: ScheduledFeature[]) {
  if (!(await unlocksShownTo(ctx, member))) return;
  await notify(ctx, member, { kind: "features-shipped", ready: featuresOf(ready) });
}

export async function notifyQuestFinished(ctx: MutationCtx, member: MemberId, quest: JourneyQuest, xp: number) {
  await notify(ctx, member, { kind: "quest-finished", quest, xp });
}

export async function notifyJourneyJoined(ctx: MutationCtx, member: MemberId, finished: Array<{ quest: JourneyQuest; xp: number }>) {
  await notify(ctx, member, { kind: "journey-joined", finished });
}

export async function notifyWeeklyQuestFinished(ctx: MutationCtx, member: MemberId, quest: WeeklyQuest, goal: string, xp: number) {
  await notify(ctx, member, { kind: "weekly-quest-finished", quest, goal, xp });
}

export async function notify(ctx: MutationCtx, member: MemberId, notification: Notification) {
  if (!(await wantsDms(ctx, member))) return;
  const { workspace, user } = await chatUserOf(ctx, member);
  await ctx.scheduler.runAfter(0, internal.slack.directMessages.deliverDirectMessage, { member, workspace, user, notification });
}

export const linesStillWanted = internalQuery({
  args: { member: v.id("members"), notification: notificationValidator },
  handler: async (ctx, { member, notification }): Promise<NotificationLine[] | null> => {
    const { workspace } = await chatUserOf(ctx, member);
    if (!(await xpLevelsShownIn(ctx, workspace)) || !(await wantsDms(ctx, member))) return null;
    const told = await stillToldOf(ctx, workspace, member, notification);
    const lines = told === null ? [] : renderNotification(told, await openTreeOf(ctx, workspace, member, told));
    return lines.length === 0 ? null : lines;
  },
});

export const purchaseReplyStillWanted = internalQuery({
  args: { member: v.id("members"), outcome: purchaseOutcomeValidator },
  handler: async (ctx, { member, outcome }): Promise<string | null> => {
    const { workspace } = await chatUserOf(ctx, member);
    return (await skillTreeAppliesIn(ctx, workspace)) ? purchaseReplyOf(outcome) : null;
  },
});

export function renderNotification(notification: Notification, openTree: MemberPerks | null = null): NotificationLine[] {
  if (notification.kind === "quest-finished") return [finishedQuestCrateOf(notification.quest, notification.xp)];
  if (notification.kind === "journey-joined") return notification.finished.map(({ quest, xp }) => finishedQuestCrateOf(quest, xp));
  if (notification.kind === "weekly-quest-finished") return [finishedWeeklyQuestCrateOf(notification.quest, notification.goal, notification.xp)];
  if (notification.kind === "tiers-earned") return tiersEarnedLines(notification.tiers);
  const crates = notification.ready.map((feature) => readyCrateOf(scheduled(feature)));
  if (notification.kind !== "level-reached") return crates;
  return [...levelReachedLines(notification, openTree), ...crates, ...perkOffersOf(openTree)];
}

function levelReachedLines({ level, skillPoints, xpToNextLevel }: Extract<Notification, { kind: "level-reached" }>, openTree: MemberPerks | null) {
  return [`🎉 You reached level ${level}!${skillPointsTold(level, skillPoints, openTree)}`, `Level ${level + 1} is ${xpToNextLevel} XP away.`];
}

function skillPointsTold(level: number, skillPoints: number | null, openTree: MemberPerks | null) {
  if (openTree !== null) return ` You have ${skillPointsOf(openTree.skillPoints)} to spend.`;
  return skillPoints !== null && level >= skillTreeLevel ? ` You have ${skillPointsOf(skillPoints)} saved for the skill tree.` : "";
}

function perkOffersOf(openTree: MemberPerks | null): NotificationLine[] {
  return (openTree?.perks ?? []).filter(({ state }) => state === "buyable").map(perkOfferOf);
}

async function stillToldOf(ctx: QueryCtx, workspace: string, member: MemberId, notification: Notification): Promise<Notification | null> {
  if (isAboutQuests(notification)) return questsStillToldOf(ctx, workspace, notification);
  if (notification.kind === "tiers-earned") return (await isBookOpenIn(ctx, workspace, member)) ? notification : null;
  if (!(await unlocksAppliedIn(ctx, workspace))) return { ...notification, ready: [] };
  const ready = await stillReady(ctx, member, notification.ready);
  if (notification.kind !== "level-reached" || notification.skillPoints === null) return { ...notification, ready };
  return { ...notification, ready, skillPoints: await whenOpened(ctx, member, "skillTree", notification.skillPoints) };
}

async function questsStillToldOf(ctx: QueryCtx, workspace: string, notification: QuestNotification): Promise<QuestNotification | null> {
  if (!(await questsApplyIn(ctx, workspace))) return null;
  if (notification.kind === "quest-finished") return (await journeyStepAppliesIn(ctx, workspace, notification.quest.step)) ? notification : null;
  if (notification.kind === "weekly-quest-finished") return notification;
  const finished: typeof notification.finished = [];
  for (const entry of notification.finished) if (await journeyStepAppliesIn(ctx, workspace, entry.quest.step)) finished.push(entry);
  return { ...notification, finished };
}

type QuestNotification = Extract<Notification, { kind: "quest-finished" | "journey-joined" | "weekly-quest-finished" }>;

async function openTreeOf(ctx: QueryCtx, workspace: string, member: MemberId, told: Notification): Promise<MemberPerks | null> {
  if (told.kind !== "level-reached" || !(await skillTreeAppliesIn(ctx, workspace)) || !(await isOpened(ctx, member, "skillTree"))) return null;
  return memberPerksOf(ctx, member);
}

function isAboutQuests(notification: Notification): notification is QuestNotification {
  return notification.kind === "quest-finished" || notification.kind === "journey-joined" || notification.kind === "weekly-quest-finished";
}

async function isBookOpenIn(ctx: QueryCtx, workspace: string, member: MemberId) {
  return (await achievementsApplyIn(ctx, workspace)) && (await isOpened(ctx, member, "book"));
}

async function stillReady(ctx: QueryCtx, member: MemberId, features: Feature[]) {
  const ready: Feature[] = [];
  for (const feature of features) if ((await stateOf(ctx, member, feature)) === "ready") ready.push(feature);
  return ready;
}

function featuresOf(ready: ScheduledFeature[]) {
  return ready.map(({ feature }) => feature);
}

async function wantsDms(ctx: QueryCtx, member: MemberId) {
  return (await progressSettingsOf(ctx, member)).dms;
}
