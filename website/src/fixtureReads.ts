import type { AppReads } from "./App";
import { fixedAlbum, fixedPeople, albumFixtures } from "./album/albumFixtures";
import { boardsFixtures, fixedBoards } from "./album/boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./album/hoggiesFixtures";
import { fixedHugBoards, hugBoardsFixtures } from "./leaderboard/thisWeekFixtures";
import { fixedLevelUp, levelUpFixtures } from "./album/levelUpFixtures";
import { fixedPlayerCards } from "./album/playerCardFixtures";
import { fixedProfile, profileFixtures } from "./album/profileFixtures";
import { fixtureWeeks } from "./album/weekFixtures";
import { emojiMappingsFixtures, fixtureAppEmojis, fixtureSlackEmojiMatches } from "./emojiMappingFixtures";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import { fixedXpMoment, xpMomentAlbum } from "./album/xpMomentFixtures";
import { fixedQuests, noQuests, questsFixtures } from "./album/questsFixtures";
import { activityWeekFixtures, fixedActivityWeek, theWeeklyEdition } from "./activity/activityWeekFixtures";

const fixtureSettings = fixedSettings(settingsFixtures.everything);

const fixtureMaintainerSettings = fixedSettings(settingsFixtures.forTheMaintainer);

const fixtureAlbum = fixedAlbum(albumFixtures.trayed);

const fixtureBoards = fixedBoards(boardsFixtures.week);

const withoutATeam = "album-without-a-team";

const withNewEmojis = "album-with-new-emojis";

const asAnAdmin = "album-as-an-admin";

const withTheEmojiWizard = "album-emoji-wizard";

const withItems = "album-with-items";

const withPersonPageD = "album-person-page-d";

const withAnXpMoment = "album-xp-moment";

const withQuests = "album-quests";

const withThisWeeksQuests = "album-quests-week";

const withTheWeeksLeaderboard = "album-leaderboard-hugs";

const fixturePeople = fixedPeople(albumFixtures.midway);
const fixtureWeek = fixtureWeeks();

const fixtureProfile = fixedProfile(profileFixtures.noted);

const fixtureHoggies = fixedHoggies(hoggiesFixtures.midway);

const fixtureLevelUp = fixedLevelUp(levelUpFixtures.levelFive);

export function fixtureReadsFor(fixture?: string): AppReads {
  return {
    useSettings: fixture === "album-maintainer" || fixture === withTheEmojiWizard ? fixtureMaintainerSettings : fixtureSettings,
    useEmojiMappings: (asking) => (asking ? emojiMappingsFixtures.workspace : undefined),
    useSlackEmojiMatches: fixtureSlackEmojiMatches,
    useAppEmojis: fixture === withTheEmojiWizard ? fixtureAppEmojis : (asking) => (asking ? { kind: "off" } : undefined),
    useAlbum: fixture === withoutATeam ? fixedAlbum(albumFixtures.teamless) : fixture === withNewEmojis ? fixedAlbum(albumFixtures.newEmojis) : fixture === asAnAdmin ? fixedAlbum(albumFixtures.admin) : fixture === withTheEmojiWizard ? fixedAlbum({ ...albumFixtures.midway, emojiWizard: true }) : fixture === withItems ? fixedAlbum(albumFixtures.withItems) : fixture === withAnXpMoment ? fixedAlbum(xpMomentAlbum) : fixture === withPersonPageD ? fixedAlbum({ ...albumFixtures.midway, personPageD: true, linkPreviews: true }) : fixture === withTheWeeksLeaderboard ? fixedAlbum({ ...albumFixtures.midway, leaderboardHugs: true }) : fixture === withQuests || fixture === withThisWeeksQuests ? fixedAlbum({ ...albumFixtures.midway, personPageD: true, linkPreviews: true, gettingStarted: null }) : fixtureAlbum,
    useThoughtfulBoards: fixture === withoutATeam ? fixedBoards(boardsFixtures.teamless) : fixtureBoards,
    useHugBoards: fixedHugBoards(hugBoardsFixtures.lively),
    useAlbumPerson: fixturePeople,
    useAlbumWeek: fixtureWeek,
    useActivityWeek: activityWeekOf(fixture),
    useAlbumProfile: fixtureProfile,
    useAlbumHoggies: fixtureHoggies,
    useLevelUp: fixtureLevelUp,
    useXpMoment: fixture === withAnXpMoment ? fixedXpMoment : (asking) => (asking ? { kind: "off" } : undefined),
    usePlayerCard: fixedPlayerCards(),
    useQuests: fixture === withQuests ? fixedQuests(questsFixtures.halfway) : fixture === withThisWeeksQuests ? fixedQuests(questsFixtures.week) : activityQuestsOf(fixture),
  };
}

const activityNextFixture = "album-activity-next-";

function activityQuestsOf(fixture: string | undefined) {
  if (!fixture?.startsWith(activityNextFixture)) return noQuests;
  return fixture === `${activityNextFixture}empty` ? fixedQuests(questsFixtures.beforeTheFirstHug) : fixedQuests(questsFixtures.week);
}

function activityWeekOf(fixture: string | undefined) {
  if (!fixture?.startsWith(activityNextFixture)) return theWeeklyEdition;
  const state = fixture.slice(activityNextFixture.length);
  return state === "thanked" || state === "quiet" ? fixedActivityWeek(activityWeekFixtures[state]) : fixedActivityWeek(activityWeekFixtures.empty);
}
