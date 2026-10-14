import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone } from "../../testing/flags";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { blockActions, buttonInHome, publishedHome } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { tellTiersEarned } from "../feedback/tierNotices";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const kudosTs = slackTs(now.getTime());

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
    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C1")).toEqual([]);
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

describe("P63 P64 P69: Settings and Admin say they cover achievements where the Book applies", () => {
  test("the mute and DM settings name achievements", async () => {
    const t = await workspace();
    await membersWithTheBookOpen(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", "Settings");

    expect(publishedHome(slack, "U_ALICE")).toContain("section: I celebrate your level ups and achievements in public. [button: Mute notices]");
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

    expect(settings).toContain("section: I celebrate your level ups in public. [button: Mute notices]");
    expect(settings).toContain("section: I send you a DM when you reach a level. [button: Turn off DMs]");
    expect(publishedHome(slack, "U_ALICE")).toContain(
      "section: I don't celebrate level ups in public yet. Pick a channel to celebrate them there. [channels_select: none]",
    );
  });
});

async function workspace({ announcementChannel }: { announcementChannel?: string } = {}) {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, ...(announcementChannel && { announcementChannel }) }));
  return bookShippedBeforeAnyoneJoined(t);
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

function publicPostsIn(channel: string) {
  return slack.callsTo("chat.postMessage").filter((call) => call.channel === channel);
}

function tierLinesIn(channel: string) {
  return slack
    .messagesIn(channel)
    .flatMap(({ text }) => String(text).split("\n"))
    .filter((line) => line.startsWith("🏅"));
}
