import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { linkSlackMember } from "../convex/auth";
import { seedTeam, setupConvex, type Team } from "./helpers";

/**
 * One Kudos user can be linked to members in several workspaces (the same Slack account signing
 * in to more than one installed workspace). The web app shows exactly one of them, and never an
 * arbitrary one: the workspace they last chose, by signing in to it or with the switcher.
 */
let t: ReturnType<typeof setupConvex>;
let acme: Team;
let globex: Team;
let userId: Id<"users">;

const HOUR = 60 * 60 * 1000;

beforeEach(async () => {
  t = setupConvex();
  acme = await seedTeam(t, { name: "Acme" }, "TACME");
  globex = await seedTeam(t, { name: "Globex" }, "TGLOBEX");
  userId = await t.run((ctx) => ctx.db.insert("users", { name: "Ana" }));
});
afterEach(() => vi.useRealTimers());

const as = () => t.withIdentity({ subject: `${userId}|session` });
const shown = async () => {
  const viewer = await as().query(api.session.viewer, {});
  return viewer.status === "ready" ? viewer.workspace.name : viewer.status;
};
/** Ana signs in with Slack in `teamId` (the Convex Auth callback links her member there). */
const signInWithSlack = (teamId: string) =>
  t.run((ctx) => linkSlackMember(ctx, userId, { slackUserId: "UANA", slackTeamId: teamId, name: "Ana" }));
const link = (memberId: Id<"members">, extra: { lastGivenAt?: number } = {}) =>
  t.run((ctx) => ctx.db.patch(memberId, { userId, ...extra }));

describe("which workspace a user in several of them sees", () => {
  test("the one they signed in to last, whatever order the rows are in", async () => {
    await signInWithSlack("TGLOBEX");
    vi.advanceTimersByTime(HOUR);
    await signInWithSlack("TACME");
    expect(await shown()).toBe("Acme");

    vi.advanceTimersByTime(HOUR);
    await signInWithSlack("TGLOBEX");
    expect(await shown()).toBe("Globex");
  });

  test("before anyone chose, the one they last gave kudos in", async () => {
    await link(acme.ana, { lastGivenAt: Date.now() - HOUR });
    await link(globex.ana, { lastGivenAt: Date.now() - 2 * HOUR });
    expect(await shown()).toBe("Acme");
    await t.run((ctx) => ctx.db.patch(globex.ana, { lastGivenAt: Date.now() }));
    expect(await shown()).toBe("Globex");
  });

  test("with nothing to go on, still always the same one: the newest membership", async () => {
    await link(acme.ana);
    await link(globex.ana);
    expect(await shown()).toBe("Globex");
    await link(acme.ana); // touching a row doesn't reorder anything
    expect(await shown()).toBe("Globex");
  });

  test("never a workspace they can't use: deactivated there, or the app is uninstalled", async () => {
    await signInWithSlack("TACME");
    vi.advanceTimersByTime(HOUR);
    await signInWithSlack("TGLOBEX");
    await t.run((ctx) => ctx.db.patch(globex.ana, { deactivated: true }));
    expect(await shown()).toBe("Acme");

    await t.run((ctx) => ctx.db.patch(acme.workspaceId, { status: "uninstalled" }));
    expect(await shown()).toBe("notInstalled");
  });
});

describe("the workspace switcher", () => {
  beforeEach(async () => {
    await signInWithSlack("TACME");
    vi.advanceTimersByTime(HOUR);
    await signInWithSlack("TGLOBEX");
  });

  test("lists every workspace the user can use, the current one first", async () => {
    const viewer = await as().query(api.session.viewer, {});
    expect(viewer.status === "ready" && viewer.workspaces).toEqual([
      { memberId: globex.ana, name: "Globex", iconUrl: null, current: true },
      { memberId: acme.ana, name: "Acme", iconUrl: null, current: false },
    ]);
  });

  test("switching shows the other workspace from then on", async () => {
    vi.advanceTimersByTime(HOUR);
    await as().mutation(api.session.switchWorkspace, { memberId: acme.ana });
    expect(await shown()).toBe("Acme");
  });

  test("only to your own, usable memberships", async () => {
    await expect(as().mutation(api.session.switchWorkspace, { memberId: acme.ben })).rejects.toThrow(/can't switch/);
    await t.run((ctx) => ctx.db.patch(acme.ana, { deactivated: true }));
    await expect(as().mutation(api.session.switchWorkspace, { memberId: acme.ana })).rejects.toThrow(/can't switch/);
    await expect(t.mutation(api.session.switchWorkspace, { memberId: acme.ana })).rejects.toThrow(/Sign in/);
    expect(await shown()).toBe("Globex");
  });

  test("a user in one workspace has nothing to switch to", async () => {
    await t.run((ctx) => ctx.db.patch(acme.ana, { userId: undefined }));
    const viewer = await as().query(api.session.viewer, {});
    expect(viewer.status === "ready" && viewer.workspaces).toEqual([
      { memberId: globex.ana, name: "Globex", iconUrl: null, current: true },
    ]);
  });
});
