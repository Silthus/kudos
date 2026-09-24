import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { seedTeam, setupConvex, type Team } from "./helpers";

type SlackCall = { method: string; params: Record<string, string> };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;

function stubSlackApi(responses: Record<string, unknown> = {}) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(url).split("/api/")[1];
      const params = Object.fromEntries(new URLSearchParams(String(init?.body ?? "")));
      calls.push({ method, params });
      if (method in responses) return Response.json(responses[method]);
      if (method === "conversations.info") return Response.json({ ok: true, channel: { name: "general" } });
      return Response.json({ ok: true });
    }),
  );
}

let ts = 100;
/** `user` posts `text` in #general (in a thread when `thread` is given); the clock moves on a minute. */
async function post(text: string, user = "UANA", thread?: string) {
  await t.action(internal.slack.processEvent, {
    teamId: "T1",
    event: { type: "message", user, text, channel: "C1", ts: `${ts++}.0001`, ...(thread ? { thread_ts: thread } : {}) },
  });
  vi.setSystemTime(Date.now() + 60_000);
}

const ephemerals = () => calls.filter((c) => c.method === "chat.postEphemeral").map((c) => c.params);
const dms = () => calls.filter((c) => c.method === "chat.postMessage").map((c) => c.params);

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false }); // no Quest DMs in the way
  vi.stubEnv("SITE_URL", "https://kudos.example");
  stubSlackApi();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the giver's reply is ephemeral where they gave, with what it earned", () => {
  test("in the thread, itemised; the receiver still gets a DM", async () => {
    await post("<@UBEN> :taco: thanks for the thorough review", "UANA", "50.0001");
    const [reply] = ephemerals();
    expect(reply).toMatchObject({ channel: "C1", thread_ts: "50.0001", user: "UANA" });
    expect(reply.text).toContain("+20 XP · new connection +10");
    expect(dms().map((d) => d.channel)).toEqual(["UBEN"]);
  });

  test("if Slack can't show it where they gave (e.g. the bot isn't in the channel), it comes as a DM instead", async () => {
    stubSlackApi({ "chat.postEphemeral": { ok: false, error: "channel_not_found" } });
    await post("<@UBEN> :taco: thanks for the thorough review");
    const toAna = dms().find((d) => d.channel === "UANA");
    expect(toAna?.text).toContain("+20 XP · new connection +10");
    const [note] = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(note).toMatchObject({ category: "giver_success", delivery: "sent" });
  });

  test("a kudos without a reason is told how to earn more", async () => {
    await post("<@UBEN> :taco:");
    expect(ephemerals()[0].text).toContain("+2 XP · a kudos with a reason (3+ words) earns more");
  });

  test("with the game off it is still the ephemeral reply, just without XP", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await post("<@UBEN> :taco: thanks for the thorough review");
    expect(ephemerals()).toHaveLength(1);
    expect(ephemerals()[0].text).not.toContain("XP");
  });

  test("a member who hides the game gets no XP line", async () => {
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    await post("<@UBEN> :taco: thanks for the thorough review");
    expect(ephemerals()[0].text).not.toContain("XP");
  });
});

describe("Hog coins in the reply and the level-up DM", () => {
  /** Ana already plays at `level` with `xp` and `coins` collected. */
  const anaAt = (level: number, xp: number, coins: number) =>
    t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.ana, since: 0, xp, level, coins }));

  test("below level 3 coins collect silently: the reply doesn't mention them", async () => {
    await post("<@UBEN> :taco::taco: thanks for the thorough review");
    expect(ephemerals()[0].text).toContain("+20 XP");
    expect(ephemerals()[0].text).not.toMatch(/coin/i);
  });

  test("once the wallet is open, the reply shows the coins a kudos earned", async () => {
    await anaAt(3, 100, 4);
    await post("<@UBEN> :taco::taco: thanks for the thorough review");
    expect(ephemerals()[0].text).toContain("+20 XP · +2 Hog coins · new connection +10");
  });

  test("once the wallet is open, a kudos without a reason is told that one with a reason earns coins", async () => {
    await anaAt(3, 100, 4);
    await post("<@UBEN> :taco:");
    expect(ephemerals()[0].text).toContain("+2 XP · a kudos with a reason (3+ words) earns coins");
  });

  test("reaching level 3 opens the wallet with what was collected so far; later levels say what they paid", async () => {
    await anaAt(2, 70, 5);
    await post("<@UBEN> :taco: thanks for the thorough review"); // +20 XP: level 3, 6 coins + 2 levels × 10
    expect(dms().find((d) => d.channel === "UANA")?.text).toContain("Your Hog coin wallet is open: 26 Hog coins collected so far.");
    calls = [];
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("players").collect()).find((x) => x.memberId === team.ana)!;
      await ctx.db.patch(p._id, { xp: 170 });
    });
    await post("<@UCLEO> :taco: great pairing session today"); // level 4
    const dm = dms().find((d) => d.channel === "UANA")?.text;
    expect(dm).toContain("Level 4: Sprout");
    expect(dm).toContain("+10 Hog coins");
  });

  test("reaching level 2 says nothing about coins yet", async () => {
    await post("<@UBEN> :taco: thanks for the thorough review");
    calls = [];
    await post("<@UCLEO> :taco: great pairing session today");
    expect(dms().find((d) => d.channel === "UANA")?.text).not.toMatch(/coin/i);
  });
});

describe("App Home", () => {
  async function home(user: string) {
    await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "app_home_opened", tab: "home", user } });
    const view = calls.filter((c) => c.method === "views.publish" && c.params.user_id === user).at(-1)!;
    return JSON.stringify(JSON.parse(view.params.view).blocks);
  }

  test("invites a member who hasn't given yet to give; never once they play or while the game is off", async () => {
    expect(await home("UBEN")).toContain("You can give kudos too");
    await post("<@UCLEO> :taco: thanks for the thorough review", "UBEN");
    expect(await home("UBEN")).not.toContain("You can give kudos too");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect(await home("UCLEO")).not.toContain("You can give kudos too");
  });
});

describe("level-up DM", () => {
  test("reaching a level DMs the new level, its title and the skill point", async () => {
    await post("<@UBEN> :taco: thanks for the thorough review");
    calls = [];
    await post("<@UCLEO> :taco: great pairing session today");
    const levelUp = dms().find((d) => d.channel === "UANA");
    expect(levelUp?.text).toContain("Level 2: Seedling");
    expect(levelUp?.text).toContain("a skill point");
  });

  test("never for a member who hides the game", async () => {
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    await post("<@UBEN> :taco: thanks for the thorough review");
    await post("<@UCLEO> :taco: great pairing session today");
    expect(dms().some((d) => d.channel === "UANA")).toBe(false);
  });
});
