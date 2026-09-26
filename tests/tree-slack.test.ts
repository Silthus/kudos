import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/** The Ancient Tree in Slack (#154, design plan #152 S9): the receiver's DM, App Home and `/kudos tree`. */

type SlackCall = { method: string; params: Record<string, string> };
type Block = { type: string; text?: { text: string }; fields?: { text: string }[]; elements?: { text: string }[] };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
  vi.stubEnv("SITE_URL", "https://kudos.example");
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(url).split("/api/")[1];
      calls.push({ method, params: Object.fromEntries(new URLSearchParams(String(init?.body ?? ""))) });
      if (method === "conversations.info") return Response.json({ ok: true, channel: { name: "general" } });
      return Response.json({ ok: true });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

let ts = 100;
async function post(text: string, user = "UANA") {
  await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "message", user, text, channel: "C1", ts: `${ts++}.0001` } });
  vi.setSystemTime(Date.now() + 60_000);
}

const dmsTo = (user: string) => calls.filter((c) => c.method === "chat.postMessage" && c.params.channel === user).map((c) => c.params);
const textOf = (blocks: Block[]) => JSON.stringify(blocks);

async function home(user: string): Promise<Block[]> {
  await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "app_home_opened", tab: "home", user } });
  const view = calls.filter((c) => c.method === "views.publish" && c.params.user_id === user).at(-1)!;
  return JSON.parse(view.params.view).blocks;
}
const slash = (text: string, user: string) => t.mutation(internal.slackData.slashCommand, { teamId: "T1", slackUserId: user, text });

describe("the receiver's kudos DM", () => {
  test("says how many seeds they have to plant at the tree", async () => {
    await post("<@UBEN> :taco: thanks for the thorough review");
    await post("<@UBEN> :taco: great pairing session today", "UCLEO");
    const [first, second] = dmsTo("UBEN");
    expect(first.text).toContain("1 seed to plant at the tree");
    expect(second.text).toContain("2 seeds to plant at the tree");
    expect(first.blocks).toContain("1 seed to plant at the tree");
  });

  test("says nothing of seeds for a kudos without a reason, or when the game is hidden from them", async () => {
    await post("<@UBEN> :taco:");
    await t.run((ctx) => ctx.db.patch(team.cleo, { gameHidden: true }));
    await post("<@UCLEO> :taco: great pairing session today");
    expect(dmsTo("UBEN")[0].text).not.toContain("seed");
    expect(dmsTo("UCLEO")[0].text).not.toContain("seed");
  });
});

describe("App Home and /kudos tree", () => {
  test("show the desert before the seed moment, with the seeds to plant", async () => {
    await post("<@UBEN> :taco: thanks for the thorough review");
    const blocks = await home("UBEN");
    expect(textOf(blocks)).toContain("The Ancient Tree");
    expect(textOf(blocks)).toContain("A desert");
    expect(textOf(blocks)).toContain("*Seeds to plant*\\n1");
  });

  test("show the stage, the way to the next one and the districts open", async () => {
    await post("<@UBEN> :taco: thanks for the thorough review");
    await (await signInAs(t, team.ben)).mutation(api.tree.plantSeeds, {});
    const reply = await slash("tree", "UANA");
    expect(reply.text).toBe("The Ancient Tree is a seed: 4 growth to a sprout.");
    const text = textOf(reply.blocks);
    expect(text).toContain("*A seed*\\n1 growth");
    expect(text).toContain("*Next*\\n4 growth to a sprout");
    expect(text).toContain("*Districts open*\\n1 of 18");
    expect(text).toContain("*Seeds to plant*\\n0");
    expect(textOf(await home("UANA"))).toContain("*Districts open*\\n1 of 18");
  });

  test("/kudos tree says so when the game is off or hidden", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect((await slash("tree", "UANA")).text).toBe("The game isn't on in this workspace.");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: true }));
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    expect((await slash("tree", "UANA")).text).toMatch(/hidden the game/);
    expect(textOf(await home("UANA"))).not.toContain("The Ancient Tree");
  });
});
