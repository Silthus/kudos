import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { giveKudos } from "../convex/engine";
import { resolvePeriod } from "../convex/lib/periods";
import { memberTotalsInRange } from "../convex/lib/stats";
import { NOW, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

// NOW is Wed 2026-09-23 in Berlin: "month" is the m:2026-09 bucket, "week" w:2026-W39.
let t: ReturnType<typeof setupConvex>;
let team: Team;

type Visibility = Doc<"workspaces">["receivedVisibility"];

/** A workspace whose rollups are backfilled, so the Team benchmark reads `memberStats`. */
async function setup(receivedVisibility: Visibility = "everyone") {
  t = setupConvex();
  team = await seedTeam(t, { receivedVisibility, rollupsBackfilledAt: NOW.getTime() });
}
afterEach(() => vi.useRealTimers());

const person = (name: string, extra: Partial<Doc<"members">> = {}) =>
  t.run((ctx) =>
    ctx.db.insert("members", {
      workspaceId: team.workspaceId,
      slackUserId: `U${name.toUpperCase()}`,
      name,
      isAdmin: false,
      isBot: false,
      deactivated: false,
      totalGiven: 0,
      totalReceived: 0,
      totalMaxedDays: 0,
      ...extra,
    }),
  );

type Values = { given?: number; received?: number; activeDays?: number; maxedDays?: number };

/** One member's rollup row for a bucket (the engine keeps these exact; see rollup tests). */
const stats = (memberId: Id<"members">, values: Values, bucket = "m:2026-09") =>
  t.run(async (ctx) => {
    const { given = 0, received = 0, activeDays = given > 0 ? 1 : 0, maxedDays = 0 } = values;
    await ctx.db.insert("memberStats", { workspaceId: team.workspaceId, memberId, bucket, given, received, activeDays, maxedDays });
  });

type Result = Awaited<ReturnType<typeof getTeam>>;
const row = (r: Result, metric: string) => r.rows.find((x) => x.metric === metric)!;

async function getTeam(period: "week" | "month" | "quarter" | "year" = "month", viewerId = team.ana) {
  const viewer = await signInAs(t, viewerId);
  return await viewer.query(api.compare.team.get, { period, today: TODAY });
}

/** Ana plus five teammates who gave this month, and people who must not count. */
async function fiveGivers() {
  await stats(team.ana, { given: 10, received: 3, activeDays: 4, maxedDays: 1 });
  await stats(team.ben, { given: 2, received: 5, activeDays: 1 });
  await stats(team.cleo, { given: 4, received: 1, activeDays: 2 });
  await stats(await person("Dan"), { given: 6, activeDays: 3, maxedDays: 1 });
  await stats(await person("Eve"), { given: 8, received: 2, activeDays: 3 });
  await stats(await person("Finn"), { given: 12, received: 9, activeDays: 5, maxedDays: 2 });
  // Received only: a receiver, not a giver.
  await stats(await person("Gia"), { received: 4 });
  // Neither the bot nor someone who has left is on the team.
  await stats(team.bot, { given: 40, received: 40, activeDays: 9 });
  await stats(await person("Hal", { deactivated: true }), { given: 30, received: 30, activeDays: 8 });
}

describe("compare.team.get: the participant distribution", () => {
  test("given: you against the teammates who gave this period, never the bot or people who left", async () => {
    await setup();
    await fiveGivers();
    const r = await getTeam();
    expect(r).toMatchObject({ mode: "team", period: "month", label: "This month", participants: 5, truncated: false });
    expect(r.range).toEqual({ start: "2026-09-01", end: "2026-09-23", days: 23 });
    expect(row(r, "given")).toMatchObject({
      family: "giving",
      you: { value: 10, locked: null },
      benchmark: { value: 6, locked: null },
      team: { n: 5, median: 6, p25: 4, p75: 8, max: 12 },
      // Ben 2, Cleo 4, Dan 6 and Eve 8 are below 10; Finn is not.
      percentile: 0.8,
    });
  });

  test("each giving metric is spread over the same givers, maxed days including their zeros", async () => {
    await setup();
    await fiveGivers();
    const r = await getTeam();
    expect(row(r, "activeDays")).toMatchObject({ you: { value: 4 }, team: { n: 5, median: 3, max: 5 }, percentile: 0.8 });
    // Ben, Cleo, Eve 0 · Dan 1 · Finn 2: Ana's 1 is above three of them.
    expect(row(r, "maxedDays")).toMatchObject({ you: { value: 1 }, team: { n: 5, median: 0, max: 2 }, percentile: 0.6 });
  });

  test("received is spread over the teammates who received, under `everyone`", async () => {
    await setup("everyone");
    await fiveGivers();
    const r = await getTeam();
    // Ben 5, Cleo 1, Eve 2, Finn 9, Gia 4 received; Dan received nothing.
    expect(row(r, "received")).toMatchObject({
      family: "receiving",
      you: { value: 3, locked: null },
      benchmark: { value: 4, locked: null },
      team: { n: 5, median: 4, p25: 2, p75: 5, max: 9 },
      percentile: 0.4,
    });
  });

  test("only rollup-backed metrics: no streaks, reach, channels or discoveries", async () => {
    await setup();
    await fiveGivers();
    expect((await getTeam()).rows.map((x) => x.metric)).toEqual(["given", "received", "activeDays", "maxedDays"]);
  });

  test("a viewer who gave nothing this period is on the scale but has no percentile", async () => {
    await setup();
    await fiveGivers();
    await t.run(async (ctx) => {
      const anas = (await ctx.db.query("memberStats").collect()).find((x) => x.memberId === team.ana)!;
      await ctx.db.patch(anas._id, { given: 0, activeDays: 0, maxedDays: 0 });
    });
    expect(row(await getTeam(), "given")).toMatchObject({ you: { value: 0 }, team: { n: 5, median: 6 }, percentile: null });
  });

  test("ties don't count as below you", async () => {
    await setup();
    await fiveGivers();
    await t.run(async (ctx) => {
      const anas = (await ctx.db.query("memberStats").collect()).find((x) => x.memberId === team.ana)!;
      await ctx.db.patch(anas._id, { given: 8 });
    });
    // Ben 2, Cleo 4 and Dan 6 are below 8; Eve's 8 ties.
    expect(row(await getTeam(), "given").percentile).toBe(0.6);
  });

  test("the period picks the bucket", async () => {
    await setup();
    await fiveGivers();
    await stats(team.ana, { given: 6 }, "m:2026-08");
    const viewer = await signInAs(t, team.ana);
    const august = await viewer.query(api.compare.team.get, { period: "month", today: "2026-08-20" });
    expect(august.range).toEqual({ start: "2026-08-01", end: "2026-08-20", days: 20 });
    // Alone in August: nobody else to compare with.
    expect(row(august, "given")).toMatchObject({ you: { value: 6 }, benchmark: { value: null }, team: null, percentile: null });
  });
});

describe("compare.team.get: small teams", () => {
  async function givers(values: number[]) {
    await stats(team.ana, { given: 5 });
    for (const [i, given] of values.entries()) await stats(await person(`Mate${i}`), { given });
  }

  test("2–4 teammates: the median only, no quartiles, maximum or percentile", async () => {
    await setup();
    await givers([2, 4, 9]);
    const r = await getTeam();
    expect(r.participants).toBe(3);
    expect(row(r, "given")).toMatchObject({
      you: { value: 5 },
      benchmark: { value: 4 },
      team: { n: 3, median: 4, p25: null, p75: null, max: null },
      percentile: null,
    });
  });

  test("one teammate: no benchmark at all, so their number can't be read off it", async () => {
    await setup();
    await givers([7]);
    const r = await getTeam();
    expect(r.participants).toBe(1);
    expect(row(r, "given")).toMatchObject({ you: { value: 5 }, benchmark: { value: null }, team: null, percentile: null });
    expect(JSON.stringify(r.rows)).not.toContain("7");
  });

  test("five teammates: the whole distribution", async () => {
    await setup();
    await givers([1, 2, 3, 4, 5]);
    expect(row(await getTeam(), "given")).toMatchObject({ team: { n: 5, p25: 2, median: 3, p75: 4, max: 5 }, percentile: 0.8 });
  });
});

describe("compare.team.get: privacy per receivedVisibility", () => {
  test.each([
    ["self", "private"],
    ["hidden", "hidden"],
  ] as const)("under `%s` the received row is locked and carries no number, the viewer's own included", async (visibility, reason) => {
    await setup(visibility);
    await fiveGivers();
    const r = await getTeam();
    expect(row(r, "received")).toEqual({
      metric: "received",
      family: "receiving",
      you: { value: null, locked: reason },
      benchmark: { value: null, locked: reason },
      delta: null,
      team: null,
      percentile: null,
    });
    // Giving is public in Slack and on the leaderboard, so it stays.
    expect(row(r, "given")).toMatchObject({ you: { value: 10, locked: null }, team: { n: 5, median: 6 } });
  });

  test("never names anybody", async () => {
    await setup();
    await fiveGivers();
    const text = JSON.stringify(await getTeam());
    for (const name of ["Ben", "Cleo", "Dan", "Eve", "Finn", "Gia"]) expect(text).not.toContain(name);
    expect(text).not.toContain(team.ben);
  });

  test("signed out", async () => {
    await setup();
    await expect(t.query(api.compare.team.get, { period: "month", today: TODAY })).rejects.toThrow("Sign in with Slack to continue.");
  });

  test("only the viewer's own workspace counts", async () => {
    await setup();
    await fiveGivers();
    const other = await seedTeam(t, { rollupsBackfilledAt: NOW.getTime() }, "T2");
    await t.run(async (ctx) => {
      for (const id of [other.ana, other.ben, other.cleo]) {
        await ctx.db.insert("memberStats", { workspaceId: other.workspaceId, memberId: id, bucket: "m:2026-09", given: 50, received: 50, activeDays: 9, maxedDays: 9 });
      }
    });
    expect(row(await getTeam(), "given")).toMatchObject({ team: { n: 5, max: 12 } });
  });
});

describe("compare.team.get: where the numbers come from", () => {
  test("gives through the engine land in the Team benchmark (a new install reads its rollups)", async () => {
    await setup();
    const give = (giverSlackId: string, recipientSlackIds: string[], amountEach: number, ts: string) =>
      t.run(async (ctx) => {
        await giveKudos(ctx, {
          workspace: (await ctx.db.get(team.workspaceId))!,
          giverSlackId,
          recipientSlackIds,
          amountEach,
          channelId: "CGENERAL",
          channelName: "general",
          text: "thanks for the help with the release",
          source: "message",
          messageTs: ts,
          now: Date.now(),
        });
      });
    await give("UANA", ["UBEN"], 3, "1.000");
    await give("UBEN", ["UCLEO"], 1, "2.000");
    await give("UCLEO", ["UANA", "UBEN"], 2, "3.000");
    const r = await getTeam();
    expect(r.participants).toBe(2);
    expect(row(r, "given")).toMatchObject({ you: { value: 3 }, team: { n: 2, median: 2.5 } });
    // Ben received 3 + 2, Cleo 1; Ana received 2.
    expect(row(r, "received")).toMatchObject({ you: { value: 2 }, team: { n: 2, median: 3 } });
  });

  test("before the backfill it counts memberDays, and says when the read was capped", async () => {
    t = setupConvex();
    team = await seedTeam(t, { receivedVisibility: "everyone" });
    await t.run(async (ctx) => {
      const day = (memberId: Id<"members">, dayKey: string, given: number, received = 0, maxed = false) =>
        ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId, dayKey, given, received, maxed });
      await day(team.ana, "2026-09-02", 3, 1);
      await day(team.ana, "2026-09-21", 2, 0, true);
      await day(team.ben, "2026-09-03", 4, 2);
      await day(team.cleo, "2026-09-22", 1, 5);
      await day(team.cleo, "2026-08-31", 9); // last month
    });
    const r = await getTeam();
    expect(r.truncated).toBe(false);
    expect(row(r, "given")).toMatchObject({ you: { value: 5 }, team: { n: 2, median: 2.5 } });
    expect(row(r, "maxedDays")).toMatchObject({ you: { value: 1 } });
    expect(row(r, "activeDays")).toMatchObject({ you: { value: 2 } });

    const capped = await t.run(async (ctx) => {
      const { totals, truncated } = await memberTotalsInRange(ctx, (await ctx.db.get(team.workspaceId))!, resolvePeriod("month", TODAY), 3);
      return { truncated, given: [...totals.values()].reduce((s, x) => s + x.given, 0) };
    });
    // Only the newest three days are kept: Cleo's 22nd (1), Ana's 21st (2) and Ben's 3rd (4).
    expect(capped).toEqual({ truncated: true, given: 1 + 2 + 4 });
  });
});

describe("compare.team.get: a 500-member workspace", () => {
  const MEMBERS = 500;

  test("reads each member's rollup row and the member list, within Convex's limits", { timeout: 120_000 }, async () => {
    // Everything the query may read: 500 + 4 members, 500 + 1 rollup rows, the viewer's session.
    t = setupConvex({ transactionLimits: { documentsRead: 2 * MEMBERS + 30 } });
    team = await seedTeam(t, { receivedVisibility: "everyone", rollupsBackfilledAt: NOW.getTime() });
    await t.run(async (ctx) => {
      await ctx.db.insert("memberStats", { workspaceId: team.workspaceId, memberId: team.ana, bucket: "y:2026", given: 250, received: 10, activeDays: 60, maxedDays: 20 });
      for (let i = 0; i < MEMBERS; i++) {
        const memberId = await ctx.db.insert("members", {
          workspaceId: team.workspaceId,
          slackUserId: `USCALE${i}`,
          name: `Scale ${i}`,
          isAdmin: false,
          isBot: false,
          deactivated: false,
          totalGiven: 0,
          totalReceived: 0,
          totalMaxedDays: 0,
        });
        await ctx.db.insert("memberStats", { workspaceId: team.workspaceId, memberId, bucket: "y:2026", given: 1 + i, received: i % 7, activeDays: 1 + (i % 90), maxedDays: i % 30 });
      }
    });
    const r = await getTeam("year");
    expect(r.participants).toBe(MEMBERS);
    // 1…500 given: 249 of them below Ana's 250.
    expect(row(r, "given")).toMatchObject({ you: { value: 250 }, team: { n: MEMBERS, median: 250.5, max: 500 }, percentile: 249 / MEMBERS });
  });
});
