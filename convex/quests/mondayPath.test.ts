import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { publish, subscribers } from "../bus/publish";
import { messageSettingsOf } from "../messageSettings/messageSettings";
import { standingOf } from "../progression/progression";
import type { AlbumAnswer, AlbumRead } from "../website/album";
import type { MemberId } from "../workspace/directory";
import { nextOnboardingQuestOf } from "./onboarding";
import { openQuestCrate } from "./open";
import { questStartOf } from "./start";
import { weekStartOf } from "./week";
import { rerollQuest, weeklyQuestsOf } from "./weekly";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const saysWhy = "thanks for untangling the flaky migration today";
const todaysFlags = ["xp-levels", "album", "collection", "packs", "hidden-items", "onboarding"];
const mondayPath = [...todaysFlags, "monday-quest"];
const drawnReward = { xp: 20, coins: 0, item: null };
const drawnPaid = { xp: 20, coins: 0 };
const firstThanksDone = "Quest done: Thank someone and say why · +50 XP and an unidentified Hoggie for your collection";

const deliverForReal = vi.mocked(publish).getMockImplementation()!;

type Person = { user: string; name: string };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  vi.mocked(publish).mockClear();
  vi.mocked(publish).mockImplementation(deliverForReal);
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack();
  for (const person of [alice, bob, carol]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("MQ5 MQ7 MQ10 MQ12: a first thoughtful kudos on the Monday path finishes the first onboarding quest", { timeout: 60_000 }, () => {
  test("the giver lands at 70 XP, 1 of 3 done, with the quest's Hoggie waiting and the reply's finish line", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);

    await thanks(alice, saysWhy, bob);

    expect(await xpOf(alice), "the giver's XP").toBe(70);
    expect(await nextQuestOf(alice), "the next onboarding quest").toBe("someone-new");
    expect(await questItemsOf(alice), "the quest items on the board").toEqual([{ kind: "quest", quest: { kind: "journey", step: "first-thanks" } }]);
    expect(replyTo(alice), "the after-kudos reply").toContain(firstThanksDone);
    expect(finishDmsTo(alice), "a finish DM").toEqual([]);
  });

  test.each([
    ["Quests before Progression", ["quests/quests:followKudosGiven", "progression/progression:recordEffects"]],
    ["Progression before Quests", ["progression/progression:recordEffects", "quests/quests:followKudosGiven"]],
  ])("with %s, the giver still lands at 70 XP", async (_, order) => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    const held = holdingKudosGiven();

    await thanks(alice, saysWhy, bob);
    await deliverInOrder(held[0]!, order);

    expect(await xpOf(alice), "the giver's XP").toBe(70);
    expect(await questItemsOf(alice), "the quest items on the board").toHaveLength(1);
  });

  test("a replayed finish pays the quest once", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    const held = holdingKudosGiven();

    await thanks(alice, saysWhy, bob);
    for (let delivery = 0; delivery < 3; delivery += 1) await deliverInOrder(held[0]!, ["progression/progression:recordEffects", "quests/quests:followKudosGiven"]);

    expect(await xpOf(alice), "the giver's XP").toBe(70);
    expect(await questItemsOf(alice), "the quest items on the board").toHaveLength(1);
  });

  test("MQ43: with monday-quest off, a first thoughtful kudos is as before: 20 XP, no quest, no finish line", async () => {
    await switchWebsite(t, postHog, true, ...todaysFlags);

    await thanks(alice, saysWhy, bob);

    expect(await xpOf(alice), "the giver's XP").toBe(20);
    expect(await questItemsOf(alice), "the quest items on the board").toEqual([]);
    expect(replyTo(alice).join("\n"), "the after-kudos reply").not.toContain("Quest done");
  });
});

describe("MQ3 MQ5 MQ6: the three onboarding quests are active at once", { timeout: 60_000 }, () => {
  test("the first kudos to someone new finishes only the first quest, and a later one to someone new finishes the second", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);

    await thanks(alice, saysWhy, bob);
    await thanks(alice, "thanks", carol);

    expect(await nextQuestOf(alice), "the next onboarding quest").toBe("two-days");
    expect(replyTo(alice), "the second kudos' reply").toContain("Quest done: Thank someone you haven't thanked before · +50 XP and an unidentified Hoggie for your collection");
    expect(await questItemsOf(alice), "the quest items on the board").toHaveLength(2);
  });

  test("kudos that say why on 2 different days finish the third quest, whatever order the steps come in", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await memberChanged(t, "team_join", { id: carol.user, profile: { real_name: carol.name } });

    await thanks(alice, saysWhy, bob);
    vi.setSystemTime(Date.now() + 24 * 60 * minuteMs);
    await thanks(alice, saysWhy, bob);

    expect(await nextQuestOf(alice), "the next onboarding quest").toBe("someone-new");
    expect(replyTo(alice), "the second day's reply").toContain("Quest done: Say why on 2 different days · +50 XP and an unidentified Hoggie for your collection");
  });

  test("a kudos that doesn't say why starts nothing, and the giver's first kudos that says why starts the quests and finishes the first", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);

    await thanks(alice, "thanks", bob);
    const plain = replyTo(alice);
    await thanks(alice, saysWhy, carol);

    expect(plain.join("\n"), "the plain kudos' reply").not.toContain("Quest done");
    expect(replyTo(alice), "the kudos that says why's reply").toEqual(expect.arrayContaining([firstThanksDone]));
    expect(replyTo(alice).join("\n"), "the kudos that says why's reply").not.toContain("haven't thanked before");
  });
});

describe("MQ5: the onboarding quests count each kudos as of when it was given, whatever order the subscribers run in", { timeout: 60_000 }, () => {
  test("a kudos given before the one that finished first-thanks doesn't finish someone-new, even when it is delivered after it", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await startedByTheSweep(alice);
    const held = holdingKudosGiven();

    await thanks(alice, "thanks", bob);
    await thanks(alice, saysWhy, carol);
    await deliverInOrder(held[1]!, []);
    await deliverInOrder(held[0]!, []);

    expect(await nextQuestOf(alice), "the next onboarding quest").toBe("someone-new");
    expect(await questItemsOf(alice), "the quest items on the board").toHaveLength(1);
  });

  test("a kudos that says why counts toward two-days only with the kudos given up to it, even when a later day's is already in", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await memberChanged(t, "team_join", { id: carol.user, profile: { real_name: carol.name } });
    const held = holdingKudosGiven();

    await thanks(alice, saysWhy, bob);
    vi.setSystemTime(Date.now() + dayMs);
    await thanks(alice, saysWhy, bob);
    await deliverInOrder(held[0]!, []);

    expect(await nextQuestOf(alice), "the next onboarding quest after the first day's kudos").toBe("someone-new");
    expect(await questItemsOf(alice), "the quest items after the first day's kudos").toHaveLength(1);

    await deliverInOrder(held[1]!, []);
    expect(await questItemsOf(alice), "the quest items after the second day's kudos").toHaveLength(2);
  });
});

describe("MQ4: the quests message kind applies on the Monday path", { timeout: 60_000 }, () => {
  test.each([
    ["on", mondayPath, true],
    ["off", todaysFlags, false],
  ])("with monday-quest %s, the Quests and Journey setting applies only on the Monday path", async (_, flags, applies) => {
    await switchWebsite(t, postHog, true, ...flags);
    await thanks(alice, saysWhy, bob);

    const member = await memberOf(alice);
    const settings = await t.run((ctx) => messageSettingsOf(ctx, member));

    expect(settings.find(({ kind }) => kind === "quests")?.applies).toBe(applies);
  });
});

describe("MQ9: drawn quests come once the three onboarding quests are finished", { timeout: 60_000 }, () => {
  test("nothing is drawn before the third onboarding quest, nor by the kudos that finishes it; the next sweep draws three", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await thanks(alice, "thanks", carol);
    await sweepForANewWeek();
    expect(await weekOf(alice), "the draw with 2 of 3 onboarding quests done").toBeNull();

    vi.setSystemTime(Date.now() + dayMs);
    await thanks(alice, saysWhy, bob);
    expect(await weekOf(alice), "the draw after the kudos that finishes onboarding").toBeNull();
    await sweepForANewWeek();

    expect((await weekOf(alice))?.slots, "this week's drawn quests").toHaveLength(3);
  });

  test("a replay of the kudos that finished onboarding counts toward no drawn quest", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await thanks(alice, "thanks", carol);
    vi.setSystemTime(Date.now() + dayMs);
    const held = holdingKudosGiven();
    await thanks(alice, saysWhy, bob);
    await deliverInOrder(held[0]!, []);

    await deliverInOrder(held[0]!, []);

    expect((await weekOf(alice))?.slots.map(({ progress }) => progress) ?? [], "each drawn quest's progress").not.toContain(1);
  });

  test("the next kudos after onboarding draws this week's quests and counts toward them", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await finishOnboarding();
    const onboarded = Date.now();

    await thanks(alice, saysWhy, bob);

    const week = await weekOf(alice);
    expect(week?.drawnAt, "when the quests were drawn").toBeGreaterThan(onboarded);
    expect(week?.slots.map(({ progress }) => progress), "each quest's progress").toEqual([1, 1, 1]);
  });

  test("the next week's quests are drawn at Monday 0:00 in the member's zone", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await finishOnboarding();
    await sweepForANewWeek();

    vi.setSystemTime(new Date("2026-10-19T09:00:00Z"));
    await sweepForANewWeek();

    const member = await memberOf(alice);
    const timeZone = await t.run(async (ctx) => (await ctx.db.get(member))?.timeZone);
    const week = await weekOf(alice);
    expect(week?.week, "the week drawn").toBe("2026-10-19");
    expect(week?.drawnAt, "when the week's quests were drawn").toBe(weekStartOf("2026-10-19", timeZone));
  });
});

describe("MQ8 MQ10 MQ12: a drawn quest on the Monday path pays 20 XP and a Hoggie, never coins, with no swap", { timeout: 60_000 }, () => {
  test("each drawn quest promises 20 XP and no coins, and none can be swapped", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await finishOnboarding();
    await sweepForANewWeek();

    const week = (await weekOf(alice))!;
    const member = await memberOf(alice);
    const swapped = await t.run((ctx) => rerollQuest(ctx, member, { kind: "weekly", week: week.week, slot: 0 }));

    expect(week.slots.map(({ reward }) => reward), "each drawn quest's reward").toEqual([drawnReward, drawnReward, drawnReward]);
    expect(week.swapAvailable, "a swap offered").toBe(false);
    expect(swapped, "a swap asked for").toBe("refused");
  });

  test("finishing drawn quests records 20 XP and no coins each, lays a Hoggie each, and the reply says so with no finish DM", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await finishOnboarding();

    for (let day = 0; day < 3; day += 1) {
      if (day > 0) vi.setSystemTime(Date.now() + dayMs);
      await thanks(alice, saysWhy, bob);
    }

    expect(await weeklyRewardsOf(alice), "the drawn quests' reward records").toEqual([drawnPaid, drawnPaid, drawnPaid]);
    expect((await questItemsOf(alice)).filter(({ quest }) => quest.kind === "weekly"), "the drawn quests' items").toHaveLength(3);
    expect(replyTo(alice).filter((line) => line.startsWith("Quest done:")), "the last reply's finish lines").toEqual([expect.stringMatching(/^Quest done: Thank someone and say why[^.]* · \+20 XP and an unidentified Hoggie for your collection$/)]);
    expect(finishDmsTo(alice), "a finish DM").toEqual([]);
  });
});

describe("MQ4 MQ10: with the unlock path on too, the Monday path's quests pay only the Monday way", { timeout: 60_000 }, () => {
  test("a Monday quest's reward opens no crate, so it pays no second Hoggie and no pack XP", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath, "unlocks", "quests");
    await thanks(alice, saysWhy, bob);
    const member = await memberOf(alice);

    const opened = await t.run((ctx) => openQuestCrate(ctx, member, { kind: "journey", step: "first-thanks" }, "website"));
    await settle(t);

    expect(opened, "opening the quest's crate").toBe("refused");
    expect(await xpOf(alice), "the giver's XP").toBe(70);
  });

  test("a week drawn on the unlock path is left as it is on the Monday path, paying no coins", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await memberChanged(t, "team_join", { id: alice.user, profile: { real_name: alice.name } });
    const member = await memberOf(alice);
    await t.run((ctx) => ctx.db.insert("questDraws", { member, week: "2026-10-12", drawnAt: Date.now(), slots: [{ slot: 0, quest: "say-why", reward: { xp: 20, coins: 10, item: null }, catalogueVersion: "2", feasibleBecause: { peopleLeft: 2, recognitionsLeft: 10 } }] }));

    await thanks(alice, saysWhy, bob);

    expect(await weeklyRewardsOf(alice), "the unlock path's week's reward records").toEqual([]);
    expect(await xpOf(alice), "the giver's XP").toBe(70);
  });
});

describe("MQ3: the weekly sweep starts quests for a member welcomed before the Monday path", { timeout: 60_000 }, () => {
  test.each([
    ["a welcome and monday-quest on", true, mondayPath, true],
    ["no welcome", false, mondayPath, false],
    ["a welcome and monday-quest off", true, todaysFlags, false],
  ])("with %s, the sweep starts the member's quests: %s", async (_, welcomed, flags, starts) => {
    await switchWebsite(t, postHog, true, ...flags);
    await memberChanged(t, "team_join", { id: alice.user, profile: { real_name: alice.name } });
    const member = await memberOf(alice);
    if (welcomed) await t.run((ctx) => ctx.db.insert("welcomes", { member }));

    await sweepForANewWeek();

    expect((await t.run((ctx) => questStartOf(ctx, member))) !== null, "the member's quests started").toBe(starts);
  });
});

async function finishOnboarding() {
  await thanks(alice, saysWhy, bob);
  await thanks(alice, "thanks", carol);
  vi.setSystemTime(Date.now() + dayMs);
  await thanks(alice, saysWhy, bob);
}

async function startedByTheSweep(person: Person) {
  await memberChanged(t, "team_join", { id: person.user, profile: { real_name: person.name } });
  const member = await memberOf(person);
  await t.run((ctx) => ctx.db.insert("welcomes", { member }));
  await sweepForANewWeek();
}

async function sweepForANewWeek() {
  await t.mutation(internal.quests.newWeek.sweep, {});
  await settle(t);
}

async function weekOf(person: Person) {
  const member = await memberOf(person);
  return t.run((ctx) => weeklyQuestsOf(ctx, member, Date.now()));
}

async function weeklyRewardsOf(person: Person) {
  const member = await memberOf(person);
  const records = await t.run((ctx) => ctx.db.query("rewardRecords").collect());
  return records.filter((record) => record.member === member && record.key.startsWith("weekly:")).map(({ xp, coins }) => ({ xp, coins }));
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts });
  await settleInTimeOrder(t);
  return ts;
}

function holdingKudosGiven() {
  const held: KudosGivenEvent[] = [];
  vi.mocked(publish).mockImplementation(async (ctx, event) => {
    if (event.type === "kudosGiven") held.push(event);
    else await deliverForReal(ctx, event);
  });
  return held;
}

async function deliverInOrder(event: KudosGivenEvent, first: string[]) {
  vi.mocked(publish).mockImplementation(deliverForReal);
  const named = new Map(subscribers.kudosGiven.map((subscription) => ("subscriber" in subscription ? subscription.subscriber : subscription)).map((subscriber) => [getFunctionName(subscriber), subscriber] as const));
  for (const name of [...first, ...[...named.keys()].filter((name) => !first.includes(name))]) {
    await t.mutation(named.get(name)! as FunctionReference<"mutation", "internal", { event: KudosGivenEvent }>, { event });
    await settle(t);
  }
}

function replyTo(person: Person): string[] {
  return String(slack.ephemeralsTo(person.user).findLast(({ text }) => String(text).includes("kudos from you"))?.text ?? "").split("\n");
}

function finishDmsTo(person: Person) {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => channel === person.user && String(text).startsWith("✅ You finished"))
    .map(({ text }) => String(text));
}

async function xpOf(person: Person) {
  const member = await memberOf(person);
  return t.run(async (ctx) => (await standingOf(ctx, member)).xp);
}

async function nextQuestOf(person: Person) {
  const member = await memberOf(person);
  return t.run((ctx) => nextOnboardingQuestOf(ctx, member));
}

async function questItemsOf(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: person.user, name: person.name });
  const album: AlbumRead | { kind: string } = await asSignedIn.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  const { board } = album as AlbumAnswer;
  return (board?.items ?? []).map(({ reason }) => reason).filter((reason) => reason.kind === "quest");
}

async function memberOf(person: Person): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  return row!._id;
}
