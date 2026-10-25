import type { AppReads } from "./App";
import { fixedAlbum, fixedPeople, albumFixtures } from "./album/albumFixtures";
import { boardsFixtures, fixedBoards } from "./album/boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./album/hoggiesFixtures";
import { fixedLevelUp, levelUpFixtures } from "./album/levelUpFixtures";
import { fixedPlayerCards } from "./album/playerCardFixtures";
import { fixedProfile, profileFixtures } from "./album/profileFixtures";
import { fixtureWeeks } from "./album/weekFixtures";
import { emojiMappingsFixtures, fixtureAppEmojis, fixtureSlackEmojiMatches } from "./emojiMappingFixtures";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import { fixedXpMoment, xpMomentAlbum } from "./album/xpMomentFixtures";

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
    useAlbum: fixture === withoutATeam ? fixedAlbum(albumFixtures.teamless) : fixture === withNewEmojis ? fixedAlbum(albumFixtures.newEmojis) : fixture === asAnAdmin ? fixedAlbum(albumFixtures.admin) : fixture === withTheEmojiWizard ? fixedAlbum({ ...albumFixtures.midway, emojiWizard: true }) : fixture === withItems ? fixedAlbum(albumFixtures.withItems) : fixture === withAnXpMoment ? fixedAlbum(xpMomentAlbum) : fixture === withPersonPageD ? fixedAlbum({ ...albumFixtures.midway, personPageD: true, linkPreviews: true }) : fixtureAlbum,
    useThoughtfulBoards: fixture === withoutATeam ? fixedBoards(boardsFixtures.teamless) : fixtureBoards,
    useAlbumPerson: fixturePeople,
    useAlbumWeek: fixtureWeek,
    useAlbumProfile: fixtureProfile,
    useAlbumHoggies: fixtureHoggies,
    useLevelUp: fixtureLevelUp,
    useXpMoment: fixture === withAnXpMoment ? fixedXpMoment : (asking) => (asking ? { kind: "off" } : undefined),
    usePlayerCard: fixedPlayerCards(),
  };
}
