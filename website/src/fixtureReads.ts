import { fixtureActivityWatch, fixtureReadActivity } from "./activityFixtures";
import type { AppReads } from "./App";
import { fixedAlbum, fixedPeople, albumFixtures } from "./album/albumFixtures";
import { boardsFixtures, fixedBoards } from "./album/boardsFixtures";
import { fixtureWeeks } from "./album/weekFixtures";
import { fixtureBookFor } from "./bookFixtures";
import { fixtureCollectionFor } from "./collectionFixtures";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { fixtureProfileCardFor } from "./profileCardFixtures";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixtureRecentKudos } from "./recentKudosFixtures";
import type { ShellState } from "./shell";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import { fixtureSkillTreeFor } from "./skillTreeFixtures";
import { fixtureSpotlight } from "./spotlightFixtures";

const fixtureLeaderboard = fixedLeaderboard(leaderboardFixtures.midBoard);

const fixtureQuests = fixedQuests(questsFixtures.weekWithLastWeeksCrate);

const fixtureSettings = fixedSettings(settingsFixtures.everything);

const fixtureAlbum = fixedAlbum(albumFixtures.trayed);

const fixtureBoards = fixedBoards(boardsFixtures.week);

const fixturePeople = fixedPeople(albumFixtures.midway);
const fixtureWeek = fixtureWeeks();

export function fixtureReadsFor(visitor: ShellState, fixture?: string): AppReads {
  return {
    useLeaderboard: fixtureLeaderboard,
    useQuests: fixtureQuests,
    useBook: fixtureBookFor(visitor),
    useCollection: fixtureCollectionFor(visitor, fixture),
    useSkillTree: fixtureSkillTreeFor(visitor),
    useProfileCard: fixtureProfileCardFor(visitor),
    useRecentKudos: fixtureRecentKudos,
    useActivityWatch: fixtureActivityWatch,
    readActivity: fixtureReadActivity,
    drawSpotlight: fixtureSpotlight,
    useSettings: fixtureSettings,
    useAlbum: fixtureAlbum,
    useThoughtfulBoards: fixtureBoards,
    useAlbumPerson: fixturePeople,
    useAlbumWeek: fixtureWeek,
  };
}
