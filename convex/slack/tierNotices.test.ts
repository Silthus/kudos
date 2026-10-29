import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog, FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEmails, onForEveryone } from "../../testing/flags";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { blockActions, buttonInHome, publishedHome } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { tellTiersEarned } from "../feedback/tierNotices";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const kudosTs = slackTs(now.getTime());
const siteUrl = "https://kudos-site.test";
const bobsEmail = "bob@example.com";

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "achievements");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P63 P64 P76: a tier you earn is told by DM and celebrated in the announcement channel", () => {
  test("a kudos that earns the giver Generosity silver and the recipient Recognition bronze sends each one DM and puts a line for each in the message's one public reply", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    const [alice] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    await withGiven(t, alice!, 24);

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(tierDmsTo("U_ALICE")).toEqual(["🏅 You earned Generous Soul (Generosity, silver).\n🏅 You earned First Chapter (Seasons, bronze).\nNext: Heart of the Team at 100 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given."]);
    expect(tierDmsTo("U_BOB")).toEqual(["🏅 You earned Noticed (Recognition, bronze).\nNext: Appreciated at 25 kudos received."]);
    expect(publicPostsIn("C_NEWS")).toHaveLength(1);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned Generous Soul and First Chapter.", "🏅 <@U_BOB> earned Noticed."]);
  });

  test.each([
    ["at a channel's top level", {}],
    ["in a thread", { threadTs: "1760349000.000100" }],
  ])("QM2: with no announcement channel picked, the tiers a kudos posted %s earns are told by DM and celebrated nowhere in public", async (_, where) => {
    const t = await workspace();
    await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");

    await giveKudos(t, "U_ALICE", "U_BOB", where);

    expect(tierDmsTo("U_ALICE")).toHaveLength(1);
    expect(tierDmsTo("U_BOB")).toHaveLength(1);
    expect(publicPosts()).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("publicReplies").collect())).toEqual([]);
  });

  test("QM1: the tiers a kudos posted in a thread earns are celebrated at the announcement channel's top level, and the kudos message's conversation gets nothing", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");

    await giveKudos(t, "U_ALICE", "U_BOB", { threadTs: "1760349000.000100" });

    expect(publicPostsIn("C_NEWS").map(({ thread_ts }) => thread_ts)).toEqual([undefined]);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned First Thanks and First Chapter.", "🏅 <@U_BOB> earned Noticed."]);
    expect(publicPostsIn("C1")).toEqual([]);
  });

  test("a member who hasn't opened the Book gets no DM and no public line, and the member who has still does", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    await membersWithTheBookOpen(t, "U_ALICE");

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(tierDmsTo("U_ALICE")).toHaveLength(1);
    expect(tierDmsTo("U_BOB")).toEqual([]);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned First Thanks and First Chapter."]);
  });

  test("a tier earned before the member opened the Book gets no public line, even when the opening lands before the count, and arrives as a DM summary", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    const [alice, bob] = await membersWithTheBookOpen(t);
    const earnedBeforeOpening = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice!, bob!, { at: Date.now() }));
    vi.setSystemTime(now.getTime() + 60_000);
    await openTheBook(t, alice!, bob!);

    await t.mutation(internal.achievements.achievements.countKudosGiven, { event: earnedBeforeOpening });
    await settle(t);

    expect(tierDmsTo("U_ALICE")).toEqual(["🏅 You earned First Thanks (Generosity, bronze).\n🏅 You earned First Chapter (Seasons, bronze).\nNext: Generous Soul at 25 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given."]);
    expect(tierDmsTo("U_BOB")).toEqual(["🏅 You earned Noticed (Recognition, bronze).\nNext: Appreciated at 25 kudos received."]);
    expect(tierLinesIn("C_NEWS")).toEqual([]);
  });

  test("P65: a member who muted notices gets no public line, and their DM still arrives", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    const [alice] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    await t.run((ctx) => ctx.db.insert("progressSettings", { member: alice!, muteNotices: true }));

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(tierDmsTo("U_ALICE")).toEqual(["🏅 You earned First Thanks (Generosity, bronze).\n🏅 You earned First Chapter (Seasons, bronze).\nNext: Generous Soul at 25 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given."]);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_BOB> earned Noticed."]);
  });

  test("a member who turned DMs off gets no DM, and their public line is still posted", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    const [alice] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    await t.run((ctx) => ctx.db.insert("progressSettings", { member: alice!, dms: false }));

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(tierDmsTo("U_ALICE")).toEqual([]);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned First Thanks and First Chapter.", "🏅 <@U_BOB> earned Noticed."]);
  });

  test("a kudos that reaches two tiers of one ladder names both in one DM and one line", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    const [alice, bob] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice!, bob!, { at: Date.now() }));
    const reachingTwo = { ...event, awards: event.awards.map((award) => ({ ...award, kudos: 25 })) };

    await t.mutation(internal.achievements.achievements.countKudosGiven, { event: reachingTwo });
    await settle(t);

    expect(tierDmsTo("U_ALICE")).toEqual([
      "🏅 You earned First Thanks (Generosity, bronze).\n🏅 You earned Generous Soul (Generosity, silver).\n🏅 You earned First Chapter (Seasons, bronze).\nNext: Heart of the Team at 100 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given.",
    ]);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned First Thanks, Generous Soul and First Chapter.", "🏅 <@U_BOB> earned Noticed and Appreciated."]);
  });
});

describe("P63 P64: a tier is told once per member and kudos", () => {
  test("delivering the same kudosGiven twice enqueues one DM and one line per member", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    const [alice, bob] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice!, bob!, { at: Date.now() }));

    await t.mutation(internal.achievements.achievements.countKudosGiven, { event });
    await t.mutation(internal.achievements.achievements.countKudosGiven, { event });
    await settle(t);

    expect(tierDmsTo("U_ALICE")).toHaveLength(1);
    expect(tierDmsTo("U_BOB")).toHaveLength(1);
    expect(publicPostsIn("C_NEWS")).toHaveLength(1);
    expect(slack.callsTo("chat.update")).toEqual([]);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned First Thanks and First Chapter.", "🏅 <@U_BOB> earned Noticed."]);
  });

  test("telling the same member and kudos again enqueues nothing new", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    const [alice] = await membersWithTheBookOpen(t, "U_ALICE");
    const told = { member: alice!, message: { workspace: "T1", conversation: "C1", message: kudosTs }, at: now.getTime(), earned: [{ ladder: "generosity" as const, tier: "bronze" as const }] };

    await t.run((ctx) => tellTiersEarned(ctx, told));
    await t.run((ctx) => tellTiersEarned(ctx, told));
    await settle(t);

    expect(tierDmsTo("U_ALICE")).toHaveLength(1);
    expect(publicPostsIn("C_NEWS")).toHaveLength(1);
    expect(slack.callsTo("chat.update")).toEqual([]);
  });
});

describe("P61 P78: a tier's copy celebrates, and names nothing unshipped", () => {
  test("no DM or line names coins, kudos emoji or hedgehogs, promises every tier, or suggests whom to thank", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    const [alice, bob] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice!, bob!, { at: Date.now() }));
    const reachingEvery = { ...event, awards: event.awards.map((award) => ({ ...award, kudos: 500 })) };

    await t.mutation(internal.achievements.achievements.countKudosGiven, { event: reachingEvery });
    await settle(t);

    const told = [...tierDmsTo("U_ALICE"), ...tierDmsTo("U_BOB"), ...tierLinesIn("C_NEWS")].join("\n");
    expect(told).toContain("Patron of Praise");
    expect(told).toContain("Hall of Fame");
    expect(told).not.toMatch(/coin|🪙|emoji|:taco:|hedgehog|🦔|every tier|all tiers|whom|thank someone|thank them|ask /i);
  });
});

describe("CO20: a tier DM line that paid coins says them while coins are visible", () => {
  test("with Coins open, each bronze line of the giver's DM ends with +10 🪙; the recipient, who hasn't opened Coins, gets the lines as before, and no public line names coins", async () => {
    const t = await workspaceWithCoins();
    const [alice] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    await openCoins(t, alice!);

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(tierDmsTo("U_ALICE")).toEqual([
      "🏅 You earned First Thanks (Generosity, bronze). +10 🪙\n🏅 You earned First Chapter (Seasons, bronze). +10 🪙\nNext: Generous Soul at 25 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given.",
    ]);
    expect(tierDmsTo("U_BOB")).toEqual(["🏅 You earned Noticed (Recognition, bronze).\nNext: Appreciated at 25 kudos received."]);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned First Thanks and First Chapter.", "🏅 <@U_BOB> earned Noticed."]);
  });

  test("a diamond line says +100 🪙, and the silver and gold lines, which pay no coins, say none", async () => {
    const t = await workspaceWithCoins();
    const [alice, bob] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    await openCoins(t, bob!);
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice!, bob!, { at: Date.now() }));

    await t.mutation(internal.achievements.achievements.countKudosGiven, { event: { ...event, awards: event.awards.map((award) => ({ ...award, kudos: 500 })) } });
    await settle(t);

    expect(tierDmsTo("U_BOB")).toEqual([
      "🏅 You earned Noticed (Recognition, bronze). +10 🪙\n🏅 You earned Appreciated (Recognition, silver).\n🏅 You earned Highly Valued (Recognition, gold).\n🏅 You earned Hall of Fame (Recognition, diamond). +100 🪙",
    ]);
  });

  test("a summary of tiers earned before the Book was opened says each tier's coins", async () => {
    const t = await workspaceWithCoins();
    const [alice, bob] = await membersWithTheBookOpen(t);
    await openCoins(t, bob!);
    const earnedBeforeOpening = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice!, bob!, { at: Date.now() }));
    vi.setSystemTime(now.getTime() + 60_000);
    await openTheBook(t, alice!, bob!);

    await t.mutation(internal.achievements.achievements.countKudosGiven, { event: earnedBeforeOpening });
    await settle(t);

    expect(tierDmsTo("U_BOB")).toEqual(["🏅 You earned Noticed (Recognition, bronze). +10 🪙\nNext: Appreciated at 25 kudos received."]);
  });

  test("with coins turned off after the member opened Coins, the DM says no coins, and the coins stay recorded", async () => {
    const t = await workspaceWithCoins();
    const [alice] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    await openCoins(t, alice!);
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"), offForEveryone("coins"));

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(tierDmsTo("U_ALICE")).toEqual(["🏅 You earned First Thanks (Generosity, bronze).\n🏅 You earned First Chapter (Seasons, bronze).\nNext: Generous Soul at 25 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given."]);
    expect(await t.run((ctx) => balanceOf(ctx, alice!))).toBe(20);
  });
});

describe("ST16 ST18: a silver tier gives its kudos emoji, and its DM line says it while the store is visible", { timeout: 30_000 }, () => {
  test("with Coins and the inventory open, Generous Soul's line says its emoji, the bronze line keeps its coins, and no public line names the emoji", async () => {
    const t = await workspaceDeciding(onForEveryone("store"));
    const [alice] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    await openCoins(t, alice!);
    await withGiven(t, alice!, 24);

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(tierDmsTo("U_ALICE")).toEqual([
      "🏅 You earned Generous Soul (Generosity, silver). + :ribbon: Ribbon for your kudos emoji\n🏅 You earned First Chapter (Seasons, bronze). +10 🪙\nNext: Heart of the Team at 100 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given.",
    ]);
    expect(tierLinesIn("C_NEWS")).toEqual(["🏅 <@U_ALICE> earned Generous Soul and First Chapter.", "🏅 <@U_BOB> earned Noticed."]);
  });

  test.each([
    ["the store is off", offForEveryone("store"), true],
    ["the store was never created", null, true],
    ["Coins isn't open", onForEveryone("store"), false],
  ])("while %s, Generous Soul's line is unchanged, and 🎀 is granted all the same, once", async (_, store, coinsOpen) => {
    const t = await workspaceDeciding(...(store === null ? [] : [store]));
    const [alice] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    if (coinsOpen) await openCoins(t, alice!);
    await withGiven(t, alice!, 24);

    await giveKudos(t, "U_ALICE", "U_BOB");
    vi.setSystemTime(now.getTime() + 60_000);
    await giveKudos(t, "U_ALICE", "U_BOB", { ts: slackTs(Date.now()) });

    expect(tierDmsTo("U_ALICE")[0]?.split("\n")[0]).toBe("🏅 You earned Generous Soul (Generosity, silver).");
    expect(await silverEmojiOf(t, alice!)).toEqual({
      rewards: [{ key: "tier:generosity-silver-kudos-emoji", xp: 0, coins: 0, item: "kudos-emoji-ribbon", at: now.getTime() }],
      collection: [{ item: "kudos-emoji-ribbon", source: "tier", arrivedAt: now.getTime() }],
    });
  });

  test("P62: a summary of tiers earned before the Book was opened says each silver tier's emoji", async () => {
    const t = await workspaceDeciding(onForEveryone("store"));
    const [alice, bob] = await membersWithTheBookOpen(t);
    await openCoins(t, bob!);
    const earnedBeforeOpening = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice!, bob!, { at: Date.now() }));
    vi.setSystemTime(now.getTime() + 60_000);
    await openTheBook(t, alice!, bob!);

    await t.mutation(internal.achievements.achievements.countKudosGiven, { event: { ...earnedBeforeOpening, awards: earnedBeforeOpening.awards.map((award) => ({ ...award, kudos: 25 })) } });
    await settle(t);

    expect(tierDmsTo("U_BOB")).toEqual([
      "🏅 You earned Noticed (Recognition, bronze). +10 🪙\n🏅 You earned Appreciated (Recognition, silver). + :sparkling_heart: Sparkling Heart for your kudos emoji\nNext: Highly Valued at 100 kudos received.",
    ]);
  });
});

describe("P76 P78: where the Book doesn't apply, no tier is announced", () => {
  test("a tier earned while achievements is off sends no DM and no line, and isn't announced when it is on again", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"));

    await giveKudos(t, "U_ALICE", "U_BOB");
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"));
    vi.setSystemTime(now.getTime() + 60_000);
    await giveKudos(t, "U_ALICE", "U_BOB", { ts: slackTs(Date.now()) });

    expect(tierDmsTo("U_ALICE")).toEqual([]);
    expect(tierDmsTo("U_BOB")).toEqual([]);
    expect(tierLinesIn("C_NEWS")).toEqual([]);
  });

  test("a tier told while the Book applies is dropped when it stops applying before Slack takes it", async () => {
    const t = await workspace({ announcementChannel: "C_NEWS" });
    const [alice, bob] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice!, bob!, { at: Date.now() }));
    await t.mutation(internal.achievements.achievements.countKudosGiven, { event });

    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"));
    await settle(t);

    expect(tierDmsTo("U_ALICE")).toEqual([]);
    expect(tierLinesIn("C_NEWS")).toEqual([]);
  });
});

describe("SW13 SW14 SW15: each DM ends with a link to its page on the web after its own checks, while the website is open", { timeout: 30_000 }, () => {
  test("while the website is open, a tier DM ends with a link to the Book's earned page", async () => {
    const t = await workspaceWithTheWebsite(onForEveryone("website"));
    await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(tierDmsTo("U_BOB")).toEqual([`🏅 You earned Noticed (Recognition, bronze).\nNext: Appreciated at 25 kudos received.\n<${siteUrl}/book?src=reply#milestones|See what you earned on the web>`]);
  });

  test("for a member previewing the website while it is closed for the workspace, the tier DM's link goes through the sign-in entry, and the others' DMs have no link", async () => {
    const t = await workspaceWithTheWebsite(onForEmails("website", bobsEmail));
    const [, bob] = await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");
    await t.run((ctx) => ctx.db.patch(bob!, { email: bobsEmail }));

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(tierDmsTo("U_BOB")).toEqual([`🏅 You earned Noticed (Recognition, bronze).\nNext: Appreciated at 25 kudos received.\n<${siteUrl}/sign-in/book?src=reply#milestones|See what you earned on the web>`]);
    expect(tierDmsTo("U_ALICE")).toEqual(["🏅 You earned First Thanks (Generosity, bronze).\n🏅 You earned First Chapter (Seasons, bronze).\nNext: Generous Soul at 25 kudos given.\nNext: Season of Thanks at 3 calendar months with a kudos given."]);
  });
});

describe("P63 P64 P69: Settings and Admin say they cover achievements where the Book applies", () => {
  test("the mute and DM switches name achievements", async () => {
    const t = await workspace();
    await membersWithTheBookOpen(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", "Settings");

    expect(publishedHome(slack, "U_ALICE")).toContain("section: I'll celebrate your level ups and achievements in public once your workspace picks a channel. [button: Mute notices]");
    expect(publishedHome(slack, "U_ALICE")).toContain("section: I send you a DM when you reach a level or earn an achievement. [button: Turn off DMs]");
  });

  test("the announcement channel picker names achievements", async () => {
    const t = await workspace();
    slack.withMember("U_ALICE", { is_admin: true });
    await membersWithTheBookOpen(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", "Admin");

    expect(publishedHome(slack, "U_ALICE")).toContain(
      "section: I don't celebrate level ups and achievements in public yet. Pick a channel to celebrate them there. [channels_select: none]",
    );
  });

  test("where the Book doesn't apply, they name level ups only", async () => {
    const t = await workspace();
    slack.withMember("U_ALICE", { is_admin: true });
    await membersWithTheBookOpen(t, "U_ALICE");
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"));
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", "Settings");
    const settings = publishedHome(slack, "U_ALICE");
    await click(t, "U_ALICE", "Admin");

    expect(settings).toContain("section: I'll celebrate your level ups in public once your workspace picks a channel. [button: Mute notices]");
    expect(settings).toContain("section: I send you a DM when you reach a level. [button: Turn off DMs]");
    expect(publishedHome(slack, "U_ALICE")).toContain(
      "section: I don't celebrate level ups in public yet. Pick a channel to celebrate them there. [channels_select: none]",
    );
  });
});

describe("public celebrations stop while the workspace switches them off", () => {
  test("the tiers a kudos earns while they are off are told by DM and celebrated nowhere in public", async () => {
    const t = await workspaceDeciding(onForEveryone("celebrations-switch"));
    await t.run((ctx) => ctx.db.insert("celebrationsSwitches", { workspace: "T1", on: false }));
    await membersWithTheBookOpen(t, "U_ALICE", "U_BOB");

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(tierDmsTo("U_ALICE")).toHaveLength(1);
    expect(tierDmsTo("U_BOB")).toHaveLength(1);
    expect(publicPosts()).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("publicReplies").collect())).toEqual([]);
  });
});

async function workspace({ announcementChannel }: { announcementChannel?: string } = {}) {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, ...(announcementChannel && { announcementChannel }) }));
  return bookShippedBeforeAnyoneJoined(t);
}

async function workspaceWithTheWebsite(website: FlagDefinition) {
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  const t = await workspace();
  await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"), website);
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  return t;
}

async function workspaceWithCoins() {
  const t = await workspace({ announcementChannel: "C_NEWS" });
  return flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"), onForEveryone("coins"));
}

async function workspaceDeciding(...alsoDecided: FlagDefinition[]) {
  const t = await workspace({ announcementChannel: "C_NEWS" });
  return flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"), onForEveryone("coins"), ...alsoDecided);
}

async function silverEmojiOf(t: Backend, member: MemberId) {
  return t.run(async (ctx) => {
    const rewards = await ctx.db
      .query("rewardRecords")
      .withIndex("by_member_key", (q) => q.eq("member", member))
      .collect();
    const collection = await ctx.db
      .query("collection")
      .withIndex("by_member_item", (q) => q.eq("member", member))
      .collect();
    return {
      rewards: rewards.filter(({ key }) => key.endsWith("-kudos-emoji")).map(({ key, xp, coins, item, at }) => ({ key, xp, coins, item, at })),
      collection: collection.map(({ item, source, arrivedAt }) => ({ item, source, arrivedAt })),
    };
  });
}

async function openCoins(t: Backend, member: MemberId) {
  await t.run((ctx) => ctx.db.insert("unlocks", { member, feature: "coins", readyAt: Date.now(), openedAt: Date.now() }));
}

async function membersWithTheBookOpen(t: Backend, ...users: string[]): Promise<MemberId[]> {
  const opened = new Set(users);
  return t.run(async (ctx) => {
    const members: MemberId[] = [];
    for (const user of ["U_ALICE", "U_BOB"]) {
      const member = await ctx.db.insert("members", { workspace: "T1", user, kind: "member" });
      if (opened.has(user)) await ctx.db.insert("unlocks", { member, feature: "book", readyAt: now.getTime(), openedAt: now.getTime() });
      members.push(member);
    }
    return members;
  });
}

async function openTheBook(t: Backend, ...members: MemberId[]) {
  await t.run(async (ctx) => {
    for (const member of members) await ctx.db.insert("unlocks", { member, feature: "book", readyAt: Date.now(), openedAt: Date.now() });
  });
}

async function withGiven(t: Backend, member: MemberId, count: number) {
  await t.run(async (ctx) => {
    await ctx.db.insert("ladderCounts", { member, ladder: "generosity", count });
    const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C0", message: "1760340000.000100", giver: member, recipient: member, kudos: count, day: "2026-10-12", at: now.getTime() - 86_400_000 });
    await ctx.db.insert("earnedTiers", { member, ladder: "generosity", tier: "bronze", earnedAt: now.getTime() - 86_400_000, award, catalogueVersion: "1", rewards: [] });
  });
}

async function giveKudos(t: Backend, giver: string, recipient: string, { ts = kudosTs, threadTs }: { ts?: string; threadTs?: string } = {}) {
  await t.fetch("/slack/events", await signedRequest(messageEvent([section(mention(recipient), emoji("taco"))], { user: giver, ts, threadTs })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, label: string) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, buttonInHome(slack, user, label)), form));
  await settle(t);
}

function slackTs(at: number) {
  return `${at / 1000}.000100`;
}

function tierDmsTo(user: string) {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => channel === user && String(text).startsWith("🏅"))
    .map(({ text }) => String(text));
}

function publicPosts() {
  return slack.callsTo("chat.postMessage").filter(({ channel }) => !String(channel).startsWith("U"));
}

function publicPostsIn(channel: string) {
  return slack.callsTo("chat.postMessage").filter((call) => call.channel === channel);
}

function tierLinesIn(channel: string) {
  return slack
    .messagesIn(channel)
    .flatMap(({ text }) => String(text).split("\n"))
    .filter((line) => line.startsWith("🏅"));
}
