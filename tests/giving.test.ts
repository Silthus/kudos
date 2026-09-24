import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal, api } from "../convex/_generated/api";
import { all, member, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
});
afterEach(() => vi.useRealTimers());

let ts = 1000;
const message = (giver: string, text: string, messageTs = `${ts++}.0001`) =>
  t.mutation(internal.kudos.ingestMessage, {
    workspaceId: team.workspaceId,
    botUserId: "UBOT",
    giverSlackId: giver,
    text,
    channelId: "CGENERAL",
    channelName: "general",
    messageTs,
  });

describe("giving kudos with a Slack message", () => {
  test("each emoji gives one kudos to every mentioned teammate", async () => {
    const result = await message("UANA", "<@UBEN> <@UCLEO> :taco::taco: great release");
    expect(result?.status).toBe("given");

    const kudos = await all(t, "kudos");
    expect(kudos.map((k) => [k.receiverId, k.amount])).toEqual([
      [team.ben, 2],
      [team.cleo, 2],
    ]);
    expect(kudos[0]).toMatchObject({ channelName: "general", dayKey: "2026-09-23", source: "message", text: "@Ben @Cleo :taco::taco: great release" });
    expect(await member(t, team.ana)).toMatchObject({ totalGiven: 4, totalReceived: 0 });
    expect(await member(t, team.ben)).toMatchObject({ totalReceived: 2 });
  });

  test("keeps a per-day rollup for the giver and every receiver", async () => {
    await message("UANA", "<@UBEN> :taco:");
    await message("UANA", "<@UBEN> :taco:");
    const days = await all(t, "memberDays");
    expect(days.find((d) => d.memberId === team.ana)).toMatchObject({ given: 2, received: 0, maxed: false });
    expect(days.find((d) => d.memberId === team.ben)).toMatchObject({ given: 0, received: 2 });
  });

  test("the giver and each receiver get a rarity-rolled bot message and a discovery", async () => {
    await message("UANA", "<@UBEN> :taco:");
    const notes = await all(t, "notifications");
    expect(notes.map((n) => [n.memberId, n.category, n.delivery])).toEqual([
      [team.ana, "giver_success", "pending"],
      [team.ben, "receiver_success", "pending"],
    ]);
    expect(notes[0].slackText).not.toMatch(/\{\w+\}/);
    expect(notes[0].webText).not.toContain("<@");
    const discoveries = await all(t, "discoveries");
    expect(discoveries).toHaveLength(2);
    expect(discoveries.every((d) => d.timesSeen === 1)).toBe(true);
  });

  test("more than the remaining allowance gives nothing and explains why", async () => {
    await message("UANA", "<@UBEN> :taco::taco::taco:");
    const result = await message("UANA", "<@UBEN> <@UCLEO> :taco:"); // needs 2, has 2 → ok
    expect(result?.status).toBe("given");
    const rejected = await message("UANA", "<@UBEN> :taco:");
    expect(rejected?.status).toBe("limit");
    expect(await member(t, team.ana)).toMatchObject({ totalGiven: 5 });
    const last = (await all(t, "notifications")).at(-1)!;
    expect(last).toMatchObject({ memberId: team.ana, category: "limit_reached" });
  });

  test("using the whole allowance counts as a maxed day", async () => {
    await message("UANA", "<@UBEN> :taco::taco::taco::taco::taco:");
    expect(await member(t, team.ana)).toMatchObject({ totalMaxedDays: 1 });
    expect((await all(t, "memberDays")).find((d) => d.memberId === team.ana)?.maxed).toBe(true);
  });

  test("the allowance resets at midnight in the workspace timezone", async () => {
    await message("UANA", "<@UBEN> :taco::taco::taco::taco::taco:");
    vi.setSystemTime(new Date("2026-09-23T21:59:00Z")); // 23:59 in Berlin
    expect((await message("UANA", "<@UBEN> :taco:"))?.status).toBe("limit");
    vi.setSystemTime(new Date("2026-09-23T22:01:00Z")); // 00:01 in Berlin
    expect((await message("UANA", "<@UBEN> :taco:"))?.status).toBe("given");
  });

  test("you can't give kudos to yourself", async () => {
    const result = await message("UANA", "<@UANA> :taco:");
    expect(result?.status).toBe("self");
    expect(await all(t, "kudos")).toHaveLength(0);
    expect((await all(t, "notifications"))[0].category).toBe("self_kudos");
  });

  test("mentioning yourself alongside others only rewards the others", async () => {
    await message("UANA", "<@UANA> <@UBEN> :taco:");
    expect((await all(t, "kudos")).map((k) => k.receiverId)).toEqual([team.ben]);
  });

  test("bots never receive kudos", async () => {
    const result = await message("UANA", "<@UBOT> :taco:");
    expect(result?.status).toBe("invalid"); // an invalid attempt: ❌ and guidance for the giver
    expect(await all(t, "kudos")).toHaveLength(0);
  });

  test("messages without the configured emoji are ignored", async () => {
    expect(await message("UANA", "<@UBEN> :pizza: thanks")).toBeNull();
  });

  test("the configured emoji is respected", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { emojiName: "star" }));
    expect(await message("UANA", "<@UBEN> :taco:")).toBeNull();
    expect((await message("UANA", "<@UBEN> :star:"))?.status).toBe("given");
  });

  test("a redelivered message is only counted once", async () => {
    await message("UANA", "<@UBEN> :taco:", "42.0001");
    expect(await message("UANA", "<@UBEN> :taco:", "42.0001")).toBeNull();
    expect(await all(t, "kudos")).toHaveLength(1);
  });

  test("unknown Slack users are added as members on first mention", async () => {
    await message("UANA", "<@UNEW> :taco:");
    const newcomer = await t.run((ctx) =>
      ctx.db
        .query("members")
        .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", team.workspaceId).eq("slackUserId", "UNEW"))
        .unique(),
    );
    expect(newcomer).toMatchObject({ totalReceived: 1, isBot: false });
  });
});

describe("giving kudos with a reaction", () => {
  const react = (reactor: string, author: string, messageTs = "77.0001") =>
    t.mutation(internal.kudos.ingestReaction, {
      workspaceId: team.workspaceId,
      botUserId: "UBOT",
      reactorSlackId: reactor,
      authorSlackId: author,
      channelId: "CGENERAL",
      channelName: "general",
      messageTs,
      messageText: "<@UANA> shipped it",
    });

  test("gives the message author one kudos", async () => {
    expect((await react("UANA", "UBEN"))?.status).toBe("given");
    const [k] = await all(t, "kudos");
    expect(k).toMatchObject({ receiverId: team.ben, amount: 1, source: "reaction", text: "Reacted with :taco: to “@Ana shipped it”" });
  });

  test("only counts once per person and message", async () => {
    await react("UANA", "UBEN");
    expect(await react("UANA", "UBEN")).toBeNull();
    expect((await react("UCLEO", "UBEN"))?.status).toBe("given");
    expect(await all(t, "kudos")).toHaveLength(2);
  });

  test("does nothing when reactions are switched off", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { reactionsEnabled: false }));
    expect(await react("UANA", "UBEN")).toBeNull();
  });
});

describe("redelivered messages that others reacted to", () => {
  const react = (reactor: string, author: string, messageTs: string) =>
    t.mutation(internal.kudos.ingestReaction, {
      workspaceId: team.workspaceId,
      botUserId: "UBOT",
      reactorSlackId: reactor,
      authorSlackId: author,
      channelId: "CGENERAL",
      channelName: "general",
      messageTs,
    });
  const messageGives = async () => (await all(t, "kudos")).filter((k) => k.source === "message");

  test("a reaction that lands before the kudos message does not let a redelivery give again", async () => {
    // Slack delivered Cleo's reaction first, the kudos message after it, then retried the message.
    expect((await react("UCLEO", "UANA", "42.0001"))?.status).toBe("given");
    expect((await message("UANA", "<@UBEN> :taco:", "42.0001"))?.status).toBe("given");
    expect(await message("UANA", "<@UBEN> :taco:", "42.0001")).toBeNull();

    expect(await messageGives()).toHaveLength(1);
    expect(await member(t, team.ana)).toMatchObject({ totalGiven: 1, totalReceived: 1 });
    expect(await member(t, team.ben)).toMatchObject({ totalReceived: 1 });
  });

  test("a redelivery after midnight gives nothing and the rollups stay exact", async () => {
    // Ben's reaction was processed first, then Ana's kudos message, then Slack redelivered it the next day.
    await react("UBEN", "UANA", "42.0001");
    expect((await message("UANA", "<@UBEN> <@UCLEO> :taco:", "42.0001"))?.status).toBe("given");
    vi.setSystemTime(new Date("2026-09-24T10:00:00Z"));
    expect(await message("UANA", "<@UBEN> <@UCLEO> :taco:", "42.0001")).toBeNull();

    expect((await messageGives()).map((k) => [k.receiverId, k.amount, k.dayKey])).toEqual([
      [team.ben, 1, "2026-09-23"],
      [team.cleo, 1, "2026-09-23"],
    ]);
    expect(await member(t, team.cleo)).toMatchObject({ totalReceived: 1 });
    // Live maintenance and a rebuild from the kudos rows must both agree with the legacy computation.
    const buckets = ["d:2026-09-23", "d:2026-09-24", "w:2026-W39", "m:2026-09", "q:2026-Q3", "y:2026"];
    const verify = () => t.query(internal.rollups.verify, { workspaceId: team.workspaceId, buckets });
    // `verify` can't sample the all-time bucket, so check its live row, then the rebuilt one.
    const allTime = async () => {
      const rows = await t.run((ctx) => ctx.db.query("workspaceStats").collect());
      const { given, messages } = rows.find((w) => w.bucket === "all")!;
      return { given, messages };
    };
    // Ben's reaction and Ana's message: two messages, three kudos.
    expect(await verify()).toEqual({ checked: buckets, mismatches: [] });
    expect(await allTime()).toEqual({ given: 3, messages: 2 });
    await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    expect(await verify()).toEqual({ checked: buckets, mismatches: [] });
    expect(await allTime()).toEqual({ given: 3, messages: 2 });
  });

  test("a giver who wasn't a member yet is still only counted once", async () => {
    expect((await message("UNEW", "<@UBEN> :taco:", "42.0001"))?.status).toBe("given");
    expect(await message("UNEW", "<@UBEN> :taco:", "42.0001")).toBeNull();
    expect(await messageGives()).toHaveLength(1);
  });

  test("reactions to a kudos message still count once per person", async () => {
    await message("UANA", "<@UBEN> :taco:", "42.0001");
    expect((await react("UCLEO", "UANA", "42.0001"))?.status).toBe("given");
    expect(await react("UCLEO", "UANA", "42.0001")).toBeNull();
    expect((await react("UBEN", "UANA", "42.0001"))?.status).toBe("given");
    expect((await all(t, "kudos")).map((k) => [k.source, k.giverId])).toEqual([
      ["message", team.ana],
      ["reaction", team.cleo],
      ["reaction", team.ben],
    ]);
  });
});

describe("revoking kudos", () => {
  test("restores totals, rollups, allowance and maxed days", async () => {
    await message("UANA", "<@UBEN> :taco::taco::taco::taco::taco:");
    const admin = await signInAs(t, team.ana);
    const [k] = await all(t, "kudos");
    await admin.mutation(api.admin.revoke, { kudosId: k._id });

    expect(await all(t, "kudos")).toHaveLength(0);
    expect(await all(t, "memberDays")).toHaveLength(0);
    expect(await member(t, team.ana)).toMatchObject({ totalGiven: 0, totalMaxedDays: 0 });
    expect(await member(t, team.ben)).toMatchObject({ totalReceived: 0 });
    expect((await message("UANA", "<@UBEN> :taco::taco::taco::taco::taco:"))?.status).toBe("given");
  });
});
