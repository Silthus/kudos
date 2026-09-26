import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { all, seedTeam, setupConvex, type Team } from "./helpers";

/**
 * Seeds of appreciation (#168): the kudos emoji is Slack's standard 🌱 `seedling` for new installs,
 * the demo and the simulator. A standard emoji needs no upload, so it works the moment Kudos is in.
 */

type SlackCall = { method: string; params: Record<string, string> };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;

beforeEach(() => {
  t = setupConvex();
  calls = [];
  vi.stubEnv("SITE_URL", "https://kudos.example");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(url).split("/api/")[1];
      calls.push({ method, params: Object.fromEntries(new URLSearchParams(String(init?.body ?? ""))) });
      const answers: Record<string, unknown> = {
        "conversations.info": { ok: true, channel: { name: "general" } },
        "conversations.history": { ok: true, messages: [{ ts: "9.9", text: "shipped the release" }] },
      };
      return Response.json(answers[method] ?? { ok: true });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const install = (teamId: string) =>
  t.mutation(internal.slackData.saveInstallation, { teamId, teamName: `Team ${teamId}`, botToken: "xoxb", botUserId: "UBOT", appId: "A1", installerSlackId: "UANA", scope: "" });
const workspace = (id: Id<"workspaces">) => t.run(async (ctx) => (await ctx.db.get(id))!);

describe("a new install", () => {
  test("gives with the seedling emoji, and a reinstall keeps the emoji the workspace chose", async () => {
    const id = await install("TNEW");
    expect(await workspace(id)).toMatchObject({ emojiName: "seedling", emojiGlyph: "🌱" });

    await t.run((ctx) => ctx.db.patch(id, { emojiName: "taco", emojiGlyph: "🌮" }));
    await install("TNEW");
    expect(await workspace(id)).toMatchObject({ emojiName: "taco", emojiGlyph: "🌮" });
  });
});

describe("a workspace giving seeds in Slack", () => {
  let team: Team;
  beforeEach(async () => {
    team = await seedTeam(t, { emojiName: "seedling", emojiGlyph: "🌱" });
  });
  const event = (event: Record<string, unknown>) => t.action(internal.slack.processEvent, { teamId: "T1", event });

  test("a message with :seedling: gives, and the bot confirms it with 🌱 on the message", async () => {
    await event({ type: "message", user: "UANA", text: "<@UBEN> :seedling::seedling: thanks for the thorough review", channel: "C1", ts: "1.1" });
    expect((await all(t, "kudos")).map((k) => [k.receiverId, k.amount, k.noteWords])).toEqual([[team.ben, 2, 5]]);
    expect(calls.filter((c) => c.method === "reactions.add").map((c) => c.params)).toEqual([{ channel: "C1", timestamp: "1.1", name: "seedling" }]);
  });

  test("reacting with 🌱 gives the author a kudos", async () => {
    await event({ type: "reaction_added", user: "UANA", reaction: "seedling", item_user: "UCLEO", item: { type: "message", channel: "C1", ts: "9.9" } });
    expect((await all(t, "kudos")).map((k) => [k.receiverId, k.source])).toEqual([[team.cleo, "reaction"]]);
  });
});

describe("how Slack explains giving", () => {
  beforeEach(async () => {
    await seedTeam(t, { emojiName: "seedling", emojiGlyph: "🌱", gameEnabled: true });
  });

  test("App Home invites a member to give a seed, and its footer says how", async () => {
    await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "app_home_opened", tab: "home", user: "UBEN" } });
    const view = JSON.parse(calls.find((c) => c.method === "views.publish")!.params.view);
    const texts: string[] = view.blocks.flatMap((b: { text?: { text: string }; elements?: { text: string }[] }) => [b.text?.text, ...(b.elements ?? []).map((e) => e.text)]);
    expect(texts).toContain("*You can give seeds of appreciation too.* Give a seed: @name :seedling: and a few words on why. Your first kudos starts your level.");
    expect(texts).toContain(
      "Give a seed of appreciation: mention teammates with :seedling: and a few words on why, like `@ana :seedling: thanks for the thorough review`. Every :seedling: gives one kudos to each person you mention.",
    );
  });

  test("/kudos help starts with how to give a seed", async () => {
    const reply = await t.mutation(internal.slackData.slashCommand, { teamId: "T1", slackUserId: "UBEN", text: "help" });
    expect(reply.text.split("\n").slice(0, 2)).toEqual([
      "*How Kudos works* :seedling:",
      "• Give a seed of appreciation: mention teammates with :seedling: and a few words on why, like `@ana @ben :seedling::seedling: thanks for the release!`",
    ]);
  });
});
