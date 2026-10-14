import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { journeyShippedBeforeAnyoneJoined, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { post, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome } from "../../testing/slackInteractions";
import { signedRequest } from "../../testing/signedSlack";
import { appHomeOpened, emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { QuestId } from "../quests/pool";
import type { Activity, ActivityEntry } from "./activity";

const now = new Date("2026-10-13T10:00:00Z");
const alice = { user: "U_ALICE", name: "Alice Archer" };
const bob = { user: "U_BOB", name: "Bob Brandt" };
const carol = { user: "U_CAROL", name: "Carol Chen" };
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const progression = ["activity", "xp-levels", "unlocks"];

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
      { xp: 10, questsDone: [] },
      { xp: 20, questsDone: [] },
    ]);
    expect(gainsLinesTo(alice).toReversed()).toEqual(given.map(({ earned }) => `+${earned?.xp} XP`));
  });

  test("a kudos that finishes a weekly quest and the Journey step it opens lists both with their goals and XP, as its success reply names them", async () => {
    await questsOpened(["say-why-twice", "say-why-three-days", "two-new"]);

    await thank([bob, carol], saysWhy);

    const [finishing] = givenEntries(await activityOf(alice, { filter: "given" }));
    expect(finishing?.earned).toEqual({
      xp: 20,
      questsDone: [
        { kind: "weekly", goal: "Thank someone and say why, 2 times.", xp: 20 },
        { kind: "journey", goal: "Finish a weekly quest.", xp: 20 },
      ],
    });
    expect(gainsLinesTo(alice).at(-1)).toBe("+20 XP · Quest done: Thank someone and say why, 2 times (+20 XP) · Quest done: Finish a weekly quest (+20 XP)");
  });

  test("a kudos that finishes no quest lists none, and the kudos before it keeps the step it finished", async () => {
    await questsOpened(["say-why-twice", "say-why-three-days", "two-new"]);

    await thank([bob], "thanks");

    expect(givenEntries(await activityOf(alice, { filter: "given" })).map(({ earned }) => earned)).toEqual([
      { xp: 10, questsDone: [] },
      { xp: 10, questsDone: [{ kind: "journey", goal: "Give a kudos that says why.", xp: 10 }] },
    ]);
  });

  test("a Journey step finished by the Journey's join from a member's history attaches to no entry", async () => {
    await switchWebsite(t, postHog, true, ...progression);
    await unlocksShippedBeforeAnyoneJoined(t);
    await thank([bob], saysWhy);

    await switchWebsite(t, postHog, true, ...progression, "quests");
    await journeyShippedBeforeAnyoneJoined(t);
    await settleInTimeOrder(t);

    expect(await rewardKeysOf(alice)).toEqual(["journey:first-thanks"]);
    expect(givenEntries(await activityOf(alice, { filter: "given" })).map(({ earned }) => earned)).toEqual([{ xp: 10, questsDone: [] }]);
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

  test("with quests not applying, questsDone is empty while XP still shows", async () => {
    await questsOpened(["say-why-twice", "say-why-three-days", "two-new"]);
    await thank([bob, carol], saysWhy);

    await switchWebsite(t, postHog, true, ...progression);

    expect(givenEntries(await activityOf(alice, { filter: "given" })).map(({ earned }) => earned)).toEqual([
      { xp: 20, questsDone: [] },
      { xp: 10, questsDone: [] },
    ]);
  });
});

describe("AT18: a page's reads are bounded", () => {
  test("pages of level-ups and given kudos that each finished every quest stay within Convex's limits inside one instant", { timeout: 60_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await switchWebsite(t, postHog, true, ...progression, "quests");
    await unlocksShippedBeforeAnyoneJoined(t);
    const at = now.getTime();
    const me = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: alice.user, kind: "member", name: alice.name, asOf: 0 }));
    const teammate = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: bob.user, kind: "member", name: bob.name, asOf: 0 }));
    await drawFor(alice.user, ["say-why-twice", "say-why-three-days", "two-new"]);
    const everyQuest = ["weekly:2026-10-12:0", "weekly:2026-10-12:1", "weekly:2026-10-12:2", "journey:first-thanks", "journey:first-quest", "journey:someone-new", "journey:two-days"];
    await t.run(async (ctx) => {
      for (let index = 0; index < 60; index++) {
        const cause = { workspace: "T1", conversation: "C1", message: `given-${index}` };
        await ctx.db.insert("levelUps", { member: me, level: index + 2, ready: [], at });
        await ctx.db.insert("awards", { ...cause, giver: me, recipient: teammate, kudos: 1, day: "2026-10-13", at });
        for (const key of everyQuest) await ctx.db.insert("rewardRecords", { member: me, key, xp: 20, coins: 0, item: null, catalogueVersion: "1", at, cause });
      }
    });

    const first = await activityOf(alice, { filter: "all", limit: 50 });
    const next = await activityOf(alice, { filter: "all", cursor: first.cursor, limit: 50 });

    expect([first.entries.length, next.entries.length]).toEqual([50, 50]);
    expect(first.entries.every(({ kind }) => kind === "levelUp")).toBe(true);
    expect(next.entries.slice(10).map((entry) => (entry.kind === "kudosGiven" ? entry.earned?.questsDone.length : entry.kind))).toEqual(Array(40).fill(everyQuest.length));
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

async function questsOpened(quests: QuestId[]) {
  await switchWebsite(t, postHog, true, ...progression, "quests");
  await unlocksShippedBeforeAnyoneJoined(t);
  await thank([bob], saysWhy);
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(alice.user)));
  await settle(t);
  await drawFor(alice.user, quests);
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(alice.user, buttonInHome(slack, alice.user, "Open")), form));
  await settle(t);
}

async function drawFor(user: string, quests: QuestId[]) {
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
  await t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id;
    await ctx.db.insert("questDraws", { member, week: "2026-10-12", drawnAt: now.getTime(), slots });
  });
}

async function rewardKeysOf({ user }: { user: string }) {
  return t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id;
    return (await ctx.db.query("rewardRecords").collect()).filter((reward) => reward.member === member).map(({ key }) => key);
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
