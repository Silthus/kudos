import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { anIdInHalfOf, unlocksShippedBeforeAnyoneJoined, onForEveryone, onForHalf } from "../../testing/flags";
import { post, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSession, switchWebsite } from "../../testing/website";
import { api, components, internal } from "../_generated/api";
import type { PerkId } from "../progression/tree";
import { mondayCatalogueVersion } from "../quests/mondayCatalogue";
import type { QuestId } from "../quests/pool";
import type { Activity, ActivityEntry } from "./activity";

const now = new Date("2026-10-13T10:00:00Z");
const alice = { user: "U_ALICE", name: "Alice Archer" };
const bob = { user: "U_BOB", name: "Bob Brandt" };
const carol = { user: "U_CAROL", name: "Carol Chen" };
const saysWhy = "thanks for untangling the release notes today";
const progression = ["activity", "xp-levels", "unlocks"];
const skillTree = [...progression, "skill-tree"];

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack().withWorkspaceUrl("https://kudos-test.slack.com/");
  for (const person of [alice, bob, carol]) slack.withMember(person.user, { real_name: person.name, tz: "UTC" });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AT16 AT26: level-ups in the timeline", () => {
  test("a kudos that crosses a level shows a levelUp entry directly above its kudosGiven entry, at the same instant", async () => {
    await switchWebsite(t, postHog, true, ...progression);

    const at = await thank([bob, carol]);

    const { entries } = await activityOf(alice, { filter: "all" });
    expect(entries.map(kindAndInstant)).toEqual([
      { kind: "levelUp", at, level: 2 },
      { kind: "kudosGiven", at },
    ]);
  });

  test("pages one entry at a time from the level-up to its kudos, repeating and skipping none", async () => {
    await switchWebsite(t, postHog, true, ...progression);
    await thank([bob, carol]);

    const first = await activityOf(alice, { filter: "all", limit: 1 });
    const second = await activityOf(alice, { filter: "all", limit: 1, cursor: first.cursor });

    expect([...first.entries, ...second.entries].map(({ kind }) => kind)).toEqual(["levelUp", "kudosGiven"]);
    expect(second.cursor).toBeNull();
  });

  test("level-ups appear only in the full view, never in received or given", async () => {
    await switchWebsite(t, postHog, true, ...progression);
    await thank([bob, carol]);

    expect((await activityOf(alice, { filter: "given" })).entries.map(({ kind }) => kind)).toEqual(["kudosGiven"]);
    expect((await activityOf(alice, { filter: "received" })).entries).toEqual([]);
  });
});

describe("AT25: what each given kudos earned", () => {
  test("earned.xp equals the success reply's +N XP for the same kudos", async () => {
    await switchWebsite(t, postHog, true, ...progression);

    await thank([bob, carol]);
    await thank([bob]);

    const given = givenEntries(await activityOf(alice, { filter: "given" }));
    expect(given.map(({ earned }) => earned)).toEqual([
      { xp: 10, questsDone: [], bonuses: [] },
      { xp: 20, questsDone: [], bonuses: [] },
    ]);
    expect(gainsLinesTo(alice).toReversed()).toEqual(given.map(({ earned }) => `+${earned?.xp} XP`));
  });
});

describe("AT25: the perk bonuses each given kudos earned", () => {
  test("a kudos to Bob and Carol that says why lists each perk that paid, summed over its awards and saying what it pays for, as its success reply names them", async () => {
    await aliceOwning("spark", "rhythm", "circle");

    await thank([bob, carol], saysWhy);

    const [given] = givenEntries(await activityOf(alice, { filter: "given" }));
    expect(given?.earned?.bonuses).toEqual([
      { perk: { id: "spark", name: "Spark" }, why: "your first kudos of the day", xp: 5 },
      { perk: { id: "rhythm", name: "Rhythm" }, why: "a kudos to each person, once a day", xp: 4 },
      { perk: { id: "circle", name: "Circle" }, why: "your first kudos of the week to each person", xp: 10 },
    ]);
    expect(gainsLinesTo(alice)).toEqual([`+20 XP · ${bonusPartsOf(given!).join(" · ")}`]);
  });

  test("each kudos lists only the perks that paid on it, and one that paid none lists none", async () => {
    await aliceOwning("spark", "rhythm");

    await thank([bob], saysWhy);
    await thank([carol], saysWhy);
    await thank([bob], saysWhy);

    const given = givenEntries(await activityOf(alice, { filter: "given" }));
    expect(given.map((entry) => bonusPartsOf(entry))).toEqual([[], ["Rhythm bonus (+2 XP)"], ["Spark bonus (+5 XP)", "Rhythm bonus (+2 XP)"]]);
    expect(gainsLinesTo(alice).toReversed()).toEqual(given.map((entry) => ["+10 XP", ...bonusPartsOf(entry)].join(" · ")));
  });

  test("a perk bought after a kudos never shows on that kudos, as its effects record holds no bonus line, and pays on the next day's", async () => {
    await aliceOwning();
    await thank([bob], saysWhy);

    await perksBoughtBy(alice, "spark");
    vi.setSystemTime(new Date("2026-10-14T10:00:00Z"));
    await thank([carol], saysWhy);

    expect(givenEntries(await activityOf(alice, { filter: "given" })).map((entry) => bonusPartsOf(entry))).toEqual([["Spark bonus (+5 XP)"], []]);
  });

  test("SW5: with the skill tree switched off, bonuses are empty while XP still shows, and show again once it applies", async () => {
    await aliceOwning("spark");
    await thank([bob], saysWhy);

    await switchWebsite(t, postHog, true, ...progression);
    expect(givenEntries(await activityOf(alice, { filter: "given" })).map(({ earned }) => earned)).toEqual([{ xp: 10, questsDone: [], bonuses: [] }]);

    await switchWebsite(t, postHog, true, ...skillTree);
    expect(givenEntries(await activityOf(alice, { filter: "given" })).map((entry) => bonusPartsOf(entry))).toEqual([["Spark bonus (+5 XP)"]]);
  });
});

describe("AT25 SW5: bonus XP is XP, shown only where the member sees XP", () => {
  test("with xp-levels on in the workspace decision but off in the giver's, neither the reply nor the timeline shows the bonus the kudos paid", { timeout: 60_000 }, async () => {
    await aliceOwning("spark");
    await xpLevelsOnInTheWorkspaceOnly();

    await thank([bob], saysWhy);

    expect(gainsLinesTo(alice).join("\n")).not.toContain("bonus");
    expect(givenEntries(await activityOf(alice, { filter: "given" })).map(({ earned }) => earned)).toEqual([null]);
  });
});

describe("AT25 AT26 SW5: each part follows the member's view at read time", () => {
  test("with xp-levels off for the member, no levelUp entries appear and earned is null", async () => {
    await switchWebsite(t, postHog, true, ...progression);
    await thank([bob, carol]);

    await switchWebsite(t, postHog, true, "activity");

    const { entries } = await activityOf(alice, { filter: "all" });
    expect(entries.map(({ kind }) => kind)).toEqual(["kudosGiven"]);
    expect(givenEntries({ entries })[0]?.earned).toBeNull();
  });
});

describe("AT18: a page's reads are bounded", () => {
  test("pages of level-ups and given kudos that each finished every quest stay within Convex's limits inside one instant", { timeout: 60_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await switchWebsite(t, postHog, true, ...progression, "monday-quest");
    await unlocksShippedBeforeAnyoneJoined(t);
    const at = now.getTime();
    const me = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: alice.user, kind: "member", name: alice.name, asOf: 0 }));
    const teammate = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: bob.user, kind: "member", name: bob.name, asOf: 0 }));
    await drawFor(alice.user, ["kudos-once", "kudos-two-days", "two-new"]);
    const everyQuest = ["weekly:2026-10-12:0", "weekly:2026-10-12:1", "weekly:2026-10-12:2", "journey:first-thanks", "journey:first-quest", "journey:someone-new", "journey:two-days"];
    await t.run(async (ctx) => {
      for (let index = 0; index < 60; index++) {
        const cause = { workspace: "T1", conversation: "C1", message: `given-${index}` };
        await ctx.db.insert("awards", { ...cause, giver: me, recipient: teammate, kudos: 1, day: "2026-10-13", at });
        for (const key of everyQuest) await ctx.db.insert("rewardRecords", { member: me, key, xp: 20, coins: 0, item: null, catalogueVersion: mondayCatalogueVersion, at, cause });
      }
      for (let index = 0; index < 60; index++) await ctx.db.insert("levelUps", { member: me, level: index + 2, ready: [], at });
    });

    const first = await activityOf(alice, { filter: "all", limit: 50 });
    const next = await activityOf(alice, { filter: "all", cursor: first.cursor, limit: 50 });

    expect([first.entries.length, next.entries.length]).toEqual([50, 50]);
    expect(first.entries.every(({ kind }) => kind === "levelUp")).toBe(true);
    expect(next.entries.slice(10).map((entry) => (entry.kind === "kudosGiven" ? entry.earned?.questsDone.length : entry.kind))).toEqual(Array(40).fill(everyQuest.length));
  });

  test("a page of messages that each thanked hundreds of people and paid every perk on every award stays within Convex's limits", { timeout: 120_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await switchWebsite(t, postHog, true, ...skillTree);
    await unlocksShippedBeforeAnyoneJoined(t);
    const at = now.getTime();
    const recipientsEach = 820;
    const me = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: alice.user, kind: "member", name: alice.name, asOf: 0 }));
    const thanked = await t.run(async (ctx) => {
      const ids = [];
      for (let index = 0; index < recipientsEach; index++) ids.push(await ctx.db.insert("members", { workspace: "T1", user: `U_${index}`, kind: "member", asOf: 0 }));
      return ids;
    });
    const everyPerk = [
      { source: "spark" as const, xp: 5 },
      { source: "rhythm" as const, xp: 2 },
      { source: "circle" as const, xp: 5 },
    ];
    for (let index = 0; index < 2; index++) {
      await t.run(async (ctx) => {
        for (const recipient of thanked) {
          const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `given-${index}`, giver: me, recipient, kudos: 1, day: "2026-10-13", at: at + index });
          await ctx.db.insert("effectsRecords", { award, member: me, side: "giver", day: "2026-10-13", baseXp: 10, gate: { version: 1, thoughtful: true }, catalogueVersion: "1", bonus: everyPerk });
        }
      });
    }

    const first = await activityOf(alice, { filter: "given", limit: 50 });
    const next = await activityOf(alice, { filter: "given", cursor: first.cursor, limit: 50 });

    expect([...first.entries, ...next.entries].map((entry) => (entry.kind === "kudosGiven" ? entry.earned?.bonuses.map(({ xp }) => xp) : entry.kind))).toEqual([
      [5 * recipientsEach, 2 * recipientsEach, 5 * recipientsEach],
      [5 * recipientsEach, 2 * recipientsEach, 5 * recipientsEach],
    ]);
  });

  test.each([
    { messages: 51, recipientsEach: 14 },
    { messages: 50, recipientsEach: 16 },
  ])("pages of $messages messages to $recipientsEach people each, whose words mention 40 different people, each finishing every quest and paying a bonus on every award, stay within Convex's limits, skipping and repeating none", { timeout: 120_000 }, async ({ messages, recipientsEach }) => {
    t = testBackend({ transactionLimits: true });
    await switchWebsite(t, postHog, true, ...skillTree, "monday-quest");
    await unlocksShippedBeforeAnyoneJoined(t);
    const at = now.getTime();
    const mentionsEach = 40;
    const me = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: alice.user, kind: "member", name: alice.name, asOf: 0 }));
    const thanked = await t.run(async (ctx) => {
      const ids = [];
      for (let index = 0; index < recipientsEach; index++) ids.push(await ctx.db.insert("members", { workspace: "T1", user: `U_${index}`, kind: "member", asOf: 0 }));
      return ids;
    });
    const spark = [{ source: "spark" as const, xp: 5 }];
    await drawFor(alice.user, ["kudos-once", "kudos-two-days", "two-new"]);
    const everyQuest = ["weekly:2026-10-12:0", "weekly:2026-10-12:1", "weekly:2026-10-12:2", "journey:first-thanks", "journey:first-quest", "journey:someone-new", "journey:two-days"];
    await t.run(async (ctx) => {
      for (let index = 0; index < messages; index++) {
        const message = `1760350${String(index).padStart(3, "0")}.000100`;
        for (const key of everyQuest) await ctx.db.insert("rewardRecords", { member: me, key, xp: 20, coins: 0, item: null, catalogueVersion: mondayCatalogueVersion, at, cause: { workspace: "T1", conversation: "C1", message } });
        const segments = Array.from({ length: mentionsEach }, (_, mentioned) => ({ kind: "person" as const, user: `U_MENTIONED_${index}_${mentioned}` }));
        await ctx.db.insert("kudosTexts", { workspace: "T1", conversation: "C1", message, kind: "words", revision: 1n, author: alice.user, edited: false, segments, visibility: "public", gate: null });
        for (const recipient of thanked) {
          const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver: me, recipient, kudos: 1, day: "2026-10-13", at: at + index });
          await ctx.db.insert("effectsRecords", { award, member: me, side: "giver", day: "2026-10-13", baseXp: 10, gate: { version: 1, thoughtful: true }, catalogueVersion: "1", bonus: spark });
        }
      }
    });

    const first = await activityOf(alice, { filter: "given", limit: messages });
    const next = first.cursor === null ? { entries: [] } : await activityOf(alice, { filter: "given", limit: messages, cursor: first.cursor });

    const entries = [...first.entries, ...next.entries];
    expect(entries.map(({ at }) => at)).toEqual(Array.from({ length: messages }, (_, index) => at + messages - 1 - index));
    expect(entries.map((entry) => (entry.kind === "kudosGiven" ? entry.earned?.bonuses.map(({ xp }) => xp) : entry.kind))).toEqual(Array(messages).fill([5 * recipientsEach]));
    expect(entries.map((entry) => (entry.kind === "kudosGiven" ? entry.earned?.questsDone.length : entry.kind))).toEqual(Array(messages).fill(everyQuest.length));
  });
});

async function thank(recipients: Array<{ user: string }>, words = saysWhy): Promise<number> {
  sentMessages += 1;
  const seconds = Math.floor(Date.now() / 1000) + sentMessages;
  const blocks = [section(...recipients.map(({ user }) => mention(user)), text(` ${words} `), emoji("taco"))];
  await post(t, blocks, { user: alice.user, ts: `${seconds}.000100` });
  await settleInTimeOrder(t);
  return seconds * 1000;
}

async function aliceOwning(...perks: PerkId[]) {
  await switchWebsite(t, postHog, true, ...skillTree);
  await unlocksShippedBeforeAnyoneJoined(t);
  await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: alice.user, kind: "member", name: alice.name, asOf: 0 }));
  await perksBoughtBy(alice, ...perks);
}

async function xpLevelsOnInTheWorkspaceOnly() {
  const [inside, outside] = [await anIdInHalfOf("xp-levels", true), await anIdInHalfOf("xp-levels", false)];
  await t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((row) => row.user === alice.user)!._id;
    for (const row of await ctx.db.query("workspaceKeys").collect()) await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("analyticsIds").collect()) if (row.member === member) await ctx.db.delete(row._id);
    await ctx.db.insert("workspaceKeys", { workspace: "T1", workspaceKey: inside });
    await ctx.db.insert("analyticsIds", { member, analyticsId: outside });
  });
  postHog.withFlags(...skillTree.filter((key) => key !== "xp-levels").map(onForEveryone), onForEveryone("website"), onForHalf("xp-levels"));
  await t.action(components.posthog.lib.refreshFlagDefinitions, {});
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
}

async function perksBoughtBy({ user }: { user: string }, ...perks: PerkId[]) {
  await t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id;
    for (const perk of perks) await ctx.db.insert("perksOwned", { member, perk, boughtAt: Date.now(), catalogueVersion: "1" });
  });
}

function bonusPartsOf({ earned }: Extract<ActivityEntry, { kind: "kudosGiven" }>) {
  return (earned?.bonuses ?? []).map(({ perk, xp }) => `${perk.name} bonus (+${xp} XP)`);
}

async function drawFor(user: string, quests: QuestId[]) {
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: mondayCatalogueVersion, feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
  await t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id;
    await ctx.db.insert("questDraws", { member, week: "2026-10-12", drawnAt: now.getTime(), slots });
  });
}

async function activityOf(person: { user: string; name: string }, args: { filter: "all" | "received" | "given"; cursor?: string | null; limit?: number }): Promise<Activity> {
  const { asSignedIn } = await aSession(t, person, { endsIn: 30 * 24 * 60 * 60 * 1000 });
  const answer = await asSignedIn.query(api.website.activity.getActivity, { cursor: null, ...args });
  if (answer.kind !== "activity") throw new Error(`expected the activity, got ${answer.kind}`);
  return answer;
}

function givenEntries({ entries }: Pick<Activity, "entries">) {
  return entries.flatMap((entry) => (entry.kind === "kudosGiven" ? [entry] : []));
}

function kindAndInstant(entry: ActivityEntry) {
  return entry.kind === "levelUp" ? entry : { kind: entry.kind, at: entry.at };
}

function gainsLinesTo({ user }: { user: string }) {
  return slack.ephemeralsTo(user).map(({ text }) => String(text).split("\n").at(-1));
}
