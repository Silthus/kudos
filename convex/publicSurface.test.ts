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

    expect(publicFunctions.sort()).toEqual(["./auth.ts:isAuthenticated", "./auth.ts:signIn", "./auth.ts:signOut", "./website/activity.ts:getActivity", "./website/activity.ts:getRecentKudos", "./website/activity.ts:getSpotlight", "./website/album.ts:getAlbum", "./website/album.ts:getAlbumHoggies", "./website/album.ts:getAlbumPerson", "./website/album.ts:getAlbumProfile", "./website/album.ts:getAlbumWeek", "./website/album.ts:getThoughtfulBoards", "./website/album.ts:openThoughtfulPack", "./website/album.ts:putAllIn", "./website/album.ts:putIn", "./website/album.ts:unlockTeamSticker", "./website/book.ts:getBook", "./website/browserAnalytics.ts:getBrowserAnalytics", "./website/collection.ts:getCollection", "./website/commands.ts:buyCrate", "./website/commands.ts:buyItem", "./website/commands.ts:buyPerk", "./website/commands.ts:linkCompanyProfile", "./website/commands.ts:linkMyCompanyProfile", "./website/commands.ts:openCrate", "./website/commands.ts:openFeature", "./website/commands.ts:openQuestCrate", "./website/commands.ts:pickPrimaryGroup", "./website/commands.ts:setAvatar", "./website/commands.ts:setBoardVisibility", "./website/commands.ts:setMessageSetting", "./website/commands.ts:setWorkspaceSettings", "./website/commands.ts:swapQuest", "./website/face.ts:getMyFace", "./website/groupBoards.ts:getGroupBoards", "./website/leaderboard.ts:getLeaderboard", "./website/profile.ts:getMyProfile", "./website/profileCard.ts:getProfileCard", "./website/quests.ts:getQuests", "./website/settings.ts:getSettings", "./website/skillTree.ts:getSkillTree"]);
  }, 30_000);
});

function isConvexFunction(value: Registered) {
  return value.isQuery === true || value.isMutation === true || value.isAction === true;
}
