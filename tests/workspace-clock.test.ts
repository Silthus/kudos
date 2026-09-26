import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { addDays, DAY_MS, startOfDayUtc } from "../convex/lib/time";
import { weekKeyOfDay } from "../convex/lib/quests";
import { all, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

/**
 * The workspace clock (#143): a workspace with `clockOffsetMs` lives in its own "now", so everything
 * that reads the time (the day a kudos lands on, the allowance, quest weeks, plants, sprees, bonus
 * days) runs N days ahead. Workspaces without an offset keep the wall clock (the other suites).
 */

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
});
afterEach(() => vi.useRealTimers());

const ahead = (days: number) => t.run((ctx) => ctx.db.patch(team.workspaceId, { clockOffsetMs: days * DAY_MS }));

let ts = 1000;
const message = (giver: string, text: string) =>
  t.mutation(internal.kudos.ingestMessage, {
    workspaceId: team.workspaceId,
    botUserId: "UBOT",
    giverSlackId: giver,
    text,
    channelId: "CGENERAL",
    channelName: "general",
    messageTs: `${ts++}.0001`,
  });

describe("a workspace N days ahead", () => {
  test("a kudos lands on day N", async () => {
    await ahead(3);
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review of the release notes");
    const [kudos] = await all(t, "kudos");
    expect(kudos.dayKey).toBe(addDays(TODAY, 3));
    expect(kudos.at).toBe(Date.now() + 3 * DAY_MS);
  });

  test("the allowance resets on the workspace's next day", async () => {
    expect((await message("UANA", "<@UBEN> :taco::taco::taco::taco::taco: huge week"))?.status).toBe("given");
    expect((await message("UANA", "<@UBEN> :taco: one more"))?.status).toBe("limit");
    await ahead(1);
    expect((await message("UANA", "<@UBEN> :taco: one more"))?.status).toBe("given");
  });

  test("the viewer carries the offset, so the web client computes the workspace's today", async () => {
    await ahead(2);
    const viewer = await (await signInAs(t, team.ana)).query(api.session.viewer, {});
    expect(viewer.status === "ready" && viewer.workspace.clockOffsetMs).toBe(2 * DAY_MS);
  });

  test("the quest week rolls with the workspace's days", async () => {
    await ahead(7);
    await message("UANA", "<@UBEN> :taco: thanks for untangling the flaky deploy pipeline on friday afternoon");
    const boards = await t.run((ctx) => ctx.db.query("questBoards").collect());
    expect(boards.map((b) => b.weekKey)).toEqual([weekKeyOfDay(addDays(TODAY, 7))]);
  });

  test("a bonus day starts on the workspace's day: its kudos earn double", async () => {
    await t.run(async (ctx) => {
      await ctx.db.patch(team.workspaceId, { gameEnabled: true });
      const day = addDays(TODAY, 2);
      await ctx.db.insert("boosts", { workspaceId: team.workspaceId, dayKey: day, from: startOfDayUtc(day, "Europe/Berlin"), kind: "double", source: "schedule", createdAt: 0 });
    });
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review of the release notes");
    await ahead(2);
    await message("UANA", "<@UCLEO> :taco: thanks for the thorough review of the launch checklist");
    const gives = (await all(t, "gameEvents")).filter((e) => e.kind === "give");
    expect(gives.map((e) => [e.dayKey, e.lines?.[0].boosted ?? false])).toEqual([
      [TODAY, false],
      [addDays(TODAY, 2), true],
    ]);
  });
});
