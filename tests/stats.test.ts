import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { kudosInRange, workspaceDays } from "../convex/lib/stats";
import { seedTeam, setupConvex, type Team } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let team: Team;
beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
  await t.run(async (ctx) => {
    for (let d = 1; d <= 9; d++) {
      const dayKey = `2026-09-0${d}`;
      await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId: team.ana, dayKey, given: 1, received: 0, maxed: false });
      await ctx.db.insert("kudos", { workspaceId: team.workspaceId, batchId: dayKey, giverId: team.ana, receiverId: team.ben, amount: 1, dayKey, source: "seed", channelId: "C1", text: "", at: Date.UTC(2026, 8, d, 12) });
    }
  });
});
afterEach(() => vi.useRealTimers());

test("when a range is too big to read at once, the newest days are the ones kept", async () => {
  const { rows, truncated } = await t.run((ctx) => workspaceDays(ctx, team.workspaceId, { start: "2026-09-01", end: "2026-09-09", days: 9 }, 3));
  expect(rows.map((r) => r.dayKey).sort()).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
  expect(truncated).toBe(true);
});

test("kudos samples also keep the most recent activity", async () => {
  const { rows, truncated } = await t.run((ctx) => kudosInRange(ctx, team.workspaceId, 0, Date.UTC(2026, 9, 1), 2));
  expect(rows.map((k) => k.dayKey).sort()).toEqual(["2026-09-08", "2026-09-09"]);
  expect(truncated).toBe(true);
});
