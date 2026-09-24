import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { allowanceCheck, giveKudos, type GiveInput } from "../convex/engine";
import { workspaceBuckets } from "../convex/lib/buckets";
import { signSlackRequest } from "../convex/lib/slack";
import { requestRedemption, transitionRedemption } from "../convex/store";
import { seedTeam, setupConvex, type Team } from "./helpers";

/**
 * Removing a member (#8): `internal.removal.removeMember`, run by an operator with
 * `npx convex run --prod`. Everything they gave or received is revoked, their own rows are
 * deleted, and every counter ends up exactly as if they had never been there.
 */

type T = ReturnType<typeof setupConvex>;
let t: T;
let team: Team;
let xavi: Id<"members">;

async function addXavi(t: T, team: Team) {
  return await t.run((ctx) =>
    ctx.db.insert("members", {
      workspaceId: team.workspaceId,
      slackUserId: "UXAVI",
      name: "Xavi",
      isAdmin: false,
      isBot: false,
      deactivated: false,
      totalGiven: 0,
      totalReceived: 0,
      totalMaxedDays: 0,
    }),
  );
}

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
  xavi = await addXavi(t, team);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type GiveOptions = Partial<Omit<GiveInput, "workspace">> & { giverSlackId: string; recipientSlackIds: string[] };

async function giveAt(t: T, team: Team, iso: string, opts: GiveOptions) {
  vi.setSystemTime(new Date(iso));
  const result = await t.run(async (ctx) =>
    giveKudos(ctx, {
      workspace: (await ctx.db.get(team.workspaceId))!,
      amountEach: 1,
      channelId: "CGENERAL",
      channelName: "general",
      text: "thanks",
      source: "message",
      messageTs: `${Date.parse(iso) / 1000}`,
      now: Date.now(),
      ...opts,
    }),
  );
  expect(result.status, `${iso} ${opts.giverSlackId}`).toBe("given");
}

/**
 * Weeks of giving across a month, quarter and year boundary, where Xavi gives, receives, shares
 * batches with others and pushes Ana to her daily limit. `withXavi: false` is the same history
 * with every kudos that involves him left out: the oracle for a removal.
 */
async function history(t: T, team: Team, { withXavi }: { withXavi: boolean }) {
  const x = (ids: string[]) => (withXavi ? ids : ids.filter((id) => id !== "UXAVI"));
  const gives: [string, GiveOptions][] = [
    ["2026-09-21T08:00:00Z", { giverSlackId: "UANA", recipientSlackIds: x(["UBEN", "UXAVI"]), amountEach: 2 }],
    ["2026-09-21T09:00:00Z", { giverSlackId: "UANA", recipientSlackIds: x(["UXAVI"]) }], // maxes Ana's day (5)
    ["2026-09-22T11:00:00Z", { giverSlackId: "UXAVI", recipientSlackIds: ["UANA", "UCLEO"], amountEach: 2 }],
    ["2026-09-23T15:30:00Z", { giverSlackId: "UBEN", recipientSlackIds: x(["UANA", "UXAVI"]), source: "reaction" }],
    ["2026-09-30T09:00:00Z", { giverSlackId: "UCLEO", recipientSlackIds: ["UANA"], amountEach: 5 }],
    ["2026-10-01T09:00:00Z", { giverSlackId: "UXAVI", recipientSlackIds: ["UBEN"], channelId: "CSECRET", channelName: "secret", channelPrivate: true }],
    ["2026-10-02T09:00:00Z", { giverSlackId: "UCLEO", recipientSlackIds: x(["UXAVI"]), channelId: "CRANDOM", channelName: "random", amountEach: 3 }],
    ["2026-12-31T22:30:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UCLEO"], amountEach: 3 }], // 2027-01-01 in Berlin
    ["2027-01-04T10:00:00Z", { giverSlackId: "UXAVI", recipientSlackIds: ["UANA", "UBEN", "UCLEO"] }],
  ];
  for (const [iso, opts] of gives) {
    if (opts.giverSlackId === "UXAVI" && !withXavi) continue;
    if (opts.recipientSlackIds.length === 0) continue;
    await giveAt(t, team, iso, opts);
  }
}

const ROLLUP_TABLES = ["workspaceStats", "memberStats", "pairStats", "channelStats"] as const;

/**
 * The workspace's derived state as comparable lines: every rollup row, every memberDays row and
 * every remaining member's totals and giving profile. Ids become Slack ids, so two deployments
 * compare; creation times, the backfill marker and `lastGivenAt` (a revoke never moves it) are left out.
 */
async function derivedState(t: T) {
  return await t.run(async (ctx) => {
    const names = new Map<string, string>();
    for (const m of await ctx.db.query("members").collect()) names.set(m._id, m.slackUserId);
    for (const w of await ctx.db.query("workspaces").collect()) names.set(w._id, w.slackTeamId);
    const line = (table: string, row: Record<string, unknown>) => {
      const { _id, _creationTime, rollupsBackfilledAt, lastGivenAt, userId, ...rest } = row;
      const named = Object.entries(rest).map(([k, v]) => [k, typeof v === "string" ? (names.get(v) ?? v) : v]);
      return `${table} ${JSON.stringify(Object.fromEntries(named.sort()))}`;
    };
    const lines: string[] = [];
    for (const table of [...ROLLUP_TABLES, "memberDays", "members"] as const) {
      for (const row of await ctx.db.query(table).collect()) lines.push(line(table, row as Record<string, unknown>));
    }
    return lines.sort();
  });
}

async function drain(t: T) {
  await t.finishAllScheduledFunctions(vi.runAllTimers, 5000);
}

async function remove(slackUserId = "UXAVI", slackTeamId = "T1") {
  const result = await t.mutation(internal.removal.removeMember, { slackTeamId, slackUserId });
  await drain(t);
  return result;
}

describe("removing a member", () => {
  test("leaves every counter as if they had never been in the workspace", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyGiver: false, notifyReceiver: false }));
    await history(t, team, { withXavi: true });

    const control = setupConvex();
    const controlTeam = await seedTeam(control, { notifyGiver: false, notifyReceiver: false });
    await history(control, controlTeam, { withXavi: false });
    await control.mutation(internal.rollups.rebuildWorkspace, { workspaceId: controlTeam.workspaceId });
    await drain(control);
    const expected = await derivedState(control);
    expect(expected.some((l) => l.includes('"maxedDays":1'))).toBe(true);

    expect(await remove()).toMatchObject({ status: "started" });

    expect(await derivedState(t)).toEqual(expected);
    expect(await t.run((ctx) => ctx.db.get(xavi))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("kudos").collect())).toHaveLength(
      await control.run(async (ctx) => (await ctx.db.query("kudos").collect()).length),
    );
  });
});

/** Every rollup bucket the history touched, for `rollups.verify` (it can't sample `all`). */
async function historyBuckets(t: T) {
  const days = await t.run(async (ctx) => (await ctx.db.query("memberDays").collect()).map((d) => d.dayKey));
  return [...new Set(days.flatMap((d) => workspaceBuckets(d)))].filter((b) => b !== "all").sort();
}

async function rollupLines(t: T) {
  return (await derivedState(t)).filter((l) => !l.startsWith("members ") && !l.startsWith("memberDays "));
}

/** Xavi signed in to Kudos: a user, a session with a refresh token, and a Slack account with a code. */
async function signInXavi() {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Xavi", slackUserId: "UXAVI", slackTeamId: "T1" });
    await ctx.db.patch(xavi, { userId });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 1e9 });
    await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 1e9 });
    const accountId = await ctx.db.insert("authAccounts", { userId, provider: "slack", providerAccountId: "UXAVI-sub" });
    await ctx.db.insert("authVerificationCodes", { accountId, provider: "slack", code: "c0de", expirationTime: Date.now() + 1e9 });
    return userId;
  });
}

describe("what a removal deletes", () => {
  test("every row that is theirs, their sign-in, and nothing of anyone else's; the rollups verify", async () => {
    await history(t, team, { withXavi: true });
    const userId = await signInXavi();
    await t.run(async (ctx) => {
      await ctx.db.patch(xavi, { isAdmin: true });
      await ctx.db.insert("questCompletions", {
        workspaceId: team.workspaceId, memberId: xavi, weekKey: "2026-09-21", questKey: "fresh_face", completedAt: Date.now(), sweep: false,
      });
      const adjustment = { workspaceId: team.workspaceId, reason: "Welcome gift", source: "admin" as const, at: Date.now() };
      await ctx.db.insert("balanceAdjustments", { ...adjustment, memberId: xavi, amount: 5, by: team.ana });
      await ctx.db.insert("balanceAdjustments", { ...adjustment, memberId: team.ben, amount: 3, by: xavi });
      await ctx.db.patch(team.cleo, { adminRemovedBy: xavi });
      // The bot's record of a message of his that carried the emoji but thanked nobody.
      const attempt = { workspaceId: team.workspaceId, channelId: "CGENERAL", outcome: "invalid" as const, reason: "no_mention" as const, at: Date.now() };
      await ctx.db.insert("kudosAttempts", { ...attempt, messageTs: "1.1", giverId: xavi });
      await ctx.db.insert("kudosAttempts", { ...attempt, messageTs: "1.2", giverId: team.ben });
    });
    const personal = async () =>
      await t.run(async (ctx) => {
        const mine = <R extends { memberId?: Id<"members"> }>(rows: R[]) => rows.filter((r) => r.memberId === xavi).length;
        return {
          kudos: (await ctx.db.query("kudos").collect()).filter((k) => k.giverId === xavi || k.receiverId === xavi).length,
          memberDays: mine(await ctx.db.query("memberDays").collect()),
          memberStats: mine(await ctx.db.query("memberStats").collect()),
          pairStats: (await ctx.db.query("pairStats").collect()).filter((p) => p.giverId === xavi || p.receiverId === xavi).length,
          discoveries: mine(await ctx.db.query("discoveries").collect()),
          notifications: mine(await ctx.db.query("notifications").collect()),
          questCompletions: mine(await ctx.db.query("questCompletions").collect()),
          kudosAttempts: (await ctx.db.query("kudosAttempts").collect()).filter((a) => a.giverId === xavi).length,
          balanceAdjustments: mine(await ctx.db.query("balanceAdjustments").collect()),
          adminRemovedBy: (await ctx.db.query("members").collect()).filter((m) => m.adminRemovedBy === xavi).length,
          users: (await ctx.db.query("users").collect()).filter((u) => u._id === userId).length,
          authSessions: (await ctx.db.query("authSessions").collect()).length,
          authRefreshTokens: (await ctx.db.query("authRefreshTokens").collect()).length,
          authAccounts: (await ctx.db.query("authAccounts").collect()).length,
          authVerificationCodes: (await ctx.db.query("authVerificationCodes").collect()).length,
        };
      });
    const before = await personal();
    expect(Object.values(before).every((n) => n > 0), JSON.stringify(before)).toBe(true);
    const log = vi.spyOn(console, "log");

    await remove();

    expect(Object.values(await personal()).every((n) => n === 0), JSON.stringify(await personal())).toBe(true);
    // Someone else's adjustment made by Xavi stays; its ledger shows "a former admin".
    expect(await t.run(async (ctx) => (await ctx.db.query("balanceAdjustments").collect()).map((a) => a.memberId))).toEqual([team.ben]);
    expect(await t.run((ctx) => ctx.db.get(team.cleo))).not.toHaveProperty("adminRemovedBy");
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/removeMember: removed Xavi \(UXAVI\) from Team T1.*"kudosGiven":\d+/));

    const { mismatches, checked } = await t.query(internal.rollups.verify, { workspaceId: team.workspaceId, buckets: await historyBuckets(t) });
    expect(checked.length).toBeGreaterThan(10);
    expect(mismatches).toEqual([]);
    const live = await rollupLines(t);
    await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
    await drain(t);
    expect(await rollupLines(t)).toEqual(live);
  });

  test("rollup rows no kudos stand behind any more (from before rollups, or past bugs) are gone with them, before the rebuild", async () => {
    await giveAt(t, team, "2026-09-21T08:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UANA"] });
    await t.run(async (ctx) => {
      const ws = team.workspaceId;
      await ctx.db.insert("memberDays", { workspaceId: ws, memberId: xavi, dayKey: "2026-09-21", given: 2, received: 1, maxed: false });
      for (const bucket of ["w:2026-W39", "m:2026-09", "q:2026-Q3", "y:2026"]) {
        await ctx.db.insert("memberStats", { workspaceId: ws, memberId: xavi, bucket, given: 2, received: 1, maxedDays: 0, activeDays: 1 });
      }
      for (const bucket of ["m:2026-09", "all"]) {
        await ctx.db.insert("pairStats", { workspaceId: ws, bucket, giverId: xavi, receiverId: team.ana, amount: 2 });
        await ctx.db.insert("pairStats", { workspaceId: ws, bucket, giverId: team.cleo, receiverId: xavi, amount: 1 });
      }
    });

    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UXAVI" });
    // Up to the step that deletes him: readers never meet a row naming someone who's gone.
    for (let i = 0; i < 100 && (await t.run((ctx) => ctx.db.get(xavi))); i++) {
      vi.runOnlyPendingTimers();
      await t.finishInProgressScheduledFunctions();
    }
    expect(await t.run((ctx) => ctx.db.get(xavi))).toBeNull();

    const left = await t.run(async (ctx) => ({
      memberDays: (await ctx.db.query("memberDays").collect()).filter((d) => d.memberId === xavi).length,
      memberStats: (await ctx.db.query("memberStats").collect()).filter((s) => s.memberId === xavi).length,
      pairStats: (await ctx.db.query("pairStats").collect()).filter((p) => p.giverId === xavi || p.receiverId === xavi).length,
    }));
    expect(left).toEqual({ memberDays: 0, memberStats: 0, pairStats: 0 });
    await drain(t);
    const { mismatches } = await t.query(internal.rollups.verify, { workspaceId: team.workspaceId, buckets: await historyBuckets(t) });
    expect(mismatches).toEqual([]);
  });

  test("keeps the sign-in of someone who is still a member of another workspace", async () => {
    const userId = await signInXavi();
    const other = await seedTeam(t, {}, "T2");
    await t.run((ctx) => ctx.db.patch(other.ben, { userId }));

    await remove();

    expect(await t.run((ctx) => ctx.db.get(userId))).not.toBeNull();
    expect(await t.run(async (ctx) => (await ctx.db.query("authSessions").collect()).length)).toBe(1);
    expect(await t.run(async (ctx) => (await ctx.db.query("authAccounts").collect()).length)).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(xavi))).toBeNull();
  });
});

describe("their store requests", () => {
  const SECRET = "test-signing-secret";
  let calls: { method: string; params: Record<string, string> }[];

  beforeEach(async () => {
    calls = [];
    vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = String(url).split("https://slack.com/api/")[1];
        const body = String(init?.body ?? "");
        calls.push({ method: method ?? String(url), params: method ? Object.fromEntries(new URLSearchParams(body)) : JSON.parse(body || "{}") });
        return Response.json({ ok: true });
      }),
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(team.workspaceId, { storeEnabled: true });
      await ctx.db.patch(xavi, { totalReceived: 100 });
      await ctx.db.patch(team.ben, { totalReceived: 100 });
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  async function addReward(name: string, stock?: number) {
    return await t.run((ctx) =>
      ctx.db.insert("rewards", {
        workspaceId: team.workspaceId, name, emoji: "☕", cost: 10, status: "active", createdBy: team.ana, updatedAt: Date.now(),
        ...(stock !== undefined ? { stock } : {}),
      }),
    );
  }

  async function redeem(memberId: Id<"members">, rewardId: Id<"rewards">, then?: "approve" | "fulfill" | "decline") {
    return await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      const member = (await ctx.db.get(memberId))!;
      const { redemptionId } = await requestRedemption(ctx, { workspace, member, rewardId, expectedCost: 10, now: Date.now() });
      if (then) {
        const redemption = (await ctx.db.get(redemptionId))!;
        await transitionRedemption(ctx, { workspace, redemption, actor: (await ctx.db.get(team.ana))!, action: then, now: Date.now() });
      }
      return redemptionId;
    });
  }

  const setCopies = (id: Id<"redemptions">, ts: string) =>
    t.run((ctx) => ctx.db.patch(id, { adminMessages: [{ channel: "DUANA", ts }, { channel: "DCLEO", ts }] }));

  async function click(redemptionId: string) {
    const payload = JSON.stringify({
      type: "block_actions",
      api_app_id: "A1",
      team: { id: "T1", domain: "acme" },
      user: { id: "UANA", team_id: "T1" },
      container: { type: "message", channel_id: "DUANA", message_ts: "1.1" },
      response_url: "https://hooks.slack.com/actions/T1/1/secret",
      actions: [{ type: "button", action_id: "store_approve", block_id: "b1", value: redemptionId, action_ts: "1700000001.000001" }],
    });
    const body = new URLSearchParams({ payload }).toString();
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await t.fetch("/slack/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": ts,
        "x-slack-signature": await signSlackRequest(SECRET, ts, body),
      },
      body,
    });
    await drain(t);
    return res;
  }

  test("open requests give their stock back, reward counters stay exact, and other people's requests stay", async () => {
    const limited = await addReward("Mug", 3);
    const unlimited = await addReward("Coffee");
    await redeem(xavi, limited);
    await redeem(xavi, limited, "approve");
    await redeem(xavi, unlimited, "fulfill");
    await redeem(xavi, limited, "decline");
    const bens = await redeem(team.ben, limited);
    await drain(t);
    expect(await t.run((ctx) => ctx.db.get(limited))).toMatchObject({ stock: 0, openCount: 3 });
    expect(await t.run((ctx) => ctx.db.get(unlimited))).toMatchObject({ fulfilledCount: 1 });

    await remove();

    expect(await t.run((ctx) => ctx.db.get(limited))).toMatchObject({ stock: 2, openCount: 1 });
    expect(await t.run((ctx) => ctx.db.get(unlimited))).toMatchObject({ fulfilledCount: 0 });
    expect((await t.run((ctx) => ctx.db.query("redemptions").collect())).map((r) => r._id)).toEqual([bens]);
    expect(await t.run((ctx) => ctx.db.get(team.ben))).toMatchObject({ storeSpent: 10 });
  });

  test("the admins' review DMs are retired, and a click on one answers only the clicker", async () => {
    const open = await redeem(xavi, await addReward("Mug", 3));
    const done = await redeem(xavi, await addReward("Coffee"), "fulfill");
    await setCopies(open, "1.1");
    await setCopies(done, "1.2");
    await t.run(async (ctx) => ctx.db.patch(team.ana, { userId: await ctx.db.insert("users", {}) }));
    await drain(t);
    calls = [];

    await remove();

    const updates = calls.filter((c) => c.method === "chat.update");
    expect(updates.map((c) => `${c.params.channel}/${c.params.ts}`).sort()).toEqual(["DCLEO/1.1", "DCLEO/1.2", "DUANA/1.1", "DUANA/1.2"]);
    for (const u of updates) {
      const item = u.params.ts === "1.1" ? "☕ Mug" : "☕ Coffee";
      expect(u.params.text).toBe(`🗑️ This request for *${item}* is gone: its requester was removed from Kudos.`);
      expect(JSON.parse(u.params.blocks).some((b: { type: string }) => b.type === "actions")).toBe(false);
    }

    calls = [];
    const res = await click(open);
    expect(res.status).toBe(200);
    expect(calls.filter((c) => c.method.startsWith("https://hooks.slack.com")).map((c) => c.params.text)).toEqual(["Request not found."]);
  });

  test("a bot message still on its way to them is dropped quietly", async () => {
    const notificationId = await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      return (await allowanceCheck(ctx, workspace, (await ctx.db.get(xavi))!, Date.now())).notificationId;
    });

    await remove();

    await expect(t.mutation(internal.slackData.markDelivery, { id: notificationId, delivery: "sent" })).resolves.toBeNull();
  });
});

describe("other members' quests", () => {
  test("a quest someone completed only by recognizing the removed member is no longer done", async () => {
    await t.run((ctx) => ctx.db.insert("questBoards", { workspaceId: team.workspaceId, weekKey: "2026-09-21", questKeys: ["fresh", "channels", "story"] }));
    const note = { text: "thanks for the great help", noteWords: 5 };
    await giveAt(t, team, "2026-09-22T09:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UXAVI"], ...note });
    await giveAt(t, team, "2026-09-22T10:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UCLEO"], ...note });
    const done = async () =>
      (await t.run((ctx) => ctx.db.query("questCompletions").collect())).map((c) => `${c.memberId === team.ana ? "Ana" : "Ben"} ${c.questKey}`);
    expect(await done()).toEqual(["Ana fresh", "Ben fresh"]);

    await remove();

    expect(await done()).toEqual(["Ben fresh"]);
  });
});

describe("running a removal", () => {
  test("refuses bots, the Kudos bot user, and anyone in the shared demo", async () => {
    await expect(t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UBOT" })).rejects.toThrow(/bot/);
    await t.run((ctx) => ctx.db.patch(team.bot, { isBot: false })); // the installation still knows it's ours
    await expect(t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UBOT" })).rejects.toThrow(/bot/);

    const demo = await seedTeam(t, { isDemo: true }, "T_DEMO_LUMEN");
    await expect(t.mutation(internal.removal.removeMember, { slackTeamId: "T_DEMO_LUMEN", slackUserId: "UBEN" })).rejects.toThrow(/demo/);
    // The shared demo user is signed in as a member elsewhere too: still never theirs to delete.
    const demoUser = await t.run((ctx) => ctx.db.insert("users", { isDemo: true }));
    await t.run((ctx) => ctx.db.patch(xavi, { userId: demoUser }));
    await expect(t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UXAVI" })).rejects.toThrow(/demo/);

    await drain(t);
    expect(await t.run((ctx) => ctx.db.get(xavi))).toMatchObject({ deactivated: false });
    expect(await t.run((ctx) => ctx.db.get(team.bot))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(demo.ben))).not.toBeNull();
  });

  test("is idempotent: a second run, even one started while the first is running, changes nothing more", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyGiver: false, notifyReceiver: false }));
    await history(t, team, { withXavi: true });
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UXAVI" });
    expect(await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UXAVI" })).toMatchObject({ status: "started" });
    await drain(t);
    const after = await derivedState(t);
    expect(after.some((l) => l.includes("UXAVI"))).toBe(false);

    expect(await remove()).toEqual({ status: "not_found" });
    expect(await derivedState(t)).toEqual(after);
    const { mismatches } = await t.query(internal.rollups.verify, { workspaceId: team.workspaceId, buckets: await historyBuckets(t) });
    expect(mismatches).toEqual([]);
  });

  test("a member with a long history is removed over many steps, and a give racing the removal is revoked too", async () => {
    // 40 days of Xavi and Ana thanking each other, one day at a time.
    for (let day = 0; day < 40; day++) {
      const at = new Date(Date.parse("2026-08-01T09:00:00Z") + day * 86_400_000).toISOString();
      await giveAt(t, team, at, { giverSlackId: "UXAVI", recipientSlackIds: ["UANA", "UBEN"] });
      await giveAt(t, team, at.replace("T09", "T10"), { giverSlackId: "UANA", recipientSlackIds: ["UXAVI"] });
    }
    const log = vi.spyOn(console, "log");
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UXAVI" });
    // Step by step until every kudos of his is revoked, while he is still there.
    const involved = () =>
      t.run(async (ctx) => (await ctx.db.query("kudos").collect()).filter((k) => k.giverId === xavi || k.receiverId === xavi).length);
    for (let i = 0; i < 100 && (await involved()) > 0; i++) {
      vi.runOnlyPendingTimers();
      await t.finishInProgressScheduledFunctions();
    }
    expect(await t.run((ctx) => ctx.db.get(xavi))).not.toBeNull();
    // A Slack resync marks him active again and he gives once more, after his gives were revoked.
    await t.run((ctx) => ctx.db.patch(xavi, { deactivated: false }));
    await giveAt(t, team, "2026-09-23T10:00:00Z", { giverSlackId: "UXAVI", recipientSlackIds: ["UCLEO"] });

    await drain(t);

    expect(await t.run((ctx) => ctx.db.get(xavi))).toBeNull();
    expect(await t.run(async (ctx) => (await ctx.db.query("kudos").collect()).filter((k) => k.giverId === xavi || k.receiverId === xavi))).toEqual([]);
    const summary = log.mock.calls.map(([line]) => String(line)).find((l) => l.startsWith("removeMember: removed"))!;
    const tally = JSON.parse(summary.slice(summary.indexOf("{")));
    expect(tally).toMatchObject({ kudosGiven: 81, kudosReceived: 40 });
    expect(tally.steps).toBeGreaterThan(12);
    expect(await t.run((ctx) => ctx.db.get(team.ana))).toMatchObject({ totalGiven: 0, totalReceived: 0 });
    expect(await t.run((ctx) => ctx.db.get(team.cleo))).toMatchObject({ totalReceived: 0 });
    const { mismatches } = await t.query(internal.rollups.verify, { workspaceId: team.workspaceId, buckets: await historyBuckets(t) });
    expect(mismatches).toEqual([]);
  });

  test("won't leave the workspace without an admin unless forced", async () => {
    await t.run(async (ctx) => {
      await ctx.db.patch(team.ana, { isAdmin: false });
      await ctx.db.patch(team.ben, { isAdmin: true, deactivated: true }); // left Slack: can't administer
      await ctx.db.patch(xavi, { isAdmin: true });
    });
    await expect(t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UXAVI" })).rejects.toThrow(
      /only admin.*force/,
    );
    await drain(t);
    expect(await t.run((ctx) => ctx.db.get(xavi))).toMatchObject({ deactivated: false });

    expect(await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UXAVI", force: true })).toMatchObject({
      status: "started",
    });
    await drain(t);
    expect(await t.run((ctx) => ctx.db.get(xavi))).toBeNull();
  });
});

describe("within Convex's transaction limits", () => {
  // Every step must fit however much history there is. Tightened here so small fixtures show it.
  const LIMITS = { documentsRead: 1500 };

  test("a member who gave on hundreds of days: each step stops before it runs out of reads", async () => {
    t = setupConvex({ transactionLimits: LIMITS });
    team = await seedTeam(t, { notifyGiver: false, notifyReceiver: false });
    xavi = await addXavi(t, team);
    // Revoking a day's only kudos recomputes his streaks from every day he gave on.
    for (let day = 0; day < 250; day++) {
      const at = new Date(Date.parse("2026-01-05T09:00:00Z") + day * 86_400_000).toISOString();
      await giveAt(t, team, at, { giverSlackId: "UXAVI", recipientSlackIds: ["UANA"] });
    }

    await remove();

    expect(await t.run((ctx) => ctx.db.get(xavi))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(team.ana))).toMatchObject({ totalReceived: 0 });
  });

  test("a sign-in with thousands of refresh tokens is deleted a batch at a time", async () => {
    t = setupConvex({ transactionLimits: LIMITS });
    team = await seedTeam(t);
    xavi = await addXavi(t, team);
    const userId = await signInXavi();
    await t.run(async (ctx) => {
      const [sessionId] = (await ctx.db.query("authSessions").collect()).map((s) => s._id);
      for (let i = 0; i < 2500; i++) await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 1e9 });
    });

    await remove();

    expect(await t.run((ctx) => ctx.db.get(userId))).toBeNull();
    expect(await t.run(async (ctx) => (await ctx.db.query("authRefreshTokens").take(1)).length)).toBe(0);
  });
});
