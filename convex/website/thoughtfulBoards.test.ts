import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import type { ThoughtfulBoardsRead } from "./album";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const grantJob = vi.hoisted(() => "album/packs:grantThoughtfulPacks");
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const dana = { user: "U_DANA", name: "Dana Ferreira" };
const erin = { user: "U_ERIN", name: "Erin Castellanos" };
const fern = { user: "U_FERN", name: "Fern Abernathy" };
const people = [alice, bob, carol, dana, erin, fern];
const bobsPicture = "https://avatars.slack-edge.test/bob-192.png";
const why = "Thanks for untangling the flaky migration";

const lanterns: TeamPage = { slug: "lanterns", name: "Lanterns", profiles: [profileOf(1, alice), profileOf(2, bob)] };
const otters: TeamPage = { slug: "otters", name: "Otters", profiles: [profileOf(3, carol), profileOf(4, dana)] };
const quills: TeamPage = { slug: "quills", name: "Quills", profiles: [profileOf(5, erin), { id: 6, firstName: "Fernanda", lastName: "Abernathy", colour: "teal" }] };

type Person = { user: string; name: string };

const theGrants = vi.hoisted(() => ({ seen: [] as unknown[] }));

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  actual.subscribers.kudosGiven = actual.subscribers.kudosGiven.map((subscription) => {
    if ("subscriber" in subscription || getFunctionName(subscription) !== grantJob) return subscription;
    return {
      subscriber: subscription,
      only: (event: KudosGivenEvent) => {
        theGrants.seen.push(event);
        return true;
      },
    };
  });
  return actual;
});

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  theGrants.seen = [];
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom().withTeams(lanterns, otters, quills);
  slack = new FakeSlack();
  for (const person of people) slack.withMember(person.user, slackUserOf(person));
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, "album", "everyone-board", "team-pages");
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await settle(t);
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

describe("AL49: the thoughtful boards rank thoughtful kudos awards given in the period asked", () => {
  test("the people board ranks each giver by the thoughtful kudos awards they gave this week, never by kudos received, short kudos or hugs", async () => {
    const first = await thanks(dana, why, alice, bob);
    await thanks(dana, "Thanks again for pairing on the stubborn rollback", bob);
    await thanks(alice, "Thanks for the careful review of the billing export", carol, erin);
    await thanks(bob, "Thanks for writing the thorough onboarding notes", carol);
    await thanks(carol, "ty", alice, bob, dana);
    await hugs(erin, dana, first);

    const boards = await boardsOf(carol);

    expect(peopleOn(boards)).toEqual([
      { name: dana.name, rank: 1, tied: false, thoughtful: 3, teams: ["otters"] },
      { name: alice.name, rank: 2, tied: false, thoughtful: 2, teams: ["lanterns"] },
      { name: bob.name, rank: 3, tied: false, thoughtful: 1, teams: ["lanterns"] },
    ]);
  });

  test("the team board sums its matched members' thoughtful kudos awards, ties sharing a rank, and a team nobody gave for is off it", async () => {
    await thanks(alice, why, carol, dana);
    await thanks(bob, "Thanks for the careful review of the billing export", erin);
    await thanks(carol, "Thanks for writing the thorough onboarding notes", alice, bob, erin);

    const boards = await boardsOf(erin);

    expect(teamsOn(boards)).toEqual([
      { team: "lanterns", name: "Lanterns", rank: 1, tied: true, thoughtful: 3, mine: false },
      { team: "otters", name: "Otters", rank: 1, tied: true, thoughtful: 3, mine: false },
    ]);
  });

  test("the member's own row and team are pinned, and with nothing given this week they are pinned unranked", async () => {
    await thanks(alice, why, carol, dana);
    await thanks(carol, "Thanks for writing the thorough onboarding notes", alice);

    const [alices, erins] = [await boardsOf(alice), await boardsOf(erin)];

    expect(pinnedOn(alices)).toEqual({ me: { name: alice.name, rank: 1, thoughtful: 2, you: true }, teams: [{ team: "lanterns", rank: 1, thoughtful: 2, mine: true }], onTheBoards: true });
    expect(pinnedOn(erins)).toEqual({ me: { name: erin.name, rank: null, thoughtful: 0, you: true }, teams: [{ team: "quills", rank: null, thoughtful: 0, mine: true }], onTheBoards: true });
  });

  test("a thoughtful kudos given last week is off this week's boards and on last week's", async () => {
    await thanks(alice, why, carol, dana);
    vi.setSystemTime(tuesday.getTime() + 7 * dayMs);
    await thanks(bob, "Thanks for writing the thorough onboarding notes", carol);

    expect(peopleOn(await boardsOf(carol))).toEqual([{ name: bob.name, rank: 1, tied: false, thoughtful: 1, teams: ["lanterns"] }]);
    expect(teamsOn(await boardsOf(carol))).toEqual([{ team: "lanterns", name: "Lanterns", rank: 1, tied: false, thoughtful: 1, mine: false }]);
    expect(peopleOn(await boardsOf(carol, { period: "last-week" }))).toEqual([{ name: alice.name, rank: 1, tied: false, thoughtful: 2, teams: ["lanterns"] }]);
    expect(teamsOn(await boardsOf(carol, { period: "last-week" }))).toEqual([{ team: "lanterns", name: "Lanterns", rank: 1, tied: false, thoughtful: 2, mine: false }]);
  });

  test("the month board counts the awards given in the reader's calendar month, and the all-time board every award", async () => {
    vi.setSystemTime(new Date("2026-09-30T10:00:00Z"));
    await thanks(alice, why, carol, dana);
    vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
    await thanks(bob, "Thanks for writing the thorough onboarding notes", carol);
    vi.setSystemTime(tuesday);
    await thanks(bob, "Thanks for the careful review of the billing export", erin);

    expect(peopleOn(await boardsOf(carol, { period: "month" }))).toEqual([{ name: bob.name, rank: 1, tied: false, thoughtful: 2, teams: ["lanterns"] }]);
    expect(peopleOn(await boardsOf(carol, { period: "all" }))).toEqual([
      { name: alice.name, rank: 1, tied: true, thoughtful: 2, teams: ["lanterns"] },
      { name: bob.name, rank: 1, tied: true, thoughtful: 2, teams: ["lanterns"] },
    ]);
    expect(teamsOn(await boardsOf(carol, { period: "all" }))).toEqual([{ team: "lanterns", name: "Lanterns", rank: 1, tied: false, thoughtful: 4, mine: false }]);
    expect(pinnedOn(await boardsOf(alice, { period: "month" })), "Alice gave nothing this month").toMatchObject({ me: { name: alice.name, rank: null, thoughtful: 0 } });
  });

  test("an award counts in the month of its giver's own day, as the reader's month is the reader's own", async () => {
    await livesIn(alice, "Pacific/Auckland");
    vi.setSystemTime(new Date("2026-10-31T14:00:00Z"));
    await thanks(alice, why, erin);
    await thanks(bob, "Thanks for writing the thorough onboarding notes", erin);

    expect(peopleOn(await boardsOf(carol, { period: "month" })).map(({ name }) => name), "a reader on UTC, still in October").toEqual([bob.name]);
    await livesIn(dana, "Pacific/Auckland");
    expect(peopleOn(await boardsOf(dana, { period: "month" })).map(({ name }) => name), "a reader in Auckland, already in November").toEqual([alice.name]);
  });

  test("each award counts in its giver's own week and each reader reads their own week, so a reader ahead of UTC sees the new week while UTC is still on the old one", async () => {
    for (const person of [alice, bob, carol]) await livesIn(person, "Pacific/Auckland");
    vi.setSystemTime(new Date("2026-10-18T09:00:00Z"));
    await thanks(alice, why, erin);
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
    await thanks(bob, "Thanks for writing the thorough onboarding notes", erin);

    expect(peopleOn(await boardsOf(carol)).map(({ name }) => name), "a reader in Auckland, already on Monday").toEqual([bob.name]);
    expect(peopleOn(await boardsOf(dana)).map(({ name }) => name), "a reader on UTC, still on Sunday").toEqual([alice.name]);
  });

  test("a message's tally run again and redelivered counts each award once on every board", async () => {
    await thanks(alice, why, carol, dana);
    const [event] = theGrants.seen as KudosGivenEvent[];

    await t.mutation(internal.album.tallies.tallyKudosGiven, { event: event! });
    await t.mutation(internal.album.tallies.tallyKudosGiven, { event: { ...event!, retry: true } });
    await settle(t);

    for (const period of ["week", "month", "all"] as const) expect(peopleOn(await boardsOf(carol, { period })), period).toEqual([{ name: alice.name, rank: 1, tied: false, thoughtful: 2, teams: ["lanterns"] }]);
  });

  test("awards the album tallied before the boards counted them reach every board once through fillThoughtfulBoards, however often it runs, beside awards given while it runs", async () => {
    await thanks(alice, why, carol, dana);
    await thanks(bob, "ty", carol);
    vi.setSystemTime(tuesday.getTime() + 7 * dayMs);
    await thanks(carol, "Thanks for writing the thorough onboarding notes", alice);
    await asIfTheBoardsNeverCountedThem();
    expect(peopleOn(await boardsOf(carol, { period: "all" })), "before the fill").toEqual([]);

    await t.mutation(internal.album.history.fillThoughtfulBoards, { workspace: "T1" });
    await thanks(dana, "Thanks for the careful review of the billing export", alice);
    await t.mutation(internal.album.history.fillThoughtfulBoards, { workspace: "T1" });
    await settle(t);

    expect(peopleOn(await boardsOf(erin))).toEqual([
      { name: carol.name, rank: 1, tied: true, thoughtful: 1, teams: ["otters"] },
      { name: dana.name, rank: 1, tied: true, thoughtful: 1, teams: ["otters"] },
    ]);
    expect(peopleOn(await boardsOf(erin, { period: "last-week" }))).toEqual([{ name: alice.name, rank: 1, tied: false, thoughtful: 2, teams: ["lanterns"] }]);
    expect(peopleOn(await boardsOf(erin, { period: "all" }))).toEqual([
      { name: alice.name, rank: 1, tied: false, thoughtful: 2, teams: ["lanterns"] },
      { name: carol.name, rank: 2, tied: true, thoughtful: 1, teams: ["otters"] },
      { name: dana.name, rank: 2, tied: true, thoughtful: 1, teams: ["otters"] },
    ]);
  });

  test("Who gave narrows the people board to one team's givers in any period, each keeping their rank", async () => {
    await thanks(dana, why, alice, bob);
    await thanks(alice, "Thanks for the careful review of the billing export", carol);
    await thanks(carol, "Thanks for writing the thorough onboarding notes", alice);

    const narrowed = await boardsOf(erin, { team: "otters" });

    expect(peopleOn(narrowed)).toEqual([
      { name: dana.name, rank: 1, tied: false, thoughtful: 2, teams: ["otters"] },
      { name: carol.name, rank: 2, tied: true, thoughtful: 1, teams: ["otters"] },
    ]);
    expect(teamsOn(narrowed)).toEqual(teamsOn(await boardsOf(erin)));
    expect(peopleOn(await boardsOf(erin, { team: "otters", period: "all" }))).toEqual(peopleOn(narrowed));
  });

  test("a member's teams follow the matcher: once an unmatched giver links their own profile, their awards count for its team", async () => {
    await thanks(fern, why, alice);
    expect(teamsOn(await boardsOf(alice))).toEqual([]);

    const { asSignedIn: asFern } = await aSignedInSession(t, fern);
    expect(await asFern.mutation(api.website.commands.linkMyCompanyProfile, { profile: 6 })).toMatchObject({ kind: "linked" });
    await settle(t);

    expect(teamsOn(await boardsOf(alice))).toEqual([{ team: "quills", name: "Quills", rank: 1, tied: false, thoughtful: 1, mine: false }]);
    expect(peopleOn(await boardsOf(alice))).toEqual([{ name: fern.name, rank: 1, tied: false, thoughtful: 1, teams: ["quills"] }]);
  });

  test("a giver shows their stored company face, else their Slack picture", async () => {
    postHogCom.withTeams({ ...lanterns, profiles: [{ ...profileOf(1, alice), cutout: aCutout("alice") }, profileOf(2, bob)] }, otters, quills);
    await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
    await settle(t);
    await thanks(alice, why, carol);
    await thanks(bob, "Thanks for writing the thorough onboarding notes", carol);

    const boards = await boardsOf(carol);

    expect(boards).toMatchObject({ kind: "boards", people: [{ name: alice.name, face: { kind: "company-profile", image: expect.stringContaining("alice") } }, { name: bob.name, face: { kind: "slack", image: bobsPicture, initials: "BO" } }] });
  });
});

describe("AL49: a member who left the boards is on neither thoughtful board", () => {
  test("a member whose Show me on the leaderboards is off is off the people board, their awards leave their team's sum, and they are pinned off the boards", async () => {
    await thanks(alice, why, carol, dana);
    await thanks(bob, "Thanks for writing the thorough onboarding notes", carol);
    await thanks(carol, "Thanks for the careful review of the billing export", alice);
    const { asSignedIn: asAlice } = await aSignedInSession(t, alice);
    expect(await asAlice.mutation(api.website.commands.setBoardVisibility, { visible: false })).toEqual({ kind: "set", visible: false });

    const [alices, carols] = [await boardsOf(alice), await boardsOf(carol)];

    for (const boards of [alices, carols]) {
      expect(peopleOn(boards).map(({ name }) => name)).toEqual([bob.name, carol.name]);
      expect(teamsOn(boards).map(({ team, thoughtful }) => ({ team, thoughtful }))).toEqual([
        { team: "lanterns", thoughtful: 1 },
        { team: "otters", thoughtful: 1 },
      ]);
    }
    expect(pinnedOn(alices)).toEqual({ me: null, teams: [{ team: "lanterns", rank: 1, thoughtful: 1, mine: true }], onTheBoards: false });
  });
});

describe("AL49: the thoughtful boards stay within Convex's transaction limits", { timeout: 120_000 }, () => {
  test("every period's board of 1,000 members of one company team, each of whom gave thoughtful kudos, reads in one query", async () => {
    t = testBackend({ transactionLimits: true });
    await switchWebsite(t, postHog, true, "album");
    const givers = 1000;
    await t.run(async (ctx) => {
      await ctx.db.insert("companyTeams", { team: "lanterns", name: "Lanterns", leads: [], people: Array.from({ length: givers }, (_, n) => n + 1), asOf: 0 });
      for (let n = 1; n <= givers; n += 1) {
        const member = await ctx.db.insert("members", { workspace: "T1", user: `U${n}`, kind: "member", asOf: 0, name: `Giver ${n}` });
        await ctx.db.insert("companyFaces", { workspace: "T1", member, face: null, profile: n });
        for (const period of ["week:2026-10-12", "week:2026-10-05", "month:2026-10", "all"]) await ctx.db.insert("thoughtfulBoardTallies", { workspace: "T1", period, giver: member, awards: n });
      }
    });

    for (const period of boardPeriods) {
      const boards = boardsIn(await boardsOf({ user: "U1", name: "Giver 1" }, { period }));

      expect(boards.people, period).toHaveLength(givers);
      expect(boards.people[0], period).toMatchObject({ name: `Giver ${givers}`, rank: 1, thoughtful: givers });
      expect(boards.teams, period).toEqual([expect.objectContaining({ team: "lanterns", thoughtful: (givers * (givers + 1)) / 2, mine: true })]);
    }
  });

  test("fillThoughtfulBoards pages a workspace's awards, 50 a mutation, and a thoughtful kudos to 120 people is tallied in pages", async () => {
    t = testBackend({ transactionLimits: true });
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 500 }));
    await switchWebsite(t, postHog, true, "album");
    const crowd = Array.from({ length: 120 }, (_, n) => ({ user: `U_CROWD_${n}`, name: `Crowd Person ${n}` }));
    for (const person of crowd) slack.withMember(person.user, slackUserOf(person));
    for (const person of [alice, carol]) await memberChanged(t, "team_join", { id: person.user, ...slackUserOf(person) });
    await thanks(alice, why, ...crowd);
    expect(peopleOn(await boardsOf(carol, { period: "all" }))).toEqual([{ name: alice.name, rank: 1, tied: false, thoughtful: 120, teams: [] }]);
    await asIfTheBoardsNeverCountedThem();

    await t.mutation(internal.album.history.fillThoughtfulBoards, { workspace: "T1" });
    await settle(t);

    for (const period of ["week", "month", "all"] as const) expect(peopleOn(await boardsOf(carol, { period })), period).toEqual([{ name: alice.name, rank: 1, tied: false, thoughtful: 120, teams: [] }]);
  });
});

describe("AL40: getThoughtfulBoards answers off while album is off for the member", () => {
  test("with album off, getThoughtfulBoards answers off", async () => {
    await thanks(alice, why, carol);
    await switchWebsite(t, postHog, true, "everyone-board");

    expect(await boardsOf(carol)).toEqual({ kind: "off" });
  });
});

describe("E2: a view of the website's Leaderboard sends leaderboard viewed", () => {
  test.each(["week", "last-week", "month", "all"] as const)("a view of the %s boards sends one leaderboard viewed for the Everyone board from the website", async (period) => {
    expect(await (await signedIn(alice)).mutation(api.website.album.viewLeaderboard, { period })).toEqual({ kind: "viewed" });
    await settle(t);

    expect(leaderboardViews()).toEqual([{ board: "everyone", period, surface: "website" }]);
  });

  test("with album off a view is refused and sends nothing", async () => {
    await switchWebsite(t, postHog, true, "everyone-board");

    expect(await (await signedIn(alice)).mutation(api.website.album.viewLeaderboard, { period: "week" })).toEqual({ kind: "refused" });
    await settle(t);

    expect(leaderboardViews()).toEqual([]);
  });
});

function slackUserOf({ user, name }: Person) {
  const picture = user === bob.user ? { image_72: bobsPicture, image_192: bobsPicture } : {};
  return { real_name: name, profile: { real_name: name, display_name: name, ...picture } };
}

function profileOf(id: number, { name }: Person) {
  const [firstName, lastName] = name.split(" ");
  return { id, firstName: firstName!, lastName: lastName!, colour: "teal" };
}

type Boards = Extract<ThoughtfulBoardsRead, { kind: "boards" }>;

const boardPeriods = ["week", "last-week", "month", "all"] as const;

type Asked = { team?: string; period?: (typeof boardPeriods)[number] };

async function boardsOf(person: Person, asked: Asked = {}) {
  return (await signedIn(person)).query(api.website.album.getThoughtfulBoards, asked);
}

async function asIfTheBoardsNeverCountedThem() {
  await t.run(async (ctx) => {
    for (const tally of await ctx.db.query("thoughtfulBoardTallies").collect()) await ctx.db.delete(tally._id);
    for (const counted of await ctx.db.query("boardCountedAwards").collect()) await ctx.db.delete(counted._id);
  });
}

function boardsIn(read: unknown): Boards {
  expect(read).toMatchObject({ kind: "boards" });
  return read as Boards;
}

function peopleOn(read: unknown) {
  return boardsIn(read).people.map(({ name, rank, tied, thoughtful, teams }) => ({ name, rank, tied, thoughtful, teams }));
}

function teamsOn(read: unknown) {
  return boardsIn(read).teams.map(({ team, name, rank, tied, thoughtful, mine }) => ({ team, name, rank, tied, thoughtful, mine }));
}

function pinnedOn(read: unknown) {
  const { pinned, onTheBoards } = boardsIn(read);
  return {
    me: pinned.me === null ? null : { name: pinned.me.name, rank: pinned.me.rank, thoughtful: pinned.me.thoughtful, you: pinned.me.you },
    teams: pinned.teams.map(({ team, rank, thoughtful, mine }) => ({ team, rank, thoughtful, mine })),
    onTheBoards,
  };
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return ts;
}

async function livesIn(person: Person, tz: string) {
  await memberChanged(t, "user_change", { id: person.user, ...slackUserOf(person), tz });
  await settle(t);
}

async function hugs(giver: Person, author: Person, ts: string) {
  await react(t, { user: giver.user, itemUser: author.user, ts, eventId: `EvHug${messages}` });
  await settle(t);
}

async function signedIn(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: person.user, name: person.name });
  return asSignedIn;
}

function leaderboardViews() {
  return postHog
    .productEvents()
    .filter(({ event }) => event === "leaderboard viewed")
    .map(({ properties: { board, period, surface } }) => ({ board, period, surface }));
}
