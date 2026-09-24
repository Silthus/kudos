import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { signSlackRequest } from "../convex/lib/slack";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * Every web link Kudos sends in Slack (DMs, App Home, `/kudos` replies, store and quest DMs)
 * opens the workspace it was sent in (#76). Slack is a stubbed `fetch` that keeps every payload.
 */

const SECRET = "test-signing-secret";
let t: ReturnType<typeof setupConvex>;
let team: Team;
let sent: string[];

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, realRewardsEnabled: true, emojiGlyph: "🌮" }, "TLUMEN");
  // A level-5 player with 42 Hog coins: the Store (and real rewards) open at level 5.
  await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.ben, since: 0, xp: 350, level: 5, coins: 2 }));
  vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
  vi.stubEnv("SITE_URL", "https://kudos.example");
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(JSON.stringify(Object.fromEntries(new URLSearchParams(String(init?.body ?? "")))));
      return Response.json({ ok: true, channel: "D1", ts: "1.1" });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

let triggers = 0;
async function command(text: string, userId: string) {
  const body = new URLSearchParams({ team_id: "TLUMEN", user_id: userId, command: "/kudos", text, trigger_id: `${++triggers}` }).toString();
  const ts = String(Math.floor(Date.now() / 1000));
  const res = await t.fetch("/slack/commands", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": ts,
      "x-slack-signature": await signSlackRequest(SECRET, ts, body),
    },
    body,
  });
  sent.push(await res.text());
}

/** Every link into the web app found in what went to Slack. */
const links = () => sent.flatMap((s) => s.match(/https:\/\/kudos\.example[^\s"'|<>\\]*/g) ?? []).map((href) => new URL(href));

test("every link into the web app names the Slack workspace it was sent in", async () => {
  const drain = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  const rewardId = await t.run((ctx) =>
    ctx.db.insert("rewards", { workspaceId: team.workspaceId, name: "Coffee", emoji: "☕", cost: 15, unit: "coins", status: "active", createdBy: team.ana, updatedAt: Date.now() }),
  );

  // A kudos with a thoughtful note: the giver's DMs (gallery, and the quest log once a quest is done).
  await t.action(internal.slack.processEvent, {
    teamId: "TLUMEN",
    event: { type: "message", user: "UANA", text: "<@UBEN> :taco: thanks for the careful review", channel: "CGENERAL", ts: "100.0001" },
  });
  // A redemption: the requester's DM, the admin's review DM, then the rewritten admin copy.
  await signInAs(t, team.ana);
  const ben = await signInAs(t, team.ben);
  const { redemptionId } = await ben.mutation(api.store.redeem, { rewardId, expectedCost: 15 });
  await drain();
  await t.action(internal.slack.processEvent, { teamId: "TLUMEN", event: { type: "app_home_opened", tab: "home", user: "UANA" } });
  const ana = await signInAs(t, team.ana);
  await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "approve" });
  await drain();
  for (const sub of ["me", "top", "quests", "store", "help"]) await command(sub, "UANA");

  const found = links();
  expect(found.filter((u) => u.searchParams.get("ws") !== "TLUMEN").map(String)).toEqual([]);
  const pages = new Set(found.map((u) => `${u.pathname}${u.searchParams.has("tab") ? `?tab=${u.searchParams.get("tab")}` : ""}${u.hash}`));
  expect([...pages].sort()).toEqual(["/admin?tab=store", "/discoveries", "/leaderboard", "/me", "/quests", "/store", "/store#my-requests"]);
});
