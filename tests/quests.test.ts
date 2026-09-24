import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { RECIPROCAL_WINDOW_MS, type QuestKey } from "../convex/lib/quests";
import { all, DEMO_TIMEOUT, NOW, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** NOW (Wed 2026-09-23) falls in the quest week starting Monday 2026-09-21. */
const WEEK = "2026-09-21";
const H = 3_600_000;

let ts = 1000;
const message = (giver: string, text: string, channel = "general", messageTs = `${ts++}.0001`) =>
  t.mutation(internal.kudos.ingestMessage, {
    workspaceId: team.workspaceId,
    botUserId: "UBOT",
    giverSlackId: giver,
    text,
    channelId: `C${channel.toUpperCase()}`,
    channelName: channel,
    messageTs,
  });

const react = (reactor: string, author: string) =>
  t.mutation(internal.kudos.ingestReaction, {
    workspaceId: team.workspaceId,
    botUserId: "UBOT",
    reactorSlackId: reactor,
    authorSlackId: author,
    channelId: "CGENERAL",
    channelName: "general",
    messageTs: `${ts++}.0002`,
    messageText: "shipped the thing everyone wanted",
  });

/** Pins this week's board so a test doesn't depend on the seeded draw. */
const setBoard = (questKeys: QuestKey[], weekKey = WEEK) =>
  t.run((ctx) => ctx.db.insert("questBoards", { workspaceId: team.workspaceId, weekKey, questKeys }));

const completions = async (memberId: Id<"members">) =>
  (await all(t, "questCompletions")).filter((c) => c.memberId === memberId);

async function mine(memberId: Id<"members">, today = "2026-09-23") {
  const res = await (await signInAs(t, memberId)).query(api.quests.mine, { today });
  if (!res.enabled) throw new Error("quests are disabled");
  return res;
}
const status = async (memberId: Id<"members">) =>
  Object.fromEntries((await mine(memberId)).quests.map((q) => [q.key, [q.status, q.progress]]));

describe("kudos carry the words of their Note", () => {
  test("messages store noteWords; reactions don't", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    await react("UANA", "UCLEO");
    const kudos = await all(t, "kudos");
    expect(kudos.map((k) => [k.source, k.noteWords])).toEqual([
      ["message", 5],
      ["reaction", undefined],
    ]);
  });
});

describe("a qualifying kudos in Slack", () => {
  test("stores this week's board and completes New connection once", async () => {
    await setBoard(["fresh", "spread", "channels"]);
    const text = "<@UBEN> :taco: thanks for the quick review";
    await message("UANA", text, "general", "111.0001");
    await message("UANA", text, "general", "111.0001"); // Slack re-delivers the same message

    const done = await completions(team.ana);
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ weekKey: WEEK, questKey: "fresh", sweep: false, completedAt: Date.now() });
    const board = await mine(team.ana);
    expect(board).toMatchObject({ weekKey: WEEK, weekStart: WEEK, weekEnd: "2026-09-27", completed: 1, available: 2, sweep: false });
    expect(board.resetsAt).toBe(Date.UTC(2026, 8, 27, 22)); // Monday 00:00 in Berlin
    expect(board.quests.find((q) => q.key === "fresh")).toMatchObject({ status: "done", progress: 1, goal: 1, completedAt: Date.now() });
    // Only Ben and Cleo are Ana's teammates, so Spread the love can't be done this week.
    expect(board.quests.find((q) => q.key === "spread")).toMatchObject({ status: "waived", waivedReason: "no_candidates" });
  });

  test("the first qualifying kudos of the week stores the seeded board", async () => {
    const before = await mine(team.ana);
    await react("UANA", "UCLEO");
    await message("UANA", "<@UCLEO> :taco: thanks!");
    expect(await all(t, "questBoards")).toHaveLength(0); // no Note: nothing to check, nothing stored
    await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    const boards = await all(t, "questBoards");
    expect(boards.map((b) => [b.weekKey, b.questKeys])).toEqual([[WEEK, before.quests.map((q) => q.key)]]);
  });

  test("clearing every quest that isn't waived is a clean sweep", async () => {
    await setBoard(["fresh", "spread", "channels"]);
    await message("UANA", "<@UBEN> :taco: thanks for the quick review", "general");
    await message("UANA", "<@UCLEO> :taco: loved your demo this morning", "random");
    const done = await completions(team.ana);
    expect(done.map((c) => [c.questKey, c.sweep])).toEqual([
      ["fresh", false],
      ["channels", true],
    ]);
    expect(await mine(team.ana)).toMatchObject({ completed: 2, available: 2, sweep: true });
  });

});

describe("a completed quest rewards a Quest message", () => {
  beforeEach(() => setBoard(["fresh", "spread", "channels"]));
  const questMessages = async () => (await all(t, "notifications")).filter((n) => n.category === "quest_complete");

  test("rolls a collectible from the quest-only category, DMs it and links it to the completion", async () => {
    const res = await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    const [note] = await questMessages();
    expect(note).toMatchObject({ memberId: team.ana, delivery: "pending", isNewDiscovery: true });
    expect(note.templateKey).toMatch(/^quest\./);
    expect(note.webText).toContain("New connection");
    expect(note.webText).not.toMatch(/\{\w+\}/); // every placeholder is filled
    // Delivered after the giver's and the receiver's messages.
    expect(res?.notificationIds.at(-1)).toBe(note._id);
    expect((await completions(team.ana))[0].notificationId).toBe(note._id);
    const found = (await all(t, "discoveries")).find((d) => d.templateKey === note.templateKey);
    expect(found).toMatchObject({ memberId: team.ana, category: "quest_complete" });
  });

  test("carries the week's progress for the DM", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the quick review", "general");
    await message("UANA", "<@UCLEO> :taco: loved your demo this morning", "random");
    expect((await questMessages()).map((n) => n.questProgress)).toEqual([
      { completed: 1, available: 2, sweep: false },
      { completed: 2, available: 2, sweep: true },
    ]);
  });

  test("the completion that clears the board rolls at least Rare", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // every roll would be Common
    await message("UANA", "<@UBEN> :taco: thanks for the quick review", "general");
    await message("UANA", "<@UCLEO> :taco: loved your demo this morning", "random");
    expect((await questMessages()).map((n) => n.rarity)).toEqual(["common", "rare"]);
  });

  test("two quests met by one message get one message each, the last one clearing the board", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    await t.run(async (ctx) => {
      const board = (await ctx.db.query("questBoards").first())!;
      await ctx.db.patch(board._id, { questKeys: ["fresh", "channels", "story"] });
    });
    // New connection; Channel hopper and Say why at 1 of 2 each.
    await message("UANA", "<@UBEN> :taco: thanks for untangling the deploy pipeline on friday, saved my whole afternoon", "random");
    // One message finishes both Channel hopper and Say why.
    await message("UANA", "<@UCLEO> :taco: your onboarding checklist turned my first week into a genuinely calm one", "general");
    const notes = await questMessages();
    expect(notes.map((n) => [n.questProgress, n.rarity])).toEqual([
      [{ completed: 1, available: 3, sweep: false }, "common"],
      [{ completed: 2, available: 3, sweep: false }, "common"],
      [{ completed: 3, available: 3, sweep: true }, "rare"],
    ]);
    const sweep = (await completions(team.ana)).find((c) => c.sweep)!;
    expect(sweep.notificationId).toBe(notes[2]._id);
  });

  test("a re-delivered message doesn't reward twice", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the quick review", "general", "222.0001");
    await message("UANA", "<@UBEN> :taco: thanks for the quick review", "general", "222.0001");
    expect(await questMessages()).toHaveLength(1);
  });

  test("with giver DMs off, the message is collected but not sent", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyGiver: false }));
    const res = await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    const [note] = await questMessages();
    expect(note.delivery).toBe("skipped");
    expect(res?.notificationIds).not.toContain(note._id);
    expect((await completions(team.ana))[0].notificationId).toBe(note._id);
    expect((await all(t, "discoveries")).some((d) => d.category === "quest_complete")).toBe(true);
  });

  test("with giver DMs off, a clean sweep still rolls at least Rare", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyGiver: false }));
    await message("UANA", "<@UBEN> :taco: thanks for the quick review", "general");
    await message("UANA", "<@UCLEO> :taco: loved your demo this morning", "random");
    expect((await questMessages()).map((n) => [n.rarity, n.delivery, n.questProgress?.sweep])).toEqual([
      ["common", "skipped", false],
      ["rare", "skipped", true],
    ]);
  });

  test("a quest hidden by privacy doesn't count towards the week's progress", async () => {
    await t.run(async (ctx) => {
      const board = (await ctx.db.query("questBoards").first())!;
      await ctx.db.patch(board._id, { questKeys: ["unsung", "channels", "story"] }); // received counts are hidden
    });
    await message("UANA", "<@UBEN> :taco: thanks for untangling the deploy pipeline on friday, saved my whole afternoon", "general");
    await message("UANA", "<@UCLEO> :taco: your onboarding checklist turned my first week into a genuinely calm one", "random");
    expect((await questMessages()).map((n) => n.questProgress)).toEqual([
      { completed: 1, available: 2, sweep: false },
      { completed: 2, available: 2, sweep: true },
    ]);
  });

  test("Quest message discoveries count once each in the workspace's collection stats", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the quick review", "general");
    await message("UANA", "<@UCLEO> :taco: loved your demo this morning", "random");
    const byRarity = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    for (const d of await all(t, "discoveries")) byRarity[d.rarity]++;
    expect((await all(t, "discoveries")).filter((d) => d.category === "quest_complete")).toHaveLength(2);
    const stats = await t.run((ctx) => ctx.db.query("workspaceStats").filter((q) => q.eq(q.field("bucket"), "all")).first());
    expect(stats?.found).toEqual(byRarity);
  });

  test("the board shows the rarity of each done quest's message", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    const [note] = await questMessages();
    const quests = (await mine(team.ana)).quests;
    expect(quests.map((q) => [q.key, q.messageRarity])).toEqual([
      ["fresh", note.rarity],
      ["spread", null],
      ["channels", null],
    ]);
  });

  test("revoking the kudos removes the completion but the member keeps the message", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    const [row] = await all(t, "kudos");
    await (await signInAs(t, team.ana)).mutation(api.admin.revoke, { kudosId: row._id });
    expect(await completions(team.ana)).toHaveLength(0);
    expect(await questMessages()).toHaveLength(1);
    expect((await all(t, "discoveries")).some((d) => d.category === "quest_complete")).toBe(true);
  });
});

describe("only thoughtful giving counts", () => {
  beforeEach(() => setBoard(["fresh", "spread", "channels"]));

  test("a reaction or a message without a Note moves nothing", async () => {
    await react("UANA", "UBEN");
    await message("UANA", "<@UBEN> :taco: thanks!", "random");
    expect(await completions(team.ana)).toHaveLength(0);
    expect(await status(team.ana)).toMatchObject({ fresh: ["active", 0], channels: ["active", 0] });
  });

  test("thanking someone back within 72 hours doesn't count", async () => {
    await message("UBEN", "<@UANA> :taco: thanks for pairing on the flaky test");
    vi.advanceTimersByTime(24 * H);
    await message("UANA", "<@UBEN> :taco: right back at you, great session");
    expect(await status(team.ana)).toMatchObject({ fresh: ["active", 0], channels: ["active", 0] });
    expect(await completions(team.ana)).toHaveLength(0);
    // Ben's kudos to Ana was his first to her, so it counts for him.
    expect((await completions(team.ben)).map((c) => c.questKey)).toEqual(["fresh"]);
  });
});

describe("the clean-sweep flag follows the board", () => {
  const addDan = () =>
    t.run((ctx) =>
      ctx.db.insert("members", {
        workspaceId: team.workspaceId, slackUserId: "UDAN", name: "Dan", isAdmin: false, isBot: false,
        deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0,
      }),
    );

  test("is set when the last open quest becomes waived", async () => {
    const dan = await addDan();
    await setBoard(["fresh", "spread", "channels"]);
    await message("UANA", "<@UBEN> :taco: thanks for the quick review", "general");
    await message("UANA", "<@UCLEO> :taco: loved your demo this morning", "random");
    expect((await completions(team.ana)).some((c) => c.sweep)).toBe(false); // Spread the love is still open

    await t.run((ctx) => ctx.db.patch(dan, { deactivated: true })); // now only 2 teammates
    await message("UANA", "<@UBEN> :taco: and thanks again for the pairing", "general");
    expect(await mine(team.ana)).toMatchObject({ sweep: true });
    expect((await completions(team.ana)).map((c) => [c.questKey, c.sweep])).toEqual([
      ["fresh", false],
      ["channels", true],
    ]);
  });

  test("is cleared when a waived quest opens up again", async () => {
    const dan = await addDan();
    await t.run((ctx) => ctx.db.patch(dan, { deactivated: true }));
    await setBoard(["fresh", "spread", "channels"]);
    await message("UANA", "<@UBEN> :taco: thanks for the quick review", "general");
    await message("UANA", "<@UCLEO> :taco: loved your demo this morning", "random");
    expect((await completions(team.ana)).filter((c) => c.sweep)).toHaveLength(1);

    await t.run((ctx) => ctx.db.patch(dan, { deactivated: false }));
    await message("UANA", "<@UBEN> :taco: and thanks again for the pairing", "general");
    expect(await mine(team.ana)).toMatchObject({ sweep: false });
    expect((await completions(team.ana)).filter((c) => c.sweep)).toHaveLength(0);
  });

  test("a board that reopens and is cleared again is a new clean sweep, with a new Rare-or-better message", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // every roll without a floor is Common
    const dan = await addDan();
    await t.run((ctx) => ctx.db.patch(dan, { deactivated: true })); // Spread the love is waived
    await setBoard(["fresh", "spread", "channels"]);
    await message("UANA", "<@UBEN> :taco: thanks for the quick review", "general");
    await message("UANA", "<@UCLEO> :taco: loved your demo this morning", "random");

    await t.run((ctx) => ctx.db.patch(dan, { deactivated: false })); // Dan is back: the board reopens
    await message("UANA", "<@UDAN> :taco: welcome back, great to have you here", "general");
    expect((await completions(team.ana)).map((c) => [c.questKey, c.sweep])).toEqual([
      ["fresh", false],
      ["channels", false],
      ["spread", true],
    ]);
    const notes = (await all(t, "notifications")).filter((n) => n.category === "quest_complete");
    expect(notes.map((n) => [n.rarity, n.questProgress])).toEqual([
      ["common", { completed: 1, available: 2, sweep: false }],
      ["rare", { completed: 2, available: 2, sweep: true }],
      ["rare", { completed: 3, available: 3, sweep: true }],
    ]);
  });
});

describe("revoking kudos", () => {
  test("re-checks the week and removes completions that are no longer met", async () => {
    await setBoard(["fresh", "spread", "channels"]);
    await message("UANA", "<@UBEN> :taco: thanks for the quick review", "general");
    await message("UANA", "<@UCLEO> :taco: loved your demo this morning", "random");
    const admin = await signInAs(t, team.ana);
    const toCleo = (await all(t, "kudos")).find((k) => k.receiverId === team.cleo)!;

    await admin.mutation(api.admin.revoke, { kudosId: toCleo._id });
    expect((await completions(team.ana)).map((c) => [c.questKey, c.sweep])).toEqual([["fresh", false]]);
    expect(await mine(team.ana)).toMatchObject({ completed: 1, sweep: false });
    // The discovery rolled for the kudos stays in the collection.
    expect((await all(t, "discoveries")).length).toBeGreaterThan(0);
  });

  test("keeps completions that privacy now hides", async () => {
    await setBoard(["unsung", "channels", "story"]);
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "everyone" }));
    await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "hidden" }));
    const [row] = await all(t, "kudos");
    await (await signInAs(t, team.ana)).mutation(api.admin.revoke, { kudosId: row._id });
    expect((await completions(team.ana)).map((c) => c.questKey)).toEqual(["unsung"]);
  });
});

describe("facts come from real kudos history", () => {
  const D = 24 * H;
  /** Monday 2026-09-21 00:00 in Berlin. */
  const WEEK_START = Date.UTC(2026, 8, 20, 22);
  const past = (giverId: Id<"members">, receiverId: Id<"members">, at: number, source: "seed" | "reaction" = "seed") =>
    t.run((ctx) =>
      ctx.db.insert("kudos", {
        workspaceId: team.workspaceId, batchId: `past-${at}-${receiverId}`, giverId, receiverId, amount: 1,
        dayKey: "2026-01-01", source, channelId: "CPAST", text: "", at,
      }),
    );

  test("Old friends: the last kudos to them is 30+ days before, from before the week", async () => {
    await setBoard(["rekindle", "channels", "story"]);
    await past(team.ana, team.cleo, WEEK_START - 100 * D); // Ana's first-ever kudos: old enough
    await past(team.ana, team.ben, WEEK_START - 26 * D); // Ben: recognized 28 days before Wednesday
    await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    expect(await status(team.ana)).toMatchObject({ rekindle: ["active", 0] });
    await past(team.ana, team.cleo, Date.now() - 31 * D);
    await message("UANA", "<@UCLEO> :taco: good to work with you again");
    expect(await status(team.ana)).toMatchObject({ rekindle: ["done", 1] });
  });

  test("Unsung hero: nobody else recognized them in the 14 days before", async () => {
    await setBoard(["unsung", "channels", "story"]);
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "everyone" }));
    await past(team.cleo, team.ben, Date.now() - 13 * D);
    await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    expect(await status(team.ana)).toMatchObject({ unsung: ["active", 0] });
    await past(team.ben, team.cleo, Date.now() - 15 * D);
    await message("UANA", "<@UCLEO> :taco: thanks for the design review");
    expect(await status(team.ana)).toMatchObject({ unsung: ["done", 1] });
  });

  test("New connection: an earlier reaction this week already recognized them", async () => {
    await setBoard(["fresh", "channels", "story"]);
    await react("UANA", "UBEN");
    await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    expect(await status(team.ana)).toMatchObject({ fresh: ["active", 0] });
  });

  test("the week starts at Monday 00:00 in the workspace timezone", async () => {
    await setBoard(["steady", "channels", "story"]);
    await t.run((ctx) =>
      ctx.db.insert("kudos", {
        workspaceId: team.workspaceId, batchId: "monday", giverId: team.ana, receiverId: team.ben, amount: 1,
        dayKey: "2026-09-21", source: "message", channelId: "CMON", text: "", at: WEEK_START, noteWords: 4,
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("kudos", {
        workspaceId: team.workspaceId, batchId: "sunday", giverId: team.ana, receiverId: team.ben, amount: 1,
        dayKey: "2026-09-20", source: "message", channelId: "CSUN", text: "", at: WEEK_START - 1, noteWords: 4,
      }),
    );
    expect(await status(team.ana)).toMatchObject({ steady: ["active", 1], channels: ["active", 1] });
  });

  test("a stray duplicate board row doesn't break giving", async () => {
    await setBoard(["fresh", "spread", "channels"]);
    await setBoard(["story", "steady", "channels"]);
    expect((await message("UANA", "<@UBEN> :taco: thanks for the quick review"))?.status).toBe("given");
  });
});

describe("quest weeks", () => {
  test("a new week gets a new board with no completions", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    const [lastWeek] = await all(t, "questBoards");
    const lastDone = await completions(team.ana);

    // The client's day rolls the board over (Convex caches Date.now() inside queries).
    const next = await mine(team.ana, "2026-09-28");
    expect(next.weekKey).toBe("2026-09-28");
    expect(next.completed).toBe(0);
    expect(next.quests.every((q) => q.status !== "done")).toBe(true);
    // 5 quests are drawable here (no Unsung hero or Old friends yet): both of last week's
    // leftovers are picked before anything repeats.
    expect(next.quests.filter((q) => !lastWeek.questKeys.includes(q.key))).toHaveLength(2);
    // Last week's completions are kept.
    expect(await completions(team.ana)).toEqual(lastDone);
  });

  test("Unsung hero on a stored board is waived once received counts are hidden", async () => {
    await setBoard(["unsung", "channels", "story"]);
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "everyone" }));
    await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    expect(await status(team.ana)).toMatchObject({ unsung: ["done", 1] });

    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "hidden" }));
    const unsung = (await mine(team.ana)).quests.find((q) => q.key === "unsung");
    expect(unsung).toMatchObject({ status: "waived", waivedReason: "privacy", progress: 0 });
  });
});

describe("who can see quests", () => {
  test("signed-out callers are asked to sign in", async () => {
    await expect(t.query(api.quests.mine, { today: "2026-09-23" })).rejects.toThrow(/Sign in with Slack/);
  });

  test("`today` must be a real day key", async () => {
    await expect(mine(team.ana, "2026-02-30")).rejects.toThrow(/day key/);
  });

  test("members only ever see their own board progress", async () => {
    await setBoard(["fresh", "spread", "channels"]);
    await message("UBEN", "<@UANA> :taco: thanks for pairing on the flaky test");
    expect((await completions(team.ben)).map((c) => c.questKey)).toEqual(["fresh"]);
    expect(await mine(team.ana)).toMatchObject({ completed: 0 });
    expect(await status(team.ana)).toMatchObject({ fresh: ["active", 0] });
  });

  test("a member of another workspace sees their own board", async () => {
    const other = await seedTeam(t, {}, "T2");
    await setBoard(["fresh", "spread", "channels"]);
    await message("UANA", "<@UBEN> :taco: thanks for the quick review");
    const theirs = await mine(other.ana);
    expect(theirs.quests.map((q) => q.key)).not.toEqual(["fresh", "spread", "channels"]);
    expect(theirs).toMatchObject({ completed: 0, sweep: false });
  });
});

test("the dashboard overview no longer computes quests", async () => {
  const overview = await (await signInAs(t, team.ana)).query(api.me.overview, { period: "month", today: "2026-09-23" });
  expect(overview).not.toHaveProperty("quests");
});

describe("quests in the demo", () => {
  async function enterDemo() {
    const userId = await t.mutation(internal.demo.ensureDemoUser, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000); // seeding, then the rollup rebuild
    return t.withIdentity({ subject: `${userId}|s` });
  }
  const demoCompletions = async () => {
    const alex = await t.run((ctx) => ctx.db.query("members").filter((q) => q.eq(q.field("slackUserId"), "UDEMOYOU")).unique());
    return (await all(t, "questCompletions")).filter((c) => c.memberId === alex!._id);
  };

  test("a playground message with a Note completes quests; refilling the allowance takes them back", async () => {
    const demo = await enterDemo();
    const workspaceId = (await t.run((ctx) => ctx.db.query("workspaces").filter((q) => q.eq(q.field("isDemo"), true)).first()))!._id;
    await t.run((ctx) => ctx.db.insert("questBoards", { workspaceId, weekKey: WEEK, questKeys: ["spread", "channels", "story"] }));
    // Thanking back someone who just recognized you doesn't count, so pick two teammates the seeded
    // history hasn't had recognize Alex in the last 72 hours.
    const [first, second] = await t.run(async (ctx) => {
      const members = await ctx.db.query("members").filter((q) => q.eq(q.field("workspaceId"), workspaceId)).collect();
      const alex = members.find((m) => m.slackUserId === "UDEMOYOU")!;
      const recent = (await ctx.db.query("kudos").collect()).filter((k) => k.receiverId === alex._id && k.at >= NOW.getTime() - RECIPROCAL_WINDOW_MS);
      return members
        .filter((m) => m._id !== alex._id && m.slackUserId !== "UDEMOJONAS" && !recent.some((k) => k.giverId === m._id))
        .map((m) => m.slackUserId);
    });
    const res = await demo.mutation(api.demo.simulateMessage, {
      text: `<@${first}> :taco: thanks for untangling the deploy pipeline on friday, saved my whole afternoon`,
      channelName: "general",
    });
    expect(res.status).toBe("given");
    expect((await all(t, "kudos")).find((k) => k.source === "playground")?.noteWords).toBe(12);
    await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOJONAS> :taco:", channelName: "design" });
    expect((await all(t, "kudos")).find((k) => k.source === "playground" && k.channelName === "design")?.noteWords).toBe(0);
    const last = await demo.mutation(api.demo.simulateMessage, {
      text: `<@${second}> :taco: your onboarding checklist turned my first week into a genuinely calm one`,
      channelName: "design",
    });
    // The playground previews the Quest message DMs, with the week's progress.
    expect(last.messages.filter((m) => m.category === "quest_complete").map((m) => [m.toMe, m.questProgress])).toEqual([
      [true, { completed: 1, available: 3, sweep: false }],
      [true, { completed: 2, available: 3, sweep: false }],
    ]);
    expect((await demoCompletions()).map((c) => c.questKey).sort()).toEqual(["channels", "story"]);
    const board = await demo.query(api.quests.mine, { today: "2026-09-23" });
    expect(board).toMatchObject({ completed: 2 });

    await demo.mutation(api.demo.refillAllowance, {});
    expect(await demoCompletions()).toHaveLength(0);
  }, DEMO_TIMEOUT);

  test("resetting the demo clears quest boards and completions", async () => {
    const demo = await enterDemo();
    await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> :taco: great work on the release notes", channelName: "general" });
    expect(await all(t, "questBoards")).not.toHaveLength(0);
    await demo.mutation(api.demo.resetDemo, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000); // seeding, then the rollup rebuild
    expect(await all(t, "questBoards")).toHaveLength(0);
    expect(await all(t, "questCompletions")).toHaveLength(0);
  }, DEMO_TIMEOUT); // a reset re-seeds the year and rebuilds its rollups
});

describe("the Quest message DM in Slack", () => {
  type SlackCall = { method: string; params: Record<string, string> };
  let calls: SlackCall[];
  beforeEach(async () => {
    calls = [];
    vi.stubEnv("SITE_URL", "https://kudos.example");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ method: String(url).split("/api/")[1], params: Object.fromEntries(new URLSearchParams(String(init?.body ?? ""))) });
        return Response.json({ ok: true, channel: { name: "general" } });
      }),
    );
    await setBoard(["fresh", "spread", "channels"]);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const post = (text: string, channel: string) =>
    t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "message", user: "UANA", text, channel, ts: `${ts++}.0003` } });
  /** Context lines of the Quest message DMs Ana got, in order. */
  const questDms = async () => {
    const texts = new Set((await all(t, "notifications")).filter((n) => n.category === "quest_complete").map((n) => n.slackText));
    return calls
      .filter((c) => c.method === "chat.postMessage" && c.params.channel === "UANA" && texts.has(c.params.text))
      .map((c) => JSON.parse(c.params.blocks).at(-1).elements[0].text as string);
  };

  test("says how far the week is and links the quest log; the board-clearing one says so", async () => {
    await post("<@UBEN> :taco: thanks for the quick review", "CGENERAL");
    const [first] = await questDms();
    expect(first).toContain("✨ New discovery! (");
    expect(first).toContain("1 of 2 quests this week");
    expect(first).toContain("<https://kudos.example/quests|Quest log>");
    expect(first).not.toContain("Clean sweep");
    expect(first).not.toContain("Message gallery");

    await post("<@UCLEO> :taco: loved your demo this morning", "CRANDOM");
    const [, second] = await questDms();
    expect(second).toContain("2 of 2 quests this week  ·  🧹 Clean sweep!");
    // Sent after the giver's own "kudos delivered" DM.
    const dms = calls.filter((c) => c.method === "chat.postMessage" && c.params.channel === "UANA");
    expect(dms.at(-1)!.params.blocks).toContain("Clean sweep");
  });

  test("each DM counts the collection as it stood when that message was found", async () => {
    await post("<@UBEN> :taco: thanks for the quick review", "CGENERAL");
    const contexts = calls
      .filter((c) => c.method === "chat.postMessage" && c.params.channel === "UANA")
      .map((c) => JSON.parse(c.params.blocks).at(-1).elements[0].text as string);
    // Ana's first ever bot message, then her first Quest message.
    expect(contexts.map((c) => c.match(/\((\d+) collected\)/)?.[1])).toEqual(["1", "2"]);
  });
});
