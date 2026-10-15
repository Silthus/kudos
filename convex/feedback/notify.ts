import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { achievementsApplyIn } from "../achievements/flag";
import { tierRefValidator, type TierRef } from "../achievements/ladders";
import { recordedRewardsOf, tierRewardsRecordedFor, type TierRewardsRecorded } from "../achievements/tierRewards";
import { everyTierEarnedBy } from "../achievements/tiers";
import type { LevelReachedEvent } from "../bus/events";
import { skillTreeLevel } from "../progression/levels";
import { memberPerksOf, ownsEveryPerk, type MemberPerks } from "../progression/perks";
import { skillTreeAppliesIn } from "../progression/skillTree";
import { purchaseOutcomeValidator } from "../progression/purchases";
import { progressSettingsOf } from "../progression/settings";
import { xpLevelsOnFor, xpLevelsShownTo } from "../progression/xpLevels";
import { journeyStepAppliesIn, questsApplyTo } from "../quests/flag";
import { journeyQuestValidator, weeklyQuestValidator, type JourneyQuest, type WeeklyQuest } from "../quests/step";
import { featureValidator, type Feature } from "../unlocks/feature";
import { unlocksAppliedTo, unlocksShownTo } from "../unlocks/launch";
import { storeShownTo, storeVisibleTo } from "../store/visibility";
import { namedFor, scheduled, type ScheduledFeature } from "../unlocks/schedule";
import { stateOf } from "../unlocks/unlocks";
import { websiteOriginFor } from "../website/link";
import { coinsApplyTo, coinsVisibleTo } from "../wallet/visibility";
import { isCoinPerk, perkOf, type PerkId } from "../progression/tree";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { coinsOpenedLineOf, inventoryOpenedLineOf } from "./coins";
import { deepLinkFrom, deepLinks, type DeepLink } from "./deepLinks";
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
  v.object({ kind: v.literal("coins-opened"), balance: v.number() }),
);

export type Notification = Infer<typeof notificationValidator>;

export type NotificationLine = string | { text: string; action: HomeAction } | { link: DeepLink };

const linkedPages = {
  "level-reached": deepLinks.levelReached,
  "features-shipped": deepLinks.featuresShipped,
  "quest-finished": deepLinks.journey,
  "journey-joined": deepLinks.journey,
  "weekly-quest-finished": deepLinks.weeklyQuest,
  "tiers-earned": deepLinks.successReply,
  "coins-opened": deepLinks.successReply,
} satisfies Record<Notification["kind"], unknown>;

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
    if (!(await xpLevelsOnFor(ctx, member)) || !(await wantsDms(ctx, member))) return null;
    const told = await stillToldOf(ctx, workspace, member, notification);
    const website = await websiteOriginFor(ctx, workspace, member);
    const lines = told === null ? [] : renderNotification(told, await deliveryFactsOf(ctx, workspace, member, told, website));
    if (lines.length === 0) return null;
    const link = deepLinkFrom(website, linkedPages[notification.kind]);
    return link === null ? lines : [...lines, { link }];
  },
});

export const purchaseReplyStillWanted = internalQuery({
  args: { member: v.id("members"), outcome: purchaseOutcomeValidator },
  handler: async (ctx, { member, outcome }): Promise<string | null> => {
    const { workspace } = await chatUserOf(ctx, member);
    if (!(await skillTreeAppliesIn(ctx, workspace))) return null;
    if (isCoinPerk(perkOf(outcome.perk)) && !(await coinsApplyTo(ctx, member))) return null;
    return purchaseReplyOf(outcome, namedFor(scheduled("coins"), await storeShownTo(ctx, member)).name);
  },
});

type DeliveryFacts = { website: string | null; openTree: MemberPerks | null; everyTierEarned: TierRef[]; tierRewardsShown: TierRewardsRecorded; inventoryWith: string | null };

function renderNotification(notification: Notification, { website, openTree, everyTierEarned, tierRewardsShown, inventoryWith }: DeliveryFacts): NotificationLine[] {
  if (notification.kind === "quest-finished") return [finishedQuestCrateOf(notification.quest, notification.xp, website)];
  if (notification.kind === "journey-joined") return notification.finished.map(({ quest, xp }) => finishedQuestCrateOf(quest, xp, website));
  if (notification.kind === "weekly-quest-finished") return [finishedWeeklyQuestCrateOf(notification.quest, notification.goal, notification.xp, website)];
  if (notification.kind === "tiers-earned") return tiersEarnedLines(notification.tiers, everyTierEarned, (ref) => recordedRewardsOf(ref, tierRewardsShown));
  if (notification.kind === "coins-opened") return [inventoryWith === null ? coinsOpenedLineOf(notification.balance) : inventoryOpenedLineOf(notification.balance, inventoryWith)];
  const crates = notification.ready.map((feature) => readyCrateOf(namedFor(scheduled(feature), inventoryWith !== null), website));
  if (notification.kind !== "level-reached") return crates;
  return [...levelReachedLines(notification, openTree), ...crates, ...perkOffersOf(openTree, website)];
}

function levelReachedLines({ level, skillPoints, xpToNextLevel }: Extract<Notification, { kind: "level-reached" }>, openTree: MemberPerks | null) {
  return [`🎉 You reached level ${level}!${skillPointsTold(level, skillPoints, openTree)}`, `Level ${level + 1} is ${xpToNextLevel} XP away.`];
}

function skillPointsTold(level: number, skillPoints: number | null, openTree: MemberPerks | null) {
  if (openTree !== null) return ownsEveryPerk(openTree) ? "" : ` You have ${skillPointsOf(openTree.skillPoints)} to spend.`;
  return skillPoints !== null && level >= skillTreeLevel ? ` You have ${skillPointsOf(skillPoints)} saved for the skill tree.` : "";
}

function perkOffersOf(openTree: MemberPerks | null, website: string | null): NotificationLine[] {
  return (openTree?.perks ?? []).filter(({ state }) => state === "buyable").map((perk) => perkOfferOf(perk, websiteDrawing(perk, website)));
}

function websiteDrawing({ perk }: { perk: PerkId }, website: string | null) {
  return isCoinPerk(perkOf(perk)) ? null : website;
}

async function stillToldOf(ctx: QueryCtx, workspace: string, member: MemberId, notification: Notification): Promise<Notification | null> {
  if (isAboutQuests(notification)) return questsStillToldOf(ctx, workspace, member, notification);
  if (notification.kind === "tiers-earned") return (await isBookOpenIn(ctx, workspace, member)) ? notification : null;
  if (notification.kind === "coins-opened") return (await coinsVisibleTo(ctx, member)) ? notification : null;
  if (!(await unlocksAppliedTo(ctx, member))) return { ...notification, ready: [] };
  const ready = await stillReady(ctx, member, notification.ready);
  if (notification.kind !== "level-reached" || notification.skillPoints === null) return { ...notification, ready };
  return { ...notification, ready, skillPoints: await whenOpened(ctx, member, "skillTree", notification.skillPoints) };
}

async function questsStillToldOf(ctx: QueryCtx, workspace: string, member: MemberId, notification: QuestNotification): Promise<QuestNotification | null> {
  if (!(await questsApplyTo(ctx, member))) return null;
  if (notification.kind === "quest-finished") return (await journeyStepAppliesIn(ctx, workspace, notification.quest.step)) ? notification : null;
  if (notification.kind === "weekly-quest-finished") return notification;
  const finished: typeof notification.finished = [];
  for (const entry of notification.finished) if (await journeyStepAppliesIn(ctx, workspace, entry.quest.step)) finished.push(entry);
  return { ...notification, finished };
}

type QuestNotification = Extract<Notification, { kind: "quest-finished" | "journey-joined" | "weekly-quest-finished" }>;

async function deliveryFactsOf(ctx: QueryCtx, workspace: string, member: MemberId, told: Notification, website: string | null): Promise<DeliveryFacts> {
  return {
    website,
    openTree: await openTreeOf(ctx, workspace, member, told),
    everyTierEarned: told.kind === "tiers-earned" ? await everyTierEarnedBy(ctx, member) : [],
    tierRewardsShown: told.kind === "tiers-earned" ? await tierRewardsShownTo(ctx, member) : new Map(),
    inventoryWith: namesCoins(told) && (await storeShownTo(ctx, member)) ? (await settingsOf(ctx, workspace)).kudosEmoji : null,
  };
}

async function tierRewardsShownTo(ctx: QueryCtx, member: MemberId): Promise<TierRewardsRecorded> {
  if (!(await coinsVisibleTo(ctx, member))) return new Map();
  const itemsShown = await storeVisibleTo(ctx, member);
  const recorded = await tierRewardsRecordedFor(ctx, member);
  return new Map([...recorded].map(([reward, record]) => [reward, { ...record, item: itemsShown ? record.item : null }]));
}

function namesCoins(told: Notification) {
  return told.kind === "coins-opened" || ("ready" in told && told.ready.includes("coins"));
}

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
