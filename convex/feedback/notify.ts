import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { achievementsApplyIn } from "../achievements/flag";
import { levelUpFollowerAwaitedUntil, levelUpRevealedTo } from "../album/levelUp";
import { tierRefValidator, type TierRef } from "../achievements/ladders";
import { recordedRewardsOf, tierRewardsRecordedFor, type TierRewardsRecorded } from "../achievements/tierRewards";
import { laddersShownTo } from "../achievements/shown";
import { everyTierEarnedBy } from "../achievements/tiers";
import type { LevelReachedEvent } from "../bus/events";
import type { MessageRef } from "../engine/messageEvent";
import { skillTreeLevel } from "../progression/levels";
import { memberPerksOf, ownsEveryPerk, type MemberPerks } from "../progression/perks";
import { skillTreeAppliesIn } from "../progression/skillTree";
import { purchaseOutcomeValidator } from "../progression/purchases";
import { xpLevelsOnFor, xpLevelsShownTo } from "../progression/xpLevels";
import type { MessageKind } from "../messageSettings/kinds";
import { placeOf, wantsMessage } from "../messageSettings/messageSettings";
import { messageSettingsOnFor } from "../messageSettings/flag";
import { featureValidator, type Feature } from "../unlocks/feature";
import { unlocksAppliedTo, unlocksShownTo } from "../unlocks/launch";
import { teamSpiritShownTo } from "../stickers/flag";
import { storeShownTo, storeVisibleTo } from "../store/visibility";
import { namedFor, readyFromTheStart, scheduled, type ScheduledFeature } from "../unlocks/schedule";
import { stateOf } from "../unlocks/unlocks";
import { websiteOriginFor } from "../website/link";
import { websiteAt, type Website } from "../website/visitSource";
import { coinsApplyTo, coinsVisibleTo } from "../wallet/visibility";
import { isCoinPerk, perkOf } from "../progression/tree";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { coinsOpenedLineOf, inventoryOpenedLineOf } from "./coins";
import { deepLinkFrom, deepLinks, levelUpRevealOf, type DeepLink } from "./deepLinks";
import { perkOfferOf, purchaseReplyOf, readyCrateOf, tiersEarnedLines, type HomeAction } from "./home";
import { skillPointsOf } from "./naming";
import { settingsFooterFor, type SettingsFooter } from "./settingsFooter";
import { isOpened, whenOpened, whenShipped } from "./unlockFilter";

export const completedTeamValidator = v.object({ team: v.string(), name: v.string(), crestEarned: v.boolean() });

export type CompletedTeam = Infer<typeof completedTeamValidator>;

export const notificationValidator = v.union(
  v.object({
    kind: v.literal("level-reached"),
    level: v.number(),
    skillPoints: v.union(v.number(), v.null()),
    xpToNextLevel: v.number(),
    ready: v.array(featureValidator),
  }),
  v.object({ kind: v.literal("features-shipped"), ready: v.array(featureValidator) }),
  v.object({ kind: v.literal("tiers-earned"), tiers: v.array(tierRefValidator), teams: v.optional(v.array(completedTeamValidator)) }),
  v.object({ kind: v.literal("coins-opened"), balance: v.number() }),
);

export type Notification = Infer<typeof notificationValidator>;

export type NotificationLine = string | { text: string; action: HomeAction } | { link: DeepLink } | { footer: SettingsFooter };

const linkedPages = {
  "level-reached": deepLinks.levelReached,
  "features-shipped": deepLinks.featuresShipped,
  "tiers-earned": deepLinks.tiersEarned,
  "coins-opened": deepLinks.successReply,
} satisfies Record<Notification["kind"], unknown>;

const messageKindOf: Record<Notification["kind"], MessageKind> = {
  "level-reached": "level-ups",
  "features-shipped": "new-features",
  "tiers-earned": "achievements",
  "coins-opened": "new-features",
};

export async function notifyLevelReached(ctx: MutationCtx, { member, level, skillPoints, xpToNextLevel, message }: LevelReachedEvent, ready: ScheduledFeature[]) {
  if (!(await xpLevelsShownTo(ctx, member))) return;
  const unlocksShown = await unlocksShownTo(ctx, member);
  await notify(ctx, member, { kind: "level-reached", level, skillPoints, xpToNextLevel, ready: unlocksShown ? featuresOf(ready) : [] }, message);
}

export async function notifyFeaturesShipped(ctx: MutationCtx, member: MemberId, ready: ScheduledFeature[]) {
  if (!(await unlocksShownTo(ctx, member))) return;
  await notify(ctx, member, { kind: "features-shipped", ready: featuresOf(ready) });
}

export async function notify(ctx: MutationCtx, member: MemberId, notification: Notification, kudos?: MessageRef) {
  const place = await placeOf(ctx, member, messageKindOfNotification(notification));
  if (place === "none") return;
  const { workspace, user } = await chatUserOf(ctx, member);
  const placedAtDelivery = kudos !== undefined && (place === "channel" || (await messageSettingsOnFor(ctx, member)));
  await ctx.scheduler.runAfter(0, internal.slack.directMessages.deliverDirectMessage, { member, workspace, user, notification, ...(placedAtDelivery && { kudos }) });
}

export function messageKindOfNotification(notification: Notification): MessageKind {
  return messageKindOf[notification.kind];
}

export const linesStillWanted = internalQuery({
  args: { member: v.id("members"), notification: notificationValidator },
  handler: async (ctx, { member, notification }): Promise<NotificationLine[] | null> => {
    const { workspace } = await chatUserOf(ctx, member);
    if (!(await xpLevelsOnFor(ctx, member)) || !(await wantsNotification(ctx, member, notification))) return null;
    const told = await stillToldOf(ctx, workspace, member, notification);
    const website = websiteAt(await websiteOriginFor(ctx, workspace, member), "reply");
    const lines = told === null ? [] : renderNotification(told, await deliveryFactsOf(ctx, workspace, member, told, website));
    if (lines.length === 0) return null;
    const link = deepLinkFrom(website, await linkedPageOf(ctx, member, notification));
    const footer = await settingsFooterFor(ctx, member);
    return [...lines, ...(link === null ? [] : [{ link }]), ...(footer === null ? [] : [{ footer }])];
  },
});

export const followersAwaitedUntil = internalQuery({
  args: { member: v.id("members"), notification: notificationValidator },
  handler: async (ctx, { member, notification }): Promise<number | null> => (notification.kind === "level-reached" ? await levelUpFollowerAwaitedUntil(ctx, member, notification.level) : null),
});

export const purchaseReplyStillWanted = internalQuery({
  args: { member: v.id("members"), outcome: purchaseOutcomeValidator },
  handler: async (ctx, { member, outcome }): Promise<string | null> => {
    const { workspace } = await chatUserOf(ctx, member);
    if (!(await skillTreeAppliesIn(ctx, workspace))) return null;
    if (isCoinPerk(perkOf(outcome.perk)) && !(await coinsApplyTo(ctx, member))) return null;
    return purchaseReplyOf(outcome, namedFor(scheduled("coins"), { storeShown: await storeShownTo(ctx, member) }).name);
  },
});

async function linkedPageOf(ctx: QueryCtx, member: MemberId, notification: Notification) {
  if (notification.kind === "level-reached" && (await levelUpRevealedTo(ctx, member, notification.level))) return levelUpRevealOf(notification.level);
  return linkedPages[notification.kind];
}

type DeliveryFacts = { website: Website | null; openTree: MemberPerks | null; everyTierEarned: TierRef[]; tierRewardsShown: TierRewardsRecorded; inventoryWith: string | null };

function renderNotification(notification: Notification, { website, openTree, everyTierEarned, tierRewardsShown, inventoryWith }: DeliveryFacts): NotificationLine[] {
  if (notification.kind === "tiers-earned") return [...(notification.teams ?? []).map(completionLineOf), ...tiersEarnedLines(notification.tiers, everyTierEarned, (ref) => recordedRewardsOf(ref, tierRewardsShown))];
  if (notification.kind === "coins-opened") return [inventoryWith === null ? coinsOpenedLineOf(notification.balance) : inventoryOpenedLineOf(notification.balance, inventoryWith)];
  const crates = notification.ready.map((feature) => readyCrateOf(namedFor(scheduled(feature), { storeShown: inventoryWith !== null }), website));
  if (notification.kind !== "level-reached") return crates;
  return [...levelReachedLines(notification, openTree), ...crates, ...perkOffersOf(openTree, website)];
}

function completionLineOf({ name, crestEarned }: CompletedTeam) {
  return crestEarned ? `Team complete · ${name} crest earned` : `Team complete · ${name}`;
}

function levelReachedLines({ level, skillPoints, xpToNextLevel }: Extract<Notification, { kind: "level-reached" }>, openTree: MemberPerks | null) {
  return [`🎉 You reached level ${level}!${skillPointsTold(level, skillPoints, openTree)}`, `Level ${level + 1} is ${xpToNextLevel} XP away.`];
}

function skillPointsTold(level: number, skillPoints: number | null, openTree: MemberPerks | null) {
  if (openTree !== null) return ownsEveryPerk(openTree) ? "" : ` You have ${skillPointsOf(openTree.skillPoints)} to spend.`;
  return skillPoints !== null && level >= skillTreeLevel ? ` You have ${skillPointsOf(skillPoints)} saved for the skill tree.` : "";
}

function perkOffersOf(openTree: MemberPerks | null, website: Website | null): NotificationLine[] {
  return (openTree?.perks ?? []).filter(({ state }) => state === "buyable").map((perk) => perkOfferOf(perk, website));
}

async function stillToldOf(ctx: QueryCtx, workspace: string, member: MemberId, notification: Notification): Promise<Notification | null> {
  if (notification.kind === "tiers-earned") return tiersAndTeamsStillToldOf(ctx, workspace, member, notification);
  if (notification.kind === "coins-opened") return (await coinsVisibleTo(ctx, member)) ? notification : null;
  const unlocksApply = await unlocksAppliedTo(ctx, member);
  const ready = unlocksApply ? await stillReady(ctx, member, notification.ready) : [];
  if (notification.kind !== "level-reached" || notification.skillPoints === null) return { ...notification, ready };
  const skillPointsTold = unlocksApply ? whenOpened : whenShipped;
  return { ...notification, ready, skillPoints: await skillPointsTold(ctx, member, "skillTree", notification.skillPoints) };
}

type TiersEarnedNotification = Extract<Notification, { kind: "tiers-earned" }>;

async function tiersAndTeamsStillToldOf(ctx: QueryCtx, workspace: string, member: MemberId, notification: TiersEarnedNotification): Promise<TiersEarnedNotification | null> {
  const tiers = (await isBookOpenIn(ctx, workspace, member)) ? await tiersStillShownTo(ctx, member, notification) : null;
  if (notification.teams === undefined) return tiers;
  const teams = (await teamSpiritShownTo(ctx, member)) ? notification.teams : [];
  if (tiers === null && teams.length === 0) return null;
  return { kind: "tiers-earned", tiers: tiers?.tiers ?? [], teams };
}

async function tiersStillShownTo(ctx: QueryCtx, member: MemberId, notification: TiersEarnedNotification): Promise<TiersEarnedNotification | null> {
  const shown = await laddersShownTo(ctx, member);
  const tiers = notification.tiers.filter(({ ladder }) => shown.includes(ladder));
  return tiers.length === 0 ? null : { ...notification, tiers };
}

async function deliveryFactsOf(ctx: QueryCtx, workspace: string, member: MemberId, told: Notification, website: Website | null): Promise<DeliveryFacts> {
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

async function isBookOpenIn(ctx: QueryCtx, workspace: string, member: MemberId) {
  return (await achievementsApplyIn(ctx, workspace)) && (await isOpened(ctx, member, "book"));
}

async function stillReady(ctx: QueryCtx, member: MemberId, features: Feature[]) {
  const ready: Feature[] = [];
  for (const feature of features) if (!readyFromTheStart(scheduled(feature)) && (await stateOf(ctx, member, feature)) === "ready") ready.push(feature);
  return ready;
}

function featuresOf(ready: ScheduledFeature[]) {
  return ready.map(({ feature }) => feature);
}

function wantsNotification(ctx: QueryCtx, member: MemberId, notification: Notification) {
  return wantsMessage(ctx, member, messageKindOfNotification(notification));
}
