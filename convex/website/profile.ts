import type { QueryCtx } from "../_generated/server";
import { homeFacts } from "../engine/home";
import { avatarShownOn, type Avatar } from "../hoggies/avatar";
import { groupsShownTo } from "../groups/groups";
import { xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import { xpLevelsOnFor } from "../progression/xpLevels";
import { workspaceLink } from "../slack/workspaceLink";
import { visibleWalletOf } from "../wallet/wallet";
import { bookSpreadShownTo } from "./bookSpread";
import { followTheClock } from "./clock";
import { faceOf, type Face } from "./faces";
import { inventoryShownTo, type MemberInventory } from "./inventory";
import { memberQuery, type Denial, type VerifiedMember } from "./memberQuery";
import { journeyStepsOf, type JourneyStep } from "./quests";
import { settingsShownTo } from "./settings";
import { skillPointsOf } from "./skillTree";
import { featureCardsOf, leaderboardStateOf, unlockPathOf, type FeatureCard, type FeaturePage } from "./unlockPath";

export type { Face } from "./faces";
export type { Avatar } from "../hoggies/avatar";
export type { FeatureCard, FeaturePage, PageWaits } from "./unlockPath";
export type { JourneyStep } from "./quests";
export type { InventoryItem, ItemSource, MemberInventory } from "./inventory";

export type Kudos = { given: number; received: number };

export type Progression = { level: number; xp: number; levelStartsAt: number; nextLevelAt: number; xpToNextLevel: number };

export type MemberProfile = {
  kind: "member";
  name?: string;
  face: Face;
  kudosEmoji: string;
  allowance: { left: number; base: number; refillsAt: number };
  thisWeek: Kudos;
  lifetime: Kudos;
  chatUrl: string;
  leaderboard: FeaturePage;
  features: FeatureCard[] | null;
  journey: JourneyStep[] | null;
  progression: Progression | null;
  skillPoints: number | null;
  coins: number | null;
  inventory: MemberInventory | null;
  groups: boolean;
  settings: boolean;
  avatar?: Avatar | null;
  bookSpread?: true;
};

export type MyProfile = Denial | MemberProfile;

export const getMyProfile = memberQuery(async (ctx, me): Promise<MemberProfile | Denial> => {
  await followTheClock(ctx);
  const facts = await homeFacts(ctx, me.workspace, me.user);
  if (facts?.kind !== "member") return { kind: "not-a-member" };
  const path = await unlockPathOf(ctx, me);
  const leaderboard = await leaderboardStateOf(ctx, me, path);
  return {
    kind: "member",
    ...(me.name !== undefined && { name: me.name }),
    face: await faceOf(ctx, me),
    kudosEmoji: facts.kudosEmoji,
    allowance: { left: facts.left, base: facts.base, refillsAt: facts.refillsAt },
    thisWeek: { given: facts.givenWeek, received: facts.receivedWeek },
    lifetime: { given: facts.given, received: facts.received },
    chatUrl: workspaceLink(me.workspace),
    leaderboard,
    features: await featureCardsOf(ctx, me, path),
    journey: await journeyStepsOf(ctx, me),
    progression: await progressionOf(ctx, me),
    skillPoints: await skillPointsOf(ctx, me, path),
    coins: (await visibleWalletOf(ctx, me.member))?.balance ?? null,
    inventory: await inventoryShownTo(ctx, me.member),
    groups: await groupsShownTo(ctx, me.member),
    settings: await settingsShownTo(ctx, me, leaderboard),
    ...(await avatarShownOn(ctx, me.member, me.member)),
    ...(await bookSpreadShownTo(ctx, me.member)),
  };
});

async function progressionOf(ctx: QueryCtx, me: VerifiedMember): Promise<Progression | null> {
  if (!(await xpLevelsOnFor(ctx, me.member))) return null;
  const { level, xp, xpToNextLevel } = await progressionHomeOf(ctx, me.member);
  return { level, xp, levelStartsAt: xpToReach(level), nextLevelAt: xpToReach(level + 1), xpToNextLevel };
}
