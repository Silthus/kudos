import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEveryone } from "../../testing/flags";
import { withoutExposureOf } from "../../testing/hoggies";
import { settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { publish } from "../bus/publish";
import type { Command } from "../commands/commands";
import { allowanceDay } from "../engine/allowance";
import { levelOf } from "../progression/levels";
import { recordReward } from "../progression/progression";
import type { Quest } from "../quests/step";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";
import type { CrateKey } from "./crateKey";
import { packBonusOf } from "./draw";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const thisWeek = "2026-10-12";
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const rowan = { user: "U_ROWAN", name: "Rowan Pike" };
const questsFlags = ["xp-levels", "unlocks", "quests"];
const packsFlags = ["collection", "packs"];
const saysWhy = { gate: { version: 1, thoughtful: true, words: 7 } };
const firstThanks: Quest = { kind: "journey", step: "first-thanks" };
const firstSlot: Quest = { kind: "weekly", week: thisWeek, slot: 0 };
const startingOut = { xp: 0, level: 1, coins: 0, skillPoints: 0 };
const journeyCounted = 10;
const weekCounted = journeyCounted + 20;
const xpSteps = [5, 10, 15, 20, 25];
const coinAmounts = [1, 2, 3, 4, 5];

type TableName = keyof typeof schema.tables;
type Caller = Pick<Backend, "mutation">;
type Bonus = { xp: number; coins: number };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function flagsOn(backend: Backend, ...keys: string[]) {
  return switchWebsite(backend, postHog, true, ...keys);
}

async function aTeamIn(backend: Backend) {
  const member = await aMember(backend, juno.user);
  const teammate = await aMember(backend, rowan.user);
  const { asSignedIn } = await aSignedInSession(backend, juno);
  return { backend, member, teammate, asSignedIn };
}

async function thanks(backend: Backend, giver: MemberId, recipient: MemberId) {
  const at = Date.now();
  const event = await backend.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient, { annotations: saysWhy, day: allowanceDay(at, undefined), at }));
  await backend.mutation(internal.quests.quests.followKudosGiven, { event });
}

async function aFinishedJourneyStepIn(backend: Backend, ...alsoOn: string[]) {
  await flagsOn(backend, ...questsFlags, ...alsoOn);
  await journeyShippedBeforeAnyoneJoined(backend);
  const team = await aTeamIn(backend);
  await thanks(backend, team.member, team.teammate);
  return team;
}

async function aFinishedWeeklyQuestIn(backend: Backend, ...alsoOn: string[]) {
  await flagsOn(backend, ...questsFlags, ...alsoOn);
  await journeyShippedBeforeAnyoneJoined(backend);
  const team = await aTeamIn(backend);
  await reachesLevel(backend, team.member, 3);
  await opens(backend, team.member, "quests");
  const slots = (["say-why", "say-why-three-times"] as const).map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 15 } }));
  await backend.run((ctx) => ctx.db.insert("questDraws", { member: team.member, week: thisWeek, drawnAt: Date.now(), slots }));
  await thanks(backend, team.member, team.teammate);
  return team;
}

async function aReadyFeatureIn(backend: Backend, ...alsoOn: string[]) {
  await flagsOn(backend, ...questsFlags, ...alsoOn);
  await journeyShippedBeforeAnyoneJoined(backend);
  const team = await aTeamIn(backend);
  await reachesLevel(backend, team.member, 3);
  return team;
}

async function aShopperWithABoughtCrate(...alsoOn: string[]) {
  const shopping = ["xp-levels", "unlocks", "achievements", "coins", "crate-store"];
  await flagsOn(t, ...shopping);
  await bookShippedBeforeAnyoneJoined(t);
  const member = await aMember(t, juno.user);
  const { asSignedIn } = await aSignedInSession(t, juno);
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: 1000, pointsSpent: 0 }));
  await reachesLevel(t, member, 6);
  await opens(t, member, "book");
  await opens(t, member, "coins");
  await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:earned:120", xp: 0, coins: 120, item: null, catalogueVersion: "2", at: 0 }));
  await flagsOn(t, ...shopping, "collection", ...alsoOn);
  expect(await asSignedIn.mutation(api.website.commands.buyCrate, { next: 1 })).toEqual({ kind: "bought", crate: "bought:1" });
  return { member, asSignedIn };
}

function packsOn(backend: Backend, ...alsoOn: string[]) {
  return flagsOn(backend, ...questsFlags, ...alsoOn, ...packsFlags);
}

function openQuestCrate(caller: Caller, quest: Quest = firstThanks) {
  return caller.mutation(api.website.commands.openQuestCrate, { quest });
}

function openFeature(caller: Caller) {
  return caller.mutation(api.website.commands.openFeature, { feature: "quests" });
}

function openCrate(caller: Caller, crate = "bought:1") {
  return caller.mutation(api.website.commands.openCrate, { crate });
}

function openFromAppHome(backend: Backend, command: Command, eventId = "Ev_OPEN") {
  return backend.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId, user: juno.user, commands: [command] });
}

async function bonusDrawnFor(member: MemberId, crate: string, secret = ""): Promise<Bonus> {
  const digest = new DataView(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}:${member}:${crate}:pack:1`)));
  const fractionAt = (offset: number) => digest.getUint32(offset) / 2 ** 32;
  return { xp: xpSteps[Math.floor(fractionAt(0) * xpSteps.length)]!, coins: coinAmounts[Math.floor(fractionAt(4) * coinAmounts.length)]! };
}

function standingAt(xp: number, coins = 0) {
  return { xp, level: levelOf(xp), coins, skillPoints: 0 };
}

async function everyTable(backend: Backend = t) {
  return backend.run(async (ctx) => {
    const rows = {} as Record<TableName, Record<string, unknown>[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
}

async function everythingWritten(backend: Backend = t) {
  return { tables: await everyTable(backend), scheduled: await backend.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()) };
}

function publishedEvents() {
  return vi.mocked(publish).mock.calls.map(([, event]) => event);
}

function packsExposures() {
  const sent = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === "packs");
  return [...new Map(sent.map((event) => [event.uuid, event])).values()].map(({ properties }) => properties.$feature_flag_response);
}

function levelUpDmsTo(user: string) {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => channel === user && String(text).startsWith("🎉 You reached level"))
    .map(({ text }) => String(text));
}

describe("CV13: a pack pays its bonus once", { timeout: 60_000 }, () => {
  test("CV2 CV5 CV6: a Journey step's crate with nothing held pays its bonus at the website's open, answered as applied with coins hidden", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn(t);
    await packsOn(t);
    const bonus = await bonusDrawnFor(member, "journey:first-thanks");

    expect(await openQuestCrate(asSignedIn), "the open's answer").toEqual({ kind: "opened", applied: { xp: bonus.xp, coins: 0, from: standingAt(journeyCounted), to: standingAt(journeyCounted + bonus.xp) }, drop: expect.objectContaining({ copy: 1 }) });
    expect(xpSteps, "the bonus XP inside band v1").toContain(bonus.xp);
  });

  test("CV5 CV6: a held quest reward and the bonus add up in one applied, from the standing before both, and the bonus pays after the held reward and before questOpened", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn(t, "crate-rewards");
    await packsOn(t, "crate-rewards");
    vi.mocked(publish).mockClear();
    const bonus = await bonusDrawnFor(member, "journey:first-thanks");

    expect(await openQuestCrate(asSignedIn), "the open's answer").toEqual({ kind: "opened", applied: { xp: 10 + bonus.xp, coins: 0, from: startingOut, to: standingAt(10 + bonus.xp) }, drop: expect.objectContaining({ copy: 1 }) });
    const types = publishedEvents().map(({ type }) => type);
    expect(types.filter((type) => type !== "levelReached"), "the open's events in order").toEqual(["xpRecorded", "xpRecorded", "hoggieDropped", "questOpened"]);
  });

  test("CV2 CV6: a weekly quest's crate pays its bonus at the website's open", async () => {
    const { member, asSignedIn } = await aFinishedWeeklyQuestIn(t);
    await packsOn(t);
    const bonus = await bonusDrawnFor(member, `weekly:${thisWeek}:0`);

    expect(await openQuestCrate(asSignedIn, firstSlot)).toEqual({ kind: "opened", applied: { xp: bonus.xp, coins: 0, from: standingAt(weekCounted), to: standingAt(weekCounted + bonus.xp) }, drop: expect.objectContaining({ copy: 1 }) });
  });

  test("CV2 CV6: a feature's crate opens its feature and pays its bonus, answered as applied beside the drop", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t);
    await packsOn(t);
    const bonus = await bonusDrawnFor(member, "unlock:quests");

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened", applied: { xp: bonus.xp, coins: 0, from: startingOut, to: standingAt(bonus.xp) }, drop: expect.objectContaining({ copy: 1 }) });
  });

  test("CV2 CV6: a bought crate pays its bonus, its coins shown where coins are visible", async () => {
    const { member, asSignedIn } = await aShopperWithABoughtCrate("packs");
    const bonus = await bonusDrawnFor(member, "bought:1");

    expect(await openCrate(asSignedIn)).toEqual({ kind: "opened", applied: { xp: bonus.xp, coins: bonus.coins, from: standingAt(1000, 70), to: standingAt(1000 + bonus.xp, 70 + bonus.coins) }, drop: expect.objectContaining({ copy: 1 }) });
    expect(coinAmounts, "the bonus coins inside band v1").toContain(bonus.coins);
  });

  test("CV5 CV9: crates opened from App Home pay the same bonus, and the website's later opens answer it without paying again", async () => {
    const { member, asSignedIn } = await aFinishedWeeklyQuestIn(t, "crate-rewards");
    await packsOn(t, "crate-rewards");
    await openFromAppHome(t, { type: "openQuestCrate", quest: firstThanks }, "Ev_JOURNEY");
    await openFromAppHome(t, { type: "openQuestCrate", quest: firstSlot }, "Ev_WEEKLY");
    const journey = await bonusDrawnFor(member, "journey:first-thanks");
    const weekly = await bonusDrawnFor(member, `weekly:${thisWeek}:0`);
    const afterJourney = 10 + journey.xp;
    const before = await everyTable();

    expect(await openQuestCrate(asSignedIn), "the Journey crate's answer").toEqual({ kind: "opened", applied: { xp: afterJourney, coins: 0, from: startingOut, to: standingAt(afterJourney) }, drop: expect.anything() });
    expect(await openQuestCrate(asSignedIn, firstSlot), "the weekly crate's answer").toEqual({
      kind: "opened",
      applied: { xp: 20 + weekly.xp, coins: 0, from: standingAt(afterJourney), to: standingAt(afterJourney + 20 + weekly.xp) },
      drop: expect.anything(),
    });
    expect(await everyTable(), "tables after the website's opens").toEqual(before);
  });

  test("CV5 CV9: a feature and a bought crate opened from App Home pay their bonus once, and the website answers it", async () => {
    const { member, asSignedIn } = await aShopperWithABoughtCrate("packs");
    await openFromAppHome(t, { type: "openCrate", crate: "bought:1" });
    const bonus = await bonusDrawnFor(member, "bought:1");

    expect(await openCrate(asSignedIn)).toEqual({ kind: "opened", applied: { xp: bonus.xp, coins: bonus.coins, from: standingAt(1000, 70), to: standingAt(1000 + bonus.xp, 70 + bonus.coins) }, drop: expect.anything() });

    const ready = await aReadyFeatureIn(testBackend());
    await packsOn(ready.backend);
    await openFromAppHome(ready.backend, { type: "openUnlock", feature: "quests" });
    const featureBonus = await bonusDrawnFor(ready.member, "unlock:quests");
    expect(await openFeature(ready.asSignedIn)).toEqual({ kind: "opened", applied: { xp: featureBonus.xp, coins: 0, from: startingOut, to: standingAt(featureBonus.xp) }, drop: expect.anything() });
  });

  test("CV5: a second website open, a replayed App Home Open and a new App Home Open of an opened crate pay nothing and write nothing", async () => {
    const { asSignedIn } = await aFinishedJourneyStepIn(t);
    await packsOn(t);
    await openFromAppHome(t, { type: "openQuestCrate", quest: firstThanks });
    const first = await openQuestCrate(asSignedIn);
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();
    vi.setSystemTime(now.getTime() + 60_000);

    await openFromAppHome(t, { type: "openQuestCrate", quest: firstThanks });
    await openFromAppHome(t, { type: "openQuestCrate", quest: firstThanks }, "Ev_OPEN_AGAIN");
    expect(await openQuestCrate(asSignedIn), "the repeated website open").toEqual(first);

    expect((await everythingWritten()).tables, "tables after the repeats").toEqual({ ...before.tables, slackReceipts: expect.any(Array) });
    expect(publishedEvents(), "events of the repeats").toEqual([]);
  });

  test("CV4 CV5: the same member and crate pay the same bonus in a second fresh backend with the same secret", async () => {
    vi.stubEnv("HOGGIE_DRAW_SECRET", "a-deployment-secret");
    const elsewhere = await aFinishedJourneyStepIn(testBackend());
    await packsOn(elsewhere.backend);
    const here = await aFinishedJourneyStepIn(t);
    await packsOn(t);
    expect(here.member).toBe(elsewhere.member);
    const bonus = await bonusDrawnFor(here.member, "journey:first-thanks", "a-deployment-secret");

    const answer = await openQuestCrate(here.asSignedIn);

    expect(answer).toEqual(await openQuestCrate(elsewhere.asSignedIn));
    expect(answer).toMatchObject({ applied: { xp: bonus.xp } });
  });

  test("CV5 CV9: a bonus that crosses a level publishes levelReached and sends the level-up DM, as any XP does", async () => {
    const { member } = await aFinishedJourneyStepIn(t);
    await packsOn(t);
    await t.run(async (ctx) => {
      const progress = await ctx.db
        .query("memberProgress")
        .withIndex("by_member", (q) => q.eq("member", member))
        .unique();
      await ctx.db.patch(progress!._id, { xp: 15 });
    });

    await openFromAppHome(t, { type: "openQuestCrate", quest: firstThanks });
    await settleInTimeOrder(t);

    expect(publishedEvents().filter(({ type }) => type === "levelReached")).toEqual([expect.objectContaining({ member, level: 2 })]);
    expect(levelUpDmsTo(juno.user)).toEqual([expect.stringContaining("level 2")]);
  });

  test("CV5: a refused open pays nothing", async () => {
    await packsOn(t);
    await journeyShippedBeforeAnyoneJoined(t);
    const { member, asSignedIn } = await aTeamIn(t);

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "refused" });
    expect(await openFeature(asSignedIn)).toEqual({ kind: "refused" });
    expect(await t.run((ctx) => ctx.db.query("memberProgress").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("drops").withIndex("by_member_at", (q) => q.eq("member", member)).collect())).toEqual([]);
  });

  test("CV5: a crate opened while packs was off keeps no bonus once packs turns on, and a pack paid stays paid when packs turns off", async () => {
    const { asSignedIn } = await aFinishedWeeklyQuestIn(t);
    await flagsOn(t, ...questsFlags, "collection");
    const openedWhileOff = await openQuestCrate(asSignedIn);
    await packsOn(t);

    expect(await openQuestCrate(asSignedIn), "the crate opened while packs was off").toEqual({ ...openedWhileOff, applied: null });
    const paid = await openQuestCrate(asSignedIn, firstSlot);
    expect(paid).toMatchObject({ applied: { xp: expect.any(Number) } });
    await flagsOn(t, ...questsFlags, "collection");
    expect(await openQuestCrate(asSignedIn, firstSlot), "the paid crate with packs off again").toEqual({ ...paid, applied: null });
  });
});

describe("CV3 CV4: the pack draw", () => {
  test("is SHA-256 of the secret, member, crate key, 'pack' and band version, bytes 0–3 picking the XP step and 4–7 the coins", async () => {
    for (const crate of ["journey:first-thanks", `weekly:${thisWeek}:1`, "group:g1:2026-10-12", "unlock:quests", "bought:7"] as CrateKey[]) {
      expect(await packBonusOf({ secret: "s", member: "m1", crate }), crate).toEqual(await bonusDrawnFor("m1" as MemberId, crate, "s"));
    }
  });

  test("over 10,000 crate keys, each XP step and each coin amount is drawn within one percentage point of its share", async () => {
    const keys = Array.from({ length: 10_000 }, (_, index): CrateKey => `bought:${index + 1}`);
    const bonuses = await Promise.all(keys.map((crate) => packBonusOf({ secret: "s", member: "m1", crate })));
    const shareOf = (count: number) => count / keys.length;

    for (const step of xpSteps) expect(Math.abs(shareOf(bonuses.filter(({ xp }) => xp === step).length) - 0.2), `share of ${step} XP`).toBeLessThan(0.01);
    for (const amount of coinAmounts) expect(Math.abs(shareOf(bonuses.filter(({ coins }) => coins === amount).length) - 0.2), `share of ${amount} coins`).toBeLessThan(0.01);
  });
});

describe("CV10: a paid bonus in hoggieDropped and hoggie dropped", () => {
  test("hoggieDropped carries the pack's XP and coins, and hoggie dropped projects them as pack_xp and pack_coins", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t);
    await packsOn(t);
    vi.mocked(publish).mockClear();
    const bonus = await bonusDrawnFor(member, "unlock:quests");

    await openFeature(asSignedIn);
    await settleInTimeOrder(t);

    expect(publishedEvents().find(({ type }) => type === "hoggieDropped")).toMatchObject({ type: "hoggieDropped", member, crate: "unlock:quests", pack: bonus });
    const dropped = postHog.productEvents().filter(({ event }) => event === "hoggie dropped");
    expect(dropped.map(({ properties: { pack_xp, pack_coins, crate_kind } }) => ({ pack_xp, pack_coins, crate_kind }))).toEqual([{ pack_xp: bonus.xp, pack_coins: bonus.coins, crate_kind: "unlock" }]);
  });
});

describe("CV11: with packs off or unset, the opens answer main's and pay no bonus", () => {
  test.each([
    { condition: "off", packs: [offForEveryone("packs")] },
    { condition: "unset", packs: [] },
  ])("with packs $condition, the opens answer no bonus, hoggieDropped carries none, and only the flag's exposure differs", async ({ packs }) => {
    const { asSignedIn } = await aFinishedWeeklyQuestIn(t, "crate-rewards");
    await flagsFromPostHog(t, postHog, ...["website", ...questsFlags, "crate-rewards", "collection"].map(onForEveryone), ...packs);
    vi.mocked(publish).mockClear();

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "opened", applied: { xp: 10, coins: 0, from: startingOut, to: standingAt(10) }, drop: expect.anything() });
    expect(await openQuestCrate(asSignedIn, firstSlot)).toEqual({ kind: "opened", applied: { xp: 20, coins: 0, from: standingAt(10), to: standingAt(30) }, drop: expect.anything() });
    expect(publishedEvents().filter(({ type }) => type === "hoggieDropped")).toEqual([expect.not.objectContaining({ pack: expect.anything() }), expect.not.objectContaining({ pack: expect.anything() })]);
    expect(withoutExposureOf("packs", await everyTable()).drops).toEqual([expect.not.objectContaining({ pack: expect.anything() }), expect.not.objectContaining({ pack: expect.anything() })]);
  });

  test("with packs off, a feature's and a bought crate's opens answer main's, with no applied field", async () => {
    const { asSignedIn } = await aShopperWithABoughtCrate();

    expect(await openCrate(asSignedIn)).toEqual({ kind: "opened", drop: expect.objectContaining({ copy: 1 }) });

    const ready = await aReadyFeatureIn(testBackend(), "collection");
    expect(await openFeature(ready.asSignedIn)).toEqual({ kind: "opened", drop: expect.objectContaining({ copy: 1 }) });
  });
});

describe("CV11: packs' exposure", () => {
  test("goes once per member and value, only in a first successful open while collection is on", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn(t);
    await flagsOn(t, ...questsFlags, "packs");
    await openQuestCrate(asSignedIn);
    await openQuestCrate(asSignedIn, firstSlot);
    await settleInTimeOrder(t);
    expect(packsExposures(), "exposures with collection off").toEqual([]);

    await packsOn(t);
    await reachesLevel(t, member, 3);
    await openFeature(asSignedIn);
    await openFeature(asSignedIn);
    await settleInTimeOrder(t);

    expect(packsExposures()).toEqual([true]);
  });
});
