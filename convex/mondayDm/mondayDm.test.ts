import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack, networkFailure, rateLimitedFor, type SlackArgs } from "../../testing/fakeSlack";
import { post, react, settleInTimeOrder, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { readBlocks, type Block } from "../../testing/slackInteractions";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, switchWebsite } from "../../testing/website";
import { internal } from "../_generated/api";
import crons from "../crons";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const mondayNine = Date.parse("2026-10-19T09:00:00Z");
const weekendBeforeMonday = Date.parse("2026-10-18T00:00:00Z");
const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const siteUrl = "https://kudos.example";
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const saysWhy = "thanks for untangling the flaky migration today";
const todaysFlags = ["xp-levels", "album", "collection", "packs", "hidden-items", "onboarding", "hugs", "message-settings"];
const mondayPath = [...todaysFlags, "monday-quest"];
const footer = "<slack://app?team=T1&id=A_KUDOS&tab=home|Change what I send you> in App Home's Settings tab.";
const nudge = "Hugs are a quick thanks. A kudos that names a teammate and says why earns much more XP.";
const sendMondayDm = "slack/mondayDm:sendMondayDm";
const sendHugsRecap = "slack/hugsRecap:sendHugsRecap";

type Person = { user: string; name: string };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  vi.stubEnv("SITE_URL", siteUrl);
  postHog = new FakePostHog();
  slack = new FakeSlack();
  for (const person of [alice, bob, carol]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await t.mutation(internal.workspace.url.rememberWorkspaceUrl, { workspace: "T1", url: "https://t1.slack.com/" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("MQ23 MQ24 MQ25 MQ28: at Monday 9:00 local a Monday-path member gets one DM built from their hugs and their quests", { timeout: 60_000 }, () => {
  test("a member hugged last week, one quest into onboarding, gets the recap's lines, then the journey with three buttons, and today's footer", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const hugged = await hug(bob, alice);

    await mondayArrives();

    expect(dmsTo(alice).map(seen)).toEqual([
      [
        `section: :taco: Your week in hugs\nTeammates reacted :taco: on your messages and gave you 1 hug (+1 XP).\n1 teammate reacted :taco: on your most-hugged message: <${permalinkOf(hugged)}|open it in Slack>`,
        "divider",
        `section: *Your onboarding journey* · 1 of 3 done\nTwo quests left this week. Each one pays +50 XP and an unidentified Hoggie for your collection.\n\nFive unidentified Hoggies for your collection are waiting for you.`,
        "✅ ~Thank someone and say why~",
        "👉 *Thank someone you haven't thanked before*",
        "⚪ Say why on 2 different days _1 of 2 days_",
        `actions: Identify them on the website (primary, dm-link:monday:book → ${siteUrl}/book) | See your quests (dm-link:monday:quests → ${siteUrl}/book#me) | Stop Monday quests`,
        `context: ${footer}`,
      ],
    ]);
    expect(dmTimesTo(alice)).toEqual([mondayNine]);
  });

  test("a member whose onboarding is done and who had no hugs gets this week's three drawn quests, drawn at the DM's start", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await finishOnboarding(alice);

    await mondayArrives();

    const [dm, ...more] = dmsTo(alice).map(seen);
    expect(more).toEqual([]);
    expect(dm?.[0]).toBe(`section: Happy Monday :sun_with_face: Here are three quests for your week. Each one pays +20 XP and an unidentified Hoggie for your collection.\n\nTen unidentified Hoggies for your collection are waiting for you.`);
    expect(dm?.slice(1, 4)).toHaveLength(3);
    for (const quest of dm!.slice(1, 4)) expect(quest).toMatch(/^⚪ /);
    expect(dm?.slice(4)).toEqual([`actions: Identify them on the website (primary, dm-link:monday:book → ${siteUrl}/book) | See your quests (dm-link:monday:quests → ${siteUrl}/book#me) | Stop Monday quests`]);
  });

  test("a member taken out of monday-quest before 9:00 gets the hugs recap alone, byte for byte as today's recap", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const hugged = await hug(bob, alice);
    await sweepsAt(Date.now() + hourMs);

    await switchWebsite(t, postHog, true, ...todaysFlags);
    await mondayArrives();

    expect(dmsTo(alice)).toEqual([
      {
        text: [":taco: Your week in hugs", "Teammates reacted :taco: on your messages and gave you 1 hug (+1 XP).", `1 teammate reacted :taco: on your most-hugged message: <${permalinkOf(hugged)}|open it in Slack>`, nudge, footer].join("\n"),
        blocks: undefined,
      },
    ]);
  });

  test("a member with no quests section and no hugs gets nothing that Monday", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await sweepsAt(Date.now() + hourMs);

    await switchWebsite(t, postHog, true, ...todaysFlags);
    await mondayArrives();

    expect(dmsTo(alice)).toEqual([]);
  });

  test("a member whose quests never started keeps today's recap and gets no Monday DM", async () => {
    await switchWebsite(t, postHog, true, ...todaysFlags);
    const carolsMessage = await thanks(carol, "thanks", alice);
    await hug(bob, carol, carolsMessage);
    await switchWebsite(t, postHog, true, ...mondayPath);

    await mondayArrives();

    expect(dmsTo(bob).map(({ text, blocks }) => ({ opening: String(text).split("\n").slice(0, 2), blocks }))).toEqual([{ opening: [":taco: Your week in hugs", "You reacted :taco: and gave 1 hug (+1 XP)."], blocks: undefined }]);
  });

  test("a member in a time zone ahead of UTC gets the DM at 9:00 there", async () => {
    slack.withMember(alice.user, { real_name: alice.name, tz: "Asia/Kolkata" });
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);

    await mondayArrives();

    expect(dmTimesTo(alice)).toEqual([Date.parse("2026-10-19T03:30:00Z")]);
  });
});

describe("MQ26: a member's week of hugs goes out once, in the Monday DM, whichever start runs first", { timeout: 60_000 }, () => {
  test("with today's recap starting first, the member still gets one DM with their hugs and their quests", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const hugged = await hug(bob, alice);
    await sweepsAt(Date.now() + hourMs);
    await settleUpTo(t, mondayNine - 1);

    await startsFirst(sendHugsRecap);
    await settleUpTo(t, mondayNine + hourMs);

    expect(dmsTo(alice).map(seen).map((dm) => [dm[0]?.split("\n")[0], dm[2]?.split("\n")[0]])).toEqual([["section: :taco: Your week in hugs", "section: *Your onboarding journey* · 1 of 3 done"]]);
  });

  test("with the Monday DM starting first and its post held, today's recap stands down, and one DM goes out", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const hugged = await hug(bob, alice);
    await sweepsAt(Date.now() + hourMs);
    await settleUpTo(t, mondayNine - 1);
    const recap = await cancelled(sendHugsRecap);
    const held = slack.holdNext("chat.postMessage");

    const sending = settleUpTo(t, mondayNine);
    await held.reached;
    await t.mutation(internal.hugs.recap.startRecap, recap);
    held.release();
    await sending;
    await settleUpTo(t, mondayNine + hourMs);

    expect(dmsTo(alice)).toHaveLength(1);
    expect(seen(dmsTo(alice)[0]!)[0]).toMatch(/^section: :taco: Your week in hugs/);
  });
});

describe("MQ27: the Monday DM goes out at most once", { timeout: 60_000 }, () => {
  test("a delivered DM records dm sent with its sections, and hugs recap sent as today", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const hugged = await hug(bob, alice);

    await mondayArrives();

    expect((await mondayDmsSentTo(alice)).map(({ properties }) => ({ kind: properties.kind, sections: properties.sections }))).toEqual([{ kind: "monday", sections: "hugs,quests" }]);
    expect(productEvents("hugs recap sent").map(({ properties }) => properties.hugs_received).toSorted(), "the hugs received in Bob's recap and in Alice's Monday DM").toEqual([0, 1]);
  });

  test("a rate limit is retried, at most three tries in all", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    slack.answeringIn("chat.postMessage", alice.user, rateLimitedFor(30), rateLimitedFor(30), rateLimitedFor(30), rateLimitedFor(30));

    await mondayArrives();

    expect(postsTo(alice)).toHaveLength(3);
    expect(dmsTo(alice)).toEqual([]);
    expect(await mondayDmsSentTo(alice)).toEqual([]);
  });

  test("a rate-limited DM goes out on a later try and is recorded once", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    slack.answeringIn("chat.postMessage", alice.user, rateLimitedFor(30));

    await mondayArrives();

    expect(dmsTo(alice)).toHaveLength(1);
    expect(await mondayDmsSentTo(alice)).toHaveLength(1);
  });

  test("an unknown answer is never sent again", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    slack.answeringIn("chat.postMessage", alice.user, networkFailure);

    await mondayArrives();
    await mondayArrives(mondayNine + 2 * dayMs);

    expect(postsTo(alice)).toHaveLength(1);
    expect(await mondayDmsSentTo(alice)).toEqual([]);
  });

  test("a start that Convex stranded is never sent again", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await sweepsAt(Date.now() + hourMs);
    await settleUpTo(t, mondayNine - 1);

    await startsFirst(sendMondayDm);
    await startsFirst(sendMondayDm);
    await sweepsAt(mondayNine + hourMs);
    await sweepsAt(mondayNine + 2 * hourMs);

    expect([...postsTo(alice), ...postsTo(bob)], "Alice's DM and Bob's, whom her kudos welcomed").toEqual([]);
  });
});

async function finishOnboarding(person: Person) {
  await thanks(person, saysWhy, bob);
  await thanks(person, "thanks", carol);
  vi.setSystemTime(Date.now() + dayMs);
  await thanks(person, saysWhy, bob);
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts });
  await settleInTimeOrder(t);
  return ts;
}

async function hug(giver: Person, author: Person, message = `${Math.floor(Date.now() / 1000) - 600}.000100`) {
  await react(t, { user: giver.user, itemUser: author.user, ts: message });
  await settleUpTo(t, Date.now() + minuteMs);
  return message;
}

async function mondayArrives(until = mondayNine + hourMs) {
  await sweepsAt(Math.min(Date.now() + hourMs, until));
  await settleUpTo(t, until);
  await sweepsAt(until);
}

async function sweepsAt(at: number) {
  await settleUpTo(t, at);
  await t.mutation(cronNamed("schedule each member's weekly hugs recap"), {});
  await t.mutation(cronNamed("ensure each member's coming Monday DM"), {});
  await settleUpTo(t, at);
}

function cronNamed(name: string) {
  const job = crons.crons[name];
  if (job === undefined) throw new Error(`no cron job named ${name}`);
  expect(job.schedule).toEqual({ type: "interval", hours: 1 });
  return makeFunctionReference<"mutation">(job.name);
}

async function startsFirst(functionName: typeof sendMondayDm | typeof sendHugsRecap) {
  const args = await cancelled(functionName);
  await t.mutation(functionName === sendMondayDm ? internal.mondayDm.mondayDm.startMondayDm : internal.hugs.recap.startRecap, args);
}

async function cancelled(functionName: string) {
  const job = await t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).find(({ name, state }) => name === functionName && state.kind === "pending"));
  if (job === undefined) throw new Error(`no pending ${functionName}`);
  await t.run((ctx) => ctx.scheduler.cancel(job._id));
  vi.setSystemTime(Math.max(Date.now(), job.scheduledTime));
  return job.args[0];
}

function postsTo(person: Person) {
  const times = slack.timesOf("chat.postMessage");
  return slack.callsTo("chat.postMessage").filter(({ channel }, index) => channel === person.user && times[index]! >= weekendBeforeMonday);
}

function dmsTo(person: Person) {
  const mondayTexts = new Set(postsTo(person).map(({ text }) => String(text)));
  return slack
    .messagesShownIn(person.user)
    .filter(({ text }) => mondayTexts.has(text))
    .map(({ text, blocks }) => ({ text, blocks }));
}

function dmTimesTo(person: Person) {
  return slack.timesOf("chat.postMessage", (args: SlackArgs) => args.channel === person.user).filter((at) => at >= weekendBeforeMonday);
}

function seen({ blocks }: { blocks?: unknown }): string[] {
  return ((blocks ?? []) as Block[]).flatMap((block) => (block.type === "rich_text" ? checklistOf(block) : block.type === "actions" ? [buttonsOf(block)] : readBlocks([block])));
}

type RichText = { type: string; name?: string; text?: string; style?: { bold?: boolean; strike?: boolean; italic?: boolean } };

function checklistOf(block: Block): string[] {
  const [list] = (block as unknown as { elements: Array<{ elements: Array<{ elements: RichText[] }> }> }).elements;
  return list!.elements.map(({ elements }) => elements.map(richTextOf).join("").trim());
}

const marks: Record<string, string> = { white_check_mark: "✅", point_right: "👉", white_circle: "⚪" };

function richTextOf({ type, name, text, style }: RichText) {
  if (type === "emoji") return marks[name!] ?? `:${name}:`;
  const styled = style?.strike ? `~${text!.trim()}~` : style?.bold ? `*${text!.trim()}*` : style?.italic ? `_${text!.trim()}_` : text!.trim();
  return ` ${styled}`;
}

function buttonsOf(block: Block) {
  const buttons = (block.elements ?? []) as Array<{ text: { text: string }; style?: string; action_id?: string; url?: string }>;
  return `actions: ${buttons.map(({ text, style, action_id, url }) => (url === undefined ? text.text : `${text.text} (${style === "primary" ? "primary, " : ""}${action_id} → ${url})`)).join(" | ")}`;
}


function productEvents(event: string) {
  return postHog.productEvents().filter((captured) => captured.event === event);
}

async function mondayDmsSentTo(person: Person) {
  const analyticsId = await t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique();
    const identity = await ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member!._id))
      .unique();
    return identity?.analyticsId;
  });
  return productEvents("dm sent").filter(({ distinct_id, properties }) => distinct_id === analyticsId && properties.kind === "monday");
}

function permalinkOf(message: string) {
  return `https://t1.slack.com/archives/C1/p${message.replace(".", "")}`;
}
