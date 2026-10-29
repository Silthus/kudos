import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack, slackError, type SlackArgs } from "../../testing/fakeSlack";
import { deliverAgain, post, settleInTimeOrder, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest } from "../../testing/signedSlack";
import { blockActions, buttonIn, type Block } from "../../testing/slackInteractions";
import { emoji, mention, section, text, userGroup } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, switchWebsite } from "../../testing/website";
import type { KudosGivenEvent } from "../bus/events";
import { publish, subscribers } from "../bus/publish";
import { setMessageSetting } from "../messageSettings/messageSettings";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const saysWhy = "thanks for untangling the flaky migration today";
const mondayPath = ["xp-levels", "album", "album-slack", "collection", "packs", "hidden-items", "onboarding", "monday-quest", "message-settings"];
const oneReply = "one-reply";
const questsJob = "quests/quests:followKudosGiven";
const grantJob = "album/packs:grantThoughtfulPacks";
const albumReplyJob = "feedback/albumReplies:replyAfterTheGrant";
const site = "https://kudos-site.test";
const footer = { type: "context", elements: [{ type: "mrkdwn", text: "<slack://app?team=T1&id=A_KUDOS&tab=home|Change what I send you> in App Home's Settings tab." }] };
const doneMark = { type: "emoji", name: "white_check_mark" };
const movedMark = { type: "emoji", name: "point_right", skin_tone: 2 };

const deliverForReal = vi.mocked(publish).getMockImplementation()!;

type Person = { user: string; name: string };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  vi.mocked(publish).mockClear();
  vi.mocked(publish).mockImplementation(deliverForReal);
  aDeploymentForWorkspace();
  vi.stubEnv("SITE_URL", site);
  postHog = new FakePostHog();
  slack = new FakeSlack();
  for (const person of [alice, bob, carol]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 3 }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("OR1: one private reply after a kudos shows what it gave, the quests it moved and the item it earned", { timeout: 60_000 }, () => {
  test("a first thoughtful kudos gets one message: who got kudos and the XP, the kudos left, the quest it finished with its reward, the quest it moved with its bar, the item for thanking, one button to identify them and one to the quests", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);

    await thanks(alice, saysWhy, bob);

    expect(messagesTo(alice), "the messages Alice got").toEqual([
      {
        channel: "C1",
        user: alice.user,
        text: "<@U_BOB> got 1 kudos from you · +10 XP\n2 kudos left today\nDone: Give a kudos to someone · +50 XP and an unidentified Hoggie\nThank someone on two different days · 🟩⬜ 1 of 2 days\n🎁 *An item for thanking Bob*",
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: "*<@U_BOB> got 1 kudos from you* · +10 XP" } },
          { type: "context", elements: [{ type: "mrkdwn", text: "2 kudos left today" }] },
          {
            type: "rich_text",
            elements: [
              {
                type: "rich_text_list",
                style: "bullet",
                indent: 0,
                elements: [
                  {
                    type: "rich_text_section",
                    elements: [doneMark, { type: "text", text: " Give a kudos to someone", style: { bold: false, strike: true } }, { type: "text", text: "  +50 XP and an unidentified Hoggie", style: { italic: true } }],
                  },
                  {
                    type: "rich_text_section",
                    elements: [movedMark, { type: "text", text: " Thank someone on two different days", style: { bold: true, strike: false } }, { type: "text", text: "  🟩⬜ 1 of 2 days", style: { italic: true } }],
                  },
                ],
              },
            ],
          },
          { type: "section", text: { type: "mrkdwn", text: "🎁 *An item for thanking Bob*" } },
          {
            type: "actions",
            elements: [
              { type: "button", text: { type: "plain_text", text: "Identify them on the website" }, url: `${site}/book`, action_id: "dm-link:kudos-reply:book", style: "primary" },
              { type: "button", text: { type: "plain_text", text: "See your quests" }, url: `${site}/book#me/quests`, action_id: "dm-link:kudos-reply:quests" },
            ],
          },
          footer,
        ],
      },
    ]);
  });

  test.each([
    ["Quests before the grant", [questsJob, grantJob]],
    ["the grant before Quests", [grantJob, questsJob]],
  ])("with %s, the quest and the item arrive in the same one message", async (_, order) => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    const held = holdingKudosGiven();

    await posts(alice, saysWhy, bob);
    await deliverInOrder(held[0]!, order);

    expect(messagesTo(alice).map(({ text }) => text), "the messages Alice got").toHaveLength(1);
    expect(blockTextsOf(messagesTo(alice)[0]!), "the one message").toEqual(expect.arrayContaining([" Give a kudos to someone", "🎁 *An item for thanking Bob*"]));
  });

  test("when the item never comes, the reply goes out after 10 seconds without it, and a later grant is told on its own", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    const held = holdingKudosGiven();

    await posts(alice, saysWhy, bob);
    await deliverInOrder(held[0]!, [], [grantJob]);
    await settleUpTo(t, Date.now() + 10_000);

    expect(messagesTo(alice), "the messages Alice got before the grant").toHaveLength(1);
    expect(blockTextsOf(messagesTo(alice)[0]!), "the reply without the item").not.toContain("🎁 *An item for thanking Bob*");

    await deliverOnly(held[0]!, [grantJob]);

    expect(messagesTo(alice), "the messages Alice got after the grant").toHaveLength(2);
  });

  test("a grant told in the one reply and delivered again sends nothing more", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    await thanks(alice, saysWhy, bob);

    await deliverAgain(t, albumReplyJob);

    expect(messagesTo(alice), "the messages Alice got").toHaveLength(1);
  });

  test("a grant later than the reply and delivered again is told on its own once", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    const held = holdingKudosGiven();
    await posts(alice, saysWhy, bob);
    await deliverInOrder(held[0]!, [], [grantJob]);
    await settleUpTo(t, Date.now() + 10_000);
    await deliverOnly(held[0]!, [grantJob]);

    await deliverAgain(t, albumReplyJob);

    expect(messagesTo(alice), "the messages Alice got").toHaveLength(2);
  });

  test("a quick thanks from a giver off the Monday path and without hidden items moves no quest and shows who got kudos, the kudos left and one button to the progress", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath.filter((flag) => flag !== "hidden-items" && flag !== "monday-quest"), oneReply);

    await thanks(alice, "thanks", bob);

    expect(messagesTo(alice).map(({ blocks }) => blocks), "the messages Alice got").toEqual([
      [
        { type: "section", text: { type: "mrkdwn", text: "*<@U_BOB> got 1 kudos from you* · +10 XP" } },
        { type: "context", elements: [{ type: "mrkdwn", text: "2 kudos left today" }] },
        { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "See your progress" }, url: `${site}/`, action_id: "dm-link:kudos-reply:home", style: "primary" }] },
        footer,
      ],
    ]);
  });

  test("a skipped mention still shows, and the last kudos of the day says when more come", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);

    await thanks(alice, "thanks", bob, carol, alice);
    await thanks(alice, "thanks", bob);

    expect(contextsOf(messagesTo(alice)[0]!), "the first message's context").toEqual(["1 kudos left today\nI skipped <@U_ALICE>: you can't give kudos to yourself."]);
    expect(contextsOf(messagesTo(alice)[1]!), "the last message's context").toEqual(["That was your last kudos for today, and you'll have 3 more at midnight."]);
  });

  test("a giver who chose a direct message gets the one reply there", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    await thanks(alice, "thanks", bob);
    const member = await memberOf(alice);
    await t.run((ctx) => setMessageSetting(ctx, member, "kudos-reply", "dm"));

    await thanks(alice, saysWhy, carol);

    const direct = directRepliesTo(alice);
    expect(direct.map(({ text }) => String(text).split("\n")[0]), "the direct messages Alice got").toEqual(["<@U_CAROL> got 1 kudos from you · +10 XP"]);
    expect(blockTextsOf(direct[0]!), "the direct message").toContain("🎁 *An item for thanking Carol*");
  });

  test.each(["user_not_in_channel", "channel_not_found", "not_in_channel"])("Slack refusing the reply beside the kudos with %s sends it as a direct message, once", async (error) => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    slack.answering("chat.postEphemeral", slackError(error));

    await thanks(alice, saysWhy, bob);

    const direct = directRepliesTo(alice);
    expect(direct.map(({ text }) => String(text).split("\n")[0]), "the direct messages Alice got").toEqual(["<@U_BOB> got 1 kudos from you · +10 XP"]);
    expect(blockTextsOf(direct[0]!), "the direct message").toContain("🎁 *An item for thanking Bob*");
  });

  test("a reply refused beside the kudos whose direct message lands but times out is sent once", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    slack.answering("chat.postEphemeral", slackError("user_not_in_channel"));
    vi.stubGlobal("fetch", routedFetch(postHog, theFirstReplyLandsButTimesOut(alice)));

    await thanks(alice, saysWhy, bob);
    await settleUpTo(t, Date.now() + dayMs);

    expect(messagesTo(alice).map(({ channel }) => channel), "where the reply was tried: the refused one beside the kudos, then the direct message").toEqual(["C1", alice.user]);
  });

  test("a reply still waiting for its item after Quests stays held, so the 10-second release of any version sends it", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    const held = holdingKudosGiven();

    await posts(alice, saysWhy, bob);
    await deliverOnly(held[0]!, [questsJob]);

    expect(messagesTo(alice), "the messages Alice got while the item is pending").toEqual([]);
    expect(await heldRepliesTo(alice), "Alice's replies still held").toBe(1);
  });

  test("Quests delivered twice for a kudos that finished two quests keeps both in its reply", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    const held = holdingKudosGiven();
    const dayOne = Date.now() + minuteMs;
    vi.setSystemTime(dayOne + dayMs);
    await posts(alice, saysWhy, bob);
    await postsAt(dayOne, alice, saysWhy, carol);
    const sentLater = held[1]!;

    await deliverOnly(sentLater, [questsJob, questsJob, grantJob]);

    expect(blockTextsOf(messagesTo(alice)[0]!), "the reply").toEqual(expect.arrayContaining([" Give a kudos to someone", " Thank someone on two different days"]));
  });

  test("an item section longer than one Slack text is cut short", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    await t.run(async (ctx) => ctx.db.patch((await ctx.db.query("workspaces").first())!._id, { baseAllowance: 20 }));
    const ampersands = Array.from({ length: 10 }, (_, index) => ({ user: `U_AMP${index}`, name: `${"&".repeat(79)}${index} Teammate` }));
    for (const person of ampersands) slack.withMember(person.user, { real_name: person.name });

    await thanks(alice, saysWhy, ...ampersands);

    const items = blockTextsOf(messagesTo(alice)[0]!).find((line) => line.startsWith("🎁"));
    expect(items?.length, "the item section's length").toBe(3_000);
    expect(items?.endsWith("…"), "the item section ends cut short").toBe(true);
  });

  test("after onboarding, a kudos shows each drawn quest it moved with its bar, and the next one shows the quest it finished with its reward", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    await finishOnboarding();

    await thanks(alice, saysWhy, carol);
    await thanks(alice, saysWhy, bob);

    const [moved, finished] = messagesTo(alice).slice(-2);
    expect(checklistOf(moved!), "the quests the first kudos moved").toEqual([
      ":point_right: Thank someone and say why, 3 times  🟩⬜⬜ 1 of 3 kudos",
      ":point_right: Thank someone and say why on 2 different days  🟩⬜ 1 of 2 days",
      ":point_right: Thank someone and say why, 2 times  🟩⬜ 1 of 2 kudos",
    ]);
    expect(checklistOf(finished!), "the quests the next kudos finished and moved").toEqual([
      ":white_check_mark: Thank someone and say why, 2 times  +20 XP and an unidentified Hoggie",
      ":point_right: Thank someone and say why, 3 times  🟩🟩⬜ 2 of 3 kudos",
    ]);
  });

  test("a recipient's name adds no markup to the reply", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    const dee = { user: "U_DEE", name: "<!here|everyone> Dee" };
    slack.withMember(dee.user, { real_name: dee.name });

    await thanks(alice, saysWhy, dee);

    expect(blockTextsOf(messagesTo(alice)[0]!), "the one message").toContain("🎁 *An item for thanking &lt;!here|everyone&gt;*");
  });

  test("a kudos that skips more mentions than Slack shows in one line still gets its reply, cut short", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    const groups = Array.from({ length: 150 }, (_, index) => userGroup(`S${String(index).padStart(10, "0")}`));

    await post(t, [section(text("thanks "), mention(bob.user), text(" "), ...groups.flatMap((group) => [group, text(" ")]), emoji("taco"))], { user: alice.user, ts: "1760349600.000001" });
    await settleInTimeOrder(t);

    const [context] = contextsOf(messagesTo(alice)[0]!);
    expect(context, "the context's start").toMatch(/^2 kudos left today\nI skipped <!subteam\^S0000000000>, /);
    expect(context?.length, "the context's length").toBe(3_000);
    expect(context?.endsWith("…"), "the context ends cut short").toBe(true);
  });

  test("each button pressed in the reply records its destination", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, oneReply);
    await thanks(alice, saysWhy, bob);
    await press(alice, "Identify them on the website");
    await press(alice, "See your quests");
    await switchWebsite(t, postHog, true, ...mondayPath.filter((flag) => flag !== "hidden-items"), oneReply);
    await thanks(alice, "thanks", carol);

    await press(alice, "See your progress");

    expect(linkClicks()).toEqual([
      { kind: "kudos-reply", destination: "book" },
      { kind: "kudos-reply", destination: "quests" },
      { kind: "kudos-reply", destination: "home" },
    ]);
  });

  test("with one-reply off, the giver gets today's text reply and the album reply apart", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);

    await thanks(alice, saysWhy, bob);

    expect(messagesTo(alice).map(({ text }) => text), "the messages Alice got").toEqual([
      "<@U_BOB> got 1 kudos from you. You have 2 kudos left today.\n+10 XP · <https://kudos-site.test/|See your progress on the web>\nQuest done: Give a kudos to someone · +50 XP and an unidentified Hoggie for your collection\n<slack://app?team=T1&id=A_KUDOS&tab=home|Change what I send you> in App Home's Settings tab.",
      "An item for thanking Bob",
    ]);
  });
});

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  await posts(giver, words, ...recipients);
  await settleInTimeOrder(t);
}

async function posts(giver: Person, words: string, ...recipients: Person[]) {
  vi.setSystemTime(Date.now() + minuteMs);
  await postsAt(Date.now(), giver, words, ...recipients);
}

async function postsAt(at: number, giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  const ts = `${at / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts });
  await settleForASecond();
}

function settleForASecond() {
  return settleUpTo(t, Date.now() + 1_000);
}

function holdingKudosGiven() {
  const held: KudosGivenEvent[] = [];
  vi.mocked(publish).mockImplementation(async (ctx, event) => {
    if (event.type === "kudosGiven") held.push(event);
    else await deliverForReal(ctx, event);
  });
  return held;
}

async function deliverInOrder(event: KudosGivenEvent, first: string[], skipped: string[] = []) {
  const rest = [...namedSubscribers().keys()].filter((name) => !first.includes(name) && !skipped.includes(name));
  await deliverOnly(event, [...first, ...rest]);
}

async function deliverOnly(event: KudosGivenEvent, names: string[]) {
  vi.mocked(publish).mockImplementation(deliverForReal);
  const named = namedSubscribers();
  for (const name of names) {
    await t.mutation(named.get(name)! as FunctionReference<"mutation", "internal", { event: KudosGivenEvent }>, { event });
    await settleForASecond();
  }
}

function namedSubscribers() {
  return new Map(subscribers.kudosGiven.map((subscription) => ("subscriber" in subscription ? subscription.subscriber : subscription)).map((subscriber) => [getFunctionName(subscriber), subscriber] as const));
}

function theFirstReplyLandsButTimesOut(person: Person): typeof fetch {
  let timedOut = false;
  return async (input, init) => {
    const response = await slack.fetch(input, init);
    const { channel, text } = init?.body ? JSON.parse(String(init.body)) : {};
    if (timedOut || channel !== person.user || !/kudos from you/.test(String(text))) return response;
    timedOut = true;
    throw new DOMException("The operation timed out.", "TimeoutError");
  };
}

function messagesTo(person: Person): SlackArgs[] {
  return [...slack.ephemeralsTo(person.user), ...directRepliesTo(person)];
}

function directRepliesTo(person: Person): SlackArgs[] {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === person.user && /kudos from you|^An item for thanking/.test(String(text)));
}

function blockTextsOf(message: SlackArgs): string[] {
  return JSON.stringify(message.blocks ?? []).match(/"text":"[^"]*"/g)?.map((found) => JSON.parse(`{${found}}`).text as string) ?? [];
}

function contextsOf(message: SlackArgs): string[] {
  const blocks = (message.blocks ?? []) as Array<{ type: string; elements?: Array<{ text?: string }> }>;
  return blocks
    .filter(({ type }) => type === "context")
    .slice(0, -1)
    .map(({ elements }) => elements?.map(({ text }) => text).join("") ?? "");
}

async function heldRepliesTo(person: Person) {
  const replies = await t.run((ctx) => ctx.db.query("privateReplies").collect());
  return replies.filter(({ to, held }) => to === person.user && held === true).length;
}

async function finishOnboarding() {
  await thanks(alice, saysWhy, bob);
  await thanks(alice, "thanks", carol);
  vi.setSystemTime(Date.now() + dayMs);
  await thanks(alice, saysWhy, bob);
}

function checklistOf(message: SlackArgs): string[] {
  const blocks = (message.blocks ?? []) as ChecklistBlock[];
  const sections = blocks.filter(({ type }) => type === "rich_text").flatMap(({ elements }) => elements?.flatMap((list) => list.elements ?? []) ?? []);
  return sections.map(({ elements }) => (elements ?? []).map((element) => (element.type === "emoji" ? `:${element.name}:` : element.text)).join(""));
}

type ChecklistBlock = { type: string; elements?: Array<{ elements?: Array<{ elements?: Array<{ type: string; name?: string; text?: string }> }> }> };

async function press(person: Person, label: string) {
  const reply = messagesTo(person).at(-1)!;
  const click = blockActions(person.user, buttonIn(reply.blocks as Block[], label), { inMessage: { channel: String(reply.channel), ts: "", ephemeral: true } });
  const response = await t.fetch("/slack/interactivity", await signedRequest(click, { contentType: "application/x-www-form-urlencoded" }));
  expect(response.status, "Slack's acknowledgement").toBe(200);
  await settleUpTo(t, Date.now() + minuteMs);
}

function linkClicks() {
  return postHog
    .productEvents()
    .filter(({ event }) => event === "dm link clicked")
    .map(({ properties: { kind, destination } }) => ({ kind, destination }));
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
