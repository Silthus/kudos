import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { all, member, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let team: Team;
let ts = 1;
const give = (text: string, giver = "UANA") =>
  t.mutation(internal.kudos.ingestMessage, { workspaceId: team.workspaceId, botUserId: "UBOT", giverSlackId: giver, text, channelId: "C1", messageTs: `${ts++}.0` });
const members = () => t.run((ctx) => ctx.db.query("members").collect());

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Slack lifecycle events", () => {
  const process = (event: object) => t.action(internal.slack.processEvent, { teamId: "T1", event });
  const status = async () => (await t.run((ctx) => ctx.db.get(team.workspaceId)))?.status;

  test("a person revoking their own sign-in token doesn't disconnect the workspace", async () => {
    await process({ type: "tokens_revoked", tokens: { oauth: ["UBEN"] } });
    expect(await status()).toBe("active");
  });

  test("revoking the bot token does", async () => {
    await process({ type: "tokens_revoked", tokens: { bot: ["UBOT"] } });
    expect(await status()).toBe("uninstalled");
  });
});

describe("reinstalling", () => {
  const reinstall = (installer: string) =>
    t.mutation(internal.slackData.saveInstallation, { teamId: "T1", teamName: "Team T1", botToken: "xoxb-2", botUserId: "UBOT", appId: "A1", installerSlackId: installer, scope: "" });

  test("doesn't turn whoever re-runs the OAuth flow into an admin", async () => {
    await reinstall("UBEN");
    expect(await member(t, team.ben)).toMatchObject({ isAdmin: false });
  });

  test("the first installer of a new workspace becomes admin", async () => {
    await t.mutation(internal.slackData.saveInstallation, { teamId: "TNEW", teamName: "New", botToken: "x", botUserId: "UB", appId: "A", installerSlackId: "UFIRST", scope: "" });
    expect((await members()).find((m) => m.slackUserId === "UFIRST")?.isAdmin).toBe(true);
  });

  test("a directory resync doesn't re-promote someone an admin demoted", async () => {
    await t.run((ctx) => ctx.db.patch(team.ben, { isAdmin: false }));
    await t.mutation(internal.slackData.upsertSlackUsers, {
      workspaceId: team.workspaceId,
      users: [{ slackUserId: "UBEN", name: "Ben", isBot: false, deactivated: false, isSlackAdmin: true }],
    });
    expect(await member(t, team.ben)).toMatchObject({ isAdmin: false });
  });
});

describe("robustness", () => {
  test("mass mentions over the allowance don't create members", async () => {
    const before = (await members()).length;
    const text = Array.from({ length: 50 }, (_, i) => `<@UFAKE${i}>`).join(" ") + " :taco:";
    expect((await give(text))?.status).toBe("limit");
    expect((await members()).length).toBe(before);
  });

  test("a Slack API outage while enriching an event doesn't lose the kudos", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>502</html>", { status: 502 })));
    await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "message", user: "UANA", text: "<@UBEN> :taco:", channel: "C1", ts: "5.5" } });
    expect(await member(t, team.ben)).toMatchObject({ totalReceived: 1 });
    expect((await all(t, "notifications")).every((n) => n.delivery === "failed")).toBe(true);
  });
});

describe("maxed days stay consistent when the daily limit changes", () => {
  test("receiving kudos never marks a day as maxed", async () => {
    await give("<@UBEN> :taco::taco::taco:");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 2 }));
    await give("<@UANA> :taco:", "UCLEO");
    const anaDay = (await all(t, "memberDays")).find((d) => d.memberId === team.ana)!;
    expect(anaDay.maxed).toBe(false);
    expect(await member(t, team.ana)).toMatchObject({ totalMaxedDays: 0 });
  });

  test("raising the limit after maxing out doesn't double count the day", async () => {
    await give("<@UBEN> :taco::taco::taco::taco::taco:");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 10 }));
    await give("<@UBEN> :taco::taco::taco::taco::taco:");
    expect(await member(t, team.ana)).toMatchObject({ totalGiven: 10, totalMaxedDays: 1 });
  });
});

describe("analytics privacy", () => {
  test("admins also respect a private received visibility in analytics", async () => {
    await give("<@UBEN> :taco:");
    const ana = await signInAs(t, team.ana);
    const analytics = await ana.query(api.analytics.overview, { period: "7d" });
    expect(analytics.topReceivers).toBeNull();
  });
});
