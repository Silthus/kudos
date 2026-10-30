import { describe, expect, test } from "vitest";
import { modules } from "./test.setup";

type Registered = { isQuery?: true; isMutation?: true; isAction?: true; isInternal?: true };

describe("WS10: the public surface is exact", () => {
  test("only HTTP routes, Convex Auth's signIn, signOut and isAuthenticated, and the website's signed-in functions are public", async () => {
    const publicFunctions: string[] = [];
    for (const [path, load] of Object.entries(modules)) {
      if (path.startsWith("./_generated/")) continue;
      const exports = (await load()) as Record<string, Registered>;
      for (const [name, value] of Object.entries(exports)) {
        if (isConvexFunction(value) && !value.isInternal) publicFunctions.push(`${path}:${name}`);
      }
    }

    expect(publicFunctions.sort()).toEqual(["./auth.ts:isAuthenticated", "./auth.ts:signIn", "./auth.ts:signOut", "./website/activity.ts:getActivity", "./website/activity.ts:getActivityWeek", "./website/activity.ts:getRecentKudos", "./website/activity.ts:getSpotlight", "./website/activity.ts:viewActivity", "./website/album.ts:forgeHoggie", "./website/album.ts:getAlbum", "./website/album.ts:getAlbumHoggies", "./website/album.ts:getAlbumPerson", "./website/album.ts:getAlbumProfile", "./website/album.ts:getAlbumWeek", "./website/album.ts:getLevelUp", "./website/album.ts:getThoughtfulBoards", "./website/album.ts:makePet", "./website/album.ts:markEmojisSeen", "./website/album.ts:openThoughtfulPack", "./website/album.ts:pickKudosEmoji", "./website/album.ts:putAllIn", "./website/album.ts:putIn", "./website/album.ts:turnItem", "./website/album.ts:unlockTeamSticker", "./website/album.ts:viewLeaderboard", "./website/book.ts:getBook", "./website/browserAnalytics.ts:getBrowserAnalytics", "./website/collection.ts:getCollection", "./website/commands.ts:buyCrate", "./website/commands.ts:buyItem", "./website/commands.ts:buyPerk", "./website/commands.ts:linkCompanyProfile", "./website/commands.ts:linkMyCompanyProfile", "./website/commands.ts:openCrate", "./website/commands.ts:openFeature", "./website/commands.ts:pickPrimaryGroup", "./website/commands.ts:pickWeeklyPostChannel", "./website/commands.ts:setAvatar", "./website/commands.ts:setBoardVisibility", "./website/commands.ts:setMessageSetting", "./website/commands.ts:setPublicCelebrations", "./website/commands.ts:setWeeklyPost", "./website/commands.ts:setWorkspaceSettings", "./website/emojiMappings.ts:getEmojiMappings", "./website/emojiMappings.ts:mapSlackEmoji", "./website/emojiMappings.ts:pickMyHypeEmoji", "./website/emojiWizard.ts:findSlackEmojis", "./website/emojiWizard.ts:getAppEmojis", "./website/emojiWizard.ts:mapMyEmoji", "./website/face.ts:getMyFace", "./website/groupBoards.ts:getGroupBoards", "./website/lastVisit.ts:arrive", "./website/leaderboard.ts:getBoards", "./website/leaderboard.ts:getLeaderboard", "./website/onboarding.ts:closeHowItWorks", "./website/playerCard.ts:getPlayerCard", "./website/playerCard.ts:getPlayerCardEmojis", "./website/profile.ts:getMyProfile", "./website/profileCard.ts:getProfileCard", "./website/quests.ts:getQuests", "./website/quests.ts:viewQuests", "./website/settings.ts:getSettings", "./website/skillTree.ts:getSkillTree", "./website/xpMoment.ts:endXpMoment", "./website/xpMoment.ts:getXpMoment"]);
  }, 30_000);
});

function isConvexFunction(value: Registered) {
  return value.isQuery === true || value.isMutation === true || value.isAction === true;
}
