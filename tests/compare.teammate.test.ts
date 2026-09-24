import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

// NOW is Wed 2026-09-23 in Berlin: "week" is Mon 21 – Wed 23.
let t: ReturnType<typeof setupConvex>;
let team: Team;

async function setup(receivedVisibility: Doc<"workspaces">["receivedVisibility"] = "everyone") {
  t = setupConvex();
  team = await seedTeam(t, { receivedVisibility });
}
afterEach(() => vi.useRealTimers());

const UNAVAILABLE = "That teammate isn't available to compare.";

async function getTeammate(memberId: string, period: "week" | "month" | "quarter" | "year" = "week", viewerId = team.ana) {
  const viewer = await signInAs(t, viewerId);
  return await viewer.query(api.compare.teammate.get, { period, today: TODAY, memberId });
}

describe("compare.teammate.get: eligibility", () => {
  test("signed out", async () => {
    await setup();
    await expect(t.query(api.compare.teammate.get, { period: "month", today: TODAY, memberId: team.ben })).rejects.toThrow(
      "Sign in with Slack to continue.",
    );
  });

  test("a teammate in the same workspace is available", async () => {
    await setup();
    const r = await getTeammate(team.ben);
    expect(r.mode).toBe("teammate");
    expect(r.teammate).toMatchObject({ _id: team.ben, name: "Ben" });
  });

  test("yourself, the bot and a deactivated member are not", async () => {
    await setup();
    await t.run((ctx) => ctx.db.patch(team.cleo, { deactivated: true }));
    for (const id of [team.ana, team.bot, team.cleo]) {
      await expect(getTeammate(id)).rejects.toThrow(UNAVAILABLE);
    }
  });

  test("a member of another workspace is not", async () => {
    await setup();
    const other = await seedTeam(t, {}, "T2");
    await expect(getTeammate(other.ben)).rejects.toThrow(UNAVAILABLE);
  });

  test("a removed member, a malformed id and an id from another table fail the same way", async () => {
    await setup();
    const gone: Id<"members"> = team.ben;
    await t.run((ctx) => ctx.db.delete(gone));
    await expect(getTeammate(gone)).rejects.toThrow(UNAVAILABLE);
    await expect(getTeammate("not-an-id")).rejects.toThrow(UNAVAILABLE);
    await expect(getTeammate(team.workspaceId)).rejects.toThrow(UNAVAILABLE);
  });
});
