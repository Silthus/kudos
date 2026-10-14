import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog as flagsLoadedFromPostHog, onForEveryone, onInTheSandboxOnly, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aSession } from "../../testing/website";
import { api, components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { countGiven, everyoneBoardOf } from "../leaderboard/totals";
import type { Period } from "../leaderboard/periods";
import { setLeaderboardVisibility } from "../leaderboard/visibility";
import { openUnlock } from "../unlocks/unlocks";
import type { Leaderboard, MyLeaderboard } from "./leaderboard";

const tuesday = new Date("2026-10-13T10:00:00Z");
const week = 7 * 24 * 60 * 60 * 1000;
const juno = { user: "U_JUNO", name: "Juno Whitlock", image: "https://avatars.slack-edge.com/juno.png" };

let postHog: FakePostHog;
let t: Backend;
let given = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("website reads pass one guard", () => {
  test("getLeaderboard reads closed while the website flag is off, even with everyone-board on", async () => {
    await aMember("U_JUNO", "Juno");
    const { asSignedIn } = await aSession(t, juno);
    await flagsOn("everyone-board");

    expect(await leaderboard("week", asSignedIn)).toEqual({ kind: "closed" });
  });

  test("getLeaderboard reads signed out without a session", async () => {
    await flagsOn("website", "everyone-board");

    expect(await leaderboard("week")).toEqual({ kind: "signed-out" });
  });

  test("getLeaderboard reads not-a-member for a former member with a live session", async () => {
    await aMember("U_JUNO", "Juno", { kind: "not-a-member" });
    const { asSignedIn } = await aSession(t, juno);
    await flagsOn("website", "everyone-board");

    expect(await leaderboard("week", asSignedIn)).toEqual({ kind: "not-a-member" });
  });

  test("getLeaderboard reaches the board only for a verified member", async () => {
    await aMember("U_JUNO", "Juno");
    const { asSignedIn } = await aSession(t, juno);
    await flagsOn("website", "everyone-board");

    expect((await leaderboard("week", asSignedIn)).kind).toBe("board");
  });

  test("an argument that names another member is rejected by the validator", async () => {
    await aMember("U_JUNO", "Juno");
    const { asSignedIn } = await aSession(t, juno);
    await flagsOn("website", "everyone-board");
    const withAnotherMember = { period: "week", user: "U_BOB" } as unknown as { period: Period };

    await expect(asSignedIn.query(api.website.leaderboard.getLeaderboard, withAnotherMember)).rejects.toThrow(/user/);
  });

  test("a period other than week, month or all is rejected by the validator", async () => {
    await aMember("U_JUNO", "Juno");
    const { asSignedIn } = await aSession(t, juno);
    await flagsOn("website", "everyone-board");

    await expect(asSignedIn.query(api.website.leaderboard.getLeaderboard, { period: "year" as Period })).rejects.toThrow(/year/);
  });
});

describe("WS30: the website's board is invisible while everyone-board is off", () => {
  type BoardOff = { condition: string; turnOff: () => Promise<unknown> };

  const boardOff: BoardOff[] = [
    { condition: "while PostHog has no everyone-board flag", turnOff: () => flagsOn("website") },
    {
      condition: "in production, while the flag is on in the sandbox only",
      turnOff: async () => {
        await flagsFromPostHog(onForEveryone("website"), onInTheSandboxOnly("everyone-board"));
        vi.stubEnv("KUDOS_ENVIRONMENT", "production");
      },
    },
  ];

  test.each(boardOff)("$condition, getLeaderboard answers not-found and getMyProfile's leaderboard is off", async ({ turnOff }) => {
    await aMember("U_JUNO", "Juno");
    await gives("U_JUNO", 2);
    const { asSignedIn } = await aSession(t, juno);
    await turnOff();

    expect(await leaderboard("week", asSignedIn)).toEqual({ kind: "not-found" });
    expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", leaderboard: { kind: "off" } });
  });

  test("while everyone-board is on, getLeaderboard answers the board and getMyProfile's leaderboard is open", async () => {
    await aMember("U_JUNO", "Juno");
    const { asSignedIn } = await aSession(t, juno);
    await flagsOn("website", "everyone-board");

    expect(await leaderboard("week", asSignedIn)).toMatchObject({ kind: "board" });
    expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", leaderboard: { kind: "open" } });
  });

  test("switching everyone-board off under an open session turns the board to not-found", async () => {
    await aMember("U_JUNO", "Juno");
    const { asSignedIn } = await aSession(t, juno);
    await flagsOn("website", "everyone-board");
    expect((await leaderboard("week", asSignedIn)).kind).toBe("board");

    await flagsOn("website");

    expect(await leaderboard("week", asSignedIn)).toEqual({ kind: "not-found" });
    expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", leaderboard: { kind: "off" } });
  });
});

describe("a website board row carries only what a board shows", () => {
  beforeEach(() => flagsOn("website", "everyone-board"));

  test("a row holds exactly position, rank, tied, name, face, kudos and you", async () => {
    await aMember("U_JUNO", "Juno Whitlock");
    await aMember("U_ANN", "Ann Lee");
    await gives("U_ANN", 3);
    await gives("U_JUNO", 1);
    const { asSignedIn } = await aSession(t, juno);

    expect((await board("week", asSignedIn)).rows).toEqual([
      { position: 1, rank: 1, tied: false, name: "Ann Lee", face: { kind: "initials", initials: "AL" }, kudos: 3, you: false },
      { position: 2, rank: 2, tied: false, name: "Juno Whitlock", face: { kind: "slack", image: juno.image, initials: "JW" }, kudos: 1, you: true },
    ]);
  });

  test("the answer carries no Slack user ID, member ID or kudos received", async () => {
    const junoId = await aMember("U_JUNO", "Juno Whitlock");
    const annId = await aMember("U_ANN", "Ann Lee");
    await gives("U_ANN", 3, { to: "U_JUNO" });
    const { asSignedIn } = await aSession(t, juno);

    const answer = JSON.stringify(await leaderboard("week", asSignedIn));

    for (const id of ["U_JUNO", "U_ANN", junoId, annId]) expect(answer).not.toContain(id);
    expect(answer).not.toMatch(/received|xp|level|group/i);
  });

  test("G13: a member who only received is not on the board", async () => {
    await aMember("U_JUNO", "Juno");
    await aMember("U_ANN", "Ann");
    await gives("U_ANN", 3, { to: "U_JUNO" });
    const { asSignedIn } = await aSession(t, juno);

    expect(shown(await board("week", asSignedIn))).toEqual(["1 Ann 3"]);
  });

  test("G22: a member who left the boards is on nobody's board, their own included", async () => {
    await aMember("U_JUNO", "Juno");
    await aMember("U_ANN", "Ann");
    await aMember("U_BOB", "Bob");
    await gives("U_ANN", 3);
    await gives("U_BOB", 2);
    await gives("U_JUNO", 1);
    await leavesTheBoards("U_ANN");
    const asJuno = (await aSession(t, juno)).asSignedIn;
    const asAnn = (await aSession(t, { user: "U_ANN", name: "Ann" })).asSignedIn;

    expect(shown(await board("week", asJuno))).toEqual(["1 Bob 2", "2 Juno (you) 1"]);
    expect(shown(await board("week", asAnn))).toEqual(["1 Bob 2", "2 Juno 1"]);
  });

  test("G15: a giver who is no longer a member is not on the board", async () => {
    await aMember("U_JUNO", "Juno");
    const annId = await aMember("U_ANN", "Ann");
    await gives("U_ANN", 3);
    await gives("U_JUNO", 1);
    await t.run((ctx) => ctx.db.patch(annId, { kind: "not-a-member" }));
    const { asSignedIn } = await aSession(t, juno);

    expect(shown(await board("week", asSignedIn))).toEqual(["1 Juno (you) 1"]);
  });

  test("WS34: a member without a display name shows as a teammate on a question-mark tile", async () => {
    await aMember("U_JUNO", "Juno");
    await aMember("U_ANN");
    await gives("U_ANN", 3);
    const { asSignedIn } = await aSession(t, juno);

    expect((await board("week", asSignedIn)).rows[0]).toMatchObject({ name: "A teammate", face: { kind: "initials", initials: "?" } });
  });

  test("WS34: initials come from each word's first letter, so a name that starts with an emoji still reads as letters", async () => {
    await aMember("U_JUNO", "Juno");
    await aMember("U_ANN", "🦔 Ann Lee");
    await gives("U_ANN", 3);
    const { asSignedIn } = await aSession(t, juno);

    expect((await board("week", asSignedIn)).rows[0]).toMatchObject({ name: "🦔 Ann Lee", face: { kind: "initials", initials: "AL" } });
  });
});

describe("WS31 WS32 WS35: the board is the leaderboard module's, as the viewer sees it", () => {
  beforeEach(() => flagsOn("website", "everyone-board"));

  test.each([
    { period: "week" as const, rows: ["1 Cy 1"] },
    { period: "month" as const, rows: ["1 Ann 2", "2 Cy 1"] },
    { period: "all" as const, rows: ["1 Ann 2", "2 Bob 1", "2 Cy 1"] },
  ])("G23: $period ranks the kudos given in it", async ({ period, rows }) => {
    await aMember("U_JUNO", "Juno");
    for (const [user, name] of [["U_ANN", "Ann"], ["U_BOB", "Bob"], ["U_CY", "Cy"]]) await aMember(user!, name);
    await gives("U_BOB", 1, { day: "2026-09-20" });
    await gives("U_ANN", 2, { day: "2026-10-01" });
    await gives("U_CY", 1, { day: "2026-10-13" });
    const { asSignedIn } = await aSession(t, juno);

    const answer = await board(period, asSignedIn);

    expect(answer.period).toBe(period);
    expect(shown(answer)).toEqual(rows);
  });

  test("G16: equal totals share a rank and are marked tied", async () => {
    await aMember("U_JUNO", "Juno");
    await aMember("U_ZOE", "Zoe");
    await aMember("U_AL", "Al");
    await gives("U_ZOE", 2);
    await gives("U_AL", 2);
    await gives("U_JUNO", 1);
    const { asSignedIn } = await aSession(t, juno);

    const answer = await board("week", asSignedIn);

    expect(answer.rows.map(({ position, rank, tied, name }) => ({ position, rank, tied, name }))).toEqual([
      { position: 1, rank: 1, tied: true, name: "Al" },
      { position: 2, rank: 1, tied: true, name: "Zoe" },
      { position: 3, rank: 3, tied: false, name: "Juno" },
    ]);
    expect(answer.standing).toEqual({ kind: "ranked", position: 3, rank: 3 });
  });

  test("G17: a viewer at position 2 sees the first ten positions, and the whole board is in rows", async () => {
    await aBoardOf(15, { viewerAt: 2 });
    const { asSignedIn } = await aSession(t, juno);

    const answer = await board("week", asSignedIn);

    expect(answer.window).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(answer.rows.map(({ position }) => position)).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(answer.standing).toEqual({ kind: "ranked", position: 2, rank: 2 });
  });

  test("G17: a viewer at position 9 sees the top three, then three around them, skipping positions 4 and 5", async () => {
    await aBoardOf(15, { viewerAt: 9 });
    const { asSignedIn } = await aSession(t, juno);

    const answer = await board("week", asSignedIn);

    expect(answer.window).toEqual([1, 2, 3, 6, 7, 8, 9, 10, 11, 12]);
    expect(answer.rows).toHaveLength(15);
    expect(answer.standing).toEqual({ kind: "ranked", position: 9, rank: 9 });
  });

  test("G17: a viewer who gave nothing this period is not ranked and sees the top three", async () => {
    await aBoardOf(5);
    await aMember("U_JUNO", "Juno");
    const { asSignedIn } = await aSession(t, juno);

    const answer = await board("week", asSignedIn);

    expect(answer.window).toEqual([1, 2, 3]);
    expect(answer.standing).toEqual({ kind: "not-ranked" });
    expect(answer.onTheBoards).toBe(true);
  });

  test("G22 G18: a viewer who left is off the board and keeps their gain without places", async () => {
    await aMember("U_JUNO", "Juno");
    await aMember("U_ANN", "Ann");
    await gives("U_ANN", 2, { day: "2026-10-06" });
    await gives("U_JUNO", 1, { day: "2026-10-06" });
    await gives("U_ANN", 2, { day: "2026-10-12" });
    await gives("U_JUNO", 3, { day: "2026-10-13" });
    await leavesTheBoards("U_JUNO");
    const { asSignedIn } = await aSession(t, juno);

    const answer = await board("week", asSignedIn);

    expect(shown(answer)).toEqual(["1 Ann 2"]);
    expect(answer.standing).toEqual({ kind: "left" });
    expect(answer.improvement).toEqual({ gain: 2 });
    expect(answer.onTheBoards).toBe(false);
  });

  test("G18: the improvement line passes through, with places climbed", async () => {
    await aMember("U_JUNO", "Juno");
    await aMember("U_ANN", "Ann");
    await gives("U_ANN", 2, { day: "2026-10-06" });
    await gives("U_JUNO", 1, { day: "2026-10-06" });
    await gives("U_ANN", 1, { day: "2026-10-13" });
    await gives("U_JUNO", 4, { day: "2026-10-13" });
    const { asSignedIn } = await aSession(t, juno);

    expect((await board("week", asSignedIn)).improvement).toEqual({ gain: 3, places: 1 });
    expect((await board("all", asSignedIn)).improvement).toBeNull();
  });

  test.each([
    { viewerAt: 2, count: 15 },
    { viewerAt: 9, count: 15 },
    { viewerAt: 14, count: 15 },
    { viewerAt: 0, count: 6 },
  ])("the rows in the window equal App Home's board, with a gap where positions skip (viewer at $viewerAt of $count)", async ({ viewerAt, count }) => {
    await aBoardOf(count, { viewerAt });
    if (viewerAt === 0) await aMember("U_JUNO", "Juno");
    const { asSignedIn } = await aSession(t, juno);
    const appHome = await t.run((ctx) => everyoneBoardOf(ctx, "T1", juno.user, "week"));

    const answer = await board("week", asSignedIn);

    const windowed = answer.window.flatMap((position, index) => {
      const row = answer.rows[position - 1]!;
      const skips = index > 0 && position > answer.window[index - 1]! + 1;
      return [...(skips ? ["…"] : []), `${row.rank} ${row.name} ${row.kudos}`];
    });
    expect(windowed).toEqual(appHome.rows.map((row) => ("gap" in row ? "…" : `${row.rank} ${row.name} ${row.value}`)));
  });

  test("WS35: the viewer's row carries their own face, and the chat link opens the workspace in Slack", async () => {
    await aMember("U_JUNO", "Juno Whitlock");
    await gives("U_JUNO", 1);
    const { asSignedIn } = await aSession(t, juno);

    const answer = await board("week", asSignedIn);

    expect(answer.rows[0]).toMatchObject({ you: true, face: { kind: "slack", image: juno.image, initials: "JW" } });
    expect(answer.chatUrl).toBe("https://app.slack.com/client/T1");
  });
});

describe("WS36: an open board turns over with the period on a clock tick", () => {
  beforeEach(() => flagsOn("website", "everyone-board"));

  test("after the viewer's local Monday midnight and a clock tick, the week's board is the new week's", async () => {
    vi.setSystemTime(new Date("2026-10-18T21:00:00Z"));
    await aMember("U_JUNO", "Juno", { timeZone: "Europe/Berlin" });
    await gives("U_JUNO", 2, { day: "2026-10-18" });
    const { asSignedIn } = await aSession(t, juno, { endsIn: week });
    expect(shown(await board("week", asSignedIn))).toEqual(["1 Juno (you) 2"]);

    vi.setSystemTime(new Date("2026-10-18T22:05:00Z"));
    await t.mutation(internal.website.clock.tick, {});

    const answer = await board("week", asSignedIn);
    expect(shown(answer)).toEqual([]);
    expect(answer.standing).toEqual({ kind: "not-ranked" });
  });

  test("after the first of the month and a clock tick, the month's board is the new month's", async () => {
    vi.setSystemTime(new Date("2026-10-31T23:00:00Z"));
    await aMember("U_JUNO", "Juno");
    await gives("U_JUNO", 2, { day: "2026-10-31" });
    const { asSignedIn } = await aSession(t, juno, { endsIn: week });
    expect(shown(await board("month", asSignedIn))).toEqual(["1 Juno (you) 2"]);

    vi.setSystemTime(new Date("2026-11-01T00:05:00Z"));
    await t.mutation(internal.website.clock.tick, {});

    expect(shown(await board("month", asSignedIn))).toEqual([]);
  });
});

describe("WS52: the website's leaderboard waits for its unlock", () => {
  const allFlags = ["website", "everyone-board", "xp-levels", "unlocks"];

  type UnlocksDontApply = { condition: string; turnOn: () => Promise<unknown> };

  const unlocksDontApply: UnlocksDontApply[] = [
    { condition: "with xp-levels and unlocks off, before any launch", turnOn: () => flagsOn("website", "everyone-board") },
    { condition: "with xp-levels on and unlocks off, before any launch", turnOn: () => flagsOn("website", "everyone-board", "xp-levels") },
    { condition: "with unlocks on and xp-levels off, before the launch", turnOn: () => flagsOn("website", "everyone-board", "unlocks") },
    { condition: "with xp-levels and unlocks on, before the launch", turnOn: () => flagsOn(...allFlags) },
    { condition: "with xp-levels and unlocks switched off after the launch", turnOn: () => launchedThen("website", "everyone-board") },
    { condition: "with xp-levels on and unlocks switched off after the launch", turnOn: () => launchedThen("website", "everyone-board", "xp-levels") },
    { condition: "with unlocks on and xp-levels switched off after the launch", turnOn: () => launchedThen("website", "everyone-board", "unlocks") },
  ];

  async function launchedThen(...keys: string[]) {
    await flagsOn(...allFlags);
    await unlocksLaunched();
    await flagsOn(...keys);
  }

  test.each(unlocksDontApply)("$condition, a member at level 1 reads WS30's open board", async ({ turnOn }) => {
    await turnOn();
    await aMember("U_JUNO", "Juno");
    const { asSignedIn } = await aSession(t, juno);

    expect(await leaderboard("week", asSignedIn)).toMatchObject({ kind: "board" });
    expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", leaderboard: { kind: "open" } });
  });

  test("with xp-levels and unlocks on after the launch, the same member reads locked", async () => {
    await launchedThen(...allFlags);
    await aMember("U_JUNO", "Juno");
    const { asSignedIn } = await aSession(t, juno);

    expect(await leaderboard("week", asSignedIn)).toEqual({ kind: "locked", level: 3 });
    expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", leaderboard: { kind: "locked", level: 3 } });
  });

  test("before the launch, website reads never run it: no launch is recorded", async () => {
    await flagsOn(...allFlags);
    await aMember("U_JUNO", "Juno");
    const { asSignedIn } = await aSession(t, juno);

    await leaderboard("week", asSignedIn);
    await myProfile(asSignedIn);

    expect(await t.run((ctx) => ctx.db.query("unlockLaunches").collect())).toEqual([]);
  });

  describe("while unlocks apply", () => {
    beforeEach(async () => {
      await flagsOn(...allFlags);
      await unlocksLaunched();
    });

    test("a member at level 1 reads locked at the leaderboard's level, with no board facts", async () => {
      await aMember("U_JUNO", "Juno");
      await gives("U_JUNO", 2);
      const { asSignedIn } = await aSession(t, juno);

      expect(await leaderboard("week", asSignedIn)).toEqual({ kind: "locked", level: 3 });
      expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", leaderboard: { kind: "locked", level: 3 } });
    });

    test("a member at level 3 who hasn't opened it reads ready, with no board facts", async () => {
      await aMember("U_JUNO", "Juno");
      await gives("U_JUNO", 2);
      await reachesLevelThree("U_JUNO");
      const { asSignedIn } = await aSession(t, juno);

      expect(await leaderboard("week", asSignedIn)).toEqual({ kind: "ready" });
      expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", leaderboard: { kind: "ready" } });
    });

    test("a member who opened it reads the board", async () => {
      await aMember("U_JUNO", "Juno");
      await gives("U_JUNO", 2);
      await reachesLevelThree("U_JUNO");
      await opensTheLeaderboard("U_JUNO");
      const { asSignedIn } = await aSession(t, juno);

      expect(shown(await board("week", asSignedIn))).toEqual(["1 Juno (you) 2"]);
      expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", leaderboard: { kind: "open" } });
    });

    test("with everyone-board off, the unshipped leaderboard reads not-found and off", async () => {
      await aMember("U_JUNO", "Juno");
      const { asSignedIn } = await aSession(t, juno);
      await flagsOn("website", "xp-levels", "unlocks");

      expect(await leaderboard("week", asSignedIn)).toEqual({ kind: "not-found" });
      expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", leaderboard: { kind: "off" } });
    });

    test("#103: a member's row on another member's board never depends on their own unlocks", async () => {
      await aMember("U_JUNO", "Juno");
      await aMember("U_ANN", "Ann");
      await gives("U_ANN", 5);
      await gives("U_JUNO", 2);
      await reachesLevelThree("U_JUNO");
      await opensTheLeaderboard("U_JUNO");
      const { asSignedIn } = await aSession(t, juno);

      expect(shown(await board("week", asSignedIn))).toEqual(["1 Ann 5", "2 Juno (you) 2"]);
    });
  });

  test("P77: a member who was there at the launch keeps the leaderboard open", async () => {
    await flagsOn(...allFlags);
    await aMember("U_JUNO", "Juno");
    await unlocksLaunched();
    const { asSignedIn } = await aSession(t, juno);

    expect(await leaderboard("week", asSignedIn)).toMatchObject({ kind: "board" });
    expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", leaderboard: { kind: "open" } });
  });
});

type MemberOptions = { kind?: "member" | "not-a-member"; timeZone?: string };

function aMember(user: string, name?: string, { kind = "member", timeZone }: MemberOptions = {}): Promise<Id<"members">> {
  return t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind, asOf: 0, ...(name && { name }), ...(timeZone && { timeZone }) }));
}

async function aBoardOf(count: number, { viewerAt = 0 } = {}) {
  for (let position = 1; position <= count; position += 1) {
    const user = position === viewerAt ? juno.user : `U_${position}`;
    await aMember(user, position === viewerAt ? "Juno" : `Giver ${String(position).padStart(2, "0")}`);
    await gives(user, 100 - position);
  }
}

async function memberIdOf(user: string) {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return row!._id;
  });
}

async function gives(user: string, kudos: number, { day = "2026-10-13", to }: { day?: string; to?: string } = {}) {
  const giver = await memberIdOf(user);
  const recipient = to === undefined ? giver : await memberIdOf(to);
  given += 1;
  const message = { workspace: "T1", conversation: "C1", message: `${given}` };
  await t.run((ctx) => countGiven(ctx, { workspace: "T1", message, giver, awards: [{ giver, recipient, kudos }], day }));
}

function unlocksLaunched() {
  return unlocksShippedBeforeAnyoneJoined(t);
}

async function reachesLevelThree(user: string) {
  const member = await memberIdOf(user);
  const message = { workspace: "T1", conversation: "C1", message: `level-3-${user}` };
  const event = { type: "levelReached" as const, workspace: "T1", member, level: 3, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200, message, at: Date.now() };
  await t.mutation(internal.unlocks.unlocks.makeReady, { event });
}

async function opensTheLeaderboard(user: string) {
  const member = await memberIdOf(user);
  expect(await t.run((ctx) => openUnlock(ctx, member, "leaderboard"))).toBe("done");
}

async function leavesTheBoards(user: string) {
  const member = await memberIdOf(user);
  await t.run((ctx) => setLeaderboardVisibility(ctx, member, false));
}

async function flagsFromPostHog(...definitions: FlagDefinition[]) {
  await flagsLoadedFromPostHog(t, postHog, ...definitions);
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
}

function flagsOn(...keys: string[]) {
  return flagsFromPostHog(...keys.map(onForEveryone));
}

function leaderboard(period: Period, asSignedIn: Pick<Backend, "query"> = t): Promise<MyLeaderboard> {
  return asSignedIn.query(api.website.leaderboard.getLeaderboard, { period });
}

async function board(period: Period, asSignedIn: Pick<Backend, "query">): Promise<Leaderboard> {
  const answer = await leaderboard(period, asSignedIn);
  if (answer.kind !== "board") throw new Error(`expected a board, got ${answer.kind}`);
  return answer;
}

function myProfile(asSignedIn: Pick<Backend, "query">) {
  return asSignedIn.query(api.website.profile.getMyProfile, {});
}

function shown({ rows }: Leaderboard) {
  return rows.map((row) => `${row.rank} ${row.name}${row.you ? " (you)" : ""} ${row.kudos}`);
}
