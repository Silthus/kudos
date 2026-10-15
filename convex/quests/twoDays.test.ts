import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHome, publishedHomeBlocks, readBlocks, type Block, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { DomainEvent, KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import type { Notification } from "../feedback/notify";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const monday = Date.parse("2026-10-12T09:00:00Z");
const tuesday = Date.parse("2026-10-13T10:00:00Z");
const wednesday = Date.parse("2026-10-14T10:00:00Z");
const thursday = Date.parse("2026-10-15T10:00:00Z");
const minuteMs = 60_000;
const saysWhy = "thanks for untangling the release notes today";
const saysWhyDecision = { gate: { version: 1, thoughtful: true, words: 7 } };
const form = { contentType: "application/x-www-form-urlencoded" };
const twoDaysActive = "section: *Journey:* Give kudos that say why on 2 different days. It pays *30 XP*.";
const twoDaysCondition = "context: It counts when your message has 5 or more words besides mentions and emoji.";
const twoDaysDone = "section: *Journey:* ✅ Give kudos that say why on 2 different days. You earned *30 XP*. [button: Open]";
const finishedTwoDays = "✅ You finished a Journey step: Give kudos that say why on 2 different days. You earned *30 XP*.";
const twoDaysReward = { xp: 30, coins: 0, item: null };
const firstThanksDone = "section: *Journey:* ✅ Give a kudos that says why. You earned *10 XP*. [button: Open]";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: monday });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests", "achievements");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P88 P89: opening the Book makes two-days active, and kudos that say why on 2 different days finish it", () => {
  test("a member opens the Book and sees two-days active; kudos that say why on Monday and Wednesday record one 30 XP reward record, send the finished DM with Open, and Wednesday's reply says Quest done", async () => {
    const t = await workspace();
    await openBook(t, "U_ALICE");

    expect(journeyIn(publishedHome(slack, "U_ALICE")).slice(-2)).toEqual([twoDaysActive, twoDaysCondition]);

    aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    vi.setSystemTime(wednesday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([{ key: "journey:two-days", xp: 30, catalogueVersion: "2", at: wednesday }]);
    expect(journeyDmsTo("U_ALICE").map(({ text }) => text)).toContain(finishedTwoDays);
    expect(readBlocks(journeyDmsTo("U_ALICE").at(-1)!.blocks as Block[])).toEqual([`section: ${finishedTwoDays} [button: Open]`]);
    expect(lastReplyTo("U_ALICE").at(-1)).toBe("+10 XP · Quest done: Give kudos that say why on 2 different days (+30 XP)");
    expect(journeyIn(publishedHome(slack, "U_ALICE")).at(-1)).toBe(twoDaysDone);
  });


  test("questsOf gives two-days with its activation time, promised reward, catalogue version and finish time", async () => {
    const { t, alice, bob } = await membersInDirectory();
    await opened(t, alice, "book", monday);
    await followKudosGiven(t, await thoughtfulKudos(t, alice, bob, monday + minuteMs, "2026-10-12"));
    await followKudosGiven(t, await thoughtfulKudos(t, alice, bob, wednesday, "2026-10-14"));

    expect(await twoDaysOf(t, alice)).toEqual({ step: "two-days", activatedAt: monday, reward: twoDaysReward, catalogueVersion: "2", finishedAt: wednesday, openedAt: null });
  });
});

describe("P90: two-days has its own finishing rule, never someone-new's", () => {
  test("two kudos that say why on one day don't finish it", async () => {
    const t = await workspace();
    await openBook(t, "U_ALICE");

    aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_CAROL", saysWhy);

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([]);
  });

  test("a kudos that says why from before the Book was opened doesn't count, and the next day's kudos after the opening does", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    vi.setSystemTime(tuesday);
    await openBook(t, "U_ALICE");

    vi.setSystemTime(wednesday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([]);

    vi.setSystemTime(thursday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([{ key: "journey:two-days", xp: 30, catalogueVersion: "2", at: thursday }]);
  });

  test("a member who already thanked every other member doesn't finish two-days when the Book opens", async () => {
    slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
    postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests", "achievements");
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");

    aMinuteLater();
    await openBook(t, "U_ALICE");

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([]);
    expect(journeyIn(publishedHome(slack, "U_ALICE")).slice(-2)).toEqual([twoDaysActive, twoDaysCondition]);
  });

  test("a kudos to someone never thanked before, given after the opening and read before the activation, doesn't finish it", async () => {
    const t = await workspace();
    await bookReady(t, "U_ALICE");
    const alice = await memberOf(t, "U_ALICE");
    const openedAt = aMinuteLater();
    await t.run(async (ctx) => {
      const unlock = (await ctx.db.query("unlocks").collect()).find((row) => row.member === alice && row.feature === "book")!;
      await ctx.db.patch(unlock._id, { openedAt });
    });
    aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");

    aMinuteLater();
    await openHome(t, "U_ALICE");

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([]);
    expect((await twoDaysOf(t, alice))?.activatedAt).toBe(openedAt);
  });

  test("kudos that say why on 2 days finish it from the gate decisions the engine stored, before progression has recorded their effects", async () => {
    const { t, alice, bob } = await membersInDirectory();
    await opened(t, alice, "book", monday);
    const first = await thoughtfulKudos(t, alice, bob, monday + minuteMs, "2026-10-12");
    const second = await thoughtfulKudos(t, alice, bob, wednesday, "2026-10-14");

    await followKudosGiven(t, first);
    await followKudosGiven(t, second);

    expect(await effectsRecordCount(t)).toBe(0);
    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([{ key: "journey:two-days", xp: 30, catalogueVersion: "2", at: wednesday }]);
  });

  test("a kudosGiven counts only awards up to its own: Monday's, read after Wednesday's award is stored, doesn't finish it, and Wednesday's does", async () => {
    const { t, alice, bob } = await membersInDirectory();
    await opened(t, alice, "book", monday);
    const first = await thoughtfulKudos(t, alice, bob, monday + minuteMs, "2026-10-12");
    const second = await thoughtfulKudos(t, alice, bob, wednesday, "2026-10-14");

    await followKudosGiven(t, first);

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([]);

    await followKudosGiven(t, second);

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([{ key: "journey:two-days", xp: 30, catalogueVersion: "2", at: wednesday }]);
  });

  test("Wednesday's kudosGiven followed late by Monday's finishes it dated Wednesday, the later of its two days", async () => {
    const { t, alice, bob } = await membersInDirectory();
    await opened(t, alice, "book", monday);
    const first = await thoughtfulKudos(t, alice, bob, monday + minuteMs, "2026-10-12");
    const second = await thoughtfulKudos(t, alice, bob, wednesday, "2026-10-14");

    await followKudosGiven(t, second);
    await followKudosGiven(t, first);

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([{ key: "journey:two-days", xp: 30, catalogueVersion: "2", at: wednesday }]);
  });

  test("AT25: Wednesday's kudos, which finishes it at its own instant, is its cause", async () => {
    const { t, alice, bob } = await membersInDirectory();
    await opened(t, alice, "book", monday);
    const mondayKudos = await thoughtfulKudos(t, alice, bob, monday + minuteMs, "2026-10-12");
    const wednesdayKudos = await thoughtfulKudos(t, alice, bob, wednesday, "2026-10-14");

    await followKudosGiven(t, mondayKudos);
    await followKudosGiven(t, wednesdayKudos);

    expect(await twoDaysCauseOf(t)).toEqual({ at: wednesday, cause: wednesdayKudos.message });
  });

  test("AT25: Monday's kudos followed late, finishing it at Wednesday's instant, records no cause", async () => {
    const { t, alice, bob } = await membersInDirectory();
    await opened(t, alice, "book", monday);
    const mondayKudos = await thoughtfulKudos(t, alice, bob, monday + minuteMs, "2026-10-12");
    const wednesdayKudos = await thoughtfulKudos(t, alice, bob, wednesday, "2026-10-14");

    await followKudosGiven(t, wednesdayKudos);
    await followKudosGiven(t, mondayKudos);

    expect(await twoDaysCauseOf(t)).toEqual({ at: wednesday, cause: undefined });
  });

  test("a member who gave 4,100 kudos without saying why since the opening finishes it on the second day that says why, within Convex's transaction limits", async () => {
    const t = await bookShippedBeforeAnyoneJoined(await flagsLoaded(testBackend({ transactionLimits: true })));
    const [alice, bob] = await t.run(async (ctx) => {
      await ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 });
      return [await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }), await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" })];
    });
    await opened(t, alice!, "book", monday);
    await followKudosGiven(t, await thoughtfulKudos(t, alice!, bob!, monday + minuteMs, "2026-10-12"));
    for (let batch = 0; batch < 41; batch++) {
      await t.run(async (ctx) => {
        for (let index = 0; index < 100; index++) {
          const at = tuesday + batch * 100 + index;
          await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `${at}`, giver: alice!, recipient: bob!, kudos: 1, day: "2026-10-13", at });
        }
      });
    }

    await followKudosGiven(t, await thoughtfulKudos(t, alice!, bob!, wednesday, "2026-10-14"));

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([{ key: "journey:two-days", xp: 30, catalogueVersion: "2", at: wednesday }]);
  }, 120_000);

  test("kudos that say why on 2 days after the opening, read before the activation's subscriber runs, finish it at the second", async () => {
    const { t, alice, bob } = await membersInDirectory();
    await followKudosGiven(t, await thoughtfulKudos(t, alice, bob, monday + minuteMs, "2026-10-12"));
    await followKudosGiven(t, await thoughtfulKudos(t, alice, bob, wednesday, "2026-10-14"));
    vi.setSystemTime(wednesday + minuteMs);

    await opened(t, alice, "book", monday);

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([{ key: "journey:two-days", xp: 30, catalogueVersion: "2", at: wednesday }]);
  });
});

describe("P87 P90: two-days finishes once", () => {
  test("Wednesday's kudosGiven delivered twice and the opening delivered twice record one reward record and one questFinished for the step", async () => {
    const { t, alice, bob } = await membersInDirectory();
    await opened(t, alice, "book", monday);
    await followKudosGiven(t, await thoughtfulKudos(t, alice, bob, monday + minuteMs, "2026-10-12"));
    const finishing = await thoughtfulKudos(t, alice, bob, wednesday, "2026-10-14");

    await followKudosGiven(t, finishing);
    await followKudosGiven(t, finishing);
    await opened(t, alice, "book", monday);

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([{ key: "journey:two-days", xp: 30, catalogueVersion: "2", at: wednesday }]);
    expect(journeyFinished("two-days")).toHaveLength(1);
    expect(await activationsOf(t, "two-days")).toBe(1);
  });
});

describe("P91: two-days works whether the Book ships before the Journey or after it", () => {
  test("the Book shipping before the Journey: a member with the Book open gets two-days at the Journey's join, once, counting from then", async () => {
    postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "achievements");
    const t = await workspaceWith("U_ALICE", "U_BOB", "U_CAROL");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await bookShippedBeforeAnyoneJoined(t);

    vi.setSystemTime(tuesday);
    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "achievements", "quests"));
    await hourlySweep(t);
    await hourlySweep(t);

    const alice = await memberOf(t, "U_ALICE");
    expect(await twoDaysOf(t, alice)).toEqual({ step: "two-days", activatedAt: tuesday, reward: twoDaysReward, catalogueVersion: "2", finishedAt: null, openedAt: null });

    aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    vi.setSystemTime(wednesday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect((await twoDaysOf(t, alice))?.finishedAt).toBe(wednesday);
    expect(await activationsOf(t, "two-days")).toBe(3);
  });

  test("a Book opened before the Journey shipped, which didn't apply at the join, makes two-days active from the App Home publish that finds it applying again", async () => {
    postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "achievements");
    const t = await workspaceWith("U_ALICE", "U_BOB", "U_CAROL");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await bookShippedBeforeAnyoneJoined(t);

    vi.setSystemTime(tuesday);
    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests"));
    await hourlySweep(t);
    await hourlySweep(t);
    expect(await activationsOf(t, "two-days")).toBe(0);

    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests", "achievements"));
    vi.setSystemTime(wednesday);
    await openHome(t, "U_ALICE");

    const alice = await memberOf(t, "U_ALICE");
    expect(await twoDaysOf(t, alice)).toEqual({ step: "two-days", activatedAt: expect.any(Number), reward: twoDaysReward, catalogueVersion: "2", finishedAt: null, openedAt: null });
    expect((await twoDaysOf(t, alice))!.activatedAt).toBeGreaterThanOrEqual(wednesday);
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toContain(twoDaysActive);

    aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    vi.setSystemTime(thursday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect((await twoDaysOf(t, alice))?.finishedAt).toBe(thursday);
  });

  test("the stranded two-days activates on any App Home publish, even one that opens on a remembered Settings tab", async () => {
    postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "achievements");
    const t = await workspaceWith("U_ALICE", "U_BOB", "U_CAROL");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await bookShippedBeforeAnyoneJoined(t);
    vi.setSystemTime(tuesday);
    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests"));
    await hourlySweep(t);
    await hourlySweep(t);
    const alice = await memberOf(t, "U_ALICE");
    await t.run((ctx) => ctx.db.insert("homeSelections", { member: alice, tab: "settings", period: "week" }));

    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests", "achievements"));
    vi.setSystemTime(wednesday);
    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain("actions: Profile | Book | [Settings]");
    expect((await twoDaysOf(t, alice))!.activatedAt).toBeGreaterThanOrEqual(wednesday);
  });

  test("a stranded two-days activates within Convex's transaction limits for a member who gave 4,100 kudos while the Book didn't apply", async () => {
    postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "achievements");
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    await t.run(async (ctx) => {
      await ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 });
      for (const user of ["U_ALICE", "U_BOB"]) await ctx.db.insert("members", { workspace: "T1", user, kind: "member" });
    });
    await bookShippedBeforeAnyoneJoined(t);
    vi.setSystemTime(tuesday);
    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests"));
    await hourlySweep(t);
    await hourlySweep(t);
    const [alice, bob] = [await memberOf(t, "U_ALICE"), await memberOf(t, "U_BOB")];
    for (let batch = 0; batch < 41; batch++) {
      await t.run(async (ctx) => {
        for (let index = 0; index < 100; index++) {
          const at = tuesday + minuteMs + batch * 100 + index;
          await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `${at}`, giver: alice, recipient: bob, kudos: 1, day: "2026-10-13", at });
        }
      });
    }

    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests", "achievements"));
    vi.setSystemTime(wednesday);
    await openHome(t, "U_ALICE");

    expect((await twoDaysOf(t, alice))!.activatedAt).toBeGreaterThanOrEqual(wednesday);
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toContain(twoDaysActive);
  }, 120_000);

  test("the Book shipping after the Journey: opening it then makes two-days active from the opening", async () => {
    postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests");
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    vi.setSystemTime(tuesday);
    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests", "achievements"));
    await openBook(t, "U_ALICE");

    const alice = await memberOf(t, "U_ALICE");
    expect((await twoDaysOf(t, alice))?.activatedAt).toBe(await bookOpenedAt(t, alice));

    vi.setSystemTime(wednesday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    vi.setSystemTime(thursday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect((await twoDaysOf(t, alice))?.finishedAt).toBe(thursday);
  });
});

describe("P78: two-days exists only where the Book and quests both apply", () => {
  test("where the Book doesn't apply, an opening, the join and App Home activate nothing, and kudos that say why on 2 days record nothing", async () => {
    const { t, alice, bob } = await membersInDirectory();
    await t.run((ctx) => ctx.db.insert("unlocks", { member: alice, feature: "book", readyAt: monday, openedAt: monday }));
    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests"));

    await opened(t, alice, "book", monday);
    await t.mutation(internal.quests.join.joinJourney, { workspace: "T1", at: monday + minuteMs, member: alice });
    await followKudosGiven(t, await thoughtfulKudos(t, alice, bob, monday + minuteMs, "2026-10-12"));
    await followKudosGiven(t, await thoughtfulKudos(t, alice, bob, wednesday, "2026-10-14"));
    await openHome(t, "U_ALICE");

    expect(await activationsOf(t, "two-days")).toBe(0);
    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([]);
    expect(await journeyStepsOf(t, alice)).toEqual(["first-thanks"]);
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([firstThanksDone]);
  });

  test("where quests don't apply, kudos that say why on 2 days after the Book opened record nothing", async () => {
    const { t, alice, bob } = await membersInDirectory();
    await opened(t, alice, "book", monday);
    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "achievements"));

    await followKudosGiven(t, await thoughtfulKudos(t, alice, bob, monday + minuteMs, "2026-10-12"));
    await followKudosGiven(t, await thoughtfulKudos(t, alice, bob, wednesday, "2026-10-14"));

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([]);
  });

  test("turned off after activation, two-days hides from questsOf and App Home and records nothing", async () => {
    const t = await workspace();
    await openBook(t, "U_ALICE");
    aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests"), offForEveryone("achievements"));
    vi.setSystemTime(wednesday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");

    const alice = await memberOf(t, "U_ALICE");
    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([]);
    expect(await journeyStepsOf(t, alice)).toEqual(["first-thanks"]);
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([firstThanksDone]);
    expect(lastReplyTo("U_ALICE").join("\n")).not.toContain("2 different days");
  });

  test("a kudos that says why while the Book doesn't apply never counts: after it applies again, a second day only counts with another kudos that says why", async () => {
    const t = await workspace();
    await openBook(t, "U_ALICE");

    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests"), offForEveryone("achievements"));
    vi.setSystemTime(tuesday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests", "achievements"));
    vi.setSystemTime(wednesday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([]);
    vi.setSystemTime(thursday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    expect(await rewardRecordsOf(t, "journey:two-days")).toEqual([expect.objectContaining({ at: thursday })]);
  });

  test("turned off after it finished, a stale Open on its crate writes nothing, and its DM delivered then says nothing of it", async () => {
    const t = await workspace();
    await openBook(t, "U_ALICE");
    aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    vi.setSystemTime(wednesday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    const openButton = buttonIn(journeyDmsTo("U_ALICE").at(-1)!.blocks as Block[], "Open");
    const alice = await memberOf(t, "U_ALICE");

    await flagsFromPostHog(t, postHog, ...on("xp-levels", "unlocks", "quests"), offForEveryone("achievements"));
    await click(t, "U_ALICE", openButton);

    expect(await twoDaysCrateOpenings(t)).toEqual([]);
    expect(await linesStillWanted(t, alice, { kind: "quest-finished", quest: { kind: "journey", step: "two-days" }, xp: 30 })).toBeNull();
    expect(
      await linesStillWanted(t, alice, {
        kind: "journey-joined",
        finished: [
          { quest: { kind: "journey", step: "first-thanks" }, xp: 10 },
          { quest: { kind: "journey", step: "two-days" }, xp: 30 },
        ],
      }),
    ).toEqual([expect.objectContaining({ text: expect.stringContaining("Give a kudos that says why") })]);
  });
});

function on(...keys: string[]) {
  return keys.map(onForEveryone);
}

async function workspace() {
  const t = await bookShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

async function workspaceWith(...users: string[]) {
  const t = await flagsLoaded(testBackend());
  await t.run(async (ctx) => {
    await ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 });
    for (const user of users) await ctx.db.insert("members", { workspace: "T1", user, kind: "member" });
  });
  return t;
}

async function membersInDirectory() {
  const t = await bookShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  const [alice, bob] = await t.run(async (ctx) => {
    await ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 });
    return [await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }), await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" })];
  });
  return { t, alice: alice!, bob: bob! };
}

async function thoughtfulKudos(t: Backend, giver: MemberId, recipient: MemberId, at: number, day: string): Promise<KudosGivenEvent> {
  const message = { workspace: "T1", conversation: "C1", message: `${at / 1000}` };
  return t.run(async (ctx) => {
    const author = (await ctx.db.get(giver))!.user;
    const content = { mentions: [], emoji: ["taco"] };
    await ctx.db.insert("kudosMessages", { ...message, author, revision: 1n, state: "given", attempt: 1n, content, annotations: saysWhyDecision, spendsAt: at, checks: 0 });
    return kudosGivenEventWithAward(ctx, giver, recipient, { message, annotations: saysWhyDecision, at, day });
  });
}

async function followKudosGiven(t: Backend, event: KudosGivenEvent) {
  await t.mutation(internal.quests.quests.followKudosGiven, { event });
}

async function opened(t: Backend, member: MemberId, feature: "book", at: number) {
  await t.mutation(internal.quests.journey.activateJourney, { event: { type: "unlockOpened", workspace: "T1", member, feature, at } });
}

async function bookReady(t: Backend, user: string) {
  await openHome(t, user);
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("unlocks", { member, feature: "book", readyAt: Date.now() }));
}

async function openBook(t: Backend, user: string) {
  await bookReady(t, user);
  await openHome(t, user);
  await click(t, user, buttonIn(publishedHomeBlocks(slack, user).filter((block) => block.text?.text.includes("*Book* is ready")), "Open"));
  await click(t, user, buttonInHome(slack, user, "Profile"));
}

async function bookOpenedAt(t: Backend, member: MemberId) {
  return t.run(async (ctx) => {
    const book = await ctx.db
      .query("unlocks")
      .withIndex("by_member_feature", (q) => q.eq("member", member).eq("feature", "book"))
      .unique();
    return book?.openedAt;
  });
}

async function hourlySweep(t: Backend) {
  await t.mutation(internal.quests.newWeek.sweep, {});
  await settle(t);
}

function aMinuteLater() {
  vi.setSystemTime(Date.now() + minuteMs);
  return Date.now();
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Date.now() / 1000}.00010${sentMessages}` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, action: BlockAction) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settle(t);
}

function journeyIn(home: string[]) {
  const start = home.findIndex((line) => line.includes("*Journey:*"));
  return start === -1 ? [] : home.slice(start, home.indexOf("divider", start));
}

function journeyDmsTo(user: string): Array<{ text?: unknown; blocks?: unknown }> {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && String(text).startsWith("✅ You finished a Journey step"));
}

function lastReplyTo(user: string) {
  return String(slack.ephemeralsTo(user).at(-1)?.text).split("\n");
}

async function rewardRecordsOf(t: Backend, key: string) {
  return t.run(async (ctx) =>
    (await ctx.db.query("rewardRecords").collect()).filter((record) => record.key === key).map(({ key, xp, catalogueVersion, at }) => ({ key, xp, catalogueVersion, at })),
  );
}

async function twoDaysCauseOf(t: Backend) {
  return t.run(async (ctx) => {
    const [finished] = (await ctx.db.query("rewardRecords").collect()).filter((record) => record.key === "journey:two-days");
    return { at: finished?.at, cause: finished?.cause };
  });
}

async function journeyStepsOf(t: Backend, member: MemberId) {
  const quests = await t.query(internal.quests.quests.questsOf, { member });
  return quests!.journey.map(({ step }) => step);
}

async function twoDaysOf(t: Backend, member: MemberId) {
  const quests = await t.query(internal.quests.quests.questsOf, { member });
  return quests?.journey.find(({ step }) => step === "two-days");
}

async function effectsRecordCount(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("effectsRecords").collect()).length);
}

async function activationsOf(t: Backend, step: string) {
  return t.run(async (ctx) => (await ctx.db.query("journeySteps").collect()).filter((row) => row.step === step).length);
}

async function twoDaysCrateOpenings(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("crateOpenings").collect()).filter(({ key }) => key === "journey:two-days"));
}

function linesStillWanted(t: Backend, member: MemberId, notification: Notification) {
  return t.query(internal.feedback.notify.linesStillWanted, { member, notification });
}

function journeyFinished(step: string) {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event): event is Extract<DomainEvent, { type: "questFinished" }> => event.type === "questFinished" && event.quest.kind === "journey" && event.quest.step === step);
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return member!._id;
  });
}
