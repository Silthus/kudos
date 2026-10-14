import type { QueryCtx } from "../_generated/server";
import { homeFacts } from "../engine/home";
import { xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { workspaceLink } from "../slack/workspaceLink";
import { followTheClock } from "./clock";
import { faceOf, type Face } from "./faces";
import { memberQuery, type Denial, type VerifiedMember } from "./memberQuery";
import { journeyStepsOf, type JourneyStep } from "./quests";
import { featureCardsOf, leaderboardStateOf, unlockPathOf, type FeatureCard, type LeaderboardState } from "./unlockPath";

export type { Face } from "./faces";
export type { FeatureCard, LeaderboardState } from "./unlockPath";
export type { JourneyStep } from "./quests";

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
  leaderboard: LeaderboardState;
  features: FeatureCard[] | null;
  journey: JourneyStep[] | null;
  progression: Progression | null;
};

export type MyProfile = Denial | MemberProfile;

export const getMyProfile = memberQuery(async (ctx, me): Promise<MemberProfile | Denial> => {
  await followTheClock(ctx);
  const facts = await homeFacts(ctx, me.workspace, me.user);
  if (facts?.kind !== "member") return { kind: "not-a-member" };
  const path = await unlockPathOf(ctx, me);
  return {
    kind: "member",
    ...(me.name !== undefined && { name: me.name }),
    face: await faceOf(ctx, me),
    kudosEmoji: facts.kudosEmoji,
    allowance: { left: facts.left, base: facts.base, refillsAt: facts.refillsAt },
    thisWeek: { given: facts.givenWeek, received: facts.receivedWeek },
    lifetime: { given: facts.given, received: facts.received },
    chatUrl: workspaceLink(me.workspace),
    leaderboard: await leaderboardStateOf(ctx, me, path),
    features: await featureCardsOf(me, path),
    journey: await journeyStepsOf(ctx, me),
    progression: await progressionOf(ctx, me),
  };
});

async function progressionOf(ctx: QueryCtx, me: VerifiedMember): Promise<Progression | null> {
  if (!(await xpLevelsShownIn(ctx, me.workspace))) return null;
  const { level, xp, xpToNextLevel } = await progressionHomeOf(ctx, me.member);
  return { level, xp, levelStartsAt: xpToReach(level), nextLevelAt: xpToReach(level + 1), xpToNextLevel };
}
