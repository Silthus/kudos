import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, offForEveryone, onForEveryone, onInTheSandboxOnly, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHome, publishedHomeBlocks, readBlocks, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { achievementsLiveIn } from "../achievements/flag";
import { publish } from "../bus/publish";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const achievements = "achievements";
const bookTables = ["bookLaunches", "bookReplays", "ladderCounts", "countedAwards", "ladderMarks", "earnedTiers"] as const;
const inDm = { channel: "D_CAROL", ts: "1760435000.000200" };

type BookTurnedOff = { reason: string; flags: FlagDefinition[] };

const bookTurnedOff: BookTurnedOff[] = [
  { reason: "achievements turned off", flags: [onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone(achievements), onForEveryone("quests"), onForEveryone("skill-tree")] },
  { reason: "unlocks turned off", flags: [onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone(achievements), onForEveryone("quests")] },
  { reason: "xp-levels turned off", flags: [offForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone(achievements), onForEveryone("quests")] },
];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the Book applies only where achievements, xp-levels and unlocks all apply, whatever skill-tree says", () => {
  test.each<[string, () => Promise<Backend>]>([
    ["achievements turned off, skill-tree on", () => launchedWithoutTheBook(onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone(achievements), onForEveryone("skill-tree"), onForEveryone("quests"))],
    ["achievements not created in PostHog", () => launchedWithoutTheBook(onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("quests"))],
    ["the flags key missing", () => flagsKeyMissing(launchedWithoutTheBook(...allOn()))],
    ["achievements on but unlocks off and never launched", () => workspaceDeciding("sandbox", onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone(achievements), onForEveryone("quests"))],
    ["achievements on but unlocks turned off after its launch", () => launchedWithoutTheBook(onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone(achievements), onForEveryone("quests"))],
    ["achievements on but xp-levels off", () => launchedWithoutTheBook(offForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone(achievements), onForEveryone("quests"))],
    ["all three on in the sandbox only, read in production", () => workspaceDeciding("production", ...["xp-levels", "unlocks", achievements, "quests"].map(onInTheSandboxOnly))],
  ])("%s: kudos earn no tier and record nothing, and no DM, public line or App Home names the Book, a tier or the two-days step", async (_, workspace) => {
    const t = await workspace();
    await membersWithHistory(t);

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await giveKudos(t, "U_CAROL", "U_BOB", saysWhy);
    for (const user of ["U_ALICE", "U_BOB", "U_CAROL"]) await openHome(t, user);
    await sweeps(t);

    expect(everyLineShown().filter(namesTheBook)).toEqual([]);
    expect(await bookRows(t)).toEqual(nothingRecorded());
    expect(await bookOpenedBy(t)).toEqual([{ user: "U_ALICE", openedAt: 0 }]);
    expect(publishedTypes()).toEqual([]);
    expect(exposures()).not.toContainEqual([achievements, true]);
  }, 30_000);
});

describe("a stale crate button from when the Book applied writes nothing and publishes nothing", () => {
  test.each(bookTurnedOff)("$reason: Open on the Book's crate in the level-up DM and in App Home opens nothing", async ({ flags }) => {
    const t = await bookLaunchedDeciding(...allOn());
    await membersWithHistory(t);
    await giveKudos(t, "U_CAROL", "U_BOB", saysWhy);
    await openHome(t, "U_CAROL");
    const openInDm = buttonBeside(blocksOf(levelUpDmsTo("U_CAROL").at(-1)!), "*Book* is ready", "Open");
    const openInHome = buttonBeside(publishedHomeBlocks(slack, "U_CAROL"), "*Book* is ready", "Open");
    const opened = await bookOpenedBy(t);
    const dms = dmsTo("U_CAROL").length;
    vi.mocked(publish).mockClear();
    await flagsFromPostHog(t, postHog, ...flags);

    const responses = [await send(t, blockActions("U_CAROL", openInDm, { inMessage: inDm })), await send(t, blockActions("U_CAROL", openInHome))];

    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect(opened).toEqual([{ user: "U_ALICE", openedAt: 0 }]);
    expect(await bookOpenedBy(t)).toEqual(opened);
    expect(publishedTypes()).toEqual([]);
    expect(dmsTo("U_CAROL")).toHaveLength(dms);
    expect(publishedHome(slack, "U_CAROL").filter(namesTheBook)).toEqual([]);
  }, 30_000);
});

describe("O35: turning the Book off and on again loses nothing", () => {
  test.each(bookTurnedOff)("$reason hides the Book while kudos still count and earn, announces nothing earned meanwhile, and turning it back on shows every tier, with no replay run twice", async ({ flags }) => {
    const t = await bookLaunchedDeciding(...allOn());
    await membersWithHistory(t);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await withGiven(t, "U_ALICE", 24);
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Book")));
    const shownBefore = publishedHome(slack, "U_ALICE");
    const storedBefore = await bookRows(t);
    const toldBefore = { dms: tierDmsTo("U_ALICE"), lines: tierLinesIn("C1"), stored: await toldRows(t) };

    await flagsFromPostHog(t, postHog, ...flags);
    const silverAt = await giveKudos(t, "U_ALICE", "U_CAROL", saysWhy);
    await openHome(t, "U_ALICE");
    await sweeps(t);
    const whileOff = publishedHome(slack, "U_ALICE");
    const storedWhileOff = await bookRows(t);
    const toldWhileOff = await toldRows(t);
    await flagsFromPostHog(t, postHog, ...allOn());
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Book")));
    await sweeps(t);

    expect(shownBefore).toContain("section: 🥉 *First Thanks* · earned Oct 14, 2026");
    expect(toldBefore.dms).toHaveLength(1);
    expect(whileOff.filter(namesTheBook)).toEqual([]);
    expect(storedWhileOff.earnedTiers).toEqual(expect.arrayContaining(storedBefore.earnedTiers));
    expect(storedWhileOff.earnedTiers).toContainEqual({ user: "U_ALICE", ladder: "generosity", tier: "silver", earnedAt: silverAt });
    expect(await bookRows(t)).toEqual(storedWhileOff);
    expect(storedWhileOff.bookLaunches).toEqual(storedBefore.bookLaunches);
    expect(storedWhileOff.bookReplays).toEqual(storedBefore.bookReplays);
    expect(publishedHome(slack, "U_ALICE")).toContain("section: 🥈 *Generous Soul* · earned Oct 14, 2026");
    expect(publishedHome(slack, "U_ALICE").filter((line) => !line.includes("Generous") && !line.startsWith("context: Next"))).toEqual(expect.arrayContaining(shownBefore.filter((line) => line.includes("earned"))));
    expect(toldBefore.stored.tierNotices).toHaveLength(1);
    expect(toldWhileOff).toEqual(toldBefore.stored);
    expect(await toldRows(t)).toEqual(toldBefore.stored);
    expect(tierDmsTo("U_ALICE")).toEqual(toldBefore.dms);
    expect(tierLinesIn("C1")).toEqual(toldBefore.lines);
  }, 30_000);
});

describe("a tier the Book's replay earns while the Book doesn't apply is never announced", () => {
  test.each(bookTurnedOff)("$reason while the launch's replay still runs: a member who opens the Book once it is back gets no DM for the tier, and the Book shows it", async ({ flags }) => {
    const t = await launchedWithoutTheBook(...allOn(offForEveryone(achievements)));
    await membersWithHistory(t);
    await giveKudos(t, "U_CAROL", "U_BOB", saysWhy);
    await flagsFromPostHog(t, postHog, ...allOn());
    await t.run((ctx) => achievementsLiveIn(ctx, "T1"));
    await flagsFromPostHog(t, postHog, ...flags);
    await settle(t);

    await flagsFromPostHog(t, postHog, ...allOn());
    await sweeps(t);
    await openHome(t, "U_CAROL");
    await send(t, blockActions("U_CAROL", buttonBeside(publishedHomeBlocks(slack, "U_CAROL"), "*Book* is ready", "Open")));
    await send(t, blockActions("U_CAROL", buttonInHome(slack, "U_CAROL", "Book")));

    expect(publishedHome(slack, "U_CAROL")).toContain("section: 🥉 *First Thanks* · earned Oct 14, 2026");
    expect(tierDmsTo("U_CAROL")).toEqual([]);
    expect(tierLinesIn("C1")).toEqual([]);
  }, 30_000);
});

describe("O36: achievements exposure", () => {
  test("is sent once per member and value, from the App Home opening", async () => {
    const t = await bookLaunchedDeciding(...allOn());
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await flagsFromPostHog(t, postHog, ...allOn(offForEveryone(achievements)));
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    expect(exposures()).toEqual([
      [achievements, true],
      [achievements, false],
    ]);
  });

  test("is sent once for each member of a kudos who never opened App Home, whose tiers the flag decides to announce", async () => {
    const t = await bookLaunchedDeciding(...allOn());

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(await exposedIn(t)).toEqual([
      { user: "U_ALICE", value: true },
      { user: "U_BOB", value: true },
    ]);
  });

  test.each([
    ["xp-levels is off", [offForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone(achievements)]],
    ["unlocks is off", [onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone(achievements)]],
  ])("is never sent while %s, since achievements then decides nothing", async (_, flags) => {
    const t = await launchedWithoutTheBook(...flags);

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");

    expect(exposures()).toEqual([]);
  });
});

function allOn(book: FlagDefinition = onForEveryone(achievements)) {
  return [onForEveryone("xp-levels"), onForEveryone("unlocks"), book, onForEveryone("quests")];
}

async function workspaceDeciding(environment: "sandbox" | "production", ...definitions: FlagDefinition[]) {
  postHog = postHogDeciding(environment);
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return flagsFromPostHog(t, postHog, ...definitions);
}

async function launchedWithoutTheBook(...definitions: FlagDefinition[]) {
  const t = await unlocksShippedBeforeAnyoneJoined(await workspaceDeciding("sandbox", ...allOn(offForEveryone(achievements))));
  return flagsFromPostHog(t, postHog, ...definitions);
}

async function bookLaunchedDeciding(...definitions: FlagDefinition[]) {
  return bookShippedBeforeAnyoneJoined(await workspaceDeciding("sandbox", ...definitions));
}

async function flagsKeyMissing(workspace: Promise<Backend>) {
  const t = await workspace;
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
  return t;
}

async function membersWithHistory(t: Backend) {
  await t.run(async (ctx) => {
    const insertMember = (user: string) => ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: "UTC" });
    const [alice, bob, carol] = [await insertMember("U_ALICE"), await insertMember("U_BOB"), await insertMember("U_CAROL")];
    await ctx.db.insert("memberProgress", { member: alice, xp: 400, pointsSpent: 0 });
    await ctx.db.insert("memberProgress", { member: bob, xp: 0, pointsSpent: 0 });
    await ctx.db.insert("memberProgress", { member: carol, xp: 295, pointsSpent: 0 });
    await ctx.db.insert("unlocks", { member: alice, feature: "book", readyAt: 0, openedAt: 0 });
  });
}

async function withGiven(t: Backend, user: string, count: number) {
  await t.run(async (ctx) => {
    const member = await memberOf(ctx, user);
    const row = (await ctx.db.query("ladderCounts").collect()).find((counted) => counted.member === member && counted.ladder === "generosity")!;
    await ctx.db.patch(row._id, { count });
  });
}

async function sweeps(t: Backend) {
  await t.mutation(internal.unlocks.sweep.sweep, {});
  await t.mutation(internal.quests.newWeek.sweep, {});
  await settle(t);
}

function namesTheBook(line: string) {
  return /Book|achievement|🏅|🥉|🥈|Generosity|Recognition|Connections|Dependability|Applause|Seasons|Old Friends|2 different days/.test(line);
}

function everyLineShown() {
  const posts = slack.callsTo("chat.postMessage").flatMap((post) => (post.blocks === undefined ? String(post.text).split("\n") : readBlocks(post.blocks as Block[])));
  const replies = slack.callsTo("chat.postEphemeral").flatMap(({ text }) => String(text).split("\n"));
  const homes = ["U_ALICE", "U_BOB", "U_CAROL"].flatMap((user) => (slack.homeShownTo(user) === undefined ? [] : publishedHome(slack, user)));
  return [...posts, ...replies, ...homes];
}

function dmsTo(user: string) {
  return slack.callsTo("chat.postMessage").filter(({ channel }) => channel === user || channel === inDm.channel);
}

function levelUpDmsTo(user: string) {
  return dmsTo(user).filter(({ text }) => String(text).startsWith("🎉"));
}

function tierDmsTo(user: string) {
  return dmsTo(user)
    .map(({ text }) => String(text))
    .filter((dm) => dm.startsWith("🏅"));
}

function tierLinesIn(channel: string) {
  return slack
    .messagesIn(channel)
    .flatMap(({ text }) => String(text).split("\n"))
    .filter((line) => line.startsWith("🏅"));
}

function blocksOf(dm: Record<string, unknown>) {
  expect(dm.blocks, "the DM's blocks").toBeDefined();
  return dm.blocks as Block[];
}

function buttonBeside(blocks: Block[], beside: string, label: string) {
  return buttonIn(
    blocks.filter((block) => readBlocks([block])[0]!.includes(beside)),
    label,
  );
}

function nothingRecorded() {
  return Object.fromEntries(bookTables.map((table) => [table, []]));
}

async function bookRows(t: Backend) {
  return t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of bookTables) {
      const stored = await ctx.db.query(table).collect();
      const read = await Promise.all(
        stored.map(async (row) => {
          const { _id, _creationTime, member, award, batch, ...rest } = row as Record<string, unknown>;
          if (table === "earnedTiers") return { user: (await ctx.db.get(member as MemberId))!.user, ladder: rest.ladder, tier: rest.tier, earnedAt: rest.earnedAt };
          return member === undefined ? rest : { user: (await ctx.db.get(member as MemberId))!.user, ...rest };
        }),
      );
      rows[table] = read.sort((one, other) => JSON.stringify(one).localeCompare(JSON.stringify(other)));
    }
    return rows as Record<(typeof bookTables)[number], unknown[]>;
  });
}

async function toldRows(t: Backend) {
  return t.run(async (ctx) => ({
    tierNotices: (await ctx.db.query("tierNotices").collect()).map(({ tiers }) => tiers),
    tierSummaries: (await ctx.db.query("tierSummaries").collect()).map(({ tiers }) => tiers),
    tierLines: (await ctx.db.query("publicReplies").collect()).flatMap(({ sections }) => sections.filter(({ about }) => about !== "level")),
  }));
}

async function bookOpenedBy(t: Backend) {
  return t.run(async (ctx) => {
    const opened = (await ctx.db.query("unlocks").collect()).filter(({ feature, openedAt }) => feature === "book" && openedAt !== undefined);
    return Promise.all(opened.map(async ({ member, openedAt }) => ({ user: (await ctx.db.get(member))!.user, openedAt })));
  });
}

function publishedTypes() {
  return vi.mocked(publish).mock.calls.map(([, event]) => event.type).filter((type) => type === "achievementEarned" || type === "unlockOpened");
}

async function exposedIn(t: Backend) {
  return t.run(async (ctx) => {
    const rows = (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flag === achievements);
    return Promise.all(rows.map(async ({ member, value }) => ({ user: (await ctx.db.get(member))!.user, value })));
  });
}

function exposures() {
  const sent = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === achievements);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => [properties.$feature_flag, properties.$feature_flag_response]);
}

async function memberOf(ctx: Parameters<Parameters<Backend["run"]>[0]>[0], user: string): Promise<MemberId> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const sentAt = Math.floor(Date.now() / 1000) + sentMessages;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${sentAt}.000100` })));
  await settle(t);
  return sentAt * 1000;
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settle(t);
  return response;
}
