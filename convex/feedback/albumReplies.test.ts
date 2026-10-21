import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { offForEveryone, onForEmails, onForEveryone, onInTheSandboxOnly } from "../../testing/flags";
import type { FlagDefinition } from "../../testing/fakePostHog";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack, rateLimitedFor, slackError, timesOut, type SlackCall } from "../../testing/fakeSlack";
import { memberChanged, post, settle, settleUntil, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession } from "../../testing/website";
import { api, components, internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { setMessageSetting } from "../messageSettings/messageSettings";
import type { MessagePlace } from "../messageSettings/kinds";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const weekMs = 7 * 24 * 60 * minuteMs;
const site = "https://kudos-site.test";
const channel = "C_TEAM";
const why = "Thanks for untangling the flaky migration";
const grantJob = vi.hoisted(() => "album/packs:grantThoughtfulPacks");
const replyJob = vi.hoisted(() => "feedback/albumReplies:replyAfterTheGrant");
const albumOn = ["website", "album", "collection", "packs", "xp-levels", "message-settings"];
const albumSlack = "album-slack";
const hiddenItems = "hidden-items";
const levelTwoItems = 3;

type Person = { user: string; name: string; email: string; profile: number };

const alice = person("Alice", "Marchetti", 1);
const bob = person("Bob", "Okonkwo", 2);
const carol = person("Carol", "Lindqvist", 3);
const dana = person("Dana", "Ferreira", 4);
const everyone = [alice, bob, carol, dana];
const bobsFace = aCutout("bob-okonkwo");
const bobsStoredFace = bobsFace.replace("/upload/", "/upload/c_limit,w_160,f_auto,q_auto/");
const lanterns: TeamPage = { slug: "lanterns", name: "Lanterns", profiles: [profileOf(alice), profileOf(bob, bobsFace), profileOf(carol)] };
const otters: TeamPage = { slug: "otters", name: "Otters", profiles: [profileOf(bob, bobsFace), profileOf(dana)] };

const theBus = vi.hoisted(() => ({ holdingGrants: false, heldGrants: [] as unknown[], withoutTheReply: false }));

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  actual.subscribers.kudosGiven = actual.subscribers.kudosGiven.map((subscription) => {
    if (!("subscriber" in subscription) || getFunctionName(subscription.subscriber) !== grantJob) return subscription;
    const { subscriber, only } = subscription;
    return {
      subscriber,
      only: (event: KudosGivenEvent) => {
        if (theBus.holdingGrants && only(event)) theBus.heldGrants.push(event);
        return !theBus.holdingGrants && only(event);
      },
    };
  });
  actual.subscribers.thoughtfulPacksGranted = actual.subscribers.thoughtfulPacksGranted.map((subscription) =>
    "subscriber" in subscription || getFunctionName(subscription) !== replyJob ? subscription : { subscriber: subscription, only: () => !theBus.withoutTheReply },
  );
  return actual;
});

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;
const kudosSent = new Map<string, { from: number; giver: string; threadRoot?: string }>();
let weeksLater = 0;
const albumPostAnswers: Array<"lands without an answer" | "rate limited" | "refused as rate_limited" | "lands with an internal error" | "refuses its pictures" | "refused as not in the channel"> = [];
const albumPostsWithPictures: boolean[] = [];

beforeEach(() => {
  theBus.holdingGrants = false;
  theBus.heldGrants = [];
  theBus.withoutTheReply = false;
  albumPostAnswers.length = 0;
  albumPostsWithPictures.length = 0;
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AL59: a thoughtful kudos gets one thread reply that names what each recipient's pack holds", { timeout: 60_000 }, () => {
  test("a thoughtful kudos to someone new and to someone already in the album shows its giver alone one reply in its thread, a section for each, the new person's team progress, their hype emoji as a picture, Open your pack and the gains line", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    await aliceCollects(carol);
    weeksLater += 1;

    const ts = await thanks(alice, why, bob, carol);

    expect(threadRepliesTo(ts)).toEqual([
      {
        channel,
        user: alice.user,
        text: "Bob is new in your album · A pack for thanking Carol",
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: "*Bob is new in your album*\nLanterns 2/2: page complete!\nOtters 1/2" } },
          { type: "context", elements: [{ type: "image", image_url: bobsStoredFace, alt_text: "Bob's hype emoji" }, { type: "mrkdwn", text: "Bob's hype emoji is unlocked" }] },
          { type: "section", text: { type: "mrkdwn", text: "*A pack for thanking Carol*\nCarol is already in your album, so this pack holds a hoggie." } },
          { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open your pack" }, url: `${site}/book#packs`, action_id: "album-open-packs" }] },
          { type: "context", elements: [{ type: "mrkdwn", text: "+20 XP" }] },
        ],
      },
    ]);
  });

  test("a second thoughtful kudos the same week says the next pack comes next week and links to the person's page, and a pack while an earlier one still holds the sticker says it is waiting", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    const first = await thanks(alice, why, dana);
    const sameWeek = await thanks(alice, "Thanks again for pairing on the rollback", dana);
    weeksLater += 1;
    const nextWeek = await thanks(alice, "Thanks for reviewing the quarterly runbook", dana);

    expect(sectionsOf(threadRepliesTo(first))).toEqual(["*Dana is new in your album*\nOtters 1/2"]);
    expect(sectionsOf(threadRepliesTo(sameWeek))).toEqual(["*Kudos counted.*\nYour next pack for Dana comes next week."]);
    expect(buttonsOf(threadRepliesTo(sameWeek))).toEqual([{ text: "See Dana's page", url: `${site}/book#people/${await memberOf(dana)}`, action_id: `album-see-person:${await memberOf(dana)}` }]);
    expect(sectionsOf(threadRepliesTo(nextWeek))).toEqual(["*Dana's sticker is already waiting in your packs*\nSo this pack holds a hoggie."]);
    expect(buttonsOf(threadRepliesTo(nextWeek))).toEqual([{ text: "Open your pack", url: `${site}/book#packs`, action_id: "album-open-packs" }]);
    expect(hypeLinesOf(threadRepliesTo(first))).toEqual(["Dana's hype emoji is unlocked"]);
    expect(hypeLinesOf(threadRepliesTo(sameWeek))).toEqual([]);
    expect(hypeLinesOf(threadRepliesTo(nextWeek))).toEqual([]);
  });

  test("AL29 AL30: a hype emoji Slack has shows Slack's picture with its name, one Slack doesn't have only shows its picture, falling back to the hype emblem without a face", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    slack.withCustomEmoji("bob-okonkwo-hype", "https://emoji.slack-edge.com/T1/bob-okonkwo-hype/1.png");
    await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
    await settle(t);

    const ts = await thanks(alice, why, bob, dana);

    expect(contextsOf(threadRepliesTo(ts))).toEqual([
      [{ type: "image", image_url: "https://emoji.slack-edge.com/T1/bob-okonkwo-hype/1.png", alt_text: "Bob's hype emoji" }, { type: "mrkdwn", text: "Bob's hype emoji is unlocked: :bob-okonkwo-hype:" }],
      [{ type: "image", image_url: `${site}/emoji/hype.png`, alt_text: "Dana's hype emoji" }, { type: "mrkdwn", text: "Dana's hype emoji is unlocked" }],
      [{ type: "mrkdwn", text: "+20 XP" }],
    ]);
  });

  test("the reply is never posted in public, and one Slack refuses beside the kudos arrives as a DM to the giver", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    const shown = await thanks(alice, why, bob);
    albumPostAnswers.push("refused as not in the channel");
    const refused = await thanks(carol, why, dana);

    expect(threadRepliesTo(shown)).toHaveLength(1);
    expect(albumPostsInPublic()).toEqual([]);
    expect(threadRepliesTo(refused)).toEqual([]);
    expect(albumRepliesIn(carol.user).map((reply) => sectionsOf([reply]))).toEqual([["*Dana is new in your album*\nOtters 1/2"]]);
  });

  test("a kudos posted in a thread is answered in that thread, a giver who chose DMs gets it as a DM, and one who turned kudos replies off gets none", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    const root = "1760349000.000001";
    const inAThread = await thanks(alice, why, bob, { threadTs: root });
    await choosesKudosRepliesIn(carol, "dm");
    const carolsKudos = await thanks(carol, why, bob);
    await choosesKudosRepliesIn(dana, "none");
    await thanks(dana, why, bob);

    expect(threadRepliesTo(inAThread).map(({ thread_ts }) => thread_ts)).toEqual([root]);
    expect(threadRepliesTo(carolsKudos)).toEqual([]);
    expect(albumRepliesIn(carol.user).map((reply) => sectionsOf([reply]))).toEqual([["*Bob is new in your album*\nLanterns 1/2\nOtters 1/2"]]);
    expect(everyAlbumReply().map(({ channel: to, user }) => ({ to, user }))).toEqual([
      { to: channel, user: alice.user },
      { to: carol.user, user: undefined },
    ]);
  });

  test("a short kudos keeps today's private reply and posts nothing in its thread", async () => {
    await fourMembers([onForEveryone(albumSlack)]);

    const ts = await thanks(alice, "ty", bob);

    expect(threadRepliesTo(ts)).toEqual([]);
    expect(slack.ephemeralsTo(alice.user).map(({ text }) => text)).toEqual([expect.stringContaining("got 1 kudos from you")]);
  });

  test("with Feedback's private reply delivered before the grant and the grant run after, the reply is posted once, and a grant run again posts nothing more", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    theBus.holdingGrants = true;
    const ts = await thanks(alice, why, bob);
    const [held] = theBus.heldGrants as KudosGivenEvent[];

    expect(slack.ephemeralsTo(alice.user)).toHaveLength(1);
    expect(threadRepliesTo(ts)).toEqual([]);

    await t.mutation(internal.album.packs.grantThoughtfulPacks, { event: held! });
    await settle(t);
    await t.mutation(internal.album.packs.grantThoughtfulPacks, { event: held! });
    await settle(t);

    expect(sectionsOf(threadRepliesTo(ts))).toEqual(["*Bob is new in your album*\nLanterns 1/2\nOtters 1/2"]);
    expect(threadRepliesTo(ts)).toHaveLength(1);
  });

  test("a reply whose post lands without Slack's answer is never posted again, and one Slack rate-limits is posted once it may", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    albumPostAnswers.push("lands without an answer");
    const lost = await thanks(alice, why, bob);
    albumPostAnswers.push("rate limited");
    const limited = await thanks(carol, why, dana);

    expect(threadRepliesTo(lost), "the post whose answer was lost").toHaveLength(1);
    expect(threadRepliesTo(limited), "the post Slack rate-limited once").toHaveLength(1);
  });

  test("two new people who complete a team page together are each told it is complete", async () => {
    await fourMembers([onForEveryone(albumSlack)]);

    const ts = await thanks(alice, why, bob, dana);

    expect(sectionsOf(threadRepliesTo(ts))).toEqual(["*Bob is new in your album*\nLanterns 1/2\nOtters 2/2: page complete!", "*Dana is new in your album*\nOtters 2/2: page complete!"]);
  });

  test("a post Slack refuses as rate_limited, without an HTTP 429, is posted once it may", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    albumPostAnswers.push("refused as rate_limited");

    const ts = await thanks(alice, why, bob);

    expect(threadRepliesTo(ts)).toHaveLength(1);
  });

  test("Slack answering internal_error after the post landed is not posted again either, and a post Slack refuses for its pictures is sent once more without them", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    albumPostAnswers.push("lands with an internal error");
    const ambiguous = await thanks(alice, why, bob);
    albumPostAnswers.push("refuses its pictures");
    albumPostsWithPictures.length = 0;
    const refused = await thanks(carol, why, dana);

    expect(albumPostsWithPictures, "the refused post carried a picture and the one sent again carried none").toEqual([true, false]);
    expect(threadRepliesTo(ambiguous), "the post answered internal_error").toHaveLength(1);
    expect(sectionsOf(threadRepliesTo(refused))).toEqual(["*Dana is new in your album*\nOtters 1/2"]);
    expect(contextsOf(threadRepliesTo(refused))).toEqual([[{ type: "mrkdwn", text: "Dana's hype emoji is unlocked" }], [{ type: "mrkdwn", text: "+10 XP" }]]);
  });

  test("two people whose next pack comes next week get a page button each, every button with its own action", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    await thanks(alice, why, bob, dana);
    const again = await thanks(alice, "Thanks again for pairing on the rollback", bob, dana);

    expect(buttonsOf(threadRepliesTo(again))).toEqual([
      { text: "See Bob's page", url: `${site}/book#people/${await memberOf(bob)}`, action_id: `album-see-person:${await memberOf(bob)}` },
      { text: "See Dana's page", url: `${site}/book#people/${await memberOf(dana)}`, action_id: `album-see-person:${await memberOf(dana)}` },
    ]);
  });

  test("a pack earned by a recipient past the ten the reply names still offers Open your pack", async () => {
    const crowd = Array.from({ length: 12 }, (_, index) => person("Guest", `Number${index + 1}`, 10 + index));
    await fourMembers([onForEveryone(albumSlack)], crowd);
    await thanks(alice, why, ...crowd.slice(0, 10));

    const again = await thanks(alice, "Thanks again for staffing the help desk", ...crowd);

    expect(sectionsOf(threadRepliesTo(again))).toEqual(Array<string>(10).fill("*Kudos counted.*\nYour next pack for Guest comes next week."));
    expect(buttonsOf(threadRepliesTo(again)).map(({ text }) => text)).toEqual(["Open your pack"]);
  });

  test("a hype emoji is told unlocked once, by the grant that ran first, even when an earlier week's kudos is granted after it", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    theBus.holdingGrants = true;
    await thanks(alice, why, dana);
    theBus.holdingGrants = false;
    weeksLater += 1;
    await thanks(alice, "Thanks for reviewing the quarterly runbook", dana);
    const firstReplies = albumRepliesIn(channel);
    await t.mutation(internal.album.packs.grantThoughtfulPacks, { event: (theBus.heldGrants as KudosGivenEvent[])[0]! });
    await settle(t);
    const lateReplies = albumRepliesIn(channel).slice(firstReplies.length);

    expect(hypeLinesOf(firstReplies)).toEqual(["Dana's hype emoji is unlocked"]);
    expect(lateReplies, "the earlier week's kudos, granted last, got its own reply").toHaveLength(1);
    expect(hypeLinesOf(lateReplies)).toEqual([]);
  });

  test("a message to more people than one reply can name names the first ten and counts the rest", async () => {
    const crowd = Array.from({ length: 12 }, (_, index) => person("Guest", `Number${index + 1}`, 10 + index));
    await fourMembers([onForEveryone(albumSlack)], crowd);

    const ts = await thanks(alice, why, ...crowd);

    const [reply] = threadRepliesTo(ts);
    expect(sectionsOf([reply!])).toHaveLength(10);
    expect(contextsOf([reply!]).at(-2)).toEqual([{ type: "mrkdwn", text: "And 2 more." }]);
    expect(reply!.blocks.length).toBeLessThanOrEqual(50);
  });
});

describe("LP25: while hidden-items is on for the giver, the reply says only that an item waits", { timeout: 60_000 }, () => {
  test("a thoughtful kudos to someone new and to someone already thanked names an item for each, how many wait counting this grant's, one See your items button and the gains line, and no face, page progress, emoji or rarity", async () => {
    await fourMembers([onForEveryone(albumSlack), onForEveryone(hiddenItems)]);
    await thanks(alice, why, carol);
    weeksLater += 1;

    const ts = await thanks(alice, why, bob, carol);

    expect(threadRepliesTo(ts)).toEqual([
      {
        channel,
        thread_ts: ts,
        text: "An item for thanking Bob · An item for thanking Carol",
        unfurl_links: false,
        unfurl_media: false,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: "*An item for thanking Bob*" } },
          { type: "section", text: { type: "mrkdwn", text: "*An item for thanking Carol*" } },
          { type: "context", elements: [{ type: "mrkdwn", text: `${5 + levelTwoItems} wait` }] },
          { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "See your items" }, url: `${site}/book`, action_id: "album-see-items" }] },
          { type: "context", elements: [{ type: "mrkdwn", text: "+20 XP" }] },
        ],
      },
    ]);
  });

  test("a second thoughtful kudos the same week says the next item comes next week, still counts what waits and offers See your items", async () => {
    await fourMembers([onForEveryone(albumSlack), onForEveryone(hiddenItems)]);
    await thanks(alice, why, dana);

    const sameWeek = await thanks(alice, "Thanks again for pairing on the rollback", dana);

    expect(sectionsOf(threadRepliesTo(sameWeek))).toEqual(["*Kudos counted.*\nYour next item for Dana comes next week."]);
    expect(contextsOf(threadRepliesTo(sameWeek))[0]).toEqual([{ type: "mrkdwn", text: `${2 + levelTwoItems} wait` }]);
    expect(buttonsOf(threadRepliesTo(sameWeek))).toEqual([{ text: "See your items", url: `${site}/book`, action_id: "album-see-items" }]);
  });

  test("past fifty waiting items the count reads 50+ wait, and fifty read 50 wait", async () => {
    await fourMembers([onForEveryone(albumSlack), onForEveryone(hiddenItems)]);
    const first = await thanks(alice, why, bob);
    await aliceHasWaiting(46 - levelTwoItems);
    weeksLater += 1;
    const fiftieth = await thanks(alice, why, carol);
    weeksLater += 1;

    const fiftyFirst = await thanks(alice, why, dana);

    expect(contextsOf(threadRepliesTo(first))[0]).toEqual([{ type: "mrkdwn", text: "2 wait" }]);
    expect(contextsOf(threadRepliesTo(fiftieth))[0]).toEqual([{ type: "mrkdwn", text: "50 wait" }]);
    expect(contextsOf(threadRepliesTo(fiftyFirst))[0]).toEqual([{ type: "mrkdwn", text: "50+ wait" }]);
  });

  test("with hidden-items on for someone else's email only, the same walk makes every Slack call byte for byte as with no hidden-items flag", async () => {
    const today = await walkWith(albumOn, [onForEveryone(albumSlack)]);

    const walk = await walkWith(albumOn, [onForEveryone(albumSlack), onForEmails(hiddenItems, dana.email)]);

    expect(walk.calls).toEqual(today.calls);
  });
});

async function aliceHasWaiting(count: number) {
  const [member, person] = [await memberOf(alice), await memberOf(bob)];
  await t.run(async (ctx) => {
    for (let index = 0; index < count; index += 1) await ctx.db.insert("items", { workspace: "T1", member, source: "hoggie", key: `thoughtful:seeded-${index}`, reason: { kind: "thanks", person, message: { workspace: "T1", conversation: channel, message: `1.${index}` } }, earnedAt: Date.now() });
  });
}

const albumSlackOff: Array<{ condition: string; flags: FlagDefinition[]; turnOff?: () => void }> = [
  { condition: "with album-slack off", flags: [offForEveryone(albumSlack)] },
  { condition: "while PostHog has no album-slack flag", flags: [] },
  { condition: "without the flags key, even when PostHog turned album-slack on", flags: [onForEveryone(albumSlack)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "") },
  { condition: "in production, while album-slack is on in the sandbox only", flags: [onInTheSandboxOnly(albumSlack)], turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production") },
  { condition: "with album-slack on but album off for the giver", flags: [onForEveryone(albumSlack)] },
  { condition: "with album-slack on for someone else's email only", flags: [onForEmails(albumSlack, dana.email)] },
];

describe("AL58: album moments are dark where album-slack is off", { timeout: 60_000 }, () => {
  test.each(albumSlackOff)("$condition, a walk of thoughtful, short and threaded kudos makes every Slack call the same walk makes without the thread reply, and exposes nothing", async ({ condition, flags, turnOff }) => {
    const albumFlags = condition.includes("album off") ? albumOn.filter((key) => key !== "album") : albumOn;
    theBus.withoutTheReply = true;
    const withoutTheReply = await walkWith(albumFlags, flags, turnOff);
    theBus.withoutTheReply = false;

    const walk = await walkWith(albumFlags, flags, turnOff);

    expect(walk.calls).toEqual(withoutTheReply.calls);
    expect(walk.packs, "the packs are earned all the same").toBeGreaterThan(0);
    expect(walk.exposures).toEqual([]);
  });

  test("a reply whose delivery waits on a rate limit is not posted once album-slack turned off for the giver", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    albumPostAnswers.push("rate limited");
    const ts = await thanks(alice, why, bob, { settling: "until the first answer" });
    expect({ answersLeft: albumPostAnswers.length, posted: threadRepliesTo(ts) }, "the first post was rate-limited and nothing was posted yet").toEqual({ answersLeft: 0, posted: [] });
    postHog.withFlags(...albumOn.map(onForEveryone), offForEveryone(albumSlack));
    await t.action(components.posthog.lib.refreshFlagDefinitions, {});
    await settle(t);

    expect(threadRepliesTo(ts)).toEqual([]);
  });

  test("with album-slack on for the giver's email, the same walk adds only the thread replies of the giver's thoughtful kudos", async () => {
    theBus.withoutTheReply = true;
    const withoutTheReply = await walkWith(albumOn, [onForEmails(albumSlack, alice.email)]);
    theBus.withoutTheReply = false;

    const walk = await walkWith(albumOn, [onForEmails(albumSlack, alice.email)]);

    const added = walk.calls.filter((call) => !withoutTheReply.calls.includes(call)).map((call) => JSON.parse(call) as SlackCall);
    expect(added.map(({ method, args }) => ({ method, channel: args.channel, thread_ts: args.thread_ts, user: args.user }))).toEqual([{ method: "chat.postEphemeral", channel, thread_ts: undefined, user: alice.user }]);
    expect(withoutTheReply.calls.every((call) => walk.calls.includes(call))).toBe(true);
  });
});

async function walkWith(albumFlags: string[], flags: FlagDefinition[], turnOff?: () => void) {
  await fourMembers(flags, [], albumFlags, turnOff);
  const alicesThoughtfulKudos = await thanks(alice, why, bob, carol);
  await thanks(carol, "ty", bob);
  await thanks(bob, "Thanks for reviewing the incident write-up so quickly", alice, { threadTs: "1760349000.000001" });
  const packs = await t.run(async (ctx) => (await ctx.db.query("thoughtfulPacks").collect()).length);
  const exposures = await t.run(async (ctx) => (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flag === albumSlack));
  return { calls: slack.calls.map((call) => JSON.stringify(call)).sort(), packs, exposures, alicesThoughtfulKudos };
}

async function fourMembers(flags: FlagDefinition[], more: Person[] = [], albumFlags = albumOn, turnOff?: () => void) {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  vi.stubEnv("SITE_URL", site);
  messages = 0;
  weeksLater = 0;
  kudosSent.clear();
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom().withTeams(lanterns, otters, ...(more.length > 0 ? [{ slug: "guests", name: "Guests", profiles: more.map((guest) => profileOf(guest)) }] : []));
  slack = new FakeSlack();
  for (const someone of [...everyone, ...more]) slack.withMember(someone.user, { profile: { display_name: someone.name, real_name: someone.name, email: someone.email } });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : chatAnswering(input, init))));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  postHog.withFlags(...albumFlags.map(onForEveryone), ...flags);
  await t.action(components.posthog.lib.refreshFlagDefinitions, {});
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  for (const someone of [...everyone, ...more]) await memberChanged(t, "team_join", { id: someone.user, team_id: "T1", name: someone.name, real_name: someone.name, profile: { real_name: someone.name, display_name: someone.name, email: someone.email } });
  await settle(t);
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await settle(t);
  turnOff?.();
  slack.calls.length = 0;
}

async function chatAnswering(input: string | URL | Request, init?: RequestInit) {
  const isAnAlbumPost = /\/chat\.post(Message|Ephemeral)$/.test(String(input instanceof Request ? input.url : input)) && String(init?.body ?? "").includes("album-");
  if (isAnAlbumPost) albumPostsWithPictures.push(String(init?.body).includes('"type":"image"'));
  const answer = isAnAlbumPost ? albumPostAnswers.shift() : undefined;
  if (answer === "rate limited") return rateLimitedFor(60)(() => new Response());
  if (answer === "refused as rate_limited") return slackError("rate_limited")(() => new Response());
  if (answer === "refuses its pictures") return slackError("invalid_blocks")(() => new Response());
  if (answer === "refused as not in the channel") return slackError("user_not_in_channel")(() => new Response());
  const answered = await slack.fetch(input, init);
  if (answer === "lands with an internal error") return slackError("internal_error")(() => answered);
  return answer === "lands without an answer" ? timesOut(() => answered) : answered;
}

type Options = { threadTs?: string; settling?: "until the first answer" };

async function thanks(giver: Person, words: string, ...recipientsAndOptions: Array<Person | Options>) {
  const recipients = recipientsAndOptions.filter((item): item is Person => "user" in item);
  const { threadTs, settling } = recipientsAndOptions.find((item): item is Options => !("user" in item)) ?? {};
  messages += 1;
  vi.setSystemTime(tuesday.getTime() + weeksLater * weekMs + messages * minuteMs);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  kudosSent.set(ts, { from: slack.calls.length, giver: giver.user, ...(threadTs && { threadRoot: threadTs }) });
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts, channel, ...(threadTs && { threadTs }) });
  if (settling === "until the first answer") await settleUntil(t, new Date(Date.now() + 5_000));
  else await settle(t);
  return ts;
}

async function aliceCollects(...people: Person[]) {
  await thanks(alice, why, ...people);
  const { asSignedIn } = await aSignedInSession(t, { user: alice.user, name: alice.name });
  const album = await asSignedIn.query(api.website.album.getAlbum, {});
  for (const { pack } of album.kind === "album" ? album.packs : []) await asSignedIn.mutation(api.website.album.openThoughtfulPack, { pack });
  for (let placed = await asSignedIn.mutation(api.website.album.putAllIn, {}); placed.kind === "placed" && placed.more; ) placed = await asSignedIn.mutation(api.website.album.putAllIn, {});
  await settle(t);
}

async function choosesKudosRepliesIn(someone: Person, place: MessagePlace) {
  const member = await memberOf(someone);
  await t.run((ctx) => setMessageSetting(ctx, member, "kudos-reply", place));
}

type Posted = { channel: string; thread_ts?: string; user?: string; text: string; blocks: Array<{ type: string; text?: { text: string }; elements?: unknown[] }> };

function everyAlbumReply(): Posted[] {
  return (slack.calls as unknown as Array<{ method: string; args: Posted }>)
    .filter(({ method, args }) => (method === "chat.postMessage" || method === "chat.postEphemeral") && JSON.stringify(args.blocks ?? []).includes("album"))
    .map(({ args }) => args);
}

function albumPostsInPublic(): Posted[] {
  return (slack.callsTo("chat.postMessage") as unknown as Posted[]).filter(({ channel: to, blocks }) => to === channel && JSON.stringify(blocks ?? []).includes("album"));
}

function threadRepliesTo(ts: string): Posted[] {
  const kudos = kudosSent.get(ts);
  if (kudos === undefined) return [];
  const nextKudos = Math.min(slack.calls.length, ...[...kudosSent.values()].map(({ from }) => from).filter((from) => from > kudos.from));
  return (slack.calls.slice(kudos.from, nextKudos) as unknown as Array<{ method: string; args: Posted }>)
    .filter(({ method, args }) => method === "chat.postEphemeral" && args.channel === channel && args.user === kudos.giver && args.thread_ts === kudos.threadRoot && JSON.stringify(args.blocks ?? []).includes("album"))
    .map(({ args }) => args);
}

function albumRepliesIn(conversation: string): Posted[] {
  return everyAlbumReply().filter(({ channel: to }) => to === conversation);
}

function sectionsOf(replies: Posted[]) {
  return replies.flatMap(({ blocks }) => blocks.filter(({ type }) => type === "section").map((block) => block.text!.text));
}

function contextsOf(replies: Posted[]) {
  return replies.flatMap(({ blocks }) => blocks.filter(({ type }) => type === "context").map(({ elements }) => elements));
}

function hypeLinesOf(replies: Posted[]) {
  return contextsOf(replies).flatMap((elements) => (elements as Array<{ type: string; text?: string }>).filter(({ text }) => text?.includes("hype emoji")).map(({ text }) => text));
}

function buttonsOf(replies: Posted[]) {
  return replies.flatMap(({ blocks }) =>
    blocks.filter(({ type }) => type === "actions").flatMap(({ elements }) => (elements as Array<{ text: { text: string }; url: string; action_id: string }>).map(({ text, url, action_id }) => ({ text: text.text, url, action_id }))),
  );
}

async function memberOf(someone: Person) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", someone.user))
      .unique(),
  );
  return row!._id;
}

function person(first: string, last: string, profile: number): Person {
  return { user: `U_${first}_${last}`.toUpperCase(), name: `${first} ${last}`, email: `${first}.${last}@example.com`.toLowerCase(), profile };
}

function profileOf({ name, profile }: Person, cutout?: string): TeamPage["profiles"][number] {
  const [firstName, lastName] = name.split(" ") as [string, string];
  return { id: profile, firstName, lastName, colour: "teal", ...(cutout && { cutout }) };
}
