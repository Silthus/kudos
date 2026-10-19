import { fixtureActivityWatch, fixtureReadActivity } from "./activityFixtures";
import type { AppReads } from "./App";
import { fixedAlbum, fixedPeople, albumFixtures } from "./album/albumFixtures";
import { boardsFixtures, fixedBoards } from "./album/boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./album/hoggiesFixtures";
import { fixedProfile, profileFixtures } from "./album/profileFixtures";
import { fixtureWeeks } from "./album/weekFixtures";
import { fixtureBookFor } from "./bookFixtures";
import { fixtureCollectionFor } from "./collectionFixtures";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { fixtureProfileCardFor } from "./profileCardFixtures";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixtureRecentKudos } from "./recentKudosFixtures";
import type { ShellState } from "./shell";
import { emojiMappingsFixtures, fixtureAppEmojis, fixtureSlackEmojiMatches } from "./emojiMappingFixtures";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import { fixtureSkillTreeFor } from "./skillTreeFixtures";
import { fixtureSpotlight } from "./spotlightFixtures";

const fixtureLeaderboard = fixedLeaderboard(leaderboardFixtures.midBoard);

const fixtureQuests = fixedQuests(questsFixtures.weekWithLastWeeksCrate);

const fixtureSettings = fixedSettings(settingsFixtures.everything);

const fixtureMaintainerSettings = fixedSettings(settingsFixtures.forTheMaintainer);

const fixtureAlbum = fixedAlbum(albumFixtures.trayed);

const fixtureBoards = fixedBoards(boardsFixtures.week);

const withoutATeam = "album-without-a-team";

const withNewEmojis = "album-with-new-emojis";

const asAnAdmin = "album-as-an-admin";

const withTheEmojiWizard = "album-emoji-wizard";

const fixturePeople = fixedPeople(albumFixtures.midway);
const fixtureWeek = fixtureWeeks();

const fixtureProfile = fixedProfile(profileFixtures.noted);

const fixtureHoggies = fixedHoggies(hoggiesFixtures.midway);

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
    useSettings: fixture === "album-maintainer" || fixture === withTheEmojiWizard ? fixtureMaintainerSettings : fixtureSettings,
    useEmojiMappings: (asking) => (asking ? emojiMappingsFixtures.workspace : undefined),
    useSlackEmojiMatches: fixtureSlackEmojiMatches,
    useAppEmojis: fixture === withTheEmojiWizard ? fixtureAppEmojis : (asking) => (asking ? { kind: "off" } : undefined),
    useAlbum: fixture === withoutATeam ? fixedAlbum(albumFixtures.teamless) : fixture === withNewEmojis ? fixedAlbum(albumFixtures.newEmojis) : fixture === asAnAdmin ? fixedAlbum(albumFixtures.admin) : fixture === withTheEmojiWizard ? fixedAlbum({ ...albumFixtures.midway, emojiWizard: true }) : fixtureAlbum,
    useThoughtfulBoards: fixture === withoutATeam ? fixedBoards(boardsFixtures.teamless) : fixtureBoards,
    useAlbumPerson: fixturePeople,
    useAlbumWeek: fixtureWeek,
    useAlbumProfile: fixtureProfile,
    useAlbumHoggies: fixtureHoggies,
  };
}
