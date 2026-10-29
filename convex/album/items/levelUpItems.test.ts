import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../../testing/fakePostHog";
import { FakeSlack } from "../../../testing/fakeSlack";
import { post, settle, testBackend, type Backend } from "../../../testing/slackBackend";
import { emoji, mention, section } from "../../../testing/slackMessages";
import { reachesLevel } from "../../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../../testing/website";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { catalogue, type Rarity } from "../hoggies/catalogue";
import { drawOf } from "../hoggies/draw";
import type { AlbumAnswer, AlbumRead, TurnAnswer } from "../../website/album";
import type { Denial } from "../../website/memberQuery";
import type { MemberId } from "../../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const oldReveal = ["xp-levels", "album", "collection", "packs", "level-up-reveal"];
const itemsOn = [...oldReveal, "hidden-items"];
const rareOrRarer: Rarity[] = ["rare", "epic", "legendary"];
const slots: ReadonlyArray<{ slot: number; floor?: Rarity }> = [{ slot: 1 }, { slot: 2 }, { slot: 3, floor: "rare" }];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;

let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack();
  for (const person of [alice, bob]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await switchWebsite(t, postHog, true, ...itemsOn);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP6 LP7: a level up earns its three hoggies as items", { timeout: 60_000 }, () => {
  test("with hidden-items on, a kudos that takes the giver to level 2 earns three items keyed by the level's slots, the third with a rare floor, each naming its level on the board, and drops nothing", async () => {
    await kudos(alice, bob, 2);
    const asAlice = await signedIn(alice);

    expect(await levelUpItemsOf(alice), "the giver's stored level-up items").toEqual([
      { source: "hoggie", key: "level:2:1", reason: { kind: "levelUp", level: 2 } },
      { source: "hoggie", key: "level:2:2", reason: { kind: "levelUp", level: 2 } },
      { source: "hoggie", key: "level:2:3", floor: "rare", reason: { kind: "levelUp", level: 2 } },
    ]);
    expect(levelUpItemsOn(await boardOf(asAlice)).map(({ reason }) => reason), "the board's level-up reasons").toEqual(Array.from({ length: 3 }, () => ({ kind: "levelUp", level: 2 })));
    expect(await cratesDroppedFor(alice), "the level up's drops").toEqual([]);
    expect(await foundHoggiesOf(asAlice), "the hoggies found").toEqual([]);
  });

  test("each level reached earns its own three, and a replayed level up earns nothing more", async () => {
    const member = await memberOf(await joined(alice));

    await reachesLevel(t, member, 2);
    await reachesLevel(t, member, 3);
    await reachesLevel(t, member, 3);

    expect((await itemsOf(alice)).map(({ key }) => key)).toEqual(["level:2:1", "level:2:2", "level:2:3", "level:3:1", "level:3:2", "level:3:3"]);
  });

  test("Album's follower of levelReached, delivered the same level twice, earns the level's three items once", async () => {
    const member = await memberOf(await joined(alice));
    const event = levelReachedOf(member, 2);

    await t.mutation(internal.album.levelUpHoggies.earnLevelUpHoggies, { event });
    await t.mutation(internal.album.levelUpHoggies.earnLevelUpHoggies, { event });

    expect((await boardOf(await signedIn(alice))).items.map(({ reason }) => reason), "the board after two deliveries").toEqual(Array.from({ length: 3 }, () => ({ kind: "levelUp", level: 2 })));
  });

  test("with hidden-items off, the level up drops its three as today and marks their items turned, so none waits once hidden-items turns on", async () => {
    await switchWebsite(t, postHog, true, ...oldReveal);
    await kudos(alice, bob, 2);

    expect(await cratesDroppedFor(alice), "the level up's drops").toEqual(["level:2:1", "level:2:2", "level:2:3"]);
    await switchWebsite(t, postHog, true, ...itemsOn);
    expect(levelUpItemsOn(await boardOf(await signedIn(alice)))).toEqual([]);
  });

  test("with hidden-items and level-up-reveal off, nothing drops and the three items wait on the board once hidden-items turns on", async () => {
    await switchWebsite(t, postHog, true, ...oldReveal.filter((flag) => flag !== "level-up-reveal"));
    await kudos(alice, bob, 2);

    expect(await cratesDroppedFor(alice), "the level up's drops").toEqual([]);
    await switchWebsite(t, postHog, true, ...itemsOn);
    expect(levelUpItemsOn(await boardOf(await signedIn(alice))).map(({ reason }) => reason)).toEqual(Array.from({ length: 3 }, () => ({ kind: "levelUp", level: 2 })));
  });
});

describe("LP11 LP20: a level item is drawn at its turn, pays no XP, and the third never draws below rare", { timeout: 120_000 }, () => {
  test("turning a level's three items draws each from its own crate, the third with the rare floor, and applies nothing", async () => {
    const member = await memberOf(await joined(alice));
    await reachesLevel(t, member, 3);
    const asAlice = await signedIn(alice);
    const before = (await albumOf(asAlice)).level;

    const turned = [];
    for (const { item } of (await boardOf(asAlice)).items) turned.push(await turn(asAlice, item));
    await settle(t);

    const drawn = await Promise.all(slots.map(({ slot, floor }) => drawnFor(member, `level:3:${slot}`, floor)));
    expect(turned.map((answer) => answer.kind === "turned" && { hoggie: hoggieDrawnBy(answer)?.hoggie, rarity: hoggieDrawnBy(answer)?.rarity, applied: answer.applied })).toEqual(drawn.map(({ hoggie, rarity }) => ({ hoggie, rarity, applied: null })));
    expect((await albumOf(asAlice)).level, "the member's level and XP").toEqual(before);
    expect((await boardOf(asAlice)).items).toEqual([]);
  });

  test("over twenty level ups, every third item turns rare or rarer", async () => {
    const member = await memberOf(await joined(alice));
    for (let level = 2; level <= 21; level++) await reachesLevel(t, member, level);
    const asAlice = await signedIn(alice);

    const thirds = await itemsKeyed(alice, (key) => key.endsWith(":3"));
    expect(thirds).toHaveLength(20);
    for (const { _id, key } of thirds) {
      const answer = await turn(asAlice, _id);
      expect(rareOrRarer.includes(hoggieDrawnBy(answer)?.rarity ?? "common"), `${key}'s turned rarity`).toBe(true);
    }
  });
});

describe("LP6 LP24: with hidden-items back off, fillItems reveals every waiting level item through the old level-up drop, once", { timeout: 60_000 }, () => {
  test("a level reached with hidden-items on reaches the old reveal once it is off, pays nothing, a rerun drops nothing more, and with hidden-items on again nothing waits or draws twice", async () => {
    const member = await memberOf(await joined(alice));
    await reachesLevel(t, member, 2);
    const asAlice = await signedIn(alice);
    const before = (await albumOf(asAlice)).level;
    await fillItems();
    expect((await boardOf(asAlice)).items, "the board after a fill with hidden-items still on").toHaveLength(3);

    await switchWebsite(t, postHog, true, ...oldReveal);
    await fillItems();
    await fillItems();

    expect(await revealedHoggiesOf(asAlice, 2), "the old reveal of level 2").toEqual(await levelDrawnFor(member, 2));
    expect(await cratesDroppedFor(alice), "the drops").toEqual(["level:2:1", "level:2:2", "level:2:3"]);
    await switchWebsite(t, postHog, true, ...itemsOn);
    expect((await boardOf(asAlice)).items, "the board once hidden-items is on again").toEqual([]);
    expect((await albumOf(asAlice)).level, "the member's level and XP").toEqual(before);
    expect(await cratesDroppedFor(alice), "the drops once hidden-items is on again").toHaveLength(3);
  });

  test("a level item turned while hidden-items was on keeps its face, and only the two still waiting drop once it is off", async () => {
    const member = await memberOf(await joined(alice));
    await reachesLevel(t, member, 2);
    const asAlice = await signedIn(alice);
    const [first] = (await boardOf(asAlice)).items;
    await turn(asAlice, first!.item);

    await switchWebsite(t, postHog, true, ...oldReveal);
    await fillItems();

    expect(await revealedHoggiesOf(asAlice, 2), "the old reveal of level 2").toEqual(await levelDrawnFor(member, 2));
    expect(await cratesDroppedFor(alice), "the drops").toHaveLength(3);
  });

  test("more than 100 waiting level items continue from the fill's cursor, each level revealed once", async () => {
    const member = await memberOf(await joined(alice));
    for (let level = 2; level <= 36; level++) await reachesLevel(t, member, level);

    await switchWebsite(t, postHog, true, ...oldReveal);
    await fillItems();
    const asAlice = await signedIn(alice);

    expect(await cratesDroppedFor(alice), "the drops").toHaveLength(105);
    expect(await revealedHoggiesOf(asAlice, 36), "the old reveal of the last level").toEqual(await levelDrawnFor(member, 36));
    await switchWebsite(t, postHog, true, ...itemsOn);
    expect((await boardOf(asAlice)).items, "the board once hidden-items is on again").toEqual([]);
  });

  test("with hidden-items and level-up-reveal off, fillItems drops nothing and the level's items keep waiting, as today", async () => {
    const member = await memberOf(await joined(alice));
    await reachesLevel(t, member, 2);

    await switchWebsite(t, postHog, true, ...oldReveal.filter((flag) => flag !== "level-up-reveal"));
    await fillItems();

    expect(await cratesDroppedFor(alice), "the drops").toEqual([]);
    await switchWebsite(t, postHog, true, ...itemsOn);
    expect((await boardOf(await signedIn(alice))).items.map(({ reason }) => reason), "the board once hidden-items turns on").toEqual(Array.from({ length: 3 }, () => ({ kind: "levelUp", level: 2 })));
  });
});

function levelReachedOf(member: MemberId, level: number) {
  return { type: "levelReached" as const, workspace: "T1", member, level, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200, at: Date.now() };
}

function hoggieDrawnBy(answer: Awaited<ReturnType<typeof turn>>) {
  return answer.kind === "turned" && answer.face.kind === "hoggie" ? answer.face.drop : null;
}

async function kudos(giver: Person, recipient: Person, count: number) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(mention(recipient.user), ...Array.from({ length: count }, () => emoji("taco")))], { user: giver.user, ts });
  await settle(t);
}

async function joined(person: Person) {
  await aMember(t, person.user);
  return person;
}

function turn(reader: Reader, item: Id<"items">): Promise<TurnAnswer | Denial> {
  return reader.mutation(api.website.album.turnItem, { item });
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

async function boardOf(reader: Reader) {
  const { board } = await albumOf(reader);
  if (board === undefined) throw new Error("expected the item board");
  return board;
}

async function foundHoggiesOf(reader: Reader) {
  const answer = await reader.query(api.website.album.getAlbumHoggies, {});
  return answer.kind === "hoggies" ? answer.hoggies.filter(({ found }) => found).map(({ hoggie }) => hoggie) : [];
}

async function signedIn(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: person.user, name: person.name });
  return asSignedIn;
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

async function itemsKeyed(person: Person, wanted: (key: string) => boolean) {
  const member = await memberOf(person);
  const items = await t.run((ctx) =>
    ctx.db
      .query("items")
      .withIndex("by_member_source_key", (q) => q.eq("member", member))
      .collect(),
  );
  return items.filter(({ key }) => wanted(key));
}

function levelUpItemsOn(board: Awaited<ReturnType<typeof boardOf>>) {
  return board.items.filter(({ reason }) => reason.kind === "levelUp");
}

async function levelUpItemsOf(person: Person) {
  return (await itemsOf(person)).filter(({ reason }) => reason.kind === "levelUp");
}

async function itemsOf(person: Person) {
  return (await itemsKeyed(person, () => true)).map(({ source, key, floor, reason }) => ({ source, key, reason, ...(floor && { floor }) }));
}

async function cratesDroppedFor(person: Person) {
  const member = await memberOf(person);
  return t.run(async (ctx) => (await ctx.db.query("drops").withIndex("by_member", (q) => q.eq("member", member)).collect()).map(({ crate }) => crate));
}

async function fillItems() {
  await t.mutation(internal.album.items.fill.fillItems, {});
  await settle(t);
}

async function revealedHoggiesOf(reader: Reader, level: number) {
  const answer = await reader.query(api.website.album.getLevelUp, { level });
  return answer.kind === "levelUp" ? answer.hoggies.map(({ hoggie }) => hoggie) : answer.kind;
}

async function levelDrawnFor(member: MemberId, level: number) {
  return Promise.all(slots.map(async ({ slot, floor }) => (await drawnFor(member, `level:${level}:${slot}`, floor)).hoggie));
}

async function drawnFor(member: MemberId, crate: string, floor?: Rarity) {
  return drawOf({ secret: process.env.HOGGIE_DRAW_SECRET ?? "", member, crate, version: catalogue.version, floor });
}
