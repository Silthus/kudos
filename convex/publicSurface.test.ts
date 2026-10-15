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

    expect(publicFunctions.sort()).toEqual(["./auth.ts:isAuthenticated", "./auth.ts:signIn", "./auth.ts:signOut", "./website/activity.ts:getActivity", "./website/activity.ts:getRecentKudos", "./website/activity.ts:getSpotlight", "./website/book.ts:getBook", "./website/commands.ts:buyPerk", "./website/commands.ts:equip", "./website/commands.ts:openFeature", "./website/commands.ts:openQuestCrate", "./website/commands.ts:pickPrimaryGroup", "./website/commands.ts:setBoardVisibility", "./website/commands.ts:setMessageSetting", "./website/commands.ts:swapQuest", "./website/commands.ts:takeOff", "./website/groupBoards.ts:getGroupBoards", "./website/leaderboard.ts:getLeaderboard", "./website/profile.ts:getMyProfile", "./website/profileCard.ts:getProfileCard", "./website/quests.ts:getQuests", "./website/settings.ts:getSettings", "./website/skillTree.ts:getSkillTree"]);
  });
});

function isConvexFunction(value: Registered) {
  return value.isQuery === true || value.isMutation === true || value.isAction === true;
}
