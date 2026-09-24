import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { all, NOW, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true });
});
afterEach(() => vi.useRealTimers());

let ts = 1000;
/** A Slack message; the clock moves on a minute after each one. */
async function message(giver: string, text: string) {
  const result = await t.mutation(internal.kudos.ingestMessage, {
    workspaceId: team.workspaceId,
    botUserId: "UBOT",
    giverSlackId: giver,
    text,
    channelId: "CGENERAL",
    channelName: "general",
    messageTs: `${ts++}.0001`,
  });
  vi.setSystemTime(Date.now() + 60_000);
  return result;
}

const player = (memberId: Id<"members">) =>
  t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique());

async function mine(memberId: Id<"members">) {
  const as = await signInAs(t, memberId);
  return await as.query(api.game.mine, {});
}

describe("players and XP", () => {
  test("giving a first thoughtful kudos makes you a player with its XP", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    expect(await player(team.ana)).toMatchObject({ xp: 20, level: 1, since: NOW.getTime() }); // 10 + new connection 10
    expect(await mine(team.ana)).toMatchObject({
      enabled: true,
      hidden: false,
      player: { level: 1, title: "Seedling", xp: 20, next: 30, toNext: 10 },
    });
  });

  test("two thoughtful kudos to new people reach level 2", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await message("UANA", "<@UCLEO> :taco: great pairing session today");
    expect(await player(team.ana)).toMatchObject({ xp: 40, level: 2 });
  });

  test("receiving earns a player 5 XP per qualifying giver a day; a non-player accrues nothing", async () => {
    await message("UBEN", "<@UCLEO> :taco: you made the launch smooth"); // Ben becomes a player
    await message("UANA", "<@UBEN> <@UCLEO> :taco: thanks for all the help");
    expect(await player(team.ben)).toMatchObject({ xp: 20 + 5 });
    expect(await player(team.cleo)).toBeNull();
  });

  test("a thank-back or a kudos without a reason earns 2 XP and the receiver nothing", async () => {
    await message("UBEN", "<@UANA> :taco: thanks for pairing with me");
    await message("UANA", "<@UBEN> :taco: thank you right back Ben"); // within 72 h: a thank-back
    await message("UCLEO", "<@UBEN> :taco:");
    expect(await player(team.ana)).toMatchObject({ xp: 2 }); // not yet a player when Ben thanked her
    expect((await player(team.ben))?.xp).toBe(20);
    expect(await player(team.cleo)).toMatchObject({ xp: 2 });
  });

  test("nothing accrues while the game is off", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    expect(await player(team.ana)).toBeNull();
    expect(await all(t, "gameEvents")).toHaveLength(0);
    expect(await mine(team.ana)).toMatchObject({ enabled: false, player: null });
  });
});

describe("two messages in the same millisecond", () => {
  test("the second isn't a new connection again, live or in a rebuild", async () => {
    const same = (messageTs: string) =>
      t.mutation(internal.kudos.ingestMessage, {
        workspaceId: team.workspaceId,
        botUserId: "UBOT",
        giverSlackId: "UANA",
        text: "<@UBEN> :taco: thanks for the thorough review",
        channelId: "CGENERAL",
        messageTs,
      });
    await same("1.0001");
    await same("1.0002");
    expect(await player(team.ana)).toMatchObject({ xp: 20 + 2 });
    await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await player(team.ana)).toMatchObject({ xp: 20 + 2 });
  });
});

describe("a rebuild during a demo reset", () => {
  test("stops once another reset is under way, but not when its own reset has finished", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    const rebuild = async (resetAt?: number) => {
      await t.run(async (ctx) => {
        for (const p of await ctx.db.query("players").collect()) await ctx.db.patch(p._id, { xp: 0 });
      });
      await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId, resetAt });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      return (await player(team.ana))!.xp;
    };
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { resettingSince: 2 }));
    expect(await rebuild(1)).toBe(0); // a run of an older reset
    expect(await rebuild(2)).toBe(20); // the running reset's own run
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { resettingSince: undefined }));
    expect(await rebuild(2)).toBe(20); // its reset finished (the rollups released the lock): keep going
  });
});

describe("the admin switch", () => {
  const settings = {
    emojiName: "taco",
    emojiGlyph: "🌮",
    unitSingular: "kudos",
    unitPlural: "kudos",
    dailyLimit: 5,
    timezone: "Europe/Berlin",
    receivedVisibility: "self" as const,
    reactionsEnabled: true,
    notifyGiver: true,
    notifyReceiver: true,
  };
  async function switchGame(gameEnabled: boolean) {
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.admin.updateSettings, { ...settings, gameEnabled });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.unstubAllGlobals();
  }

  test("switching the game on for the first time plays the history so far through the rules", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: undefined }));
    await message("UBEN", "<@UCLEO> :taco: you made the launch smooth");
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    expect(await all(t, "players")).toHaveLength(0);

    await switchGame(true);
    expect(await player(team.ben)).toMatchObject({ xp: 25 });
    expect(await player(team.ana)).toMatchObject({ xp: 20 });
    expect(await player(team.cleo)).toBeNull();
    const ana = await signInAs(t, team.ana);
    expect((await ana.query(api.admin.overview, {})).settings.gameEnabled).toBe(true);
  });

  test("a kudos given before the switch-on rebuild reaches you doesn't cut your history short", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: undefined }));
    await message("UBEN", "<@UANA> :taco: thanks for the thorough review"); // Ben plays from here…
    await message("UCLEO", "<@UBEN> :taco: you made the launch smooth"); // …so this earns him 5
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.admin.updateSettings, { ...settings, gameEnabled: true }); // the rebuild is only scheduled
    await message("UBEN", "<@UCLEO> :taco: and thanks for the pairing session"); // live, before the rebuild runs
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.unstubAllGlobals();
    expect(await player(team.ben)).toMatchObject({ xp: 20 + 5 + 2, since: NOW.getTime() }); // Cleo's thanks-back to him counts
  });

  test("kudos given while it was switched off never earn anything, not even in a rebuild", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await switchGame(false);
    await message("UANA", "<@UCLEO> :taco: great pairing session today");
    await switchGame(true);
    expect(await player(team.ana)).toMatchObject({ xp: 20 });
    await message("UANA", "<@UBEN> :taco: and for the docs you wrote");
    expect(await player(team.ana)).toMatchObject({ xp: 20 + 2 }); // Ben again the same day: the second earns 2
  });
});

describe("removing a member", () => {
  test("takes their XP events and player row, and what they earned others with them", async () => {
    await message("UBEN", "<@UCLEO> :taco: you made the launch smooth");
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await message("UBEN", "<@UANA> <@UCLEO> :taco: thanks both for the help");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UBEN" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5000); // a step per phase, then the rollups rebuild
    vi.unstubAllGlobals();
    expect(await player(team.ben)).toBeNull();
    expect((await all(t, "gameEvents")).filter((e) => e.memberId === team.ben)).toEqual([]);
    expect(await player(team.ana)).toMatchObject({ xp: 0 }); // her kudos to Ben and his to her are gone
  });
});

describe("hiding the game", () => {
  test("is the member's own setting; XP keeps accruing", async () => {
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.game.setHidden, { hidden: true });
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    expect(await ana.query(api.game.mine, {})).toMatchObject({ hidden: true, player: { xp: 20 } });
    await ana.mutation(api.game.setHidden, { hidden: false });
    expect(await ana.query(api.game.mine, {})).toMatchObject({ hidden: false });
  });

  test("takes level-up messages off the Me page, and they come back with the game", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await message("UANA", "<@UCLEO> :taco: great pairing session today"); // level 2
    const ana = await signInAs(t, team.ana);
    const categories = async () => (await ana.query(api.me.overview, { period: "month", today: TODAY })).botMessages.map((m) => m.category);
    expect(await categories()).toContain("gains");
    await ana.mutation(api.game.setHidden, { hidden: true });
    expect(await categories()).not.toContain("gains");
    await ana.mutation(api.game.setHidden, { hidden: false });
    expect(await categories()).toContain("gains");
  });

  test("a discovery DM doesn't repeat on Me: the reply it came from already shows the message as new", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.85); // every roll is Rare
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { questsEnabled: false })); // no quest DM to ride in
    await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.ana, since: 0, xp: 25, level: 1, coins: 0 }));
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review"); // level 2 + a new Rare reply
    vi.restoreAllMocks();
    const ana = await signInAs(t, team.ana);
    const messages = (await ana.query(api.me.overview, { period: "month", today: TODAY })).botMessages;
    expect(messages.map((m) => m.category)).toEqual(["gains", "giver_success"]);
    expect(messages[0].text).toMatch(/^Level 2: Seedling/);
    expect(messages[0].text).not.toContain("New message discovered");
    expect(messages[1].isNewDiscovery).toBe(true);
  });

  test("with the game hidden, Me still lists the latest 5 kudos messages, however many game DMs came in between", async () => {
    for (let i = 0; i < 12; i++) {
      await t.run((ctx) =>
        ctx.db.insert("notifications", {
          workspaceId: team.workspaceId,
          memberId: team.ana,
          category: i < 5 ? "receiver_success" : "gains",
          templateKey: "x",
          rarity: "common",
          isNewDiscovery: false,
          slackText: `m${i}`,
          webText: `m${i}`,
          delivery: "sent",
          ...(i < 5 ? {} : { gains: [{ kind: "item" as const, name: "Golden frame" }] }),
        }),
      );
    }
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.game.setHidden, { hidden: true });
    const messages = (await ana.query(api.me.overview, { period: "month", today: TODAY })).botMessages;
    expect(messages.map((m) => m.text)).toEqual(["m4", "m3", "m2", "m1", "m0"]);
  });

  test("a level-up that rode in a kudos DM shows under that message on Me, labelled, and goes with the game", async () => {
    await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.ben, since: 0, xp: 28, level: 1, coins: 0 }));
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review"); // Ben +5: level 2
    const ben = await signInAs(t, team.ben);
    const latest = async () => (await ben.query(api.me.overview, { period: "month", today: TODAY })).botMessages[0];
    expect(await latest()).toMatchObject({
      category: "receiver_success",
      gains: ["Level 2: Seedling. Your thoughtful kudos got you here. You earned a skill point for your skill tree."],
      gainLabel: "Level up",
    });
    await ben.mutation(api.game.setHidden, { hidden: true });
    expect(await latest()).toMatchObject({ category: "receiver_success" });
    expect((await latest()).gains).toBeUndefined();
  });
});

describe("revoking", () => {
  test("takes back exactly the XP its kudos earned; the level reached stays", async () => {
    await message("UBEN", "<@UCLEO> :taco: you made the launch smooth");
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await message("UANA", "<@UCLEO> :taco: great pairing session today");
    expect(await player(team.ana)).toMatchObject({ xp: 40, level: 2 });
    const toBen = (await all(t, "kudos")).find((k) => k.giverId === team.ana && k.receiverId === team.ben)!;
    const admin = await signInAs(t, team.ana);
    await admin.mutation(api.admin.revoke, { kudosId: toBen._id });
    expect(await player(team.ana)).toMatchObject({ xp: 20, level: 2 });
    expect((await player(team.ben))?.xp).toBe(20);
    expect((await mine(team.ana)).player).toMatchObject({ level: 2, xp: 20, fraction: 0 });
  });
});
