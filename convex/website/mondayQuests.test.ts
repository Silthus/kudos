import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { post, react, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { AlbumAnswer } from "./album";
import type { GettingStartedStep, MondayQuests } from "./quests";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const alice = { user: "U_ALICE", name: "Alice Marchetti", givenName: "Alice" };
const bob = { user: "U_BOB", name: "Bob Okonkwo", givenName: "Bob" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist", givenName: "Carol" };
const saysWhy = "thanks for untangling the flaky migration today";
const todaysFlags = ["xp-levels", "album", "collection", "packs", "hidden-items", "onboarding", "hugs"];
const mondayPath = [...todaysFlags, "monday-quest"];

type Person = typeof alice;

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
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

describe("MQ37 MQ38: on the Monday path the quests read answers the Getting started journey", { timeout: 60_000 }, () => {
  test("a newcomer who hugged once sees five steps, the hug done and the first quest next, greeted by first name", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    const bobsMessage = await thanks(bob, "thanks", carol);

    await react(t, { user: alice.user, itemUser: bob.user, ts: bobsMessage });
    await settle(t);

    const quests = await mondayQuestsOf(alice);
    expect(quests.firstName).toBe("Alice");
    expect(quests.next, "the next onboarding quest").toBe("first-thanks");
    expect(journeyOf(quests).map(({ step, done }) => [step, done])).toEqual([
      ["hug", true],
      ["first-thanks", false],
      ["turn", false],
      ["someone-new", false],
      ["two-days", false],
    ]);
    expect(journeyOf(quests).map(({ goal, reward }) => [goal, reward?.xp ?? null])).toEqual([
      ["Give your first hug", null],
      ["Thank someone and say why", 50],
      ["Turn the hoggie it left on your board", null],
      ["Thank someone you haven't thanked before", 50],
      ["Say why on 2 different days", 50],
    ]);
  });

  test("a first thoughtful kudos finishes the first quest with its item waiting, and turning it marks the item turned and the turn step done", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);

    await thanks(alice, saysWhy, bob);

    const finished = stepOf(await mondayQuestsOf(alice), "first-thanks");
    expect(finished, "the first quest").toMatchObject({ done: true, progress: { done: 1, target: 1 }, item: "waiting" });
    expect(stepOf(await mondayQuestsOf(alice), "two-days").progress, "the third quest's days").toEqual({ done: 1, target: 2 });
    expect((await mondayQuestsOf(alice)).next).toBe("someone-new");

    await turnTheQuestItemOf(alice);

    const turned = await mondayQuestsOf(alice);
    expect(stepOf(turned, "first-thanks").item, "the first quest's item").toBe("turned");
    expect(stepOf(turned, "turn").done, "the turn step").toBe(true);
  });

  test("an unfinished quest and a guidance step carry no item", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);

    await thanks(alice, saysWhy, bob);

    const quests = await mondayQuestsOf(alice);
    expect(stepOf(quests, "someone-new").item).toBeNull();
    expect(stepOf(quests, "hug").item).toBeNull();
  });

  test("MQ7: a step finished before its quest paid an item answers no item state", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    const member = await memberOf(alice);
    await t.run((ctx) => ctx.db.insert("rewardRecords", { member, key: "journey:first-thanks", xp: 20, coins: 10, item: null, catalogueVersion: "1", at: Date.now() }));

    const quests = await mondayQuestsOf(alice);

    expect(stepOf(quests, "first-thanks")).toMatchObject({ done: true, item: null });
  });
});

describe("MQ37 MQ9: once the three quests are finished, the read answers this week's drawn quests", { timeout: 60_000 }, () => {
  test("the journey gives way to three drawn quests at 20 XP, with the days left in the week", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);

    await finishOnboarding();
    await theHourlySweep();

    const quests = await mondayQuestsOf(alice);
    expect(quests.next).toBeNull();
    expect(quests.daysLeft, "Wednesday to Sunday").toBe(5);
    const drawn = drawnOf(quests);
    expect(drawn).toHaveLength(3);
    expect(drawn.every(({ reward, done, item }) => reward.xp === 20 && !done && item === null)).toBe(true);
    expect(drawn.every(({ goal, progress }) => goal.length > 0 && progress.target >= 1)).toBe(true);
  });

  test("MQ4: a week drawn from the unlock path's pool is not shown as the Monday week", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await finishOnboarding();
    await theHourlySweep();

    await drawnFromTheUnlockPool(alice);

    expect((await mondayQuestsOf(alice)).quests.kind).toBe("journey");
  });
});

async function drawnFromTheUnlockPool(person: Person) {
  const member = await memberOf(person);
  await t.run(async (ctx) => {
    const draws = await ctx.db
      .query("questDraws")
      .withIndex("by_member_week", (q) => q.eq("member", member))
      .take(10);
    for (const draw of draws) await ctx.db.patch(draw._id, { slots: draw.slots.map((slot) => ({ ...slot, catalogueVersion: "1" })) });
  });
}

describe("MQ37 MQ43: off the Monday path the quests read answers as today", () => {
  test("with monday-quest off, a member with neither path gets no quests", async () => {
    await switchWebsite(t, postHog, true, ...todaysFlags);

    await thanks(alice, saysWhy, bob);

    expect(await questsOf(alice)).toEqual({ kind: "not-found" });
  });
});

describe("MQ41: viewing the quests records quests viewed", { timeout: 60_000 }, () => {
  test.each(["panel", "profile"] as const)("a view on the %s records one quests viewed with its surface", async (surface) => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const { asSignedIn } = await aSignedInSession(t, alice);

    expect(await asSignedIn.mutation(api.website.quests.viewQuests, { surface })).toEqual({ kind: "viewed" });
    await settle(t);

    expect(questsViewed()).toEqual([{ surface }]);
  });

  test("each view records once", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const { asSignedIn } = await aSignedInSession(t, alice);

    await asSignedIn.mutation(api.website.quests.viewQuests, { surface: "panel" });
    await asSignedIn.mutation(api.website.quests.viewQuests, { surface: "panel" });
    await settle(t);

    expect(questsViewed()).toHaveLength(2);
  });

  test("off the Monday path a view is refused and records nothing", async () => {
    await switchWebsite(t, postHog, true, ...todaysFlags);
    await thanks(alice, saysWhy, bob);
    const { asSignedIn } = await aSignedInSession(t, alice);

    expect(await asSignedIn.mutation(api.website.quests.viewQuests, { surface: "panel" })).toEqual({ kind: "refused" });
    await settle(t);

    expect(questsViewed()).toEqual([]);
  });
});

async function finishOnboarding() {
  await thanks(alice, saysWhy, bob);
  await thanks(alice, "thanks", carol);
  vi.setSystemTime(Date.now() + dayMs);
  await thanks(alice, saysWhy, bob);
}

async function theHourlySweep() {
  await t.mutation(internal.quests.newWeek.sweep, {});
  await settle(t);
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts });
  await settleInTimeOrder(t);
  return ts;
}

async function questsOf(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, person);
  return asSignedIn.query(api.website.quests.getQuests, {});
}

async function mondayQuestsOf(person: Person): Promise<MondayQuests> {
  const answer = await questsOf(person);
  if (answer.kind !== "monday") throw new Error(`expected the Monday path's quests, got ${JSON.stringify(answer)}`);
  return answer;
}

function journeyOf({ quests }: MondayQuests): GettingStartedStep[] {
  if (quests.kind !== "journey") throw new Error(`expected the journey, got ${quests.kind}`);
  return quests.steps;
}

function drawnOf({ quests }: MondayQuests) {
  if (quests.kind !== "drawn") throw new Error(`expected the drawn quests, got ${quests.kind}`);
  return quests.quests;
}

function stepOf(quests: MondayQuests, step: GettingStartedStep["step"]): GettingStartedStep {
  return journeyOf(quests).find((shown) => shown.step === step)!;
}

async function turnTheQuestItemOf(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, person);
  const album = (await asSignedIn.query(api.website.album.getAlbum, {})) as AlbumAnswer;
  const item = album.board!.items.find(({ reason }) => reason.kind === "quest")!;
  expect(await asSignedIn.mutation(api.website.album.turnItem, { item: item.item })).toMatchObject({ kind: "turned" });
  await settle(t);
}

function questsViewed() {
  return postHog
    .productEvents()
    .filter(({ event }) => event === "quests viewed")
    .map(({ properties }) => ({ surface: properties.surface }));
}

async function memberOf(person: Person) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  if (row === null) {
    await thanks(bob, "thanks", person);
    return memberOf(person);
  }
  return row._id;
}
