import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { giveKudos } from "../convex/engine";
import { markBackfilled } from "../convex/lib/rebuild";
import type { Period } from "../convex/lib/time";
import { NOW, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

/**
 * Participation is the share of the team that gave. Someone who gave and has since left Slack was
 * part of that period's team: they count in the team size as well as among the givers, so the
 * share never passes 100%. Today is Wed 2026-09-23; Ana, Ben and Cleo are still here.
 */
let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { receivedVisibility: "everyone" });
});
afterEach(() => vi.useRealTimers());

async function giveAt(iso: string, giverSlackId: string, recipientSlackId: string) {
  vi.setSystemTime(new Date(iso));
  await t.run(async (ctx) =>
    giveKudos(ctx, {
      workspace: (await ctx.db.get(team.workspaceId))!,
      giverSlackId,
      recipientSlackIds: [recipientSlackId],
      amountEach: 1,
      channelId: "C1",
      channelName: "general",
      text: "thanks",
      source: "message",
      now: Date.now(),
      messageTs: `${Date.parse(iso) / 1000}`,
    }),
  );
  vi.setSystemTime(NOW);
}

/** Dan and Eve gave in August; Dan gave again this month; both have left since. */
async function everyoneGaveThenTwoLeft() {
  const [dan, eve] = await t.run(async (ctx) =>
    Promise.all(
      [["UDAN", "Dan"], ["UEVE", "Eve"]].map(([slackUserId, name]) =>
        ctx.db.insert("members", {
          workspaceId: team.workspaceId, slackUserId, name, isAdmin: false, isBot: false, deactivated: false,
          totalGiven: 0, totalReceived: 0, totalMaxedDays: 0,
        }),
      ),
    ),
  );
  await giveAt("2026-08-10T10:00:00Z", "UDAN", "UANA");
  await giveAt("2026-08-11T10:00:00Z", "UEVE", "UANA");
  await giveAt("2026-08-12T10:00:00Z", "UANA", "UBEN");
  for (const [giver, recipient] of [["UANA", "UBEN"], ["UBEN", "UCLEO"], ["UCLEO", "UANA"], ["UDAN", "UBEN"]]) {
    await giveAt("2026-09-21T10:00:00Z", giver, recipient);
  }
  await t.run(async (ctx) => {
    await ctx.db.patch(dan, { deactivated: true });
    await ctx.db.patch(eve, { deactivated: true });
  });
}

const sources = [
  ["the rollups", true],
  ["the legacy scans", false],
] as const;

describe.each(sources)("from %s", (_, backfilled) => {
  beforeEach(async () => {
    await everyoneGaveThenTwoLeft();
    if (backfilled) await t.run((ctx) => markBackfilled(ctx, team.workspaceId, NOW.getTime()));
  });

  test("analytics count teammates who gave and left in the team size too", async () => {
    const ana = await signInAs(t, team.ana);
    const { kpis } = await ana.query(api.analytics.overview, { period: "month", today: TODAY });
    // September: Ana, Ben, Cleo and Dan gave; Eve left without giving, so she isn't counted.
    expect(kpis).toMatchObject({ givers: 4, teamSize: 4, participation: 1 });
    // August: Dan, Eve and Ana gave, out of Ana, Ben, Cleo, Dan and Eve.
    expect(kpis.prevGivers).toBe(3);
    expect(kpis.prevParticipation).toBeCloseTo(3 / 5);
  });

  test.each<Period>(["month", "all"])("so do the leaderboard highlights (%s)", async (period) => {
    const ana = await signInAs(t, team.ana);
    for (const metric of ["given", "received"] as const) {
      const { highlights } = await ana.query(api.leaderboard.get, { period, metric, today: TODAY });
      const expected = period === "month" ? { givers: 4, teamSize: 4, participation: 1 } : { givers: 5, teamSize: 5, participation: 1 };
      expect(highlights, metric).toMatchObject(expected);
    }
  });
});
