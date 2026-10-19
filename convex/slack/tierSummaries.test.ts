import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog, FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEmails, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, buttonInHome } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { ladders, type Ladder, type LadderId, type TierId } from "../achievements/ladders";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const siteUrl = "https://kudos-site.test";
const alicesEmail = "alice@example.com";
const openBookCommand = JSON.stringify({ type: "openUnlock", feature: "book" });
const openBook = { type: "button", action_id: openBookCommand, value: openBookCommand } as const;
const catalogue = ladders as unknown as { version: string; ladders: Ladder[] };
const shippedLadders = [...catalogue.ladders];
const bothBronzes = "🏅 You earned First Thanks (Generosity, bronze).\n🏅 You earned Noticed (Recognition, bronze).\n🏅 You earned First Chapter (Seasons, bronze).\nNext: Generous Soul at 25 kudos given.\nNext: Appreciated at 25 kudos received.\nNext: Season of Thanks at 3 calendar months with a kudos given.";

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
  catalogue.ladders = [...shippedLadders];
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P62 P76: tiers the launch replays wait for the Book's opening, and arrive there as one DM summary", () => {
  test("a member with history and an unopened Book is told nothing at the launch, and opening the Book sends one DM summary of every replayed tier and nothing in public", async () => {
    const t = await workspaceBeforeTheBook({ announcementChannel: "C_NEWS" });
    await giveKudos(t, "U_ALICE", "U_BOB");
    await giveKudos(t, "U_BOB", "U_ALICE");
    await withXp(t, "U_ALICE", 305);

    await launchTheBook(t);

    expect(tierDmsTo("U_ALICE")).toEqual([]);
    expect(tierLinesEverywhere()).toEqual([]);
    await openTheBookInAppHome(t, "U_ALICE");
    expect(tierDmsTo("U_ALICE")).toEqual([bothBronzes]);
    expect(tierDmsTo("U_BOB")).toEqual([]);
    expect(tierLinesEverywhere()).toEqual([]);
  });

  test("a tier earned live while the Book was unopened arrives in the opening summary, never in a DM of its own", async () => {
    const t = await workspaceWithTheBook();
    await giveKudos(t, "U_ALICE", "U_BOB");
    await withXp(t, "U_ALICE", 305);
    await giveKudos(t, "U_BOB", "U_ALICE");
    expect(tierDmsTo("U_ALICE")).toEqual([]);

    await t.mutation(internal.unlocks.sweep.sweep, {});
    await settle(t);
    await openTheBookInAppHome(t, "U_ALICE");

    expect(tierDmsTo("U_ALICE")).toEqual([bothBronzes]);
    expect(tierLinesEverywhere()).toEqual([]);
  });

  test("the opening summary's Next follows every tier earned, so a tier earned while the Book was hidden moves it on without being told", async () => {
    const t = await workspaceWithTheBook();
    await giveKudos(t, "U_ALICE", "U_BOB");
    await withXp(t, "U_ALICE", 305);
    await earnedWhileHidden(t, "U_ALICE", "generosity", "silver");

    await t.mutation(internal.unlocks.sweep.sweep, {});
    await settle(t);
    await openTheBookInAppHome(t, "U_ALICE");

    expect(tierDmsTo("U_ALICE")).toEqual([
      "🏅 You earned First Thanks (Generosity, bronze).\n🏅 You earned First Chapter (Seasons, bronze).\nNext: Heart of the Team at 100 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given.",
    ]);
  });

  test("a member who turned DMs off gets no summary on opening", async () => {
    const t = await workspaceBeforeTheBook();
    await giveKudos(t, "U_ALICE", "U_BOB");
    await withXp(t, "U_ALICE", 305);
    await t.run(async (ctx) => ctx.db.insert("progressSettings", { member: await memberIn(ctx, "U_ALICE"), dms: false }));
    await launchTheBook(t);

    await openTheBookInAppHome(t, "U_ALICE");

    expect(tierDmsTo("U_ALICE")).toEqual([]);
  });
});

describe("P62 P64 P65: a member whose Book is open when a batch completes gets one DM summary and one notice for it", () => {
  test("with an announcement channel, the batch is summarised in one DM and one notice there, and the thread gets nothing", async () => {
    const t = await workspaceBeforeTheBook({ announcementChannel: "C_NEWS" });
    await giveKudos(t, "U_ALICE", "U_BOB");
    await giveKudos(t, "U_BOB", "U_ALICE");
    await bookOpenFor(t, "U_ALICE");

    await launchTheBook(t);

    expect(tierDmsTo("U_ALICE")).toEqual([bothBronzes]);
    expect(tierDmsTo("U_BOB")).toEqual([]);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned First Thanks, Noticed and First Chapter."]);
    expect(tierLinesIn("C1")).toEqual([]);
  });

  test("when unlocks launch with the Book already shipped and open the Book for everyone, each member gets the DM summary and the channel gets no notice, then or at a later batch", async () => {
    withoutLadder("recognition");
    const t = await workspaceRow("C_NEWS");
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone("achievements"));
    await giveKudos(t, "U_ALICE", "U_BOB");
    await giveKudos(t, "U_BOB", "U_ALICE");

    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"));
    vi.setSystemTime(Date.now() + 60_000);
    await t.mutation(internal.unlocks.sweep.sweep, {});
    await settle(t);

    catalogue.ladders = [...shippedLadders];
    vi.setSystemTime(Date.now() + 60_000);
    await openHome(t, "U_ALICE");

    expect(tierDmsTo("U_ALICE")).toEqual([
      "🏅 You earned First Thanks (Generosity, bronze).\n🏅 You earned First Chapter (Seasons, bronze).\nNext: Generous Soul at 25 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given.",
      "🏅 You earned Noticed (Recognition, bronze).\nNext: Appreciated at 25 kudos received.",
    ]);
    expect(tierDmsTo("U_BOB")).toHaveLength(2);
    expect(tierLinesEverywhere()).toEqual([]);
  });

  test("without an announcement channel, nothing is posted in public", async () => {
    const t = await workspaceBeforeTheBook();
    await giveKudos(t, "U_ALICE", "U_BOB");
    await bookOpenFor(t, "U_ALICE");

    await launchTheBook(t);

    expect(tierDmsTo("U_ALICE")).toEqual(["🏅 You earned First Thanks (Generosity, bronze).\n🏅 You earned First Chapter (Seasons, bronze).\nNext: Generous Soul at 25 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given."]);
    expect(tierLinesEverywhere()).toEqual([]);
  });

  test("a member who muted notices gets the DM summary and no notice", async () => {
    const t = await workspaceBeforeTheBook({ announcementChannel: "C_NEWS" });
    await giveKudos(t, "U_ALICE", "U_BOB");
    await bookOpenFor(t, "U_ALICE");
    await t.run(async (ctx) => ctx.db.insert("progressSettings", { member: await memberIn(ctx, "U_ALICE"), muteNotices: true }));

    await launchTheBook(t);

    expect(tierDmsTo("U_ALICE")).toHaveLength(1);
    expect(tierLinesEverywhere()).toEqual([]);
  });

  test("every ladder launched together is one batch: one summary and one notice per member, not one per ladder", async () => {
    const t = await workspaceBeforeTheBook({ announcementChannel: "C_NEWS" });
    await giveKudos(t, "U_ALICE", "U_BOB");
    await giveKudos(t, "U_BOB", "U_ALICE");
    await bookOpenFor(t, "U_ALICE", "U_BOB");

    await launchTheBook(t);

    expect(tierDmsTo("U_ALICE")).toEqual([bothBronzes]);
    expect(tierDmsTo("U_BOB")).toHaveLength(1);
    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C_NEWS")).toHaveLength(2);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned First Thanks, Noticed and First Chapter.", "🏅 <@U_BOB> earned First Thanks, Noticed and First Chapter."]);
  });
});

describe("CO20: a launch batch's summary says each tier's coins while coins are visible", { timeout: 30_000 }, () => {
  test("a member with the Book and Coins open gets the batch's summary with +10 🪙 on each bronze line", async () => {
    const t = await workspaceBeforeTheBook();
    await giveKudos(t, "U_ALICE", "U_BOB");
    await giveKudos(t, "U_BOB", "U_ALICE");
    await bookOpenFor(t, "U_ALICE");
    await coinsOpenFor(t, "U_ALICE");

    await launchTheBook(t, onForEveryone("coins"));

    expect(tierDmsTo("U_ALICE")).toEqual([
      "🏅 You earned First Thanks (Generosity, bronze). +10 🪙\n🏅 You earned Noticed (Recognition, bronze). +10 🪙\n🏅 You earned First Chapter (Seasons, bronze). +10 🪙\nNext: Generous Soul at 25 kudos given.\nNext: Appreciated at 25 kudos received.\nNext: Season of Thanks at 3 calendar months with a kudos given.",
    ]);
  });
});

describe("SW13 SW14 SW15: each DM ends with a link to its page on the web after its own checks, while the website is open", { timeout: 30_000 }, () => {
  test("while the website is open, the Book's opening summary ends with one link to the Book's earned page", async () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
    vi.stubEnv("SITE_URL", siteUrl);
    const t = await workspaceBeforeTheBook();
    await giveKudos(t, "U_ALICE", "U_BOB");
    await giveKudos(t, "U_BOB", "U_ALICE");
    await withXp(t, "U_ALICE", 305);
    await launchTheBook(t, onForEveryone("website"));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});

    await clickOpenBook(t, "U_ALICE");

    expect(tierDmsTo("U_ALICE")).toEqual([`${bothBronzes}\n<${siteUrl}/book#milestones|See what you earned on the web>`]);
  });

  test("for a member previewing the website while it is closed for the workspace, the opening summary's link goes through the sign-in entry", async () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
    vi.stubEnv("SITE_URL", siteUrl);
    const t = await workspaceBeforeTheBook();
    await giveKudos(t, "U_ALICE", "U_BOB");
    await giveKudos(t, "U_BOB", "U_ALICE");
    await withXp(t, "U_ALICE", 305);
    await t.run(async (ctx) => ctx.db.patch(await memberIn(ctx, "U_ALICE"), { email: alicesEmail }));
    await launchTheBook(t, onForEmails("website", alicesEmail));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});

    await clickOpenBook(t, "U_ALICE");

    expect(tierDmsTo("U_ALICE")).toEqual([`${bothBronzes}\n<${siteUrl}/sign-in/book#milestones|See what you earned on the web>`]);
  });
});

describe("P62 P76: a tier is told once, whichever summary tells it", () => {
  test("a replayed opening tells nothing again", async () => {
    const t = await workspaceBeforeTheBook();
    await giveKudos(t, "U_ALICE", "U_BOB");
    await withXp(t, "U_ALICE", 305);
    await launchTheBook(t);
    await openTheBookInAppHome(t, "U_ALICE");

    const alice = await t.run((ctx) => memberIn(ctx, "U_ALICE"));
    const opening = { type: "unlockOpened" as const, workspace: "T1", member: alice, feature: "book" as const, at: Date.now() };
    await t.mutation(internal.feedback.tierNotices.tellOpeningSummary, { event: opening });
    await settle(t);

    expect(tierDmsTo("U_ALICE")).toHaveLength(1);
  });

  test("a later batch for a new ladder summarises only its own tiers", async () => {
    withoutLadder("recognition");
    const t = await workspaceBeforeTheBook({ announcementChannel: "C_NEWS" });
    await giveKudos(t, "U_ALICE", "U_BOB");
    await giveKudos(t, "U_BOB", "U_ALICE");
    await bookOpenFor(t, "U_ALICE");
    await launchTheBook(t);

    catalogue.ladders = [...shippedLadders];
    await openHome(t, "U_ALICE");

    expect(tierDmsTo("U_ALICE")).toEqual([
      "🏅 You earned First Thanks (Generosity, bronze).\n🏅 You earned First Chapter (Seasons, bronze).\nNext: Generous Soul at 25 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given.",
      "🏅 You earned Noticed (Recognition, bronze).\nNext: Appreciated at 25 kudos received.",
    ]);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned First Thanks and First Chapter.", "🏅 <@U_ALICE> earned Noticed."]);
  });

  test("a batch that completes while another is still replaying tells only its own tiers, and the other batch tells the rest when it completes", async () => {
    const t = await workspaceWithTheBook("C_NEWS");
    vi.setSystemTime(Date.now() + 60_000);
    const alice = await memberWithTheBookOpen(t, "U_ALICE");
    vi.setSystemTime(Date.now() + 60_000);
    const [first, second] = await t.run(async (ctx) => [await ctx.db.insert("bookBatches", { workspace: "T1", at: Date.now() }), await ctx.db.insert("bookBatches", { workspace: "T1", at: Date.now() })]);
    await earned(t, alice, "generosity", first!);
    await earned(t, alice, "recognition", second!);

    await completeBatch(t, first!);
    await completeBatch(t, second!);

    expect(tierDmsTo("U_ALICE")).toEqual([
      "🏅 You earned First Thanks (Generosity, bronze).\nNext: Generous Soul at 25 kudos given.",
      "🏅 You earned Noticed (Recognition, bronze).\nNext: Appreciated at 25 kudos received.",
    ]);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned First Thanks.", "🏅 <@U_ALICE> earned Noticed."]);
  });

  test("a member who opens the Book while the batch is still replaying hears of its tiers once, in the batch's summary and not in public, and sees the Book published again when it completes", async () => {
    const t = await workspaceWithTheBook("C_NEWS");
    const batch = await t.run((ctx) => ctx.db.insert("bookBatches", { workspace: "T1", at: Date.now() }));
    vi.setSystemTime(Date.now() + 60_000);
    const alice = await memberWithTheBookOpen(t, "U_ALICE");
    await earned(t, alice, "generosity", batch);

    await t.mutation(internal.feedback.tierNotices.tellOpeningSummary, { event: { type: "unlockOpened", workspace: "T1", member: alice, feature: "book", at: Date.now() } });
    await settle(t);
    await earned(t, alice, "recognition", batch);
    const publishedBefore = slack.callsTo("views.publish").filter(({ user_id }) => user_id === "U_ALICE").length;
    await completeBatch(t, batch);

    expect(tierDmsTo("U_ALICE")).toEqual(["🏅 You earned First Thanks (Generosity, bronze).\n🏅 You earned Noticed (Recognition, bronze).\nNext: Generous Soul at 25 kudos given.\nNext: Appreciated at 25 kudos received."]);
    expect(tierLinesEverywhere()).toEqual([]);
    expect(slack.callsTo("views.publish").filter(({ user_id }) => user_id === "U_ALICE").length).toBeGreaterThan(publishedBefore);
  });

  test("a member who opened the Book after the batch completed hears of its tiers only from the opening's summary, even when the batch's summary runs later", async () => {
    const t = await workspaceWithTheBook("C_NEWS");
    const alice = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }));
    const batch = await t.run((ctx) => ctx.db.insert("bookBatches", { workspace: "T1", at: Date.now(), completedAt: Date.now() }));
    await earned(t, alice, "generosity", batch);
    vi.setSystemTime(Date.now() + 60_000);
    await t.run((ctx) => ctx.db.insert("unlocks", { member: alice, feature: "book", readyAt: Date.now(), openedAt: Date.now() }));

    await t.mutation(internal.feedback.tierNotices.tellBatchSummaries, { batch, cursor: null });
    await t.mutation(internal.feedback.tierNotices.tellOpeningSummary, { event: { type: "unlockOpened", workspace: "T1", member: alice, feature: "book", at: Date.now() } });
    await settle(t);

    expect(tierDmsTo("U_ALICE")).toEqual(["🏅 You earned First Thanks (Generosity, bronze).\nNext: Generous Soul at 25 kudos given."]);
    expect(tierLinesEverywhere()).toEqual([]);
  });
});

async function memberWithTheBookOpen(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const member = await ctx.db.insert("members", { workspace: "T1", user, kind: "member" });
    await ctx.db.insert("unlocks", { member, feature: "book", readyAt: Date.now(), openedAt: Date.now() });
    return member;
  });
}

async function earned(t: Backend, member: MemberId, ladder: LadderId, batch: Id<"bookBatches">) {
  await t.run(async (ctx) => {
    const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C0", message: `${ladder}`, giver: member, recipient: member, kudos: 1, day: "2026-10-12", at: Date.now() - 86_400_000 });
    await ctx.db.insert("earnedTiers", { member, ladder, tier: "bronze", earnedAt: Date.now() - 86_400_000, award, catalogueVersion: "1", rewards: [], batch });
  });
}

async function earnedWhileHidden(t: Backend, user: string, ladder: LadderId, tier: TierId) {
  await t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C0", message: `${ladder}-${tier}`, giver: member, recipient: member, kudos: 1, day: "2026-10-12", at: Date.now() });
    await ctx.db.insert("earnedTiers", { member, ladder, tier, earnedAt: Date.now(), award, catalogueVersion: "1", rewards: [], hidden: true });
  });
}

async function completeBatch(t: Backend, batch: Id<"bookBatches">) {
  await t.run((ctx) => ctx.db.patch(batch, { completedAt: Date.now() }));
  await t.mutation(internal.feedback.tierNotices.tellBatchSummaries, { batch, cursor: null });
  await settle(t);
}

async function workspaceBeforeTheBook({ announcementChannel }: { announcementChannel?: string } = {}) {
  const t = await workspaceRow(announcementChannel);
  await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"));
  return unlocksShippedBeforeAnyoneJoined(t);
}

async function workspaceWithTheBook(announcementChannel?: string) {
  return bookShippedBeforeAnyoneJoined(await workspaceRow(announcementChannel));
}

async function workspaceRow(announcementChannel: string | undefined) {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, ...(announcementChannel && { announcementChannel }) }));
  return t;
}

async function launchTheBook(t: Backend, ...alsoOn: FlagDefinition[]) {
  await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"), ...alsoOn);
  vi.setSystemTime(Date.now() + 60_000);
  await t.mutation(internal.unlocks.sweep.sweep, {});
  await settle(t);
}

async function giveKudos(t: Backend, giver: string, recipient: string) {
  sentMessages += 1;
  const ts = `${Math.floor(Date.now() / 1000) + sentMessages}.000100`;
  await t.fetch("/slack/events", await signedRequest(messageEvent([section(mention(recipient), emoji("taco"))], { user: giver, ts })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function openTheBookInAppHome(t: Backend, user: string) {
  await openHome(t, user);
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, buttonInHome(slack, user, "Open")), form));
  await settle(t);
}

async function clickOpenBook(t: Backend, user: string) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, openBook), form));
  await settle(t);
}

async function coinsOpenFor(t: Backend, user: string) {
  await t.run(async (ctx) => ctx.db.insert("unlocks", { member: await memberIn(ctx, user), feature: "coins", readyAt: Date.now(), openedAt: Date.now() }));
}

async function bookOpenFor(t: Backend, ...users: string[]) {
  await t.run(async (ctx) => {
    for (const user of users) await ctx.db.insert("unlocks", { member: await memberIn(ctx, user), feature: "book", readyAt: Date.now(), openedAt: Date.now() });
  });
}

async function withXp(t: Backend, user: string, xp: number) {
  await t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function memberIn(ctx: Parameters<Parameters<Backend["run"]>[0]>[0], user: string): Promise<MemberId> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}

function withoutLadder(ladder: LadderId) {
  catalogue.ladders = shippedLadders.filter((entry) => entry.ladder !== ladder);
}

function tierDmsTo(user: string) {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => channel === user && String(text).startsWith("🏅"))
    .map(({ text }) => String(text));
}

function tierLinesIn(channel: string) {
  return slack
    .messagesIn(channel)
    .flatMap(({ text }) => String(text).split("\n"))
    .filter((line) => line.startsWith("🏅"));
}

function tierLinesEverywhere() {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel }) => !String(channel).startsWith("U_"))
    .flatMap(({ text }) => String(text).split("\n"))
    .filter((line) => line.startsWith("🏅"));
}
