import { describe, expect, test } from "vitest";
import schema from "../schema";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const placesThatWriteRewards = ["progression", "wallet", "album/items", "album/hoggies"];

const tablesOf: Record<string, string[]> = {
  achievements: ["bookLaunches", "ladderCounts", "ladderMarks", "countedAwards", "bookBatches", "bookReplays", "bookReplayCursors", "earnedTiers"],
  album: ["thoughtfulGiverCounts", "thoughtfulPacks", "trayItems", "grantRecords", "grantsTold", "thoughtfulTallies", "thoughtfulBoardTallies", "boardCountedAwards", "albumStickers", "teamStickers", "milestoneTiers", "emojiNames", "secondEmojiNames", "emojiNameNumbers", "seenEmojis", "kudosEmojiPicks", "emojiClasses", "randomEmojiDrops", "albumHistory", "pairTallies", "weekTallies", "weekPeople", "talliedAwards", "talliedHugs", "items", "drops", "hoggieTallies", "dropTallies", "trayDrops", "hoggieAvatars", "petHoggies", "boughtCrates"],
  analytics: ["analyticsIds", "workspaceKeys", "analyticsOutbox", "analyticsDrain", "errorSweep", "watchedJobs", "reportedJobs", "flagExposures"],
  bus: ["replays"],
  companyProfiles: ["companyProfiles", "companyTeams", "companyFaces", "companyProfileLinks"],
  engine: ["kudosMessages", "kudosTexts", "wordDeletionRequests", "spotlightDraws", "awards", "kudosTotals", "allowanceSpending"],
  feedback: ["welcomeNudges", "indicators", "privateReplies", "oneReplies", "publicReplies", "tierNotices", "tierSummaries", "homes", "homeSelections", "sentNotices", "grantReplies", "celebratedLevels"],
  groups: ["userGroupDepartures", "groupCountingChanges", "memberGroups", "groupSettings", "primaryGroupHistory", "attributions"],
  hugs: ["hugWeeks", "hugWeekMessages", "hugCounts", "hugs", "hugPeople", "hugsReceived"],
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
  "convex/commands/commands.ts buyCrate",
  "convex/commands/commands.ts buyPerk",
  "convex/commands/commands.ts openCrate",
  "convex/commands/commands.ts setAvatar",
  "convex/commands/commands.ts xpLevelsShownTo",
  "convex/companyProfiles/storedFaces.ts table:workspaces",
  "convex/feedback/coins.ts coinsShownTo",
  "convex/feedback/homes.ts coinsVisibleAndExposedTo",
  "convex/feedback/homes.ts skillTreeShownTo",
  "convex/feedback/homes.ts xpLevelsShownTo",
  "convex/feedback/notify.ts xpLevelsShownTo",
  "convex/feedback/replies.ts coinsShownTo",
  "convex/feedback/replies.ts xpLevelsShownTo",
  "convex/feedback/tierNotices.ts table:members",
  "convex/feedback/tierNotices.ts table:unlockLaunches",
  "convex/feedback/welcome.ts table:welcomes",
  "convex/feedback/welcomeNudge.ts earnWelcomeItem",
  "convex/feedback/welcomeNudge.ts table:users",
  "convex/groups/groups.ts table:userGroups",
  "convex/groups/reconcile.ts table:members",
  "convex/album/hoggies/boughtCrates.ts spend",
  "convex/album/hoggies/drops.ts applyGain",
  "convex/album/items/fill.ts table:members",
  "convex/leaderboard/newGivers.ts table:thoughtfulBoardTallies",
  "convex/mondayDm/mondayDm.ts table:questStarts",
  "convex/progression/perks.ts coinsShownTo",
  "convex/progression/perks.ts spend",
  "convex/progression/progression.ts credit",
  "convex/quests/finish.ts earnItem",
  "convex/quests/finish.ts recordReward",
  "convex/quests/groupQuest.ts table:members",
  "convex/quests/groupQuest.ts table:userGroups",
  "convex/quests/join.ts table:members",
  "convex/quests/journey.ts table:members",
  "convex/quests/newWeek.ts table:members",
  "convex/quests/open.ts applyGain",
  "convex/quests/open.ts dropFor",
  "convex/slack/appHome.ts xpLevelsShownTo",
  "convex/slack/verifyMember.ts earnWelcomeItem",
  "convex/store/buying.ts spend",
  "convex/store/visibility.ts coinsShownTo",
  "convex/unlocks/launch.ts table:members",
  "convex/unlocks/launch.ts xpLevelsShownTo",
  "convex/unlocks/levelUpHoggies.ts dropFor",
  "convex/unlocks/levelUpHoggies.ts earnItem",
  "convex/unlocks/levelUpHoggies.ts markTurned",
  "convex/unlocks/sweep.ts table:memberProgress",
  "convex/unlocks/sweep.ts table:members",
  "convex/unlocks/unlocks.ts dropFor",
  "convex/website/album.ts forge",
  "convex/website/album.ts makePetOf",
  "convex/website/album.ts turn",
  "convex/website/commands.ts dropOf",
  "convex/website/commands.ts openedCrateDropOf",
  "convex/website/linkPreviews.ts table:companyTeams",
  "convex/website/signIn.ts earnWelcomeItem",
  "convex/welcome/welcome.ts earnWelcomeItem",
];

describe("HH16: writes cross modules as bus facts", () => {
  test("every table has one owning module", () => {
    const mapped = Object.values(tablesOf).flat();

    expect(mapped.toSorted(), "the tables of the owner map").toEqual(Object.keys(schema.tables).toSorted());
    expect(new Set(mapped).size, "tables owned twice").toBe(mapped.length);
  });

  test("the crossings of a write function of a module that writes rewards, or of a table, are exactly the allowlist, so it only shrinks", () => {
    expect(everyCrossing().toSorted(), "+ crossings not on the allowlist, - allowlisted crossings that no longer occur").toEqual(allowed.toSorted());
  });

  test.each([
    ["a named import", `import { earnItem } from "../album/items/ledger";`, ["convex/stickers/stickers.ts earnItem"]],
    ["a renamed import over lines", `import {\n  type Earning,\n  earnItem as earn,\n} from '../album/items/ledger';`, ["convex/stickers/stickers.ts earnItem"]],
    ["a namespace import of another module, whatever it uses", `import * as ledger from "../album/items/ledger.ts";\nconst { earnItem } = ledger;`, ["convex/stickers/stickers.ts namespace:convex/album/items/ledger"]],
    ["a named import with its extension", `import { earnItem } from "../album/items/ledger.ts";`, ["convex/stickers/stickers.ts earnItem"]],
    ["a re-export", `export { earnItem } from "../album/items/ledger";`, ["convex/stickers/stickers.ts earnItem"]],
    ["a query in single quotes", `await ctx.db.query('items').collect();`, ["convex/stickers/stickers.ts table:items"]],
    ["a query spaced from its table", `await ctx.db.query ( "items" ).collect();`, ["convex/stickers/stickers.ts table:items"]],
    ["a star re-export of another module", `export * from "../album/items/ledger";`, ["convex/stickers/stickers.ts namespace:convex/album/items/ledger"]],
    ["a named star re-export of another module", `export * as ledger from "../album/items/ledger";`, ["convex/stickers/stickers.ts namespace:convex/album/items/ledger"]],
    ["a namespace import beside a default import", `import ledger, * as all from "../album/items/ledger";`, ["convex/stickers/stickers.ts namespace:convex/album/items/ledger"]],
    ["a wrapper of a write in a module that writes rewards", `import { earnWelcomeItem } from "../album/items/welcome";`, ["convex/stickers/stickers.ts earnWelcomeItem"]],
    ["a read of a module that writes rewards", `import { standingOf } from "../progression/progression";`, []],
    ["a query with a type argument", `await ctx.db.query<"items">("items").collect();`, ["convex/stickers/stickers.ts table:items"]],
    ["a query whose table the guard can't read", `await ctx.db.query(tableName).collect();`, ["convex/stickers/stickers.ts query:tableName"]],
    ["a type-only import", `import type { earnItem } from "../album/items/ledger";`, []],
    ["the module's own write and table", `import { insertSticker } from "./records";\nawait ctx.db.query("stickers").collect();`, []],
  ])("finds %s", (_, source, crossings) => {
    expect(crossingsOf("/convex/stickers/stickers.ts", source)).toEqual(crossings);
  });

  test.each([
    ["an exported function", `export async function earnBonus(ctx: MutationCtx, member: MemberId) {}`, ["earnBonus"]],
    ["an exported function with a type parameter", `export function earnAll<T extends Item>(ctx: MutationCtx, items: T[]) {}`, ["earnAll"]],
    ["an exported function whose context is destructured", `export function earnBonus({ db }: MutationCtx) {}`, ["earnBonus"]],
    ["an exported arrow", `export const earnBonus = async (ctx: MutationCtx) => {};`, ["earnBonus"]],
    ["an exported wrapped arrow", `export const earnBonus = withBudget(async (ctx: MutationCtx) => {});`, ["earnBonus"]],
    ["a function exported in a list", `async function earnBonus(ctx: MutationCtx) {}\nexport { earnBonus };`, ["earnBonus"]],
    ["a function exported under another name", `async function earn(ctx: MutationCtx) {}\nexport { earn as earnBonus };`, ["earnBonus"]],
    ["a re-export it can't read", `export { earn as earnBonus } from "./ledger";`, ["earnBonus"]],
    ["a destructured export it can't read", `export const { earnBonus, levels: levelOf = level } = writers;`, ["earnBonus", "levelOf"]],
    ["a read", `export async function standingOf(ctx: QueryCtx, member: MemberId) {}`, []],
    ["a read that also takes a mutation's context", `export function xpLevelsShownIn(ctx: QueryCtx | MutationCtx, workspace: string) {}`, []],
    ["a constant", `export const hugXp = 1;\nfunction earn(ctx: MutationCtx) {}`, []],
    ["a read exported in a list", `function standingOf(ctx: QueryCtx) {}\nexport { standingOf, type Standing };`, []],
    ["a type-only list", `export type { Earning } from "./ledger";`, []],
  ])("reads %s of a module that writes rewards", (_, source, writes) => {
    expect(writeFunctionsIn(source)).toEqual(writes);
  });
});

function everyCrossing() {
  return [...new Set(Object.entries(sources).flatMap(([path, source]) => crossingsOf(path, source)))];
}

function crossingsOf(path: string, source: string) {
  return [...writesImportedBy(path, source), ...wholeModulesReachedBy(path, source), ...tablesQueriedBy(path, source)];
}

function writesImportedBy(path: string, source: string) {
  return namedImportsOf(source)
    .filter(({ from }) => isAnotherModule(path, from))
    .flatMap(({ names, from }) => names.filter((name) => writeFunctionsOf(resolved(path, from)).includes(name)))
    .map((name) => `${fileOf(path)} ${name}`);
}

function writeFunctionsOf(target: string) {
  const place = placeThatWritesRewardsOf(target);
  if (place === undefined) return [];
  return Object.entries(sources)
    .filter(([path]) => placeThatWritesRewardsOf(path) === place)
    .flatMap(([, source]) => writeFunctionsIn(source));
}

function placeThatWritesRewardsOf(path: string) {
  return placesThatWriteRewards.find((place) => path.startsWith(`/convex/${place}/`));
}

type Exported = { name: string; local: string | null };

function writeFunctionsIn(source: string) {
  return exportsOf(source)
    .filter(({ local }) => local === null || takesMutationCtx(source, local))
    .map(({ name }) => name);
}

function exportsOf(source: string): Exported[] {
  return [...declaredExportsOf(source), ...destructuredExportsOf(source), ...listedExportsOf(source)];
}

function declaredExportsOf(source: string): Exported[] {
  return [...source.matchAll(/export\s+(?:async\s+)?(?:function\s*\*?\s*|(?:const|let|var)\s+)(\w+)/g)].map(([, name = ""]) => ({ name, local: name }));
}

function destructuredExportsOf(source: string): Exported[] {
  return [...source.matchAll(/export\s+(?:const|let|var)\s+[{[]([^}\]]*)/g)].flatMap(([, bindings = ""]) => bindings.split(",").flatMap(boundNameOf).map((name) => ({ name, local: null })));
}

function boundNameOf(binding: string) {
  const [target = ""] = binding.split("=", 1);
  const name = target.split(":").at(-1)?.trim() ?? "";
  return /^\w+$/.test(name) ? [name] : [];
}

function listedExportsOf(source: string): Exported[] {
  return [...source.matchAll(/export\s+(type\s+)?\{([^}]*)\}(\s*from\b)?/g)].flatMap(([, typeOnly, specifiers = "", from]) =>
    typeOnly === undefined ? specifiers.split(",").flatMap((specifier) => listedExportOf(specifier, from !== undefined)) : [],
  );
}

function listedExportOf(specifier: string, reexported: boolean): Exported[] {
  const [local = "", name = local] = specifier.trim().split(/\s+as\s+/);
  if (local === "" || local.startsWith("type ")) return [];
  return [{ name, local: reexported ? null : local }];
}

function takesMutationCtx(source: string, local: string) {
  return [...source.matchAll(new RegExp(String.raw`(?:function\s*\*?\s*|(?:const|let|var)\s+)${local}\b`, "g"))].some(({ index }) => needsAMutationCtx(signatureFrom(source, index)));
}

function needsAMutationCtx(signature: string) {
  return /MutationCtx\b/.test(signature) && !/QueryCtx\b/.test(signature);
}

function signatureFrom(source: string, start: number) {
  const open = source.indexOf("(", start);
  const end = source.indexOf(";", start);
  if (open === -1 || (end !== -1 && end < open)) return source.slice(start, end === -1 ? undefined : end);
  let depth = 0;
  for (let at = open; at < source.length; at += 1) {
    if (source[at] === "(") depth += 1;
    if (source[at] === ")" && (depth -= 1) === 0) return source.slice(start, at + 1);
  }
  return source.slice(start);
}

function wholeModulesReachedBy(path: string, source: string) {
  return [...source.matchAll(/(?:import\s+(?:\w+\s*,\s*)?\*\s+as\s+\w+|export\s+\*(?:\s+as\s+\w+)?)\s+from\s*["']([^"']+)["']/g)]
    .map(([, from = ""]) => from)
    .filter((from) => isAnotherModule(path, from))
    .map((from) => `${fileOf(path)} namespace:${fileOf(resolved(path, from))}`);
}

function isAnotherModule(path: string, from: string) {
  return from.startsWith(".") && moduleOf(resolved(path, from)) !== moduleOf(path);
}

function tablesQueriedBy(path: string, source: string) {
  return [...source.matchAll(/\.query\s*(?:<[^>]*>)?\s*\(\s*([^),]*)/g)].flatMap(([, argument = ""]) => {
    const table = /^["'`](\w+)["'`]$/.exec(argument.trim())?.[1];
    if (table === undefined) return [`${fileOf(path)} query:${argument.trim()}`];
    return ownerOf(table) !== undefined && ownerOf(table) !== moduleOf(path) ? [`${fileOf(path)} table:${table}`] : [];
  });
}

function namedImportsOf(source: string) {
  return [...source.matchAll(/(?:import|export)\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)].map(([, typeOnly, names = "", from = ""]) => ({
    names: typeOnly === undefined ? names.split(",").flatMap(valueNameOf) : [],
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
  return parts.join("/").replace(/\.ts$/, "");
}

function moduleOf(path: string) {
  const [, , module = "", ...rest] = path.split("/");
  return rest.length === 0 ? "" : module;
}

function fileOf(path: string) {
  return path.slice(1);
}
