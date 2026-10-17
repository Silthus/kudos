import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest } from "../../testing/signedSlack";
import { blockActions, buttonInHome, publishedHome } from "../../testing/slackInteractions";
import { memberChanged, post, setWorkspaceSettings, settleInTimeOrder as settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, section } from "../../testing/slackMessages";
import type { Person } from "../../testing/stickerBook";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { awardsOfMessage } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import { ladders, type Ladder, type LadderId, type TierId } from "./ladders";

const now = new Date("2026-10-16T10:00:00Z");
const minuteMs = 60_000;
const bookFlags = ["xp-levels", "unlocks", "achievements", "everyone-board", "skill-tree", "collection", "sticker-book", "team-pages", "groups", "coins", "store", "profile-card"];
const catalogue = ladders as unknown as { version: string; ladders: Ladder[] };
const shippedCatalogue = { version: catalogue.version, ladders: [...catalogue.ladders] };
const awardLadders: LadderId[] = ["generosity", "recognition", "connections", "dependability", "applause", "seasons", "old-friends"];
const handshake = "kudos-emoji-handshake";
const alice = { user: "U_ALICE", name: "Alice Archer" };
const bob = { user: "U_BOB", name: "Bob Brandt" };
const dan = { user: "U_DAN", name: "Dan Dorsey" };
const teammates: Person[] = Array.from({ length: 9 }, (_, index) => ({ user: `U_P${index + 1}`, name: `Pat Number${index + 1}` }));

type Reader = Awaited<ReturnType<typeof aSignedInSession>>["asSignedIn"];

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;
const tsOfMessageAt = new Map<number, string>();

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  slack = new FakeSlack();
  for (const person of [alice, bob, dan, ...teammates]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(urlOf(input)) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
});

afterEach(() => {
  catalogue.ladders = [...shippedCatalogue.ladders];
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function teamSpirit(on: boolean) {
  await switchWebsite(t, postHog, true, ...bookFlags, ...(on ? ["team-spirit"] : []));
}

async function teamSpiritOnWithout(needed: string) {
  await switchWebsite(t, postHog, true, ...bookFlags.filter((flag) => flag !== needed), "team-spirit");
}

async function teamSpiritShipped(on: boolean) {
  await setWorkspaceSettings(t, { kudosEmoji: "taco", announcementChannel: "C_NEWS" });
  await teamSpirit(on);
  await bookShippedBeforeAnyoneJoined(t);
}

async function joined(...people: Person[]) {
  for (const person of people) {
    await memberChanged(t, "team_join", { id: person.user, real_name: person.name });
    await settle(t);
  }
}

function urlOf(input: string | URL | Request) {
  return new URL(input instanceof Request ? input.url : input);
}

async function eachOnATeamOfTheirOwn(people: Person[]) {
  postHogCom.withTeams(
    ...people.map((person, index) => {
      const [firstName, lastName] = person.name.split(" ");
      return { slug: `squad-${index + 1}`, name: `Squad ${index + 1}`, profiles: [{ id: index + 1, firstName: firstName!, lastName: lastName! }] };
    }),
  );
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
}

async function thanks(giver: Person, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const at = Date.now();
  const ts = `${at / 1000}.${String(messages).padStart(6, "0")}`;
  tsOfMessageAt.set(at, ts);
  await post(t, [section(...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return at;
}

async function redelivered(giver: Person, at: number) {
  await post(t, [section(mention(alice.user), emoji("taco"))], { user: giver.user, ts: tsOfMessageAt.get(at)! });
  await settle(t);
}

async function checkedAgain(person: Person, at: number) {
  const check = { workspace: "T1", member: await memberOf(person), award: await awardOf(at), at };
  await t.mutation(makeFunctionReference<"mutation">("stickers/completions:checkTeamPages"), { check });
  await settle(t);
}

async function memberOf(person: Person): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  if (row === null) throw new Error(`${person.user} is not in the directory`);
  return row._id;
}

async function withTheBookOpen(person: Person): Promise<Reader> {
  const member = await memberOf(person);
  await reachesLevel(t, member, 6);
  await opens(t, member, "book");
  await opens(t, member, "coins");
  return (await aSignedInSession(t, person)).asSignedIn;
}

async function afterTheFirstCheck(person: Person) {
  await thanks(person, dan);
}

async function bookOf(reader: Reader) {
  const answer = await reader.query(api.website.book.getBook, {});
  if (answer.kind !== "book") throw new Error(`expected the Book, got ${JSON.stringify(answer)}`);
  return answer.ladders;
}

async function teamSpiritIn(reader: Reader) {
  return (await bookOf(reader)).find(({ ladder }) => ladder === "team-spirit");
}

async function earnedOn(reader: Reader) {
  const ladder = await teamSpiritIn(reader);
  return { count: ladder?.count, earned: ladder?.tiers.map(({ tier, earnedAt }) => ({ tier, earnedAt })) };
}

async function awardOf(at: number) {
  const [award] = await t.run((ctx) => awardsOfMessage(ctx, { workspace: "T1", conversation: "C1", message: tsOfMessageAt.get(at)! }));
  return award!.award;
}

async function teamSpiritTiersStored(person: Person) {
  const member = await memberOf(person);
  const tiers = await t.run(async (ctx) => (await ctx.db.query("earnedTiers").collect()).filter((row) => row.member === member && row.ladder === "team-spirit"));
  return tiers.map(({ tier, award, earnedAt, hidden }) => ({ tier, award, earnedAt, hidden: hidden ?? false }));
}

async function messagesToldTeamSpirit(person: Person, tier: TierId) {
  const member = await memberOf(person);
  const notices = await t.run(async (ctx) => (await ctx.db.query("tierNotices").collect()).filter((row) => row.member === member));
  return notices.filter(({ tiers }) => tiers.some((each) => each.ladder === "team-spirit" && each.tier === tier)).map(({ message }) => message);
}

async function teamSpiritRewardsPaid(person: Person) {
  const member = await memberOf(person);
  return t.run(async (ctx) => {
    const records = (await ctx.db.query("rewardRecords").collect()).filter((row) => row.member === member && row.key.startsWith("tier:team-spirit"));
    const items = (await ctx.db.query("collection").collect()).filter((row) => row.member === member && row.item === handshake);
    return { records: records.map(({ key, coins, item }) => ({ key, coins, item })), handshakes: items.length };
  });
}

function teamSpiritDmsTo(person: Person) {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel }) => channel === person.user)
    .map(({ text }) => String(text))
    .filter(namesTeamSpirit);
}

function namesTeamSpirit(text: string) {
  return /Team Spirit|All Hands|Tight-Knit|Unbreakable Crew|team pages? completed|handshake|Handshake/.test(text);
}

function publicLinesNamingTeamSpirit() {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel }) => !String(channel).startsWith("U"))
    .concat(slack.callsTo("chat.update"))
    .flatMap(({ text, blocks }) => [String(text), JSON.stringify(blocks ?? [])])
    .filter(namesTeamSpirit);
}

async function bookInAppHome(person: Person) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(person.user)));
  await settle(t);
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(person.user, buttonInHome(slack, person.user, "Book")), { contentType: "application/x-www-form-urlencoded" }));
  await settle(t);
  return JSON.stringify(publishedHome(slack, person.user));
}

async function coinsOf(reader: Reader) {
  const profile = await reader.query(api.website.profile.getMyProfile, {});
  if (profile.kind !== "member" || profile.coins === null) throw new Error(`expected a wallet, got ${JSON.stringify(profile)}`);
  return profile.coins;
}

async function tierItemsListedFor(reader: Reader) {
  const profile = await reader.query(api.website.profile.getMyProfile, {});
  if (profile.kind !== "member" || profile.inventory === null) throw new Error(`expected an inventory, got ${JSON.stringify(profile)}`);
  return profile.inventory.catalogue.filter(({ source }) => source.kind === "tier").map(({ item }) => item);
}

async function cardOf(viewer: Person, owner: Person) {
  const body = new URLSearchParams({ team_id: "T1", channel_id: "C1", channel_name: "general", user_id: viewer.user, command: "/hedgehug", text: `<@${owner.user}>`, response_url: "https://hooks.slack.test/commands/1", trigger_id: "1.2.3" }).toString();
  const response = await t.fetch("/slack/commands", await signedRequest(body, { contentType: "application/x-www-form-urlencoded" }));
  const reply = (await response.json()) as { text: string };
  await settle(t);
  return reply.text;
}

const noticedCoins = 10;

describe("CV35 SB21: Team Spirit counts completed team pages", { timeout: 120_000 }, () => {
  test("1, 2, 4 and 8 completions earn bronze, silver, gold and diamond once each, each caused by the completion that reached it, with coins and handshake paid once", async () => {
    await teamSpiritShipped(true);
    await joined(alice, dan, ...teammates.slice(0, 8));
    await eachOnATeamOfTheirOwn(teammates.slice(0, 8));
    const reader = await withTheBookOpen(alice);
    await afterTheFirstCheck(alice);

    const completedAt: number[] = [];
    const coinsGained: number[] = [];
    for (const teammate of teammates.slice(0, 8)) {
      const before = await coinsOf(reader);
      completedAt.push(await thanks(teammate, alice));
      coinsGained.push((await coinsOf(reader)) - before);
    }
    const coinsBeforeTheRetries = await coinsOf(reader);
    await redelivered(teammates[7]!, completedAt[7]!);
    await checkedAgain(alice, completedAt[7]!);

    expect(coinsGained, "Team Spirit pays 10 at bronze and 100 at diamond; the first thanks alice receives also pays Noticed's 10").toEqual([10 + noticedCoins, 0, 0, 0, 0, 0, 0, 100]);
    expect(await coinsOf(reader), "a redelivered kudos or a retried check paid coins again").toBe(coinsBeforeTheRetries);

    expect(await earnedOn(reader)).toEqual({
      count: 8,
      earned: [
        { tier: "bronze", earnedAt: completedAt[0] },
        { tier: "silver", earnedAt: completedAt[1] },
        { tier: "gold", earnedAt: completedAt[3] },
        { tier: "diamond", earnedAt: completedAt[7] },
      ],
    });
    expect(await teamSpiritTiersStored(alice)).toEqual([
      { tier: "bronze", award: await awardOf(completedAt[0]!), earnedAt: completedAt[0], hidden: false },
      { tier: "silver", award: await awardOf(completedAt[1]!), earnedAt: completedAt[1], hidden: false },
      { tier: "gold", award: await awardOf(completedAt[3]!), earnedAt: completedAt[3], hidden: false },
      { tier: "diamond", award: await awardOf(completedAt[7]!), earnedAt: completedAt[7], hidden: false },
    ]);
    expect(await teamSpiritRewardsPaid(alice)).toEqual({
      records: [
        { key: "tier:team-spirit-bronze-coins", coins: 10, item: null },
        { key: "tier:team-spirit-silver-kudos-emoji", coins: 0, item: handshake },
        { key: "tier:team-spirit-diamond-coins", coins: 100, item: null },
      ],
      handshakes: 1,
    });
  });

  test("getBook answers the ladder under Connections while team-spirit is on, with its tiers, counts and rewards", async () => {
    await teamSpiritShipped(true);
    await joined(alice, dan, ...teammates.slice(0, 1));
    await eachOnATeamOfTheirOwn(teammates.slice(0, 1));
    const reader = await withTheBookOpen(alice);
    await afterTheFirstCheck(alice);
    const bronzeAt = await thanks(teammates[0]!, alice);

    const book = await bookOf(reader);
    expect(book.map(({ ladder }) => ladder)).toEqual(["generosity", "recognition", "connections", "team-spirit", "dependability", "applause", "seasons", "old-friends"]);
    expect(await teamSpiritIn(reader)).toEqual({
      ladder: "team-spirit",
      name: "Team Spirit",
      counts: "team pages completed",
      count: 1,
      tiers: [
        { tier: "bronze", name: "Team Spirit", at: 1, earnedAt: bronzeAt, seen: expect.any(String), rewards: [{ kind: "coins", coins: 10 }] },
        { tier: "silver", name: "All Hands", at: 2, earnedAt: null, seen: null, rewards: [{ kind: "kudosEmoji", name: "Handshake", art: { kind: "unicode", glyph: "🤝" } }] },
        { tier: "gold", name: "Tight-Knit", at: 4, earnedAt: null, seen: null, rewards: [] },
        { tier: "diamond", name: "Unbreakable Crew", at: 8, earnedAt: null, seen: null, rewards: [{ kind: "coins", coins: 100 }] },
      ],
      next: { tier: "silver", at: 2 },
    });
    expect(await bookInAppHome(alice)).toContain("*Team Spirit* · *1* team page completed");
  });

  test("a tier added to the catalogue later is found from the completion records in order at the member's next new sticker, with no new completion", async () => {
    await teamSpiritShipped(true);
    await joined(alice, dan, ...teammates);
    await eachOnATeamOfTheirOwn(teammates.slice(0, 8));
    const reader = await withTheBookOpen(alice);
    await afterTheFirstCheck(alice);
    catalogue.ladders = shippedCatalogue.ladders.map((ladder) => (ladder.ladder === "team-spirit" ? { ...ladder, tiers: ladder.tiers.filter(({ tier }) => tier !== "diamond") } : ladder));

    const completedAt: number[] = [];
    for (const teammate of teammates.slice(0, 8)) completedAt.push(await thanks(teammate, alice));
    expect((await teamSpiritTiersStored(alice)).map(({ tier }) => tier)).toEqual(["bronze", "silver", "gold"]);

    catalogue.ladders = [...shippedCatalogue.ladders];
    await thanks(teammates[8]!, alice);

    expect((await teamSpiritTiersStored(alice)).find(({ tier }) => tier === "diamond")).toEqual({ tier: "diamond", award: await awardOf(completedAt[7]!), earnedAt: completedAt[7], hidden: false });
    expect(await earnedOn(reader)).toMatchObject({ count: 8 });
    expect(await messagesToldTeamSpirit(alice, "diamond"), "the added tier is told under the message of the completion that reached it").toEqual([tsOfMessageAt.get(completedAt[7]!)]);
  });
});

describe("SB22: tiers from a member's first check are stored hidden and never told", { timeout: 120_000 }, () => {
  test("pages complete at the first check earn their tiers silently, and opening the Book later names none of them", async () => {
    await teamSpiritShipped(false);
    await joined(alice, dan, ...teammates.slice(0, 2));
    await eachOnATeamOfTheirOwn(teammates.slice(0, 2));
    await thanks(alice, ...teammates.slice(0, 2));
    await teamSpirit(true);

    await thanks(alice, dan);
    expect((await teamSpiritTiersStored(alice)).map(({ tier, hidden }) => ({ tier, hidden }))).toEqual([
      { tier: "bronze", hidden: true },
      { tier: "silver", hidden: true },
    ]);

    const reader = await withTheBookOpen(alice);
    await settle(t);

    expect(teamSpiritDmsTo(alice)).toEqual([]);
    expect(publicLinesNamingTeamSpirit()).toEqual([]);
    expect(await earnedOn(reader)).toMatchObject({ count: 2, earned: [expect.objectContaining({ tier: "bronze" }), expect.objectContaining({ tier: "silver" }), expect.anything(), expect.anything()] });
    expect((await earnedOn(reader)).earned?.filter(({ earnedAt }) => earnedAt !== null).map(({ tier }) => tier)).toEqual(["bronze", "silver"]);
  });
});

describe("SB22: a tier from thanking the last missing person is told privately under that message", { timeout: 120_000 }, () => {
  test("the tier is told by DM, and no public line names Team Spirit", async () => {
    await teamSpiritShipped(true);
    await joined(alice, dan, ...teammates.slice(0, 2));
    await eachOnATeamOfTheirOwn(teammates.slice(0, 2));
    await withTheBookOpen(alice);
    await afterTheFirstCheck(alice);

    await thanks(alice, teammates[0]!);
    await thanks(teammates[1]!, alice);

    expect(teamSpiritDmsTo(alice)).toEqual([
      "Team complete · Squad 1 crest earned\n🏅 You earned Team Spirit (Team Spirit, bronze). +10 🪙\nNext: All Hands at 2 team pages completed.",
      "Team complete · Squad 2 crest earned\n🏅 You earned All Hands (Team Spirit, silver). + :handshake: Handshake for your kudos emoji\nNext: Tight-Knit at 4 team pages completed.",
    ]);
    expect(publicLinesNamingTeamSpirit()).toEqual([]);
  });

  test("a member who turned DMs off is told nothing, and no public line names Team Spirit", async () => {
    await teamSpiritShipped(true);
    await joined(alice, dan, ...teammates.slice(0, 1));
    await eachOnATeamOfTheirOwn(teammates.slice(0, 1));
    await withTheBookOpen(alice);
    await afterTheFirstCheck(alice);
    const member = await memberOf(alice);
    await t.run((ctx) => ctx.db.insert("progressSettings", { member, dms: false }));

    await thanks(alice, teammates[0]!);

    expect((await teamSpiritTiersStored(alice)).map(({ tier, hidden }) => ({ tier, hidden }))).toEqual([{ tier: "bronze", hidden: false }]);
    expect(teamSpiritDmsTo(alice)).toEqual([]);
    expect(publicLinesNamingTeamSpirit()).toEqual([]);
  });

  test("a told tier earned before the Book was opened is not named by the opening summary while team-spirit is off", async () => {
    await teamSpiritShipped(true);
    await joined(alice, dan, ...teammates.slice(0, 1));
    await eachOnATeamOfTheirOwn(teammates.slice(0, 1));
    await afterTheFirstCheck(alice);
    await thanks(teammates[0]!, alice);
    expect((await teamSpiritTiersStored(alice)).map(({ tier, hidden }) => ({ tier, hidden }))).toEqual([{ tier: "bronze", hidden: false }]);

    await teamSpirit(false);
    await withTheBookOpen(alice);
    await settle(t);

    expect(teamSpiritDmsTo(alice)).toEqual([]);
    expect(publicLinesNamingTeamSpirit()).toEqual([]);
  });
});

describe("SB21: Team Spirit is a completion ladder that the Book's replay and the award counting skip", { timeout: 120_000 }, () => {
  test("launching the Book and counting kudos write no replay, batch or counted award for it, also when it ships after the launch", async () => {
    catalogue.ladders = shippedCatalogue.ladders.filter(({ ladder }) => ladder !== "team-spirit");
    await teamSpiritShipped(true);
    await joined(alice, dan, ...teammates.slice(0, 1));
    await eachOnATeamOfTheirOwn(teammates.slice(0, 1));
    await thanks(alice, dan);
    const batchesBefore = await t.run((ctx) => ctx.db.query("bookBatches").collect());

    catalogue.ladders = [...shippedCatalogue.ladders];
    await thanks(teammates[0]!, alice);

    expect(await t.run((ctx) => ctx.db.query("bookBatches").collect())).toEqual(batchesBefore);
    const rows = await t.run(async (ctx) => [...(await ctx.db.query("bookReplays").collect()), ...(await ctx.db.query("countedAwards").collect()), ...(await ctx.db.query("ladderMarks").collect())]);
    expect(rows.filter(({ ladder }) => !awardLadders.includes(ladder))).toEqual([]);
    expect((await teamSpiritTiersStored(alice)).map(({ tier }) => tier)).toEqual(["bronze"]);
  });
});

describe("SB24: with team-spirit off nothing of Team Spirit shows", { timeout: 120_000 }, () => {
  test("the Book, App Home's Book, the inventory's tier items and a teammate's profile card show Team Spirit while it is on, and nothing of it once it is off", async () => {
    await teamSpiritShipped(true);
    await joined(alice, bob, dan, ...teammates.slice(0, 2));
    await eachOnATeamOfTheirOwn(teammates.slice(0, 2));
    const aliceReads = await withTheBookOpen(alice);
    const bobReads = await withTheBookOpen(bob);
    await afterTheFirstCheck(alice);
    await thanks(teammates[0]!, alice);
    await thanks(teammates[1]!, alice);

    expect((await bookOf(aliceReads)).map(({ ladder }) => ladder)).toContain("team-spirit");
    expect(namesTeamSpirit(await bookInAppHome(alice))).toBe(true);
    expect(await tierItemsListedFor(bobReads)).toContain(handshake);
    expect(await cardOf(bob, alice)).toContain("All Hands");

    await teamSpirit(false);

    expect((await bookOf(aliceReads)).map(({ ladder }) => ladder)).toEqual(awardLadders);
    expect(namesTeamSpirit(await bookInAppHome(alice))).toBe(false);
    expect(await tierItemsListedFor(bobReads)).not.toContain(handshake);
    expect(namesTeamSpirit(await cardOf(bob, alice))).toBe(false);
  });
});

describe.each(["team-pages", "sticker-book"])("CV35 SB24: with %s off nothing of Team Spirit shows, though team-spirit is on", (needed) => {
  test("the opening summary, the Book, App Home's Book, the inventory's tier items and a teammate's profile card leave Team Spirit out", { timeout: 120_000 }, async () => {
    await teamSpiritShipped(true);
    await joined(alice, bob, dan, ...teammates.slice(0, 2));
    await eachOnATeamOfTheirOwn(teammates.slice(0, 2));
    const bobReads = await withTheBookOpen(bob);
    await afterTheFirstCheck(alice);
    await thanks(teammates[0]!, alice);
    await thanks(teammates[1]!, alice);
    expect(await tierItemsListedFor(bobReads)).toContain(handshake);
    expect(await cardOf(bob, alice)).toContain("All Hands");

    await teamSpiritOnWithout(needed);
    const aliceReads = await withTheBookOpen(alice);
    await settle(t);

    expect(teamSpiritDmsTo(alice)).toEqual([]);
    expect((await bookOf(aliceReads)).map(({ ladder }) => ladder)).toEqual(awardLadders);
    expect(namesTeamSpirit(await bookInAppHome(alice))).toBe(false);
    expect(await tierItemsListedFor(bobReads)).not.toContain(handshake);
    expect(namesTeamSpirit(await cardOf(bob, alice))).toBe(false);
  });
});
