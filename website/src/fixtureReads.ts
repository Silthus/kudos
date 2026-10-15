import { fixtureActivityWatch, fixtureReadActivity } from "./activityFixtures";
import type { AppReads } from "./App";
import { fixtureBookFor } from "./bookFixtures";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { fixtureProfileCardFor } from "./profileCardFixtures";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixtureRecentKudos } from "./recentKudosFixtures";
import type { ShellState } from "./shell";
import { fixtureSkillTreeFor } from "./skillTreeFixtures";
import { fixtureSpotlight } from "./spotlightFixtures";

const fixtureLeaderboard = fixedLeaderboard(leaderboardFixtures.midBoard);

const fixtureQuests = fixedQuests(questsFixtures.weekWithLastWeeksCrate);

export function fixtureReadsFor(visitor: ShellState): AppReads {
  return {
    useLeaderboard: fixtureLeaderboard,
    useQuests: fixtureQuests,
    useBook: fixtureBookFor(visitor),
    useSkillTree: fixtureSkillTreeFor(visitor),
    useProfileCard: fixtureProfileCardFor(visitor),
    useRecentKudos: fixtureRecentKudos,
    useActivityWatch: fixtureActivityWatch,
    readActivity: fixtureReadActivity,
    drawSpotlight: fixtureSpotlight,
  };
}
