import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, networkFailure, rateLimitedFor, slackError } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsOnForEveryone, onForEveryone } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { post, react, settle, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aSignedInSession } from "../../testing/website";
import { internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import { questStartOf } from "../quests/start";
import { waitingHoggiesLineOf } from "../feedback/waitingHoggies";

const now = new Date("2026-10-13T10:00:00Z");
const hourMs = 60 * 60 * 1000;
const minuteMs = 60 * 1000;
const siteUrl = "https://kudos-site.test";
const saysWhy = "thanks for untangling the flaky migration today";
const todaysFlags = ["website", "album", "collection", "packs", "hugs", "xp-levels", "hidden-items", "welcome-item", "onboarding"];
const mondayPath = [...todaysFlags, "monday-quest"];
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const quests = `${siteUrl}/book#me/quests`;
const book = `${siteUrl}/book`;
const oneWaits = "An unidentified Hoggie for your collection is waiting for you.";
const firstThanksUpNext = "section: *Up next: thank someone and say why.*\nMention them, add :taco: and write a sentence about what they did.";

type Person = { user: string; name: string };

let slack: FakeSlack;
let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  slack = new FakeSlack();
  for (const person of [alice, bob, carol]) slack.withMember(person.user, { profile: { real_name: person.name, email: `${person.user.toLowerCase()}@example.com` } });
  postHog = flagsOnForEveryone(slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("MQ14 MQ15 MQ19 MQ21 MQ22: a first hug on the Monday path is answered with the hug welcome", { timeout: 60_000 }, () => {
  test("Bob's first hug on Alice's message sends Bob one welcome DM, byte for byte, and no ephemeral", async () => {
    t = await workspace(mondayPath);

    await hug(bob, alice);

    expect(welcomesTo(bob)).toEqual([
      {
        channel: "U_BOB",
        text: "Nice, that was your first hug!",
        blocks: [
          sectionOf(
            `Hey <@U_BOB> :wave::skin-tone-2: Nice, that was your first hug!\n\nA :taco: reaction is a quick thanks, and it just gave you and Alice Marchetti +1 XP. Want to really make someone's day? Thank them in a message and say why.\n\n${oneWaits}`,
          ),
          { type: "divider" },
          sectionOf("*Your onboarding journey* · 0 of 3 done"),
          {
            type: "rich_text",
            elements: [
              {
                type: "rich_text_list",
                style: "bullet",
                indent: 0,
                elements: [
                  { type: "rich_text_section", elements: [{ type: "emoji", name: "point_right", skin_tone: 2 }, { type: "text", text: " Thank someone and say why", style: { bold: true, strike: false } }] },
                  { type: "rich_text_section", elements: [{ type: "emoji", name: "white_circle" }, { type: "text", text: " Thank someone you haven't thanked before", style: { bold: false, strike: false } }] },
                  {
                    type: "rich_text_section",
                    elements: [
                      { type: "emoji", name: "white_circle" },
                      { type: "text", text: " Say why on 2 different days", style: { bold: false, strike: false } },
                      { type: "text", text: "  0 of 2 days", style: { italic: true } },
                    ],
                  },
                ],
              },
            ],
          },
          {
            ...sectionOf("*Up next: thank someone and say why.*\nMention them, add :taco: and write a sentence about what they did."),
            accessory: { type: "button", text: { type: "plain_text", text: "Show me how" }, url: `${quests}/first-thanks`, action_id: "dm-link:welcome:quests-how" },
          },
          { type: "context", elements: [{ type: "mrkdwn", text: "🎁 +50 XP and an unidentified Hoggie for your collection" }] },
          {
            type: "actions",
            elements: [
              { type: "button", text: { type: "plain_text", text: "Identify it now" }, url: book, action_id: "dm-link:welcome:book", style: "primary" },
              { type: "button", text: { type: "plain_text", text: "See your quests" }, url: quests, action_id: "dm-link:welcome:quests" },
            ],
          },
        ],
        unfurl_links: false,
        unfurl_media: false,
      },
    ]);
    expect(firstHugRepliesTo(bob)).toEqual([]);
  });

  test("a first hug on a Given kudos message names the people thanked", async () => {
    t = await workspace(mondayPath);
    const kudos = await thanks(alice, "thanks", carol);

    await hug(bob, alice, { ts: kudos });

    expect(noteTo(bob)).toContain("it just gave you and the people thanked +1 XP.");
  });

  test("Alice, hugged, is not welcomed: only the giver's first hug welcomes", async () => {
    t = await workspace(mondayPath);

    await hug(bob, alice);

    expect(welcomesTo(alice)).toEqual([]);
  });

  test("Bob's second hug sends nothing more", async () => {
    t = await workspace(mondayPath);

    await hug(bob, alice);
    await hug(bob, alice, { ts: messageAgo(2 * hourMs) });

    expect(welcomesTo(bob)).toHaveLength(1);
  });
});

describe("MQ14 MQ21: a first thoughtful kudos on the Monday path welcomes the giver at 1 of 3 and each recipient at 0 of 3", { timeout: 60_000 }, () => {
  test("the giver's welcome says the first step is done and points at thanking someone new", async () => {
    t = await workspace(mondayPath);

    await thanks(alice, saysWhy, bob);

    const [welcome] = welcomesTo(alice);
    expect(welcome?.text).toBe("You just completed the first step of your onboarding journey.");
    expect(readWelcome(welcome)).toEqual([
      `section: Hey <@U_ALICE> :wave::skin-tone-2: Your first kudos just landed with <@U_BOB>, and you said why. That's the one that counts! :tada:\n\nYou just completed the first step of your onboarding journey. Six unidentified Hoggies for your collection are waiting for you.`,
      "divider",
      "section: *Your onboarding journey* · 1 of 3 done",
      "rich_text: :white_check_mark: ~Thank someone and say why~ | :point_right: *Thank someone you haven't thanked before* | :white_circle: Say why on 2 different days _1 of 2 days_",
      `section: *Up next: thank someone you haven't thanked before.*\nSomeone from another team counts too. [link: Show me how ${quests}/someone-new]`,
      "context: 🎁 +50 XP and an unidentified Hoggie for your collection",
      "actions: [Identify them now] | See your quests",
    ]);
  });

  test("each recipient's welcome quotes the public kudos and asks them to pass it on", async () => {
    t = await workspace(mondayPath);

    await thanks(alice, saysWhy, bob, carol);

    for (const recipient of [bob, carol]) {
      const [welcome] = welcomesTo(recipient);
      expect(welcome?.text).toBe("<@U_ALICE> just thanked you with a kudos!");
      expect(readWelcome(welcome)).toEqual([
        `section: Hey <@${recipient.user}> :wave::skin-tone-2: <@U_ALICE> just thanked you with a kudos!\n> _${saysWhy} @Bob Okonkwo @Carol Lindqvist :taco:_\n\nFeels good, right? :slightly_smiling_face: ${oneWaits} Your first quest is to pass it on.`,
        "divider",
        "section: *Your onboarding journey* · 0 of 3 done",
        "rich_text: :point_right: *Thank someone and say why* | :white_circle: Thank someone you haven't thanked before | :white_circle: Say why on 2 different days _0 of 2 days_",
        `${firstThanksUpNext} [link: Show me how ${quests}/first-thanks]`,
        "context: 🎁 +50 XP and an unidentified Hoggie for your collection",
        "actions: [Identify it now] | See your quests",
      ]);
    }
  });

  test("a kudos that doesn't say why welcomes nobody", async () => {
    t = await workspace(mondayPath);

    await thanks(alice, "thanks", bob);

    expect(slack.callsTo("chat.postMessage").filter(isAMondayWelcome)).toEqual([]);
  });
});

describe("MQ13: one welcome per member, ever", { timeout: 60_000 }, () => {
  test("a hug and a thoughtful kudos in the same moment welcome Bob once", async () => {
    t = await workspace(mondayPath);

    await react(t, { user: bob.user, itemUser: alice.user, ts: messageAgo(hourMs) });
    await post(t, [section(text(`${saysWhy} `), mention(alice.user), text(" "), emoji("taco"))], { user: bob.user, ts: messageAgo(0) });
    await settle(t);

    expect(welcomesTo(bob)).toHaveLength(1);
  });

  test("a hug welcome and a later first thoughtful kudos welcome Bob once", async () => {
    t = await workspace(mondayPath);

    await hug(bob, alice);
    await thanks(bob, saysWhy, carol);

    expect(welcomesTo(bob).map(({ text }) => text)).toEqual(["Nice, that was your first hug!"]);
  });

  test.each(["welcome/welcome:welcomeOnHug", "welcome/welcome:welcomeNewMembers", "welcome/welcome:welcomeOnFirstThanks"])("a replayed %s sends nothing", async (subscriber) => {
    t = await workspace(mondayPath);
    await hug(bob, alice);
    await thanks(carol, saysWhy, alice);

    for (const job of await jobsOf(subscriber)) await t.mutation(makeFunctionReference<"mutation">(job.name), job.args[0] as never);
    await settle(t);

    expect(slack.callsTo("chat.postMessage").filter(isAMondayWelcome).map(({ channel }) => channel).toSorted()).toEqual(["U_ALICE", "U_BOB", "U_CAROL"]);
  });

  test("a member welcomed before the Monday path is never welcomed again", async () => {
    t = await workspace(todaysFlags);
    await thanks(alice, "thanks", bob);
    t = await flagsFromPostHog(t, postHog, ...mondayPath.map(onForEveryone));
    const before = slack.callsTo("chat.postMessage").length;

    await hug(bob, carol);
    await thanks(alice, saysWhy, carol);

    expect(slack.callsTo("chat.postMessage").slice(before).filter(isAMondayWelcome).map(({ channel }) => channel)).toEqual(["U_CAROL"]);
    expect(firstHugRepliesTo(bob)).toEqual([]);
  });
});

describe("MQ15 MQ43: off the Monday path, the first hug keeps its reply and sends no welcome", { timeout: 60_000 }, () => {
  test("Bob's first hug gets today's ephemeral first-hug reply and no DM", async () => {
    t = await workspace(todaysFlags);

    await hug(bob, alice);

    expect(slack.callsTo("chat.postEphemeral").map(({ text }) => text)).toEqual(["That was a hug: +1 XP for you and Alice Marchetti. Thank them in a message and say why to earn an item."]);
    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === bob.user)).toEqual([]);
  });
});

describe("MQ16: the welcome nudge never follows a welcome", { timeout: 60_000 }, () => {
  test("Bob, welcomed by his first hug, gets no nudge when Alice hugs his message", async () => {
    t = await workspace(mondayPath);
    await hug(bob, alice);

    await hug(alice, bob, { ts: messageAgo(2 * hourMs) });

    expect(nudgesTo(bob)).toEqual([]);
  });

  test("a thoughtful kudos to a new member sends them the welcome and no nudge", async () => {
    t = await workspace(mondayPath);

    await thanks(alice, saysWhy, bob);

    expect(nudgesTo(bob)).toEqual([]);
    expect(welcomesTo(bob)).toHaveLength(1);
  });

  test("a member nudged first is welcomed by their own first hug later", async () => {
    t = await workspace(mondayPath);
    await hug(alice, bob, { ts: messageAgo(2 * hourMs) });

    await hug(bob, alice);

    expect(nudgesTo(bob)).toHaveLength(1);
    expect(welcomesTo(bob)).toHaveLength(1);
  });
});

describe("MQ17: a welcome earns the welcome item, starts the quests and schedules its delivery", { timeout: 60_000 }, () => {
  test("a signed-in member's welcome still earns the welcome item", async () => {
    t = await workspace(mondayPath);
    await aSignedInSession(t, { user: bob.user, name: bob.name });

    await hug(bob, alice);

    expect(noteTo(bob)).toContain(oneWaits);
  });

  test("with welcome-item off no item waits: no waiting line, and See your quests is the primary button alone", async () => {
    t = await workspace(mondayPath.filter((flag) => flag !== "welcome-item"));

    await hug(bob, alice);

    const [welcome] = welcomesTo(bob);
    expect(noteTo(bob)).not.toContain("waiting for you");
    expect(readWelcome(welcome).at(-1)).toBe("actions: [See your quests]");
  });

  test("the hug welcome starts Bob's quests", async () => {
    t = await workspace(mondayPath);

    await hug(bob, alice);

    expect(await questStartOfPerson(bob)).not.toBeNull();
  });
});

describe("MQ18 MQ34: a welcome's delivery ends delivered, gone or failed, and only delivered records dm sent", { timeout: 60_000 }, () => {
  test("a delivered welcome records one dm sent with its kind and path", async () => {
    t = await workspace(mondayPath);

    await hug(bob, alice);
    await settleUpTo(t, Date.now() + hourMs);

    expect(dmsSent()).toEqual([{ kind: "welcome", path: "hug" }]);
  });

  test.each([
    ["a deactivated account", slackError("channel_not_found")],
    ["an unknown answer", networkFailure],
  ])("with %s it is tried once, never resent, and records no dm sent", async (_, answer) => {
    slack.answering("chat.postMessage", answer);
    t = await workspace(mondayPath);

    await hug(bob, alice);
    await settleUpTo(t, Date.now() + 2 * hourMs);

    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "U_BOB")).toHaveLength(1);
    expect(dmsSent()).toEqual([]);
  });

  test("a rate limit holds it, it goes out once the limit lifts, and records one dm sent", async () => {
    slack.answering("chat.postMessage", rateLimitedFor(30));
    t = await workspace(mondayPath);

    await hug(bob, alice);
    await settleUpTo(t, Date.now() + hourMs);

    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "U_BOB")).toHaveLength(2);
    expect(dmsSent()).toEqual([{ kind: "welcome", path: "hug" }]);
  });
});

describe("MQ20: the waiting line counts hoggie items, spelled out to ten", () => {
  test.each<[number | "50+", string | null]>([
    [0, null],
    [1, oneWaits],
    [2, "Two unidentified Hoggies for your collection are waiting for you."],
    [10, "Ten unidentified Hoggies for your collection are waiting for you."],
    [11, "11 unidentified Hoggies for your collection are waiting for you."],
    ["50+", "50+ unidentified Hoggies for your collection are waiting for you."],
  ])("%s waiting reads %s", (count, line) => {
    expect(waitingHoggiesLineOf(count)).toBe(line);
  });
});

async function workspace(flags: string[]) {
  const backend = await flagsFromPostHog(testBackend(), postHog, ...flags.map(onForEveryone));
  await backend.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await backend.mutation(internal.website.flag.prepareWebsiteFlag, {});
  return backend;
}

async function hug(giver: Person, author: Person, { ts = messageAgo(hourMs) } = {}) {
  await react(t, { user: giver.user, itemUser: author.user, ts });
  await settle(t);
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return ts;
}

function messageAgo(ms: number) {
  return `${Math.floor((Date.now() - ms) / 1000)}.000100`;
}

type Posted = { channel?: unknown; text?: unknown; blocks?: unknown };

function isAMondayWelcome({ blocks }: Posted) {
  return JSON.stringify(blocks ?? []).includes("dm-link:welcome:");
}

function welcomesTo(person: Person) {
  return slack.callsTo("chat.postMessage").filter((call) => call.channel === person.user && isAMondayWelcome(call));
}

function noteTo(person: Person) {
  return String(readWelcome(welcomesTo(person)[0])[0] ?? "");
}

function firstHugRepliesTo(person: Person) {
  return slack.ephemeralsTo(person.user).filter(({ text }) => String(text).startsWith("That was a hug"));
}

function nudgesTo(person: Person) {
  return slack.callsTo("chat.postMessage").filter(({ channel, blocks }) => channel === person.user && JSON.stringify(blocks ?? []).includes("welcome-nudge-open-album"));
}

type WelcomeBlock = { type: string; text?: { text: string }; accessory?: { text: { text: string }; url: string }; elements?: Array<Record<string, unknown>> };

function readWelcome(welcome: Posted | undefined): string[] {
  return ((welcome?.blocks ?? []) as WelcomeBlock[]).map(readWelcomeBlock);
}

function readWelcomeBlock(block: WelcomeBlock): string {
  if (block.type === "divider") return "divider";
  if (block.type === "context") return `context: ${(block.elements as Array<{ text: string }>).map(({ text }) => text).join(" ")}`;
  if (block.type === "actions") return `actions: ${(block.elements as Array<{ text: { text: string }; style?: string }>).map(({ text, style }) => (style === "primary" ? `[${text.text}]` : text.text)).join(" | ")}`;
  if (block.type === "rich_text") return `rich_text: ${checklistOf(block).join(" | ")}`;
  const accessory = block.accessory === undefined ? "" : ` [link: ${block.accessory.text.text} ${block.accessory.url}]`;
  return `${block.type}: ${block.text?.text}${accessory}`;
}

type RichElement = { type: string; name?: string; text?: string; style?: { bold?: boolean; strike?: boolean; italic?: boolean } };

function checklistOf(block: WelcomeBlock) {
  const [list] = block.elements as Array<{ elements: Array<{ elements: RichElement[] }> }>;
  return list!.elements.map(({ elements }) => elements.map(readRichElement).join("").trim());
}

function readRichElement({ type, name, text, style }: RichElement) {
  if (type === "emoji") return `:${name}:`;
  const words = text!.trim();
  if (style?.strike) return ` ~${words}~`;
  if (style?.bold) return ` *${words}*`;
  if (style?.italic) return ` _${words}_`;
  return ` ${words}`;
}

function sectionOf(text: string) {
  return { type: "section", text: { type: "mrkdwn", text } };
}

async function jobsOf(name: string) {
  return (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).filter((job) => job.name === name);
}

function dmsSent() {
  const sent = postHog.productEvents().filter(({ event }) => event === "dm sent");
  return [...new Map(sent.map((event) => [event.uuid, event])).values()].map(({ properties: { kind, path, sections } }) => ({ kind, ...(path !== undefined && { path }), ...(sections !== undefined && { sections }) }));
}

async function questStartOfPerson(person: Person) {
  const member = await memberOf(person);
  return t.run((ctx) => questStartOf(ctx, member));
}

async function memberOf(person: Person): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  return row!._id;
}
