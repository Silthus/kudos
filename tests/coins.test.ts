import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { all, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/** Hog coins (#55 §G2, G4): the ledger rides the game's per-batch events; the wallet opens at level 3. */

let t: ReturnType<typeof setupConvex>;
let team: Team & { dan: Id<"members">; eve: Id<"members"> };

const DAY = 24 * 3_600_000;
const STORY = "thanks for staying late to fix the release pipeline, it saved our whole demo today"; // 12+ words

beforeEach(async () => {
  t = setupConvex();
  const base = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
  const extra = (slackUserId: string, name: string) =>
    t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: base.workspaceId, slackUserId, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
    );
  team = { ...base, dan: await extra("UDAN", "Dan"), eve: await extra("UEVE", "Eve") };
});
afterEach(() => vi.useRealTimers());

let ts = 1000;
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

async function wallet(memberId: Id<"members">) {
  const as = await signInAs(t, memberId);
  return (await as.query(api.game.mine, {})).wallet;
}

/** Ana thanks four new people with a story on two days: 50 + 37 XP, level 3, 8 coins from kudos. */
async function anaReachesLevel3() {
  await message("UANA", `<@UBEN> <@UCLEO> <@UDAN> <@UEVE> :taco: ${STORY}`);
  expect(await player(team.ana)).toMatchObject({ level: 2 });
  vi.setSystemTime(Date.now() + DAY);
  await message("UANA", `<@UBEN> <@UCLEO> <@UDAN> <@UEVE> :taco: ${STORY}`);
  expect(await player(team.ana)).toMatchObject({ level: 3 });
}

describe("earning Hog coins", () => {
  test("a thoughtful kudos earns its giver 1 coin per kudos given; receiving never earns coins", async () => {
    await message("UBEN", "<@UCLEO> :taco:"); // Ben is a player now, without coins
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    expect(await player(team.ana)).toMatchObject({ coins: 2 });
    expect(await player(team.ben)).toMatchObject({ coins: 0, xp: 2 + 5 }); // his thin kudos, and receiving XP only
  });

  test("a kudos without a reason and a thank-back earn no coins", async () => {
    await message("UBEN", "<@UANA> :taco: thanks for pairing with me");
    await message("UANA", "<@UBEN> :taco: thank you right back Ben"); // within 72 h: a thank-back
    await message("UCLEO", "<@UBEN> :taco:");
    expect(await player(team.ben)).toMatchObject({ coins: 1 });
    expect(await player(team.ana)).toMatchObject({ coins: 0 });
    expect(await player(team.cleo)).toMatchObject({ coins: 0 });
  });

  test("coins aren't cut by XP decay or the daily XP cap: the allowance is the cap", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await message("UANA", "<@UBEN> :taco: and for the docs you wrote");
    await message("UANA", "<@UBEN> :taco::taco::taco: and for the pairing too"); // 0 XP: the third today
    expect(await player(team.ana)).toMatchObject({ xp: 20 + 2 + 0, coins: 5 });
  });

  test("nothing is earned while the game is off", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    expect(await all(t, "players")).toHaveLength(0);
  });
});

describe("the wallet", () => {
  test("stays hidden below level 3, then appears with everything collected silently so far", async () => {
    await message("UANA", `<@UBEN> <@UCLEO> <@UDAN> <@UEVE> :taco: ${STORY}`);
    expect(await player(team.ana)).toMatchObject({ level: 2, coins: 4 });
    expect(await wallet(team.ana)).toBeNull(); // not even the amount leaves the server
    vi.setSystemTime(Date.now() + DAY);
    await message("UANA", `<@UBEN> <@UCLEO> <@UDAN> <@UEVE> :taco: ${STORY}`);
    expect(await wallet(team.ana)).toEqual({ balance: 8 + 20, fromKudos: 8, fromFruit: 0, fromQuests: 0, fromLevels: 20, spent: 0, adjusted: 0 });
  });

  test("is part of the game: nothing while the game is hidden", async () => {
    await anaReachesLevel3();
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.game.setHidden, { hidden: true });
    expect((await ana.query(api.game.mine, {})).wallet).toBeNull();
  });
});

describe("/kudos coins", () => {
  const command = async (text: string, slackUserId = "UANA") =>
    await t.mutation(internal.slackData.slashCommand, { teamId: "T1", slackUserId, text });

  test("a balance of one is one coin", async () => {
    await anaReachesLevel3();
    await t.run((ctx) => ctx.db.patch(team.ana, { coinsSpent: 27 }));
    expect((await command("coins")).text).toBe("You have 1 Hog coin.");
  });

  test("shows your wallet once it's open: the balance and where it came from", async () => {
    await anaReachesLevel3();
    const reply = await command("coins");
    expect(reply.response_type).toBe("ephemeral");
    const text = JSON.stringify(reply.blocks);
    expect(text).toContain("*Balance*\\n28 Hog coins");
    expect(text).toContain("*From thoughtful kudos*\\n8");
    expect(text).toContain("*From level-ups*\\n20");
  });

  test("below level 3 says when the wallet opens, without the amount collected", async () => {
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    const reply = await command("coins");
    expect(reply.text).toBe("Your Hog coin wallet opens at level 3. Thoughtful kudos are already collecting coins for it.");
    expect(JSON.stringify(reply)).not.toMatch(/\b2\b/);
  });

  test("says when the game is off or hidden, and the help lists the command only while the game is shown to you", async () => {
    expect((await command("help")).text).toContain("`/kudos coins` your Hog coins");
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    expect((await command("coins")).text).toBe("You've hidden the game. Show it again on your Me page to see your Hog coins.");
    expect((await command("help")).text).not.toContain("/kudos coins");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect((await command("coins")).text).toBe("The game isn't on in this workspace.");
    expect((await command("help")).text).not.toContain("/kudos coins");
  });

  test("a negative balance after a revoke says spending waits", async () => {
    await anaReachesLevel3();
    await t.run((ctx) => ctx.db.patch(team.ana, { coinsSpent: 30 }));
    expect(JSON.stringify((await command("coins")).blocks)).toContain("Spending waits until your balance is above zero again");
  });
});

describe("revoking", () => {
  test("takes back exactly the coins its kudos earned; level-up coins stay with the level", async () => {
    await anaReachesLevel3();
    const toBen = (await all(t, "kudos")).find((k) => k.giverId === team.ana && k.receiverId === team.ben)!;
    const admin = await signInAs(t, team.ana);
    await admin.mutation(api.admin.revoke, { kudosId: toBen._id });
    expect(await player(team.ana)).toMatchObject({ coins: 7, level: 3 });
    expect(await wallet(team.ana)).toMatchObject({ balance: 7 + 20 });
  });

  test("the repair check compares stored coins with the ledger's events", async () => {
    await anaReachesLevel3();
    expect(await t.query(internal.game.verifyMember, { memberId: team.ana })).toMatchObject({ coins: 8, eventCoins: 8 });
  });

  test("can take the balance below zero after coins were spent", async () => {
    await anaReachesLevel3();
    await t.run((ctx) => ctx.db.patch(team.ana, { coinsSpent: 28 })); // what the Store (#91) records
    expect(await wallet(team.ana)).toMatchObject({ balance: 0 });
    const toBen = (await all(t, "kudos")).find((k) => k.giverId === team.ana && k.receiverId === team.ben)!;
    const admin = await signInAs(t, team.ana);
    await admin.mutation(api.admin.revoke, { kudosId: toBen._id });
    expect(await wallet(team.ana)).toMatchObject({ balance: -1, spent: 28 });
  });
});
