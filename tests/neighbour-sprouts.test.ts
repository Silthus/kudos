import { beforeEach, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * The neighbours' sprouts (#134): a teammate's bed on the map gets a tiny sprout on a day they gave
 * a thoughtful kudos (a qualifying line in their give event, the game's own rule). Asked for the
 * teammates already in your ring, so it reads a few game events each, never the ring again; and only
 * about teammates you've exchanged kudos with (the ring's own people), never anyone else.
 */

const TODAY = "2026-09-25";
let t: ReturnType<typeof setupConvex>;
let team: Team & Record<"dan" | "fay" | "gus", Id<"members">>;

beforeEach(async () => {
  t = setupConvex();
  const base = await seedTeam(t, { gameEnabled: true });
  const extra = (slackUserId: string, name: string, more: Partial<Doc<"members">> = {}) =>
    t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: base.workspaceId, slackUserId, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0, ...more }),
    );
  team = { ...base, dan: await extra("UDAN", "Dan"), fay: await extra("UFAY", "Fay", { gameHidden: true }), gus: await extra("UGUS", "Gus", { deactivated: true }) };
});

async function gave(memberId: Id<"members">, dayKey: string, qualifying: boolean, workspaceId = team.workspaceId) {
  await t.run(async (ctx) => {
    const kudosId = await ctx.db.insert("kudos", {
      workspaceId,
      batchId: `b-${memberId}-${dayKey}-${qualifying}`,
      giverId: memberId,
      receiverId: team.ana,
      amount: 1,
      dayKey,
      source: "message",
      channelId: "C1",
      text: "thanks",
      at: 1,
    });
    await ctx.db.insert("gameEvents", {
      workspaceId,
      memberId,
      kind: "give",
      batchId: `b-${memberId}-${dayKey}-${qualifying}`,
      dayKey,
      at: 1,
      xp: qualifying ? 10 : 2,
      lines: [{ kudosId, receiverId: team.ana, qualifying, xp: qualifying ? 10 : 2, items: [] }],
    });
  });
}
/** Kudos between the two, either way: what puts a teammate in your ring. */
async function exchanged(a: Id<"members">, b: Id<"members">, workspaceId = team.workspaceId) {
  await t.run((ctx) => ctx.db.insert("pairStats", { workspaceId, bucket: "all", giverId: a, receiverId: b, amount: 3 }));
}
async function received(memberId: Id<"members">, dayKey: string) {
  await t.run((ctx) => ctx.db.insert("gameEvents", { workspaceId: team.workspaceId, memberId, kind: "receive", batchId: `r-${memberId}`, dayKey, at: 1, xp: 5 }));
}

test("the teammates who gave a thoughtful kudos today, and only them", async () => {
  for (const m of [team.ben, team.cleo, team.dan]) await exchanged(team.ana, m);
  await gave(team.ben, TODAY, true);
  await gave(team.cleo, TODAY, false); // no note worth the name
  await gave(team.dan, "2026-09-24", true); // yesterday
  await received(team.dan, TODAY); // thanked, not thanking
  const ana = await signInAs(t, team.ana);
  expect(await ana.query(api.life.sprouts, { today: TODAY, memberIds: [team.ben, team.cleo, team.dan] })).toEqual([team.ben]);
});

test("a thoughtful kudos after a flood of thanks still counts", async () => {
  await exchanged(team.ben, team.ana); // they thanked you: the ring goes both ways
  for (let i = 0; i < 30; i++) await received(team.ben, TODAY);
  await gave(team.ben, TODAY, true);
  const ana = await signInAs(t, team.ana);
  expect(await ana.query(api.life.sprouts, { today: TODAY, memberIds: [team.ben] })).toEqual([team.ben]);
});

test("never someone who hides the game, has left, or is in another workspace", async () => {
  const other = await seedTeam(t, { gameEnabled: true }, "T2");
  for (const m of [team.fay, team.gus]) await exchanged(team.ana, m);
  await exchanged(team.ana, other.ben, other.workspaceId);
  await gave(team.fay, TODAY, true);
  await gave(team.gus, TODAY, true);
  await gave(other.ben, TODAY, true, other.workspaceId);
  const ana = await signInAs(t, team.ana);
  expect(await ana.query(api.life.sprouts, { today: TODAY, memberIds: [team.fay, team.gus, other.ben] })).toEqual([]);
});

test("never a teammate you've never exchanged kudos with: nobody outside your ring can be looked up", async () => {
  await gave(team.ben, TODAY, true);
  await gave(team.cleo, TODAY, true);
  await exchanged(team.ana, team.cleo);
  await exchanged(team.ben, team.dan); // between two others: not yours
  const ana = await signInAs(t, team.ana);
  expect(await ana.query(api.life.sprouts, { today: TODAY, memberIds: [team.ben, team.cleo] })).toEqual([team.cleo]);
});

test("nothing for a viewer who hides the game", async () => {
  await exchanged(team.ana, team.ben);
  await gave(team.ben, TODAY, true);
  await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
  const ana = await signInAs(t, team.ana);
  expect(await ana.query(api.life.sprouts, { today: TODAY, memberIds: [team.ben] })).toEqual([]);
});

test("the ring's size at most: a longer list is refused", async () => {
  const ana = await signInAs(t, team.ana);
  await expect(ana.query(api.life.sprouts, { today: TODAY, memberIds: Array(21).fill(team.ben) })).rejects.toThrow(/20/);
});
