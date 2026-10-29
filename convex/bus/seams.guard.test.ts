import { describe, expect, test } from "vitest";
import schema from "../schema";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const writeFunctions = ["recordReward", "applyGain", "earnItem", "markTurned", "dropFor", "credit", "spend"];

const tablesOf: Record<string, string[]> = {
  achievements: ["bookLaunches", "ladderCounts", "ladderMarks", "countedAwards", "bookBatches", "bookReplays", "bookReplayCursors", "earnedTiers"],
  album: ["thoughtfulGiverCounts", "thoughtfulPacks", "trayItems", "grantRecords", "grantsTold", "thoughtfulTallies", "thoughtfulBoardTallies", "boardCountedAwards", "albumStickers", "teamStickers", "milestoneTiers", "emojiNames", "secondEmojiNames", "emojiNameNumbers", "seenEmojis", "kudosEmojiPicks", "emojiClasses", "randomEmojiDrops", "albumHistory", "pairTallies", "weekTallies", "weekPeople", "talliedAwards", "talliedHugs"],
  analytics: ["analyticsIds", "workspaceKeys", "analyticsOutbox", "analyticsDrain", "errorSweep", "watchedJobs", "reportedJobs", "flagExposures"],
  companyProfiles: ["companyProfiles", "companyTeams", "companyFaces", "companyProfileLinks"],
  engine: ["kudosMessages", "kudosTexts", "wordDeletionRequests", "spotlightDraws", "awards", "kudosTotals", "allowanceSpending"],
  feedback: ["welcomeNudges", "indicators", "privateReplies", "oneReplies", "publicReplies", "tierNotices", "tierSummaries", "homes", "homeSelections"],
  groups: ["userGroupDepartures", "groupCountingChanges", "memberGroups", "groupSettings", "primaryGroupHistory", "attributions"],
  hoggies: ["drops", "hoggieTallies", "dropTallies", "trayDrops", "hoggieAvatars", "petHoggies", "boughtCrates"],
  hugs: ["hugWeeks", "hugWeekMessages", "hugCounts", "hugs", "hugPeople", "hugsReceived"],
  items: ["items"],
  leaderboard: ["countedKudosGiven", "givenByDay", "attributedTotals", "attributedGroupTotals", "countedAttributions", "givenTotals", "mondayPostSettings", "mondayPostClaims", "featuredNewGivers", "leaderboardSettings"],
  messageSettings: ["progressSettings", "messageSettings"],
  mondayDm: ["mondayDms"],
  progression: ["effectsRecords", "rewardRecords", "receivingGivers", "effectsBackfill", "memberProgress", "perksOwned", "perkPurchases"],
  quests: ["journeySteps", "questStarts", "journeyLaunches", "questDraws", "questSwaps", "questProgress", "groupQuestLaunches", "groupQuestWeeks", "groupQuests", "groupQuestContributions", "crateOpenings", "pendingCrates", "questsJudged", "pendingCratesBackfill"],
  slack: ["memberVerifications", "firstSignIns", "slackReceipts", "placedReactions", "slackRateLimits", "cardPictures"],
  stickers: ["stickers", "stickerBackfills", "teamPageCompletions", "teamPageChecks"],
  store: ["collection", "itemPurchases", "customKudosEmoji"],
  unlocks: ["unlocks", "unlockLaunches", "previewMoments", "levelUps"],
  wallet: ["wallets", "coinSpends"],
  website: ["users", "authAccounts", "authSessions", "authVerificationCodes", "authVerifiers", "authRefreshTokens", "authRateLimits", "websiteClock", "lastVisits", "howItWorksCloses"],
  welcome: ["welcomes"],
  workspace: ["workspaces", "members", "listedMembers", "userGroups", "userGroupMembers", "customEmoji", "customEmojiListings", "welcomeNudgeSwitches", "celebrationsSwitches"],
};

const allowed: string[] = [
  "convex/achievements/replay.ts table:members",
  "convex/achievements/tierCoins.ts recordReward",
  "convex/achievements/tierEmoji.ts recordReward",
  "convex/album/emojiWizard.ts table:memberProgress",
  "convex/album/opening.ts dropFor",
  "convex/album/opening.ts earnItem",
  "convex/album/opening.ts markTurned",
  "convex/album/packs.ts earnItem",
  "convex/album/putIn.ts markTurned",
  "convex/companyProfiles/storedFaces.ts table:workspaces",
  "convex/feedback/tierNotices.ts table:members",
  "convex/feedback/tierNotices.ts table:unlockLaunches",
  "convex/feedback/welcome.ts table:welcomes",
  "convex/feedback/welcomeNudge.ts table:users",
  "convex/groups/groups.ts table:userGroups",
  "convex/groups/reconcile.ts table:members",
  "convex/hoggies/boughtCrates.ts spend",
  "convex/hoggies/drops.ts applyGain",
  "convex/hoggies/forge.ts earnItem",
  "convex/hugs/hugs.ts recordReward",
  "convex/hugs/people.ts recordReward",
  "convex/items/fill.ts table:thoughtfulPacks",
  "convex/items/fill.ts table:trayItems",
  "convex/items/fill.ts table:members",
  "convex/items/finds.ts table:thoughtfulPacks",
  "convex/items/turn.ts dropFor",
  "convex/leaderboard/newGivers.ts table:thoughtfulBoardTallies",
  "convex/mondayDm/mondayDm.ts table:questStarts",
  "convex/progression/perks.ts spend",
  "convex/progression/progression.ts credit",
  "convex/quests/finish.ts earnItem",
  "convex/quests/finish.ts recordReward",
  "convex/quests/groupQuest.ts table:members",
  "convex/quests/groupQuest.ts table:userGroups",
  "convex/quests/join.ts table:members",
  "convex/quests/journey.ts table:members",
  "convex/quests/newWeek.ts table:members",
  "convex/quests/open.ts dropFor",
  "convex/quests/open.ts applyGain",
  "convex/store/buying.ts spend",
  "convex/unlocks/launch.ts table:members",
  "convex/unlocks/levelUpHoggies.ts dropFor",
  "convex/unlocks/levelUpHoggies.ts earnItem",
  "convex/unlocks/levelUpHoggies.ts markTurned",
  "convex/unlocks/sweep.ts table:members",
  "convex/unlocks/sweep.ts table:memberProgress",
  "convex/unlocks/unlocks.ts dropFor",
  "convex/website/linkPreviews.ts table:companyTeams",
];

describe("HH16: writes cross modules as bus facts", () => {
  test("every table has one owning module", () => {
    const mapped = Object.values(tablesOf).flat();

    expect(mapped.toSorted(), "the tables of the owner map").toEqual(Object.keys(schema.tables).toSorted());
    expect(new Set(mapped).size, "tables owned twice").toBe(mapped.length);
  });

  test("the crossings of a module's write function or table are exactly the allowlist, so it only shrinks", () => {
    expect(everyCrossing().toSorted(), "+ crossings not on the allowlist, - allowlisted crossings that no longer occur").toEqual(allowed.toSorted());
  });
});

function everyCrossing() {
  return [...new Set(Object.entries(sources).flatMap(([path, source]) => [...writesImportedBy(path, source), ...tablesQueriedBy(path, source)]))];
}

function writesImportedBy(path: string, source: string) {
  return importsOf(source)
    .filter(({ from }) => from.startsWith(".") && moduleOf(resolved(path, from)) !== moduleOf(path))
    .flatMap(({ names }) => names.filter((name) => writeFunctions.includes(name)))
    .map((name) => `${fileOf(path)} ${name}`);
}

function tablesQueriedBy(path: string, source: string) {
  return [...source.matchAll(/\.query\(\s*"(\w+)"/g)]
    .map(([, table = ""]) => table)
    .filter((table) => ownerOf(table) !== undefined && ownerOf(table) !== moduleOf(path))
    .map((table) => `${fileOf(path)} table:${table}`);
}

function importsOf(source: string) {
  return [...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)"/g)].map(([whole, names = "", from = ""]) => ({
    names: whole.startsWith("import type") ? [] : names.split(",").flatMap(valueNameOf),
    from,
  }));
}

function valueNameOf(specifier: string) {
  const name = specifier.trim();
  return name === "" || name.startsWith("type ") ? [] : name.split(/\s+as\s+/, 1);
}

function ownerOf(table: string) {
  return Object.entries(tablesOf).find(([, tables]) => tables.includes(table))?.[0];
}

function resolved(path: string, from: string) {
  const parts = path.split("/").slice(0, -1);
  for (const part of from.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

function moduleOf(path: string) {
  const [, , module, ...rest] = path.split("/");
  return rest.length === 0 ? "" : module;
}

function fileOf(path: string) {
  return path.slice(1);
}
