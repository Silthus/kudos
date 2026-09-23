import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Doc } from "../_generated/dataModel";
import { allowanceCheck, giveKudos, revokeKudosRow, type GiveInput } from "../engine";
import { member, seedTeam, setupConvex, type Team } from "../../tests/helpers";
import { dayKeyFor } from "./time";

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { notifyGiver: false, notifyReceiver: false });
});
afterEach(() => vi.useRealTimers());

type GiveOptions = Partial<Omit<GiveInput, "workspace">> & { giverSlackId: string; recipientSlackIds: string[] };

async function give(opts: GiveOptions) {
  return await t.run(async (ctx) => {
    const workspace = (await ctx.db.get(team.workspaceId))!;
    return await giveKudos(ctx, {
      workspace,
      amountEach: 1,
      channelId: "CGENERAL",
      channelName: "general",
      text: "thanks",
      source: "message",
      now: Date.now(),
      ...opts,
    });
  });
}

async function rollups() {
  return await t.run(async (ctx) => ({
    workspace: await ctx.db.query("workspaceStats").collect(),
    member: await ctx.db.query("memberStats").collect(),
    pair: await ctx.db.query("pairStats").collect(),
    channel: await ctx.db.query("channelStats").collect(),
  }));
}

const byBucket = <T extends { bucket: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.bucket, r]));
const heatWith = (size: number, cells: Record<number, number>) =>
  Array.from({ length: size }, (_, i) => cells[i] ?? 0);
const noFinds = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };

describe("giving kudos keeps the rollups", () => {
  test("one message to two teammates lands in every bucket of its day", async () => {
    // NOW is Wednesday 2026-09-23, 12:00 in Berlin.
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN", "UCLEO"], amountEach: 2 });
    const r = await rollups();

    const ws = byBucket(r.workspace);
    expect(Object.keys(ws).sort()).toEqual(["all", "d:2026-09-23", "m:2026-09", "q:2026-Q3", "w:2026-W39", "y:2026"]);
    const counts = {
      given: 4,
      kudosRows: 2,
      messages: 1,
      givers: 1,
      receivers: 2,
      giverDays: 1,
      cappedGiven: 4,
      maxedDays: 0,
      fromReactions: 0,
      fromMessages: 4,
      found: noFinds,
    };
    expect(ws["d:2026-09-23"]).toMatchObject({ ...counts, heat: heatWith(24, { 12: 4 }) });
    for (const bucket of ["w:2026-W39", "m:2026-09", "q:2026-Q3", "y:2026", "all"]) {
      expect(ws[bucket]).toMatchObject({ ...counts, heat: heatWith(168, { [2 * 24 + 12]: 4 }) });
    }

    const memberRows = (id: string) => byBucket(r.member.filter((m) => m.memberId === id));
    for (const bucket of ["w:2026-W39", "m:2026-09", "q:2026-Q3", "y:2026"]) {
      expect(memberRows(team.ana)[bucket]).toMatchObject({ given: 4, received: 0, activeDays: 1, maxedDays: 0 });
      expect(memberRows(team.ben)[bucket]).toMatchObject({ given: 0, received: 2, activeDays: 0, maxedDays: 0 });
      expect(memberRows(team.cleo)[bucket]).toMatchObject({ given: 0, received: 2, activeDays: 0, maxedDays: 0 });
    }
    expect(r.member).toHaveLength(12);

    expect(r.pair).toHaveLength(10);
    for (const p of r.pair) expect(p).toMatchObject({ giverId: team.ana, amount: 2 });
    expect(r.pair.filter((p) => p.receiverId === team.ben).map((p) => p.bucket).sort()).toEqual(
      ["all", "m:2026-09", "q:2026-Q3", "w:2026-W39", "y:2026"],
    );

    expect(r.channel.map((c) => [c.bucket, c.channel, c.amount]).sort()).toEqual([
      ["all", "general", 4],
      ["m:2026-09", "general", 4],
      ["q:2026-Q3", "general", 4],
      ["w:2026-W39", "general", 4],
      ["y:2026", "general", 4],
    ]);
  });

  test("each kudos row remembers the local hour it was given at", async () => {
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"] });
    const rows = await t.run((ctx) => ctx.db.query("kudos").collect());
    expect(rows[0].hour).toBe(12);
  });

  test("the giver's streak and weekday profile move with their giving", async () => {
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"], amountEach: 2 });
    expect(await member(t, team.ana)).toMatchObject({
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDay: "2026-09-23",
      givenByWeekday: [0, 0, 2, 0, 0, 0, 0],
    });
    vi.setSystemTime(new Date("2026-09-24T08:00:00Z")); // Thursday
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"] });
    expect(await member(t, team.ana)).toMatchObject({
      currentStreak: 2,
      longestStreak: 2,
      lastActiveDay: "2026-09-24",
      givenByWeekday: [0, 0, 2, 1, 0, 0, 0],
    });
    vi.setSystemTime(new Date("2026-09-28T08:00:00Z")); // next Monday: the streak restarts
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"] });
    expect(await member(t, team.ana)).toMatchObject({
      currentStreak: 1,
      longestStreak: 2,
      lastActiveDay: "2026-09-28",
      givenByWeekday: [1, 0, 2, 1, 0, 0, 0],
    });
    const ben: Doc<"members"> = await member(t, team.ben);
    expect(ben.givenByWeekday).toBeUndefined();
  });

  test("a member who gave before rollups existed gets their profile from their full history on the next give", async () => {
    await t.run(async (ctx) => {
      for (const [dayKey, given] of [["2026-09-15", 2], ["2026-09-21", 1], ["2026-09-22", 3]] as const) {
        await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId: team.ana, dayKey, given, received: 0, maxed: false });
      }
      await ctx.db.patch(team.ana, { totalGiven: 6 });
    });
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"] }); // Wednesday 2026-09-23
    expect(await member(t, team.ana)).toMatchObject({
      totalGiven: 7,
      currentStreak: 3,
      longestStreak: 3,
      lastActiveDay: "2026-09-23",
      givenByWeekday: [1, 5, 1, 0, 0, 0, 0],
    });
  });

  test("a message to three teammates touches 42 rollup rows: 6 workspace, 16 member, 15 pair, 5 channel", async () => {
    await t.run((ctx) =>
      ctx.db.insert("members", {
        workspaceId: team.workspaceId, slackUserId: "UDAN", name: "Dan", isAdmin: false, isBot: false,
        deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0,
      }),
    );
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN", "UCLEO", "UDAN"] });
    const r = await rollups();
    expect([r.workspace.length, r.member.length, r.pair.length, r.channel.length]).toEqual([6, 16, 15, 5]);
  });

  test("allowance use caps each giver-day at the daily limit in force when it was given", async () => {
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"], amountEach: 5 });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 3 }));
    await give({ giverSlackId: "UBEN", recipientSlackIds: ["UANA"], amountEach: 3 });
    const day = (await rollups()).workspace.find((w) => w.bucket === "d:2026-09-23");
    expect(day).toMatchObject({ given: 8, giverDays: 2, cappedGiven: 8, maxedDays: 2 });
  });
});

async function revokeAll() {
  await t.run(async (ctx) => {
    const workspace = (await ctx.db.get(team.workspaceId))!;
    for (const row of await ctx.db.query("kudos").collect()) await revokeKudosRow(ctx, workspace, row);
  });
}

describe("revoking kudos", () => {
  test("give followed by revoke returns every rollup to zero", async () => {
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN", "UCLEO"], amountEach: 2 });
    await give({ giverSlackId: "UBEN", recipientSlackIds: ["UANA"], source: "reaction", channelPrivate: true });
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UCLEO"] }); // maxes Ana's day
    await revokeAll();
    expect(await rollups()).toEqual({ workspace: [], member: [], pair: [], channel: [] });
    for (const id of [team.ana, team.ben]) {
      const m = await member(t, id);
      expect(m).toMatchObject({ totalGiven: 0, totalReceived: 0, totalMaxedDays: 0, currentStreak: 0, longestStreak: 0 });
      expect(m.givenByWeekday).toEqual([0, 0, 0, 0, 0, 0, 0]);
      expect(m.lastActiveDay).toBeUndefined();
    }
  });

  test("allowance use returns to zero even when the daily limit changed between give and revoke", async () => {
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"], amountEach: 5 });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 3 }));
    await revokeAll();
    expect((await rollups()).workspace).toEqual([]);

    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 5 }));
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"], amountEach: 5 });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 10 }));
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"], amountEach: 4 });
    expect((await rollups()).workspace.find((w) => w.bucket === "all")).toMatchObject({ given: 9, cappedGiven: 9 });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 5 }));
    await revokeAll();
    expect((await rollups()).workspace).toEqual([]);
  });

  test("a partial revoke keeps the rest of the day capped at the limit it was given under", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 10 }));
    for (const messageTs of ["1.0", "2.0", "3.0"]) {
      await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"], amountEach: 3, messageTs });
    }
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 5 }));
    await t.run(async (ctx) => {
      const [first] = await ctx.db.query("kudos").collect();
      await revokeKudosRow(ctx, (await ctx.db.get(team.workspaceId))!, first);
    });
    const day = (await rollups()).workspace.find((w) => w.bucket === "d:2026-09-23");
    expect(day).toMatchObject({ given: 6, cappedGiven: 6 });
  });

  test("a message stops counting only when its last row is revoked", async () => {
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN", "UCLEO"] });
    await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      const [first] = await ctx.db.query("kudos").collect();
      await revokeKudosRow(ctx, workspace, first);
    });
    const day = (await rollups()).workspace.find((w) => w.bucket === "d:2026-09-23");
    expect(day).toMatchObject({ messages: 1, kudosRows: 1, given: 1, givers: 1, receivers: 1 });
  });
});

describe("discoveries", () => {
  test("a first discovery counts once in every bucket of its day, by rarity, and survives revokes", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyGiver: true }));
    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"] });
    const [found] = await t.run((ctx) => ctx.db.query("discoveries").collect());
    const expected = { ...noFinds, [found.rarity]: 1 };
    const r = await rollups();
    expect(r.workspace).toHaveLength(6);
    for (const w of r.workspace) expect(w.found).toEqual(expected);

    await revokeAll();
    const after = await rollups();
    expect(after.workspace.map((w) => [w.bucket, w.given, w.found])).toEqual(
      r.workspace.map((w) => [w.bucket, 0, expected]),
    );
  });

  test("bot messages outside a give (the allowance check) count their discoveries too", async () => {
    await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      const ana = (await ctx.db.get(team.ana))!;
      await allowanceCheck(ctx, workspace, ana, Date.now());
    });
    const r = await rollups();
    expect(r.workspace).toHaveLength(6);
    for (const w of r.workspace) expect(Object.values(w.found).reduce((s, n) => s + n, 0)).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Property: after any sequence of gives, revokes, bot messages and timezone changes, every
// rollup equals an independent recompute from the source tables (kudos, memberDays, discoveries).

/** Deterministic PRNG so a failing seed can be replayed. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// Days around week, month, quarter and year boundaries (2026 has an ISO week 53) and DST switches.
const DAYS = [
  "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-30", "2026-10-01", "2026-10-25", "2026-11-01",
  "2026-12-28", "2026-12-31", "2027-01-01", "2027-01-04", "2027-03-28",
];
const ZONES = ["Europe/Berlin", "America/Los_Angeles", "Asia/Tokyo", "UTC"];
const PEOPLE = ["UANA", "UBEN", "UCLEO", "UDAN", "UEVE"];
const LIMITS = [3, 5, 8];

// The oracle derives bucket keys on its own (not via lib/buckets): ISO week 1 is the week
// holding January 4th, found with the platform Date API.
const DAY_MS = 86_400_000;
const utc = (dayKey: string) => new Date(`${dayKey}T00:00:00Z`);
const mondayIndex = (date: Date) => (date.getUTCDay() + 6) % 7;
function isoWeekKey(dayKey: string) {
  const date = utc(dayKey);
  const monday = date.getTime() - mondayIndex(date) * DAY_MS;
  const week1 = (year: number) => {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    return jan4.getTime() - mondayIndex(jan4) * DAY_MS;
  };
  let year = date.getUTCFullYear() + 1;
  while (week1(year) > monday) year -= 1;
  return `w:${year}-W${String((monday - week1(year)) / (7 * DAY_MS) + 1).padStart(2, "0")}`;
}
function oracleBuckets(dayKey: string) {
  const [y, m] = dayKey.split("-");
  const quarter = `q:${y}-Q${Math.ceil(Number(m) / 3)}`;
  const periods = [isoWeekKey(dayKey), `m:${y}-${m}`, quarter, `y:${y}`];
  return { day: `d:${dayKey}`, member: periods, pair: [...periods, "all"], workspace: [`d:${dayKey}`, ...periods, "all"] };
}
const oracleHeat = (bucket: string, dayKey: string, hour: number) =>
  bucket.startsWith("d:") ? hour : mondayIndex(utc(dayKey)) * 24 + hour;
const oracleChannel = (k: Doc<"kudos">) => (k.channelPrivate ? "Private channels" : (k.channelName ?? k.channelId));
const dayGap = (a: string, b: string) => (utc(b).getTime() - utc(a).getTime()) / DAY_MS;
const CHANNELS = [
  { channelId: "CGENERAL", channelName: "general" },
  { channelId: "CRANDOM", channelName: "random" },
  { channelId: "CSECRET", channelName: "secret-project", channelPrivate: true },
  { channelId: "CNONAME" },
];

type Sources = {
  kudos: Doc<"kudos">[];
  memberDays: Doc<"memberDays">[];
  discoveries: Doc<"discoveries">[];
  members: Doc<"members">[];
  workspaceStats: Doc<"workspaceStats">[];
  memberStats: Doc<"memberStats">[];
  pairStats: Doc<"pairStats">[];
  channelStats: Doc<"channelStats">[];
};

async function snapshot(): Promise<Sources> {
  return await t.run(async (ctx) => ({
    kudos: await ctx.db.query("kudos").collect(),
    memberDays: await ctx.db.query("memberDays").collect(),
    discoveries: await ctx.db.query("discoveries").collect(),
    members: await ctx.db.query("members").collect(),
    workspaceStats: await ctx.db.query("workspaceStats").collect(),
    memberStats: await ctx.db.query("memberStats").collect(),
    pairStats: await ctx.db.query("pairStats").collect(),
    channelStats: await ctx.db.query("channelStats").collect(),
  }));
}

const add = <K>(m: Map<K, number>, k: K, n: number) => m.set(k, (m.get(k) ?? 0) + n);
const sorted = (rows: string[]) => [...rows].sort();

/** Recompute every rollup from the sources and compare. `zoneAt` maps a give's time to its timezone. */
function expectRollupsMatchSources(s: Sources, zoneAt: Map<number, string>, lowestLimit: number, step: string) {
  // The sources agree with each other.
  const dayGiven = new Map<string, number>();
  const dayReceived = new Map<string, number>();
  for (const k of s.kudos) {
    add(dayGiven, `${k.giverId}|${k.dayKey}`, k.amount);
    add(dayReceived, `${k.receiverId}|${k.dayKey}`, k.amount);
  }
  for (const d of s.memberDays) {
    expect(d.given, step).toBe(dayGiven.get(`${d.memberId}|${d.dayKey}`) ?? 0);
    expect(d.received, step).toBe(dayReceived.get(`${d.memberId}|${d.dayKey}`) ?? 0);
    // The stored allowance use never exceeds what was given, nor falls below the lowest limit's cap.
    expect(d.capped, step).toBeLessThanOrEqual(d.given);
    expect(d.capped, step).toBeGreaterThanOrEqual(Math.min(d.given, lowestLimit));
  }

  // workspaceStats
  type Ws = Omit<Doc<"workspaceStats">, "_id" | "_creationTime" | "workspaceId">;
  const ws = new Map<string, Ws>();
  const wsRow = (bucket: string) => {
    let row = ws.get(bucket);
    if (!row) {
      row = {
        bucket, given: 0, kudosRows: 0, messages: 0, givers: 0, receivers: 0, giverDays: 0, cappedGiven: 0, maxedDays: 0,
        fromReactions: 0, fromMessages: 0, heat: new Array(bucket.startsWith("d:") ? 24 : 168).fill(0), found: { ...noFinds },
      };
      ws.set(bucket, row);
    }
    return row;
  };
  const batches = new Map<string, Set<string>>();
  for (const k of s.kudos) {
    expect(k.hour, step).toBeTypeOf("number");
    for (const b of oracleBuckets(k.dayKey).workspace) {
      const row = wsRow(b);
      row.given += k.amount;
      row.kudosRows += 1;
      if (k.source === "reaction") row.fromReactions += k.amount;
      else row.fromMessages += k.amount;
      row.heat[oracleHeat(b, k.dayKey, k.hour!)] += k.amount;
      batches.set(b, (batches.get(b) ?? new Set()).add(k.batchId));
    }
  }
  for (const [b, ids] of batches) wsRow(b).messages = ids.size;
  const memberGiven = new Map<string, number>();
  const memberReceived = new Map<string, number>();
  for (const d of s.memberDays) {
    for (const b of oracleBuckets(d.dayKey).workspace) {
      const row = wsRow(b);
      if (d.given > 0) row.giverDays += 1;
      if (d.maxed) row.maxedDays += 1;
      row.cappedGiven += d.capped!;
      add(memberGiven, `${b}|${d.memberId}`, d.given);
      add(memberReceived, `${b}|${d.memberId}`, d.received);
    }
  }
  for (const [key, n] of memberGiven) if (n > 0) wsRow(key.split("|")[0]).givers += 1;
  for (const [key, n] of memberReceived) if (n > 0) wsRow(key.split("|")[0]).receivers += 1;
  for (const d of s.discoveries) {
    for (const b of oracleBuckets(dayKeyFor(d.firstSeenAt, zoneAt.get(d.firstSeenAt)!)).workspace) wsRow(b).found[d.rarity] += 1;
  }
  const isZero = (w: Ws) =>
    w.given + w.kudosRows + w.messages + w.givers + w.receivers + w.giverDays + w.cappedGiven + w.maxedDays +
      w.fromReactions + w.fromMessages === 0 &&
    w.heat.every((n) => n === 0) &&
    Object.values(w.found).every((n) => n === 0);
  const wsLine = (w: Ws) => JSON.stringify({
    bucket: w.bucket, given: w.given, kudosRows: w.kudosRows, messages: w.messages, givers: w.givers, receivers: w.receivers,
    giverDays: w.giverDays, cappedGiven: w.cappedGiven, maxedDays: w.maxedDays, fromReactions: w.fromReactions,
    fromMessages: w.fromMessages, heatSize: w.heat.length,
    heat: w.heat.flatMap((n, i) => (n ? [`${i}:${n}`] : [])),
    found: Object.keys(noFinds).map((r) => w.found[r as keyof typeof noFinds]),
  });
  expect(sorted(s.workspaceStats.map(wsLine)), step).toEqual(sorted([...ws.values()].filter((w) => !isZero(w)).map(wsLine)));

  // memberStats (w/m/q/y)
  const ms = new Map<string, { given: number; received: number; maxedDays: number; activeDays: number }>();
  for (const d of s.memberDays) {
    for (const b of oracleBuckets(d.dayKey).member) {
      const key = `${d.memberId}|${b}`;
      const row = ms.get(key) ?? { given: 0, received: 0, maxedDays: 0, activeDays: 0 };
      row.given += d.given;
      row.received += d.received;
      row.maxedDays += d.maxed ? 1 : 0;
      row.activeDays += d.given > 0 ? 1 : 0;
      ms.set(key, row);
    }
  }
  expect(sorted(s.memberStats.map((m) => `${m.memberId}|${m.bucket} ${m.given} ${m.received} ${m.maxedDays} ${m.activeDays}`)), step).toEqual(
    sorted([...ms].filter(([, m]) => m.given + m.received > 0).map(([k, m]) => `${k} ${m.given} ${m.received} ${m.maxedDays} ${m.activeDays}`)),
  );

  // pairStats and channelStats (w/m/q/y/all)
  const pairs = new Map<string, number>();
  const channels = new Map<string, number>();
  for (const k of s.kudos) {
    for (const b of oracleBuckets(k.dayKey).pair) {
      add(pairs, `${k.giverId}>${k.receiverId}|${b}`, k.amount);
      add(channels, `${oracleChannel(k)}|${b}`, k.amount);
    }
  }
  expect(sorted(s.pairStats.map((p) => `${p.giverId}>${p.receiverId}|${p.bucket} ${p.amount}`)), step).toEqual(
    sorted([...pairs].map(([k, n]) => `${k} ${n}`)),
  );
  expect(sorted(s.channelStats.map((c) => `${c.channel}|${c.bucket} ${c.amount}`)), step).toEqual(
    sorted([...channels].map(([k, n]) => `${k} ${n}`)),
  );
  expect(s.channelStats.some((c) => c.channel === "secret-project"), step).toBe(false);

  // Member totals and giving profiles.
  for (const m of s.members) {
    const days = s.memberDays.filter((d) => d.memberId === m._id).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    expect(m.totalGiven, step).toBe(days.reduce((n, d) => n + d.given, 0));
    expect(m.totalReceived, step).toBe(days.reduce((n, d) => n + d.received, 0));
    const active = days.filter((d) => d.given > 0);
    if (m.givenByWeekday === undefined) {
      expect(active, step).toEqual([]);
      continue;
    }
    const weekday = new Array(7).fill(0);
    for (const d of active) weekday[mondayIndex(utc(d.dayKey))] += d.given;
    let run = 0;
    let longest = 0;
    active.forEach((d, i) => {
      run = i > 0 && dayGap(active[i - 1].dayKey, d.dayKey) === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    });
    expect(
      { givenByWeekday: m.givenByWeekday, currentStreak: m.currentStreak, longestStreak: m.longestStreak, lastActiveDay: m.lastActiveDay },
      `${step}: profile of ${m.name}`,
    ).toEqual({ givenByWeekday: weekday, currentStreak: run, longestStreak: longest, lastActiveDay: active.at(-1)?.dayKey });
  }
}

describe("rollups equal a recompute from the sources", () => {
  const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

  test.each(SEEDS)("after a random give/revoke sequence (seed %i), and return to zero once everything is revoked", async (seed) => {
    const random = mulberry32(seed);
    const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)];
    await t.run(async (ctx) => {
      await ctx.db.patch(team.workspaceId, { notifyGiver: true, notifyReceiver: true });
      for (const [slackUserId, name] of [["UDAN", "Dan"], ["UEVE", "Eve"], ["UFAY", "Fay"]]) {
        await ctx.db.insert("members", {
          workspaceId: team.workspaceId, slackUserId, name, isAdmin: false, isBot: false,
          deactivated: slackUserId === "UFAY", totalGiven: 0, totalReceived: 0, totalMaxedDays: 0,
        });
      }
    });
    let lowestLimit = 5;
    let newcomers = 0;
    const someone = () => (random() < 0.1 ? `UNEW${newcomers++}` : pick([...PEOPLE, "UBOT", "UFAY"]));
    let zone = "Europe/Berlin";
    const zoneAt = new Map<number, string>();
    const nextTime = () => {
      const [y, m, d] = pick(DAYS).split("-").map(Number);
      // Unique timestamps, so every discovery maps back to the zone it was made in.
      return Date.UTC(y, m - 1, d, Math.floor(random() * 24), Math.floor(random() * 60)) + zoneAt.size;
    };

    for (let i = 0; i < 50; i++) {
      const roll = random();
      let step: string;
      if (roll < 0.55) {
        const now = nextTime();
        zoneAt.set(now, zone);
        vi.setSystemTime(now);
        const giver = random() < 0.9 ? pick(PEOPLE) : someone();
        const recipients = [...new Set(Array.from({ length: 1 + Math.floor(random() * 4) }, someone))];
        const channel = pick(CHANNELS);
        const result = await give({
          giverSlackId: giver,
          recipientSlackIds: recipients,
          amountEach: 1 + Math.floor(random() * 3),
          source: random() < 0.3 ? "reaction" : "message",
          // A few shared message timestamps make batch ids recur across transactions and days.
          messageTs: random() < 0.2 ? undefined : random() < 0.3 ? pick(["1.0001", "2.0001"]) : `${now / 1000}`,
          ...channel,
        });
        step = `seed ${seed} step ${i}: ${giver} → ${recipients.join(",")} ${result.status}`;
      } else if (roll < 0.85) {
        const rows = await t.run((ctx) => ctx.db.query("kudos").collect());
        if (rows.length === 0) continue;
        const row = pick(rows);
        await t.run(async (ctx) => revokeKudosRow(ctx, (await ctx.db.get(team.workspaceId))!, row));
        step = `seed ${seed} step ${i}: revoke ${row._id}`;
      } else if (roll < 0.9) {
        const limit = pick(LIMITS);
        lowestLimit = Math.min(lowestLimit, limit);
        await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: limit }));
        step = `seed ${seed} step ${i}: daily limit ${limit}`;
      } else if (roll < 0.96) {
        zone = pick(ZONES);
        await t.run((ctx) => ctx.db.patch(team.workspaceId, { timezone: zone }));
        step = `seed ${seed} step ${i}: timezone ${zone}`;
      } else {
        const now = nextTime();
        zoneAt.set(now, zone);
        const who = pick([team.ana, team.ben, team.cleo]);
        await t.run(async (ctx) => {
          await allowanceCheck(ctx, (await ctx.db.get(team.workspaceId))!, (await ctx.db.get(who))!, now);
        });
        step = `seed ${seed} step ${i}: allowance check`;
      }
      expectRollupsMatchSources(await snapshot(), zoneAt, lowestLimit, step);
    }

    await revokeAll();
    const s = await snapshot();
    expectRollupsMatchSources(s, zoneAt, lowestLimit, `seed ${seed}: everything revoked`);
    expect(s.memberStats).toEqual([]);
    expect(s.pairStats).toEqual([]);
    expect(s.channelStats).toEqual([]);
    // Only first discoveries outlive a revoke: they are bot messages, not kudos.
    for (const w of s.workspaceStats) {
      expect(w).toMatchObject({ given: 0, kudosRows: 0, messages: 0, givers: 0, receivers: 0, giverDays: 0, cappedGiven: 0, maxedDays: 0 });
      expect(w.heat.every((n) => n === 0)).toBe(true);
    }
  });
});
