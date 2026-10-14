import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, buttonInHome, publishedHome } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const bookReady = "*Book* is ready. It opens achievements.";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "achievements");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P58 P61 P67 P76: a member at level 4 opens the Book and sees the tiers their kudos earned", () => {
  test("a first kudos earns Generosity bronze for the giver and Recognition bronze for the recipient, dated by that kudos; the giver opens the Book at level 4 and sees it, and nothing about achievements shows before", async () => {
    const t = await workspace();
    const firstKudosAt = await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await withXp(t, "U_ALICE", 295);
    vi.setSystemTime(now.getTime() + 60_000);

    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(levelUpDmsTo("U_ALICE").map((dm) => dm.text)).toEqual([`🎉 You reached level 4!\nLevel 5 is 295 XP away.\n${bookReady}`]);
    await openHome(t, "U_ALICE");
    const beforeOpening = publishedHome(slack, "U_ALICE");
    expect(beforeOpening[0]).toBe("actions: [Profile] | Settings");
    expect(beforeOpening.filter((line) => /Generosity|Recognition|First Thanks|Noticed/.test(line))).toEqual([]);
    expect(beforeOpening).toContain(`section: ${bookReady} [button: Open]`);

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Open")));
    expect(publishedHome(slack, "U_ALICE")[0]).toBe("actions: [Profile] | Book | Settings");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Book")));

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: Profile | [Book] | Settings",
      "header: Book",
      "section: *Generosity* · *2* kudos given",
      "section: 🥉 *First Thanks* · earned Oct 13, 2026",
      "context: Next: *Generous Soul* at 25 kudos given.",
      "divider",
      "section: *Recognition* · *0* kudos received",
      "context: Next: *Noticed* at 1 kudos received.",
    ]);
    const bob = await achievementsOf(t, "U_BOB");
    expect(bob?.ladders.find(({ ladder }) => ladder === "recognition")).toMatchObject({
      count: 2,
      tiers: [{ tier: "bronze", earnedAt: firstKudosAt }, { tier: "silver", earnedAt: null }, { tier: "gold", earnedAt: null }, { tier: "diamond", earnedAt: null }],
      next: "silver",
    });
  });
});

describe("P68: an open Book is published again after its counts change", () => {
  test("when the count lands after App Home was published, the Book tab is published again with it", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await withXp(t, "U_ALICE", 295);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Open")));
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Book")));
    const [alice, bob] = [await memberOf(t, "U_ALICE"), await memberOf(t, "U_BOB")];
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { at: Date.now() }));

    await t.mutation(internal.achievements.achievements.countKudosGiven, { event });
    await settle(t);

    expect(publishedHome(slack, "U_ALICE")[2]).toBe("section: *Generosity* · *3* kudos given");
  });
});

describe("P78: the Book's readiness names only what has shipped", () => {
  test("the Book's crate in App Home names achievements, never stickers or albums", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await withXp(t, "U_ALICE", 295);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").filter((line) => line.includes("Book"))).toEqual([`section: ${bookReady} [button: Open]`]);
    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toMatch(/sticker|album/i);
  });

  test("with achievements off, the Book is never ready, named or next, and nothing is counted", async () => {
    const t = await workspace({ launched: false });
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"));
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await withXp(t, "U_ALICE", 295);

    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");

    expect(levelUpDmsTo("U_ALICE").map((dm) => dm.text)).toEqual(["🎉 You reached level 4!\nLevel 5 is 295 XP away."]);
    expect(publishedHome(slack, "U_ALICE").filter((line) => line.includes("Book"))).toEqual([]);
    expect(await achievementsOf(t, "U_ALICE")).toBeNull();
    expect(await countedRows(t)).toEqual([]);
  });
});

describe("P75: the Book counts from its launch, whatever any flag says later", () => {
  test("a kudos before the workspace's launch counts nothing; the first one after it launches the Book and counts", async () => {
    const t = await workspace({ launched: false });
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"));
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    expect(await countedRows(t)).toEqual([]);
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"));
    vi.setSystemTime(now.getTime() + 60_000);

    const afterLaunchAt = await giveKudos(t, "U_ALICE", "U_BOB", 1);

    const generosity = (await achievementsOf(t, "U_ALICE"))?.ladders.find(({ ladder }) => ladder === "generosity");
    expect(generosity).toMatchObject({ count: 1, tiers: [{ tier: "bronze", earnedAt: afterLaunchAt }, { earnedAt: null }, { earnedAt: null }, { earnedAt: null }] });
  });

  test("the ship sweep that makes the Book ready launches it, so a kudos made after the sweep counts even when it is processed later", async () => {
    const t = await workspace({ launched: false });
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"));
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await withXp(t, "U_ALICE", 305);
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"));
    vi.setSystemTime(now.getTime() + 60_000);
    const sweptAt = Date.now();

    await t.mutation(internal.unlocks.sweep.sweep, {});
    const launchedBySweep = await t.run(async (ctx) => (await ctx.db.query("bookLaunches").take(2)).map(({ at }) => at));
    await settle(t);
    vi.setSystemTime(sweptAt + 60_000);
    const [alice, bob] = [await memberOf(t, "U_ALICE"), await memberOf(t, "U_BOB")];
    const madeAfterTheSweep = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { at: sweptAt + 1000 }));
    await t.mutation(internal.achievements.achievements.countKudosGiven, { event: madeAfterTheSweep });

    expect(launchedBySweep).toEqual([sweptAt]);
    expect((await achievementsOf(t, "U_ALICE"))?.ladders[0]).toMatchObject({ ladder: "generosity", count: 1 });
  });

  test("while achievements is off after the launch, kudos still count and earn, and turning it on again shows them", async () => {
    const t = await workspace();
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"));

    const hiddenKudosAt = await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(await achievementsOf(t, "U_ALICE")).toBeNull();
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"));
    const generosity = (await achievementsOf(t, "U_ALICE"))?.ladders.find(({ ladder }) => ladder === "generosity");
    expect(generosity).toMatchObject({ count: 1, tiers: [{ tier: "bronze", earnedAt: hiddenKudosAt }, { earnedAt: null }, { earnedAt: null }, { earnedAt: null }] });
  });
});

async function workspace({ launched = true } = {}) {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  if (launched) return bookShippedBeforeAnyoneJoined(t);
  await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"));
  return unlocksShippedBeforeAnyoneJoined(t);
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const sentAt = Math.floor(Date.now() / 1000) + sentMessages;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
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

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return member!._id;
  });
}

async function withXp(t: Backend, user: string, xp: number) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function achievementsOf(t: Backend, user: string) {
  return t.query(internal.achievements.achievements.achievementsOf, { member: await memberOf(t, user) });
}

async function countedRows(t: Backend) {
  return t.run((ctx) => ctx.db.query("ladderCounts").take(10));
}

function levelUpDmsTo(user: string) {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && String(text).startsWith("🎉")) as Array<{ channel: string; text: string }>;
}
