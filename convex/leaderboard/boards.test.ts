import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { KudosGivenEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";
import { boardsOf, placeOf, type Boards, type Measure } from "./boards";
import type { Period } from "./periods";
import { setLeaderboardVisibility } from "./visibility";

const sundayNoon = new Date("2026-10-18T12:00:00Z");
const measures: Measure[] = ["kudosGiven", "kudosReceived", "hugsGiven", "hugsReceived"];

let t: Backend;
let messages = 0;
let profileCount = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: sundayNoon });
  t = testBackend();
  messages = 0;
  profileCount = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HH28: boardsOf ranks the period's people by each count", () => {
  test("each board ranks people by its count, equal counts share a rank, and a zero count is on no board", async () => {
    const { ann, bea, cal, dee } = await people("Ann", "Bea", "Cal", "Dee");
    await gaveKudos(ann, [bea, cal]);
    await gaveKudos(cal, [bea], { kudos: 2 });
    await hugged(bea, ann);
    await hugged(bea, cal);
    await hugged(dee, ann);

    const boards = await boardsFor(dee, "week");

    expect(standingsOn(boards)).toEqual({
      kudosGiven: ["1 Ann 2 tied", "1 Cal 2 tied"],
      kudosReceived: ["1 Bea 3", "2 Cal 1"],
      hugsGiven: ["1 Bea 2", "2 Dee 1"],
      hugsReceived: ["1 Ann 2", "2 Cal 1"],
    });
  });

  test("a member who left the boards is on none of them, however much they counted, while what they gave still counts for others", async () => {
    const { ann, bea, eve } = await people("Ann", "Bea", "Eve");
    await gaveKudos(eve, [ann], { kudos: 5 });
    await gaveKudos(ann, [eve, bea]);
    await hugged(eve, ann);
    await hugged(ann, eve);
    await leftTheBoards(eve);

    const boards = await boardsFor(ann, "week");

    expect(standingsOn(boards)).toEqual({
      kudosGiven: ["1 Ann 2"],
      kudosReceived: ["1 Ann 5", "2 Bea 1"],
      hugsGiven: ["1 Ann 1"],
      hugsReceived: ["1 Ann 1"],
    });
  });
});

describe("HH28: boardsOf reads the period the viewer is in", () => {
  test("the week, month and all time are the viewer's own, in their time zone", async () => {
    const { ann, bea, cal } = await people("Ann", "Bea", "Cal");
    await inTimeZone(cal, "Pacific/Kiritimati");
    await gaveKudos(ann, [bea]);
    await gaveKudos(ann, [bea], { kudos: 2, day: "2026-10-19" });

    const kudosGiven = async (viewer: MemberId, period: Period) => standingsOn(await boardsFor(viewer, period)).kudosGiven;

    expect(await kudosGiven(ann, "week"), "Sunday noon in UTC").toEqual(["1 Ann 1"]);
    expect(await kudosGiven(cal, "week"), "Sunday noon in UTC is Monday in Kiritimati").toEqual(["1 Ann 2"]);
    expect(await kudosGiven(ann, "month")).toEqual(["1 Ann 3"]);
    expect(await kudosGiven(cal, "all")).toEqual(["1 Ann 3"]);
  });
});

describe("HH28: boardsOf sums company teams", () => {
  test("each team board sums its members on the boards by its count, equal sums share a rank, a zero sum is on no board, and the viewer's team is marked", async () => {
    const { ann, bea, cal, dee, eve, gus } = await people("Ann", "Bea", "Cal", "Dee", "Eve", "Gus");
    await onTeam("lanterns", "Lanterns", ann, bea);
    await onTeam("otters", "Otters", cal, dee, eve);
    await onTeam("quills", "Quills", gus);
    await gaveKudos(ann, [cal]);
    await gaveKudos(bea, [dee], { kudos: 2 });
    await gaveKudos(cal, [ann], { kudos: 3 });
    await gaveKudos(eve, [ann], { kudos: 4 });
    await hugged(dee, bea);
    await leftTheBoards(eve);

    const boards = await boardsFor(ann, "week");

    expect(teamStandingsOn(boards)).toEqual({
      kudosGiven: ["1 Lanterns 3 tied mine", "1 Otters 3 tied"],
      kudosReceived: ["1 Lanterns 7 mine", "2 Otters 3"],
      hugsGiven: ["1 Otters 1"],
      hugsReceived: ["1 Lanterns 1 mine"],
    });
  });

  test("asking for a team keeps only its people, at the ranks they hold among everyone", async () => {
    const { ann, bea, cal, dee } = await people("Ann", "Bea", "Cal", "Dee");
    await onTeam("lanterns", "Lanterns", ann, bea);
    await onTeam("otters", "Otters", cal, dee);
    await gaveKudos(ann, [cal]);
    await gaveKudos(bea, [dee], { kudos: 2 });
    await gaveKudos(cal, [ann], { kudos: 3 });

    const boards = await boardsFor(ann, "week", "otters");

    expect(standingsOn(boards)).toEqual({
      kudosGiven: ["1 Cal 3"],
      kudosReceived: ["2 Dee 2", "3 Cal 1"],
      hugsGiven: [],
      hugsReceived: [],
    });
    expect(teamStandingsOn(boards).kudosGiven).toEqual(["1 Lanterns 3 tied mine", "1 Otters 3 tied"]);
  });
});

describe("HH28: boardsOf pins the viewer", () => {
  test("the viewer gets their own row, or a zero row when they counted nothing in the period", async () => {
    const { ann, bea, fay } = await people("Ann", "Bea", "Fay");
    await gaveKudos(ann, [bea]);
    await hugged(bea, ann);

    const [anns, fays] = [await boardsFor(ann, "week"), await boardsFor(fay, "week")];

    expect(anns.me).toMatchObject({ member: ann, name: "Ann", counts: { kudosGiven: 1, kudosReceived: 0, hugsGiven: 0, hugsReceived: 1 }, firstDay: "2026-10-18", viewer: true });
    expect(anns.onTheBoards).toBe(true);
    expect(fays.me).toMatchObject({ member: fay, name: "Fay", counts: { kudosGiven: 0, kudosReceived: 0, hugsGiven: 0, hugsReceived: 0 }, firstDay: null, viewer: true });
    expect(fays.onTheBoards).toBe(true);
  });

  test("a viewer who left the boards gets no row of their own, and the boards say so", async () => {
    const { ann, eve } = await people("Ann", "Eve");
    await gaveKudos(eve, [ann]);
    await leftTheBoards(eve);

    const boards = await boardsFor(eve, "week");

    expect(boards.me).toBeNull();
    expect(boards.onTheBoards).toBe(false);
    expect(boards.people.kudosGiven).toEqual([]);
  });
});

describe("HH28: placeOf answers one member's place by the kudos they gave", () => {
  test("the member's rank among everyone on the boards, an equal count sharing it", async () => {
    const { ann, bea, cal, dee, eve, hal } = await people("Ann", "Bea", "Cal", "Dee", "Eve", "Hal");
    await gaveKudos(ann, [dee], { kudos: 3 });
    await gaveKudos(bea, [dee], { kudos: 2 });
    await gaveKudos(cal, [dee], { kudos: 2 });
    await gaveKudos(dee, [ann]);
    await gaveKudos(eve, [ann], { kudos: 5 });
    await gaveKudos(hal, [ann], { kudos: 4 });
    await leftTheBoards(eve);
    await leftTheWorkspace(hal);

    expect(await placeFor(ann, "week")).toEqual({ rank: 1, tied: false, kudosGiven: 3 });
    expect(await placeFor(bea, "week")).toEqual({ rank: 2, tied: true, kudosGiven: 2 });
    expect(await placeFor(dee, "week")).toEqual({ rank: 4, tied: false, kudosGiven: 1 });
    expect(await placeFor(dee, "all")).toEqual({ rank: 4, tied: false, kudosGiven: 1 });
  });

  test("no place for a member who left the boards, has no current name and picture, or gave no kudos in the period", async () => {
    const { ann, eve, hal, fay } = await people("Ann", "Eve", "Hal", "Fay");
    await gaveKudos(eve, [fay]);
    await gaveKudos(hal, [fay]);
    await gaveKudos(ann, [fay], { day: "2026-10-11" });
    await hugged(fay, ann);
    await leftTheBoards(eve);
    await leftTheWorkspace(hal);

    expect(await placeFor(eve, "week"), "left the boards").toBeNull();
    expect(await placeFor(hal, "week"), "no current name and picture").toBeNull();
    expect(await placeFor(fay, "week"), "only received and hugged").toBeNull();
    expect(await placeFor(ann, "week"), "gave last week").toBeNull();
    expect(await placeFor(ann, "month")).toEqual({ rank: 1, tied: false, kudosGiven: 1 });
  });
});

async function people<Name extends string>(...names: Name[]): Promise<Record<Lowercase<Name>, MemberId>> {
  const inserted = await t.run(async (ctx) => {
    const members: Array<[string, MemberId]> = [];
    for (const name of names) members.push([name.toLowerCase(), await ctx.db.insert("members", { workspace: "T1", user: `U_${name.toUpperCase()}`, kind: "member", name, asOf: 0 })]);
    return members;
  });
  return Object.fromEntries(inserted) as Record<Lowercase<Name>, MemberId>;
}

type Given = { kudos?: number; day?: string };

async function gaveKudos(giver: MemberId, recipients: MemberId[], { kudos = 1, day = "2026-10-18" }: Given = {}) {
  const message = nextMessage();
  const at = Date.parse(`${day}T12:00:00Z`);
  const awards = await t.run(async (ctx) => {
    const inserted: Array<{ award: Id<"awards">; giver: MemberId; recipient: MemberId; kudos: number }> = [];
    for (const recipient of recipients) inserted.push({ award: await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver, recipient, kudos, day, at }), giver, recipient, kudos });
    return inserted;
  });
  const event: KudosGivenEvent = {
    type: "kudosGiven",
    workspace: "T1",
    message: { workspace: "T1", conversation: "C1", message },
    giver,
    awards,
    via: "message",
    kudosEmoji: "taco",
    annotations: {},
    allowance: { dailyOpening: 5, dailyLeft: 0 },
    skippedMentions: 0,
    retry: false,
    inThread: false,
    day,
    at,
  };
  await t.mutation(internal.leaderboard.totals.countKudosGiven, { event });
}

async function hugged(giver: MemberId, person: MemberId, { day = "2026-10-18" }: Given = {}) {
  const message = { workspace: "T1", conversation: "C1", message: nextMessage() };
  const at = Date.parse(`${day}T12:00:00Z`);
  await t.mutation(internal.leaderboard.hugs.countHugGiven, { event: { type: "hugGiven", workspace: "T1", giver, message, onKudos: false, at, day } });
  await t.mutation(internal.leaderboard.hugs.countHugReceived, { event: { type: "hugReceived", workspace: "T1", giver, person, message, at, week: "2026-10-12" } });
}

async function inTimeZone(member: MemberId, timeZone: string) {
  await t.run((ctx) => ctx.db.patch(member, { timeZone }));
}

async function onTeam(team: string, name: string, ...members: MemberId[]) {
  await t.run(async (ctx) => {
    const profiles = members.map(() => (profileCount += 1));
    await ctx.db.insert("companyTeams", { team, name, leads: [], people: profiles, asOf: 0 });
    for (const [index, member] of members.entries()) await ctx.db.insert("companyFaces", { workspace: "T1", member, face: null, profile: profiles[index] });
  });
}

async function leftTheWorkspace(member: MemberId) {
  await t.run((ctx) => ctx.db.patch(member, { kind: "not-a-member" }));
}

async function leftTheBoards(member: MemberId) {
  await t.run((ctx) => setLeaderboardVisibility(ctx, member, false));
}

function nextMessage() {
  messages += 1;
  return String(messages);
}

function boardsFor(viewer: MemberId, period: Period, team: string | null = null) {
  return t.run((ctx) => boardsOf(ctx, { workspace: "T1", member: viewer }, { period, team }));
}

function placeFor(member: MemberId, period: Period) {
  return t.run((ctx) => placeOf(ctx, { workspace: "T1", member }, period));
}

function standingsOn(boards: Boards): Record<Measure, string[]> {
  const standings = measures.map((measure) => [measure, boards.people[measure].map(({ rank, tied, name, counts }) => `${rank} ${name} ${counts[measure]}${tied ? " tied" : ""}`)]);
  return Object.fromEntries(standings) as Record<Measure, string[]>;
}

function teamStandingsOn(boards: Boards): Record<Measure, string[]> {
  const standings = measures.map((measure) => [measure, boards.teams[measure].map(({ rank, tied, name, counts, mine }) => `${rank} ${name} ${counts[measure]}${tied ? " tied" : ""}${mine ? " mine" : ""}`)]);
  return Object.fromEntries(standings) as Record<Measure, string[]>;
}
