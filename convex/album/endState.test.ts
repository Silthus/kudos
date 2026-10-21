import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type CapturedEvent, type FakePostHog, type FlagDefinition, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, post, react, settleInTimeOrder, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, publishedHome, publishedHomeBlocks } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, section, text } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import crons from "../crons";
import { setMondayPost } from "../leaderboard/mondayPost";
import { xpToReach } from "../progression/levels";
import { openUnlock } from "../unlocks/unlocks";

vi.mock("../hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/draw")>();
  const named = (id: string) => namedIds.get(id) ?? id;
  const pinned = <Input extends { member: string; crate: string }>(input: Input): Input => ({ ...input, member: named(input.member), crate: input.crate.replace(/[^:]+/g, named) });
  return {
    ...actual,
    drawOf: vi.fn((input: Parameters<typeof actual.drawOf>[0]) => actual.drawOf(pinned(input))),
    packBonusOf: vi.fn((input: Parameters<typeof actual.packBonusOf>[0]) => actual.packBonusOf(pinned(input) as typeof input)),
  };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const mondayTen = Date.parse("2026-10-19T10:00:00Z");
const stepMs = 10 * 60_000;
const site = "https://kudos-site.test";
const slackUrl = "https://t1.slack.com/";
const channel = "C_TEAM";
const announcementChannel = "C_KUDOS";
const keptOn = ["website", "website-analytics", "album", "album-slack", "collection", "packs", "xp-levels", "everyone-board", "hugs", "activity", "book-spread", "crate-rewards", "crests", "custom-kudos-emoji", "groups", "hoggie-avatar", "message-settings", "monday-post", "profile-card", "slots-retired", "sticker-book", "team-pages"];
const retired = ["crate-store", "store", "coins", "group-quest", "quests", "team-spirit", "achievements", "unlocks", "skill-tree"];
const retiredFeatureEvents = ["achievement earned", "crate opened", "journey step activated", "perk bought", "quest drawn", "quest finished", "quest swapped", "team page completed", "unlock made ready", "unlock opened"];

type Person = { user: string; name: string; email: string; profile: number };
type Walk = Awaited<ReturnType<typeof walkWith>>;
type Figures = { coins: number; skillPoints: number };
type Answer = { kind: string; applied?: { from: Figures; to: Figures } | null };

const alice = person("Alice", "Marchetti", 1);
const bob = person("Bob", "Okonkwo", 2);
const carol = person("Carol", "Lindqvist", 3);
const dana = person("Dana", "Ferreira", 4);
const everyone = [alice, bob, carol, dana];
const lanterns: TeamPage = { slug: "lanterns", name: "Lanterns", profiles: [profileOf(alice), profileOf(bob), profileOf(carol)] };
const otters: TeamPage = { slug: "otters", name: "Otters", profiles: [profileOf(bob), profileOf(dana)] };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let namedIds = new Map<string, string>();
let messages = 0;
let steps = 0;
const authors = new Map<string, string>();

beforeEach(() => {
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AL37: with album and album-slack on and every retired flag off, a member keeps everything the album needs and App Home shows none of the retired features", { timeout: 300_000 }, () => {
  test("every album read and command, the thread reply, the recap line, the weekly post and every album event answer what the same walk answers with the retired flags on, apart from the coins and skill points the retired features show", async () => {
    const withTheRetiredOn = await walkWith("on");
    const endState = await walkWith("off");

    expect(endState.album, "every album read and command").toEqual(withoutCoinsAndSkillPoints(withTheRetiredOn.album));
    expect(endState.moments, "the thread replies, the recaps and the weekly post").toEqual(withoutCoinsAndSkillPoints(withTheRetiredOn.moments));
    expect(endState.albumEvents, "every product event outside the retired features' own").toEqual(withTheRetiredOn.albumEvents);
    expect(coinsAndSkillPointsShownIn(withTheRetiredOn), "the difference is real: the walk with the retired flags on shows coins and skill points").toEqual({ coins: true, skillPoints: true });
    expect(coinsAndSkillPointsShownIn(endState)).toEqual({ coins: false, skillPoints: false });
    expectTheAlbumsWholeLoop(endState);
  });

  test("App Home shows no coins, store, quests, Journey, skill tree, ladders or level unlocks on any tab, where the same walk with the retired flags on shows each", async () => {
    const withTheRetiredOn = await walkWith("on");
    const endState = await walkWith("off");

    for (const { user } of everyone) expect(retiredFeaturesOn(endState.homes[user]!), `${user}'s App Home with the retired flags off`).toEqual([]);
    expect(retiredFeaturesOn(Object.values(withTheRetiredOn.homes).flat()), "the members' App Homes with the retired flags on").toEqual(retiredFeatures.map(({ feature }) => feature));
  });
});

const retiredFeatures = [
  { feature: "coins", shown: /🪙|\bcoins?\b/i },
  { feature: "store", shown: /\bstore\b|\bbuy\b/i },
  { feature: "quests", shown: /\bquests?\b/i },
  { feature: "Journey", shown: /\bjourney\b/i },
  { feature: "skill tree", shown: /\bskill (tree|points?)\b/i },
  { feature: "ladders", shown: /\bbook\b|\bachievements?\b|\btiers?\b/i },
  { feature: "level unlocks", shown: /\bis ready\b|\bwhat it opens\b|\bat level \d+\b/i },
];

function retiredFeaturesOn(tabs: string[]) {
  return retiredFeatures.filter(({ shown }) => tabs.some((tab) => shown.test(tab))).map(({ feature }) => feature);
}

const coinsShown = / · \+\d+ 🪙/g;

function withoutCoinsAndSkillPoints<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).replace(coinsShown, ""), (key, field) => (key === "coins" || key === "skillPoints" ? 0 : field));
}

function coinsAndSkillPointsShownIn({ album, moments }: Walk) {
  const applied = Object.values(album).flatMap(({ opened }) => opened.flatMap(({ applied }) => (applied ? [applied.from, applied.to] : [])));
  return { coins: applied.some(({ coins }) => coins > 0) && coinsShown.test(JSON.stringify(moments)), skillPoints: applied.some(({ skillPoints }) => skillPoints > 0) };
}

function expectTheAlbumsWholeLoop({ album, moments, albumEvents }: Walk) {
  const alices = album.U_ALICE_MARCHETTI!;
  const alicesAlbum = alices.album as { kind: string; people: Array<{ held: boolean }>; teams: Array<{ team: string; state: string }>; milestones: unknown[]; emojis: Array<{ name: string }> };
  expect((alices.beforeOpening as { packs: unknown[] }).packs, "Alice's two waiting packs").toHaveLength(2);
  expect((alices.afterOpening as { tray: Array<{ kind: string }> }).tray.map(({ kind }) => kind).toSorted(), "Alice's tray after opening").toEqual(["hoggie", "hoggie", "sticker", "sticker"]);
  expect(alices.opened.map(({ kind }) => kind), "Alice opens her two packs into her tray and puts it in").toEqual(["opened", "opened", "placed", "placed"]);
  expect(alices.unlocked, "Alice unlocks the Lanterns sticker").toMatchObject({ kind: "unlocked", sticker: { team: "lanterns", emoji: "lantern-glow" } });
  expect(alicesAlbum.people.filter(({ held }) => held), "Alice's stickers").toHaveLength(2);
  expect(alicesAlbum.teams.find(({ team }) => team === "lanterns"), "Alice's Lanterns page").toMatchObject({ state: "unlocked" });
  expect(alicesAlbum.milestones.length, "Alice's milestones").toBeGreaterThan(0);
  expect(alicesAlbum.emojis.map(({ name }) => name), "Alice's earned emojis").toEqual(expect.arrayContaining(["lantern-glow", "bob-okonkwo-hype", "carol-lindqvist-hype", "first-thank-you", "level-5"]));
  expect(alices.hoggies).toMatchObject({ kind: "hoggies" });
  expect(album.U_CAROL_LINDQVIST!.boards).toMatchObject({ kind: "boards", people: expect.arrayContaining([expect.objectContaining({ name: alice.name })]) });
  expect([alices.person, alices.week, album.U_BOB_OKONKWO!.profile, alices.mappings].map((read) => (read as { kind: string }).kind)).toEqual(["person", "week", "profile", "mappings"]);
  expect(moments.threadReplies.map(({ text }) => text), "a thread reply after each thoughtful kudos").toEqual(["Bob is new in your album · Carol is new in your album", "Alice is new in your album", "Bob is new in your album"]);
  expect(moments.recaps.find(({ channel: to }) => to === alice.user)?.text, "Alice's recap line").toContain("Emojis you earned last week: :lantern-glow:, bob-okonkwo-hype, carol-lindqvist-hype");
  expect(moments.weeklyPosts.map(({ text }) => text.split("\n")[0]), "the weekly post").toEqual(["🏆 Last week's top thoughtful kudos"]);
  expect(new Set(albumEvents.map(({ event }) => event))).toEqual(new Set(["app home opened", "member welcomed", "kudos given", "kudos received", "packs earned", "person collected", "hoggie dropped", "album sticker collected", "hug given", "hugs recap sent"]));
}

async function walkWith(retiredFlags: "on" | "off") {
  await fourMembersAtLevelSixBeforeTheRetirement();
  await flagsFromPostHog(t, postHog, ...flagsWith(retired.map(retiredFlags === "on" ? onForEveryone : offForEveryone)));
  for (const someone of everyone) await opensAppHome(someone);
  await mapsTheLanternsEmoji(alice);

  const alicesThanks = await thanks(alice, "Thanks for the calm rollback of the billing service", bob, carol);
  await thanks(bob, "Thanks for reviewing the incident write-up so quickly", alice);
  await thanks(carol, "ty", bob);
  await thanks(dana, "Thanks for pairing on the flaky migration all afternoon", bob);
  await hugs(bob, alicesThanks);
  await hugs(alice, await says(dana, "Lunch is in the kitchen"));

  const album: Record<string, Record<string, unknown> & { opened: Answer[] }> = {};
  for (const someone of everyone) {
    album[someone.user] = { ...(await opensAndPutsIn(someone)), ...(await commandsOf(someone)) };
  }
  for (const someone of everyone) album[someone.user] = { ...album[someone.user]!, ...(await readsOf(someone)) };
  const homes: Record<string, string[]> = {};
  for (const someone of everyone) homes[someone.user] = await everyTabOfAppHome(someone);

  await mondayComes();

  return { album: withStableIds(album), moments: withStableIds(momentsSent()), albumEvents: albumEventsSent(), homes };
}

async function commandsOf(someone: Person) {
  nextStep();
  const asMember = await signedIn(someone);
  const unlocked = someone === alice ? await asMember.mutation(api.website.album.unlockTeamSticker, { team: "lanterns" }) : null;
  await settleInTimeOrder(t);
  const seen = await asMember.mutation(api.website.album.markEmojisSeen, { ids: ["level:5"] });
  return { unlocked, seen };
}

async function readsOf(someone: Person) {
  nextStep();
  const asMember = await signedIn(someone);
  const other = await memberOf((someone === bob ? alice : bob).user);
  return {
    album: await asMember.query(api.website.album.getAlbum, {}),
    hoggies: await asMember.query(api.website.album.getAlbumHoggies, {}),
    boards: await asMember.query(api.website.album.getThoughtfulBoards, {}),
    teamBoards: await asMember.query(api.website.album.getThoughtfulBoards, { team: "lanterns", period: "all" }),
    person: await asMember.query(api.website.album.getAlbumPerson, { person: other }),
    week: await asMember.query(api.website.album.getAlbumWeek, {}),
    profile: await asMember.query(api.website.album.getAlbumProfile, {}),
    mappings: await asMember.query(api.website.emojiMappings.getEmojiMappings, {}),
  };
}

async function opensAndPutsIn(someone: Person) {
  nextStep();
  const asMember = await signedIn(someone);
  const album = await asMember.query(api.website.album.getAlbum, {});
  const packs = album.kind === "album" ? album.packs : [];
  for (const { pack, person: recipient } of packs) namedIds.set(pack, `<pack of ${someone.user} to ${namedIds.get(recipient)}>`);
  const opened = [];
  for (const { pack } of packs) opened.push(await asMember.mutation(api.website.album.openThoughtfulPack, { pack }));
  const afterOpening = await asMember.query(api.website.album.getAlbum, {});
  const [first] = afterOpening.kind === "album" ? afterOpening.tray : [];
  const placed = first === undefined ? null : await asMember.mutation(api.website.album.putIn, { item: first.item });
  const placedAll = await asMember.mutation(api.website.album.putAllIn, {});
  await settleInTimeOrder(t);
  return { beforeOpening: album, afterOpening, opened: [...opened, ...(placed === null ? [] : [placed]), placedAll] as Answer[] };
}

async function mapsTheLanternsEmoji(maintainer: Person) {
  nextStep();
  const mapped = await (await signedIn(maintainer)).mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "lantern-glow", to: { kind: "team", team: "lanterns" } });
  expect(mapped).toEqual({ kind: "mapped" });
  await settleInTimeOrder(t);
}

function featuresOpenedBy(someone: Person) {
  const opened = ["book", "leaderboard", "quests", "skillTree", "coins"] as const;
  return someone === dana ? opened.filter((feature) => feature !== "coins") : opened;
}

function flagsWith(retiredFlags: FlagDefinition[]) {
  return [...keptOn.map(onForEveryone), onForEmails("workspace-settings", alice.email), offForEveryone("random-emojis"), ...retiredFlags];
}

async function fourMembersAtLevelSixBeforeTheRetirement() {
  vi.unstubAllEnvs();
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SITE_URL", site);
  vi.stubEnv("KUDOS_MAINTAINER", alice.user);
  aDeploymentForWorkspace();
  messages = 0;
  steps = 0;
  authors.clear();
  namedIds = new Map();
  postHog = postHogDeciding();
  const postHogCom = new FakePostHogCom().withTeams(lanterns, otters);
  slack = new FakeSlack().withCustomEmoji("lantern-glow", "https://emoji.slack-edge.com/T1/lantern-glow/1.png");
  for (const someone of everyone) slack.withMember(someone.user, { tz: "UTC", is_admin: someone === alice, profile: { display_name: someone.name, real_name: someone.name, email: someone.email } });
  slack.withUserGroup("S_LANTERNS", { name: "Lanterns", users: [alice.user, bob.user, carol.user] }).withUserGroup("S_OTTERS", { name: "Otters", users: [dana.user] });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = await flagsFromPostHog(testBackend(), postHog, ...flagsWith(retired.map(onForEveryone)));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 50, announcementChannel }));
  await t.mutation(internal.workspace.url.rememberWorkspaceUrl, { workspace: "T1", url: slackUrl });
  await journeyShippedBeforeAnyoneJoined(t);
  await bookShippedBeforeAnyoneJoined(t);
  for (const someone of everyone) {
    nextStep();
    const profile = { real_name: someone.name, display_name: someone.name, email: someone.email };
    await memberChanged(t, "team_join", { id: someone.user, team_id: "T1", tz: "UTC", is_admin: someone === alice, name: someone.name, real_name: someone.name, profile });
    await settleInTimeOrder(t);
    const member = await memberOf(someone.user);
    namedIds.set(member, `<member ${someone.user}>`);
    await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: xpToReach(6), pointsSpent: 0 }));
    for (const level of [4, 5, 6]) await reachesLevel(t, member, level);
    nextStep();
    for (const feature of featuresOpenedBy(someone)) await t.run((ctx) => openUnlock(ctx, member, feature, "slack"));
  }
  await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settleInTimeOrder(t);
  await analyticsIdsNamedByTheirMember();
}

async function analyticsIdsNamedByTheirMember() {
  for (const { analyticsId, member } of await t.run((ctx) => ctx.db.query("analyticsIds").take(everyone.length))) namedIds.set(analyticsId, `<analytics ID of ${namedIds.get(member)}>`);
}

function nextStep() {
  steps += 1;
  vi.setSystemTime(tuesday + steps * stepMs);
}

async function everyTabOfAppHome(someone: Person) {
  await opensAppHome(someone);
  const tabs = publishedHomeBlocks(slack, someone.user)
    .filter(({ type }) => type === "actions")
    .flatMap(({ elements }) => (elements ?? []) as Array<{ type: string; url?: string; text?: { text: string } }>)
    .filter(({ type, url }) => type === "button" && url === undefined)
    .map(({ text: label }) => label!.text);
  const shown = [JSON.stringify(publishedHome(slack, someone.user))];
  for (const tab of tabs) {
    nextStep();
    await t.fetch("/slack/interactivity", await signedRequest(blockActions(someone.user, buttonIn(publishedHomeBlocks(slack, someone.user), tab)), { contentType: "application/x-www-form-urlencoded" }));
    await settleInTimeOrder(t);
    shown.push(`${tab}: ${JSON.stringify(publishedHome(slack, someone.user))}`);
  }
  return shown;
}

async function opensAppHome(someone: Person) {
  nextStep();
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(someone.user)));
  await settleInTimeOrder(t);
}

type Sent = { channel: string; ts: string };

async function thanks(giver: Person, words: string, ...recipients: Person[]): Promise<Sent> {
  messages += 1;
  nextStep();
  const ts = `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts, channel });
  authors.set(`${channel}/${ts}`, giver.user);
  await settleInTimeOrder(t);
  return { channel, ts };
}

async function says(author: Person, words: string): Promise<Sent> {
  messages += 1;
  nextStep();
  const ts = `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(words))], { user: author.user, ts, channel });
  authors.set(`${channel}/${ts}`, author.user);
  await settleInTimeOrder(t);
  return { channel, ts };
}

async function hugs(hugger: Person, { channel: hugged, ts }: Sent) {
  nextStep();
  await react(t, { user: hugger.user, itemUser: authors.get(`${hugged}/${ts}`)!, channel: hugged, ts });
  await settleInTimeOrder(t);
}

async function mondayComes() {
  const recapJob = crons.crons["schedule each member's weekly hugs recap"];
  if (recapJob === undefined) throw new Error("no cron job schedules each member's weekly hugs recap");
  await t.mutation(makeFunctionReference<"mutation">(recapJob.name), {});
  const member = await memberOf(alice.user);
  await t.run((ctx) => setMondayPost(ctx, "T1", { member, admin: true, timeZone: "UTC" }, { on: true, timeZone: "UTC" }));
  await settleUpTo(t, mondayTen);
}

type Posted = SlackCall["args"] & { channel: string; text: string; thread_ts?: string };

function momentsSent() {
  const posted = slack.callsTo("chat.postMessage") as Posted[];
  return {
    threadReplies: (slack.callsTo("chat.postEphemeral") as Posted[]).filter(({ thread_ts, blocks }) => thread_ts !== undefined && JSON.stringify(blocks ?? []).includes("album-")),
    recaps: posted.filter(({ text }) => String(text).startsWith(":taco: Your week in hugs")),
    weeklyPosts: posted.filter(({ channel: to, text }) => to === announcementChannel && String(text).startsWith("🏆")),
  };
}

function albumEventsSent() {
  const sent = postHog.productEvents().filter(({ event }) => event !== "$feature_flag_called" && !retiredFeatureEvents.includes(event));
  return withStableIds(sent.map(({ event, distinct_id, properties }: CapturedEvent) => ({ event, distinct_id, properties }))).toSorted((one, other) => JSON.stringify(one).localeCompare(JSON.stringify(other)));
}

async function signedIn(someone: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: someone.user, name: someone.name });
  return asSignedIn;
}

async function memberOf(user: string) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique(),
  );
  return row!._id;
}

const convexTestId = /^\d+[a-zA-Z_]+$/;
const teammateKey = /^[0-9a-f]{32}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function withStableIds<T>(value: T): T {
  const seen = new Map<string, string>();
  const stable = (kind: string, id: string) => seen.get(id) ?? seen.set(id, `<${kind} ${seen.size + 1}>`).get(id)!;
  return JSON.parse(JSON.stringify(value), (key, field) => {
    if (key === "_id" || key === "_creationTime" || key === "uuid") return undefined;
    if (typeof field !== "string") return field;
    if (namedIds.has(field)) return namedIds.get(field);
    if (convexTestId.test(field)) return stable("document", field);
    if (field.includes(":")) return field.replace(/[^:]+/g, (part) => namedIds.get(part) ?? part);
    if (teammateKey.test(field)) return stable("teammate key", field);
    return uuid.test(field) ? stable("uuid", field) : field;
  });
}

function person(first: string, last: string, profile: number): Person {
  return { user: `U_${first}_${last}`.toUpperCase(), name: `${first} ${last}`, email: `${first}.${last}@example.com`.toLowerCase(), profile };
}

function profileOf({ name, profile }: Person): TeamPage["profiles"][number] {
  const [firstName, lastName] = name.split(" ") as [string, string];
  return { id: profile, firstName, lastName, colour: "teal" };
}
