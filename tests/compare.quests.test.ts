import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import * as quests from "../convex/quests";
import { weekKeyFor } from "../convex/lib/quests";
import { startOfDayUtc } from "../convex/lib/time";
import { seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

// The admin switch (#23) flips quests through the single `questsOn` hook; the mock lets a test turn it off.
vi.mock("../convex/quests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../convex/quests")>();
  return { ...actual, questsOn: vi.fn(actual.questsOn) };
});

// NOW is Wed 2026-09-23 in Berlin. Quest completions count in the period of the day they happened in the
// workspace timezone, whatever quest week (ISO week, Monday first) they belong to.
const TZ = "Europe/Berlin";
let t: ReturnType<typeof setupConvex>;
let team: Team;

async function setup(receivedVisibility: Doc<"workspaces">["receivedVisibility"] = "everyone") {
  t = setupConvex();
  team = await seedTeam(t, { receivedVisibility });
  await longtime(team.ana);
  await questsSince("2024-12-30");
}
beforeEach(() => vi.mocked(quests.questsOn).mockReturnValue(true));
afterEach(() => vi.useRealTimers());

/** A member since before any range under test. */
const longtime = (memberId: Id<"members">) =>
  t.run(async (ctx) => {
    await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId, dayKey: "2024-01-08", given: 1, received: 0, maxed: false });
  });

/** The workspace's first quest board: quests exist from this week on. */
const questsSince = (weekKey: string) =>
  t.run(async (ctx) => {
    await ctx.db.insert("questBoards", { workspaceId: team.workspaceId, weekKey, questKeys: ["steady", "story", "spread"] });
  });

/**
 * A quest completed `hh:mm` after Berlin midnight on `dayKey` (or at the instant `at`), filed under its
 * quest week like the engine does.
 */
const completed = (memberId: Id<"members">, dayKey: string, time = "12:00", at?: number) =>
  t.run(async (ctx) => {
    const [h, m] = time.split(":").map(Number);
    const completedAt = at ?? startOfDayUtc(dayKey, TZ) + (h * 60 + m) * 60_000;
    await ctx.db.insert("questCompletions", {
      workspaceId: team.workspaceId,
      memberId,
      weekKey: weekKeyFor(completedAt, TZ),
      questKey: "steady",
      completedAt,
      sweep: false,
    });
  });

type Period = "week" | "month" | "quarter" | "year";
async function past(period: Period, memberId = team.ana, today = TODAY) {
  const viewer = await signInAs(t, memberId);
  return await viewer.query(api.compare.past.get, { period, today });
}

const noBoards = () =>
  t.run(async (ctx) => {
    for (const b of await ctx.db.query("questBoards").collect()) await ctx.db.delete(b._id);
  });
const questsRow = (r: { rows: { metric: string }[] }) => r.rows.find((x) => x.metric === "questsCompleted");

describe("Past you: quests completed", () => {
  test("week: counts completions by their Berlin day, like for like with last week to date", async () => {
    await setup();
    await completed(team.ana, "2026-09-21", "00:30"); // Mon, this week (still Sunday in UTC)
    await completed(team.ana, "2026-09-20", "23:30"); // Sun, last week but after last week's to-date Wed
    await completed(team.ana, "2026-09-16", "23:30"); // Wed, last week to date
    await completed(team.ana, "2026-09-17", "09:00"); // Thu, last week after to date
    const row = questsRow(await past("week"))!;
    expect(row).toEqual({
      metric: "questsCompleted",
      family: "giving",
      you: { value: 1, locked: null },
      benchmark: { value: 1, locked: null },
      delta: 0,
    });
  });

  test("month: a quest week straddling the month boundary splits by completion day", async () => {
    await setup();
    await completed(team.ana, "2026-09-01"); // Tue in the quest week of Mon 31 Aug: September
    await completed(team.ana, "2026-09-20"); // Sun, September
    await completed(team.ana, "2026-08-31"); // Mon 31 Aug: neither Sep nor Aug 1–23
    await completed(team.ana, "2026-08-02"); // Sun in the quest week of Mon 27 Jul: August
    await completed(team.ana, "2026-07-31"); // Fri, July
    const row = questsRow(await past("month"))!;
    expect(row.you.value).toBe(2);
    expect(row.benchmark.value).toBe(1);
    expect(row.delta).toBe(1);
  });

  test("quarter: the week of Mon 29 Jun splits between Q2 and Q3", async () => {
    await setup();
    await completed(team.ana, "2026-06-30"); // Tue, Q2 but after Q2 to date (Apr 1 – Jun 24)
    await completed(team.ana, "2026-07-01"); // Wed, same quest week, Q3
    await completed(team.ana, "2026-04-01", "00:15"); // first minutes of Q2
    const row = questsRow(await past("quarter"))!;
    expect(row.you.value).toBe(1);
    expect(row.benchmark.value).toBe(1);
  });

  test("year: ISO week 1 of 2026 starts in 2025, its completions count in their own year", async () => {
    await setup();
    await completed(team.ana, "2025-12-31"); // Wed in the quest week of Mon 29 Dec 2025: 2025, after 2025 to date
    await completed(team.ana, "2026-01-01"); // Thu, same quest week: 2026
    await completed(team.ana, "2025-01-01"); // 2025 to date
    await completed(team.ana, "2024-12-31"); // 2024
    const row = questsRow(await past("year"))!;
    expect(row.you.value).toBe(1);
    expect(row.benchmark.value).toBe(1);
  });

  test("only the viewer's own completions count", async () => {
    await setup();
    await completed(team.ben, "2026-09-22");
    await completed(team.ana, "2026-09-22");
    const row = questsRow(await past("week"))!;
    expect(row.you.value).toBe(1);
  });

  test("a giving metric: shown even where the workspace hides received counts", async () => {
    await setup("hidden");
    await completed(team.ana, "2026-09-22");
    const row = questsRow(await past("week"))!;
    expect(row.you).toEqual({ value: 1, locked: null });
    expect(row.benchmark).toEqual({ value: 0, locked: null });
  });

  test("across the spring DST switch the week still starts at Berlin midnight", async () => {
    await setup();
    // Clocks go forward on Sun 29 Mar 2026 (CET → CEST): Monday 00:30 Berlin is 22:30 UTC on Sunday.
    await completed(team.ana, "2026-03-29", "", Date.parse("2026-03-29T21:30:00Z")); // Sun 23:30 CEST, the week before
    await completed(team.ana, "2026-03-30", "", Date.parse("2026-03-29T22:30:00Z")); // Mon 00:30 CEST, this week
    await completed(team.ana, "2026-03-25", "23:30"); // Wed, last week to date
    const row = questsRow(await past("week", team.ana, "2026-04-01"))!;
    expect(row.you.value).toBe(1);
    expect(row.benchmark.value).toBe(1);
  });

  test("on the period's last day, last period counts in full", async () => {
    await setup();
    await completed(team.ana, "2026-08-31", "20:00"); // Mon, last day of August
    await completed(team.ana, "2026-09-30", "08:00"); // Wed, last day of September
    const row = questsRow(await past("month", team.ana, "2026-09-30"))!;
    expect(row.you.value).toBe(1);
    expect(row.benchmark.value).toBe(1);
  });

  test("completions keep counting by their day after the workspace moves timezone", async () => {
    await setup();
    // Filed under the Berlin quest week of Mon 7 Sep, but Mon 14 Sep 06:30 in Tokyo: last week to date there.
    await completed(team.ana, "2026-09-13", "23:30");
    await t.run(async (ctx) => {
      await ctx.db.patch(team.workspaceId, { timezone: "Asia/Tokyo" });
    });
    const row = questsRow(await past("week"))!;
    expect(row.benchmark.value).toBe(1);
  });

  test("a workspace that never had a quest board has no last period to compare with", async () => {
    await setup();
    await noBoards();
    const row = questsRow(await past("week"))!;
    expect(row.you).toEqual({ value: 0, locked: null });
    expect(row.benchmark).toEqual({ value: null, locked: null });
  });

  test("quests that launched on the day last period to date ends still compare", async () => {
    await setup();
    await noBoards();
    await questsSince("2026-09-14");
    await completed(team.ana, "2026-09-14");
    // On Monday 21 Sep, last week to date is Monday 14 Sep alone: the first quest day.
    const row = questsRow(await past("week", team.ana, "2026-09-21"))!;
    expect(row.benchmark.value).toBe(1);
  });

  test("before quests existed there is no last period to compare with, not a zero", async () => {
    await setup();
    await noBoards();
    await questsSince("2026-09-07"); // quests launched in September
    await completed(team.ana, "2026-09-08");
    const row = questsRow(await past("month"))!;
    expect(row.you.value).toBe(1);
    expect(row.benchmark.value).toBeNull();
    expect(row.delta).toBeNull();
  });

  test("quests that launched during last period compare with what there was", async () => {
    await setup();
    await noBoards();
    await questsSince("2026-08-17");
    await completed(team.ana, "2026-08-18");
    const row = questsRow(await past("month"))!;
    expect(row.you.value).toBe(0);
    expect(row.benchmark.value).toBe(1);
  });
});

describe("Teammate and Team: quests are private to each member", () => {
  test("the teammate row is locked on both sides and carries no number", async () => {
    await setup("everyone");
    await completed(team.ana, "2026-09-22");
    await completed(team.ben, "2026-09-22");
    const ana = await signInAs(t, team.ana);
    const r = await ana.query(api.compare.teammate.get, { period: "week", today: TODAY, memberId: team.ben });
    expect(questsRow(r)).toEqual({
      metric: "questsCompleted",
      family: "giving",
      you: { value: null, locked: "personal" },
      benchmark: { value: null, locked: "personal" },
      delta: null,
    });
  });

  test("the team row is locked with no distribution, however big the team", async () => {
    await setup("everyone");
    await completed(team.ana, "2026-09-22");
    await completed(team.ben, "2026-09-22");
    await completed(team.cleo, "2026-09-22");
    const ana = await signInAs(t, team.ana);
    const r = await ana.query(api.compare.team.get, { period: "week", today: TODAY });
    expect(questsRow(r)).toEqual({
      metric: "questsCompleted",
      family: "giving",
      you: { value: null, locked: "personal" },
      benchmark: { value: null, locked: "personal" },
      delta: null,
      team: null,
      percentile: null,
    });
  });
});

describe("with quests switched off", () => {
  test("the metric disappears from every benchmark", async () => {
    await setup();
    await completed(team.ana, "2026-09-22");
    vi.mocked(quests.questsOn).mockReturnValue(false);
    const ana = await signInAs(t, team.ana);
    const results = [
      await ana.query(api.compare.past.get, { period: "week", today: TODAY }),
      await ana.query(api.compare.teammate.get, { period: "week", today: TODAY, memberId: team.ben }),
      await ana.query(api.compare.team.get, { period: "week", today: TODAY }),
    ];
    const others = ["given", "received", "activeDays", "maxedDays", "longestStreak", "reach", "channels", "newDiscoveries"];
    expect(results.map((r) => r.rows.map((x) => x.metric))).toEqual([others, others, ["given", "received", "activeDays", "maxedDays"]]);
  });
});
