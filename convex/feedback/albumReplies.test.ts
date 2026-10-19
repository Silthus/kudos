import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { offForEveryone, onForEmails, onForEveryone, onInTheSandboxOnly } from "../../testing/flags";
import type { FlagDefinition } from "../../testing/fakePostHog";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
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
const replyJob = vi.hoisted(() => "feedback/albumReplies:replyInThread");
const albumOn = ["website", "album", "collection", "packs", "xp-levels", "message-settings"];
const albumSlack = "album-slack";

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
let weeksLater = 0;

beforeEach(() => {
  theBus.holdingGrants = false;
  theBus.heldGrants = [];
  theBus.withoutTheReply = false;
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AL59: a thoughtful kudos gets one thread reply that names what each recipient's pack holds", { timeout: 60_000 }, () => {
  test("a thoughtful kudos to someone new and to someone already in the album posts one public reply in its thread, a section for each, the new person's team progress, their hype emoji as a picture, Open your pack and the gains line", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    await aliceCollects(carol);
    weeksLater += 1;

    const ts = await thanks(alice, why, bob, carol);

    expect(threadRepliesTo(ts)).toEqual([
      {
        channel,
        thread_ts: ts,
        text: "Bob is new in your album · A pack for thanking Carol",
        unfurl_links: false,
        unfurl_media: false,
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
    expect(buttonsOf(threadRepliesTo(sameWeek))).toEqual([{ text: "See Dana's page", url: `${site}/book#people/${await memberOf(dana)}`, action_id: "album-see-person" }]);
    expect(sectionsOf(threadRepliesTo(nextWeek))).toEqual(["*Dana's sticker is already waiting in your packs*\nSo this pack holds a hoggie."]);
    expect(buttonsOf(threadRepliesTo(nextWeek))).toEqual([{ text: "Open your pack", url: `${site}/book#packs`, action_id: "album-open-packs" }]);
    expect(hypeLinesOf(threadRepliesTo(first))).toEqual(["Dana's hype emoji is unlocked"]);
    expect(hypeLinesOf(threadRepliesTo(sameWeek))).toEqual([]);
    expect(hypeLinesOf(threadRepliesTo(nextWeek))).toEqual([]);
  });

  test("AL29 AL30: a hype emoji Slack has is named beside its picture, one Slack doesn't have only shows its picture, falling back to the hype emblem without a face", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    slack.withCustomEmoji("bob-okonkwo-hype", "https://emoji.slack-edge.com/T1/bob-okonkwo-hype/1.png");
    await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
    await settle(t);

    const ts = await thanks(alice, why, bob, dana);

    expect(contextsOf(threadRepliesTo(ts))).toEqual([
      [{ type: "image", image_url: bobsStoredFace, alt_text: "Bob's hype emoji" }, { type: "mrkdwn", text: "Bob's hype emoji is unlocked: :bob-okonkwo-hype:" }],
      [{ type: "image", image_url: `${site}/emoji/hype.png`, alt_text: "Dana's hype emoji" }, { type: "mrkdwn", text: "Dana's hype emoji is unlocked" }],
      [{ type: "mrkdwn", text: "+20 XP" }],
    ]);
  });

  test("a kudos posted in a thread is answered in that thread, a giver who chose DMs gets it as a DM, and one who turned kudos replies off gets none", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    const root = "1760349000.000001";
    const inAThread = await thanks(alice, why, bob, { threadTs: root });
    await choosesKudosRepliesIn(carol, "dm");
    const carolsKudos = await thanks(carol, why, bob);
    await choosesKudosRepliesIn(dana, "none");
    await thanks(dana, why, bob);

    expect(threadRepliesTo(root).map(({ thread_ts }) => thread_ts)).toEqual([root]);
    expect(threadRepliesTo(inAThread)).toEqual([]);
    expect(threadRepliesTo(carolsKudos)).toEqual([]);
    expect(albumRepliesIn(carol.user).map((reply) => sectionsOf([reply]))).toEqual([["*Bob is new in your album*\nLanterns 1/2\nOtters 1/2"]]);
    expect(everyAlbumReply().map(({ channel: to }) => to)).toEqual([channel, carol.user]);
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

  test("with album-slack on for the giver's email, the same walk adds only the thread replies of the giver's thoughtful kudos", async () => {
    theBus.withoutTheReply = true;
    const withoutTheReply = await walkWith(albumOn, [onForEmails(albumSlack, alice.email)]);
    theBus.withoutTheReply = false;

    const walk = await walkWith(albumOn, [onForEmails(albumSlack, alice.email)]);

    const added = walk.calls.filter((call) => !withoutTheReply.calls.includes(call)).map((call) => JSON.parse(call) as SlackCall);
    expect(added.map(({ method, args }) => ({ method, channel: args.channel, thread_ts: args.thread_ts }))).toEqual([{ method: "chat.postMessage", channel, thread_ts: walk.alicesThoughtfulKudos }]);
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
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom().withTeams(lanterns, otters, ...(more.length > 0 ? [{ slug: "guests", name: "Guests", profiles: more.map((guest) => profileOf(guest)) }] : []));
  slack = new FakeSlack();
  for (const someone of [...everyone, ...more]) slack.withMember(someone.user, { profile: { display_name: someone.name, real_name: someone.name, email: someone.email } });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
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

async function thanks(giver: Person, words: string, ...recipientsAndOptions: Array<Person | { threadTs: string }>) {
  const recipients = recipientsAndOptions.filter((item): item is Person => "user" in item);
  const threadTs = recipientsAndOptions.find((item): item is { threadTs: string } => "threadTs" in item)?.threadTs;
  messages += 1;
  vi.setSystemTime(tuesday.getTime() + weeksLater * weekMs + messages * minuteMs);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts, channel, ...(threadTs && { threadTs }) });
  await settle(t);
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

type Posted = { channel: string; thread_ts?: string; text: string; blocks: Array<{ type: string; text?: { text: string }; elements?: unknown[] }> };

function everyAlbumReply(): Posted[] {
  return (slack.callsTo("chat.postMessage") as unknown as Posted[]).filter(({ blocks }) => JSON.stringify(blocks ?? []).includes("album"));
}

function threadRepliesTo(ts: string): Posted[] {
  return everyAlbumReply().filter(({ channel: to, thread_ts }) => to === channel && thread_ts === ts);
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
