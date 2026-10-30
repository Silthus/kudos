import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { HugBoardsRead, Highlight, Tallies } from "./leaderboard";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const weekMs = 7 * dayMs;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const dana = { user: "U_DANA", name: "Dana Ferreira" };
const kiri = { user: "U_KIRI", name: "Kiri Tamaki", tz: "Pacific/Kiritimati" };
const people: Person[] = [alice, bob, carol, dana, kiri];
const why = "Thanks for untangling the flaky migration";
const websiteFlags = ["album", "everyone-board", "hugs", "collection", "packs"];

type Person = { user: string; name: string; tz?: string };
type Reader = Pick<Backend, "query" | "mutation">;
type Boards = Extract<HugBoardsRead, { kind: "boards" }>;

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date(tuesday.getTime() - 2 * weekMs) });
  aDeploymentForWorkspace();
  messages = 0;
  postHog = new FakePostHog();
  slack = new FakeSlack();
  for (const person of people) slack.withMember(person.user, slackUserOf(person));
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await leaderboardHugs(true);
  for (const person of people) {
    await memberChanged(t, "team_join", { id: person.user, ...slackUserOf(person) });
    await settle(t);
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HH69 HH81: the Leaderboard reads getBoards only while leaderboard-hugs is on", () => {
  test("with the flag on, getBoards answers this week's boards and the album says the Leaderboard ranks hugs", async () => {
    await thisWeek();
    const asAlice = await signedIn(alice);

    expect((await asAlice.query(api.website.leaderboard.getBoards, {})).kind).toBe("boards");
    expect(await albumSaysLeaderboardHugs(asAlice)).toBe(true);
  });

  test("with the flag off, getBoards answers off, the album says nothing of it, and the kudos boards answer as before", async () => {
    await thisWeek();
    await leaderboardHugs(false);
    const asAlice = await signedIn(alice);

    expect(await asAlice.query(api.website.leaderboard.getBoards, {})).toEqual({ kind: "off" });
    expect(await albumSaysLeaderboardHugs(asAlice)).toBe(false);
    expect((await asAlice.query(api.website.album.getThoughtfulBoards, {})).kind).toBe("boards");
  });

  test("viewing the Leaderboard records the member's leaderboard-hugs exposure, on or off, and getBoards records none", async () => {
    await thisWeek();
    const asAlice = await signedIn(alice);
    await asAlice.query(api.website.leaderboard.getBoards, {});
    expect(await exposuresOf("leaderboard-hugs"), "after the read").toEqual([]);

    await asAlice.mutation(api.website.album.viewLeaderboard, { period: "week" });
    await leaderboardHugs(false);
    await asAlice.mutation(api.website.album.viewLeaderboard, { period: "week" });

    expect(await exposuresOf("leaderboard-hugs")).toEqual([true, false]);
  });
});

describe("HH70: the you card tallies this week beside last week", () => {
  test("hugs given, hugs received and kudos received count this week and last week apart, in the member's own week", async () => {
    await lastWeek();
    await hugsOn(alice, bob);
    await hugsOn(carol, alice);
    await thisWeek();
    await hugsOn(alice, bob);
    await hugsOn(alice, carol);
    const alices = await said(alice, "Deploy is green");
    await hugs(bob, alice, alices);
    await hugs(dana, alice, alices);
    await thanks(bob, why, alice);

    const { you } = await boardsOf(alice);

    expect(you.tallies).toEqual<Tallies>({ hugsGiven: 2, hugsReceived: 2, kudosReceived: 1, hoggiesFound: 0 });
    expect(you.lastWeek).toEqual<Tallies>({ hugsGiven: 1, hugsReceived: 1, kudosReceived: 0, hoggiesFound: 0 });
  });

  test("hoggies found counts the hoggies the member put in this week", async () => {
    await thisWeek();
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    await openEveryPack(asAlice);
    await asAlice.mutation(api.website.album.putAllIn, {});
    await settle(t);

    const { you } = await boardsOf(alice);

    expect(you.tallies.hoggiesFound).toBe(1);
    expect(you.lastWeek.hoggiesFound).toBe(0);
  });
});

describe("HH71: the you card always leads with a positive highlight", () => {
  test("more hugs given than in any week before is the best week of hugs yet", async () => {
    await lastWeek();
    await hugsOn(alice, bob);
    await thisWeek();
    await hugsOn(alice, bob);
    await hugsOn(alice, carol);

    expect((await boardsOf(alice)).you.highlight).toEqual<Highlight>({ kind: "best-week", hugsGiven: 2, more: 1, hoggiesFound: 0 });
  });

  test("more hugs than last week, short of an earlier best week, says how many more", async () => {
    await weeksAgo(2);
    for (const author of [bob, carol, dana]) await hugsOn(alice, author);
    await lastWeek();
    await hugsOn(alice, bob);
    await thisWeek();
    await hugsOn(alice, bob);
    await hugsOn(alice, carol);

    expect((await boardsOf(alice)).you.highlight).toEqual<Highlight>({ kind: "more-hugs", more: 1, hugsGiven: 2 });
  });

  test("without more hugs than last week, the teammates who thanked the member this week count once each, however they thanked", async () => {
    await thisWeek();
    const alices = await said(alice, "Deploy is green");
    await hugs(bob, alice, alices);
    await hugs(carol, alice, alices);
    await thanks(carol, why, alice);
    await hugsOn(dana, bob);

    expect((await boardsOf(alice)).you.highlight).toEqual<Highlight>({ kind: "thanked", teammates: 2, reach: 0 });
  });

  test("the teammates who thanked the member count in the member's own week, wherever the giver's week falls", async () => {
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
    await thanks(alice, why, kiri);
    vi.setSystemTime(new Date("2026-10-19T13:00:00Z"));

    const { you } = await boardsOf(kiri);

    expect(you.tallies.kudosReceived).toBe(1);
    expect(you.highlight).toEqual<Highlight>({ kind: "thanked", teammates: 1, reach: 0 });
  });

  test("a quiet week after a week with hugs tells the hugs of last week, and whether it was the best week yet", async () => {
    await weeksAgo(2);
    await hugsOn(alice, bob);
    await lastWeek();
    await hugsOn(alice, bob);
    await hugsOn(alice, carol);
    await thisWeek();

    expect((await boardsOf(alice)).you.highlight).toEqual<Highlight>({ kind: "last-week", hugs: 2, best: true, reach: 2 });
  });

  test("otherwise it tells how many teammates the member's thanks ever reached", async () => {
    await weeksAgo(2);
    await hugsOn(alice, bob);
    await thanks(alice, why, carol, bob);
    await thisWeek();

    expect((await boardsOf(alice)).you.highlight).toEqual<Highlight>({ kind: "reach", teammates: 2 });
  });
});

async function leaderboardHugs(on: boolean) {
  await switchWebsite(t, postHog, true, ...websiteFlags, ...(on ? ["leaderboard-hugs"] : []));
}

async function weeksAgo(weeks: number) {
  vi.setSystemTime(new Date(tuesday.getTime() - weeks * weekMs + messages * minuteMs));
}

function lastWeek() {
  return weeksAgo(1);
}

function thisWeek() {
  return weeksAgo(0);
}

function slackUserOf({ name, tz }: Person) {
  return { real_name: name, ...(tz !== undefined && { tz }), profile: { real_name: name, display_name: name } };
}

async function signedIn(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: person.user, name: person.name });
  return asSignedIn;
}

async function boardsOf(person: Person): Promise<Boards> {
  const read = await (await signedIn(person)).query(api.website.leaderboard.getBoards, {});
  if (read.kind !== "boards") throw new Error(`expected the boards, got ${JSON.stringify(read)}`);
  return read;
}

async function albumSaysLeaderboardHugs(reader: Reader) {
  const album = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected the album, got ${album.kind}`);
  return album.leaderboardHugs === true;
}

function nextTs() {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  return `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
}

async function said(author: Person, words: string) {
  const ts = nextTs();
  await post(t, [section(text(words))], { user: author.user, ts });
  await settle(t);
  return ts;
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  const ts = nextTs();
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return ts;
}

async function hugs(giver: Person, author: Person, ts: string) {
  messages += 1;
  await react(t, { user: giver.user, itemUser: author.user, ts, eventId: `EvHug${messages}` });
  await settle(t);
}

async function hugsOn(giver: Person, author: Person) {
  const ts = await said(author, "A message worth a hug");
  await hugs(giver, author, ts);
  return ts;
}

async function openEveryPack(reader: Reader) {
  const album = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected the album, got ${album.kind}`);
  for (const { pack } of album.packs) await reader.mutation(api.website.album.openThoughtfulPack, { pack });
}

function exposuresOf(flag: string) {
  return t.run(async (ctx) => (await ctx.db.query("flagExposures").collect()).filter((exposure) => exposure.flag === flag).map(({ value }) => value));
}
