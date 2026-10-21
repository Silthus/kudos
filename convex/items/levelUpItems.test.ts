import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { catalogue, type Rarity } from "../hoggies/catalogue";
import { drawOf } from "../hoggies/draw";
import type { AlbumAnswer, AlbumRead, TurnAnswer } from "../website/album";
import type { Denial } from "../website/memberQuery";
import type { MemberId } from "../workspace/directory";

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

    expect(await itemsOf(alice), "the giver's stored items").toEqual([
      { source: "hoggie", key: "level:2:1", reason: { kind: "levelUp", level: 2 } },
      { source: "hoggie", key: "level:2:2", reason: { kind: "levelUp", level: 2 } },
      { source: "hoggie", key: "level:2:3", floor: "rare", reason: { kind: "levelUp", level: 2 } },
    ]);
    expect((await boardOf(asAlice)).items.map(({ reason }) => reason), "the board's reasons").toEqual(Array.from({ length: 3 }, () => ({ kind: "levelUp", level: 2 })));
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

  test("with hidden-items off, the level up drops its three as today and marks their items turned, so none waits once hidden-items turns on", async () => {
    await switchWebsite(t, postHog, true, ...oldReveal);
    await kudos(alice, bob, 2);

    expect(await cratesDroppedFor(alice), "the level up's drops").toEqual(["level:2:1", "level:2:2", "level:2:3"]);
    await switchWebsite(t, postHog, true, ...itemsOn);
    expect((await boardOf(await signedIn(alice))).items).toEqual([]);
  });

  test("with hidden-items and level-up-reveal off, nothing drops and the three items wait on the board once hidden-items turns on", async () => {
    await switchWebsite(t, postHog, true, ...oldReveal.filter((flag) => flag !== "level-up-reveal"));
    await kudos(alice, bob, 2);

    expect(await cratesDroppedFor(alice), "the level up's drops").toEqual([]);
    await switchWebsite(t, postHog, true, ...itemsOn);
    expect((await boardOf(await signedIn(alice))).items.map(({ reason }) => reason)).toEqual(Array.from({ length: 3 }, () => ({ kind: "levelUp", level: 2 })));
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
    expect(turned.map((answer) => answer.kind === "turned" && { hoggie: answer.face.drop.hoggie, rarity: answer.face.drop.rarity, applied: answer.applied })).toEqual(drawn.map(({ hoggie, rarity }) => ({ hoggie, rarity, applied: null })));
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
      expect(answer.kind === "turned" && rareOrRarer.includes(answer.face.drop.rarity), `${key}'s turned rarity`).toBe(true);
    }
  });
});

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

async function itemsOf(person: Person) {
  return (await itemsKeyed(person, () => true)).map(({ source, key, floor, reason }) => ({ source, key, reason, ...(floor && { floor }) }));
}

async function cratesDroppedFor(person: Person) {
  const member = await memberOf(person);
  return t.run(async (ctx) => (await ctx.db.query("drops").withIndex("by_member", (q) => q.eq("member", member)).collect()).map(({ crate }) => crate));
}

async function drawnFor(member: MemberId, crate: string, floor?: Rarity) {
  return drawOf({ secret: process.env.HOGGIE_DRAW_SECRET ?? "", member, crate, version: catalogue.version, floor });
}
