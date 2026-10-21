import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { catalogue } from "../hoggies/catalogue";
import { drawOf } from "../hoggies/draw";
import schema from "../schema";
import type { AlbumAnswer, AlbumRead, TurnAnswer } from "../website/album";
import type { Denial } from "../website/memberQuery";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs"];
const itemsOn = [...albumOpen, "hidden-items"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;
type ItemId = Id<"items">;

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
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...itemsOn);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP5 LP7: a thanks in Slack earns its pack's hoggie as one item", () => {
  test("a thoughtful kudos earns the giver exactly one item for thanking the recipient, and the redelivered event earns nothing more", async () => {
    const ts = await thanks(alice, why, bob);
    await redeliver(alice, why, ts, bob);

    const { board } = await albumOf(await signedIn(alice));

    expect(board?.items.map(({ reason }) => reason)).toEqual([{ kind: "thanks", thanked: { name: bob.name, face: expect.anything() } }]);
  });

  test("the item is earned while hidden-items is off, and waits on the board once it turns on", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    await thanks(alice, why, bob);

    await switchWebsite(t, postHog, true, ...itemsOn);

    expect((await boardOf(await signedIn(alice))).items).toHaveLength(1);
  });
});

describe("LP8 LP9 LP17: with hidden-items on, getAlbum answers the item board and no packs or tray", () => {
  test("the board lists the waiting items oldest first, naming only when each was earned and whom it thanked, and the packs and the tray are empty", async () => {
    await thanks(alice, why, bob);
    await thanks(alice, "Thanks for pairing on the release", carol);

    const album = await albumOf(await signedIn(alice));

    expect(album.board?.items.map(({ reason }) => reason.thanked.name)).toEqual([bob.name, carol.name]);
    for (const item of album.board!.items) expect(Object.keys(item).sort()).toEqual(["earnedAt", "item", "reason"]);
    expect(album.board?.more).toBe(false);
    expect(album).toMatchObject({ packs: [], morePacks: false, tray: [], moreTray: false });
  });

  test("a board of 101 waiting items shows the oldest 100 with more", async () => {
    const crowd = Array.from({ length: 101 }, (_, index) => ({ user: `U_CROWD_${index}`, name: `Crowd Person ${index}` }));
    for (const person of crowd) slack.withMember(person.user, { real_name: person.name });
    await thanks(alice, why, ...crowd.slice(0, 50));
    await thanks(alice, why, ...crowd.slice(50));

    const board = await boardOf(await signedIn(alice));

    expect(board.items).toHaveLength(100);
    expect(board.more).toBe(true);
  });
});

describe("LP10 LP11 LP16: turnItem draws the hoggie at the turn, pays the pack's 15 XP and sends item turned", () => {
  test("the turn answers the drawn hoggie on the Hoggies page with 15 XP applied, the board empties, the hoggie is found and item turned names its source, rarity and newness", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const before = (await albumOf(asAlice)).level.xp;
    const [item] = (await boardOf(asAlice)).items;

    const turned = await turn(asAlice, item!.item);
    await settle(t);

    const drawn = await drawnFor(alice, await packOf(alice));
    expect(turned).toMatchObject({ kind: "turned", again: false, face: { kind: "hoggie", drop: { hoggie: drawn.hoggie, rarity: drawn.rarity, isNew: true } }, applied: { xp: 15, coins: 0 }, page: { kind: "hoggies" } });
    const album = await albumOf(asAlice);
    expect(album.level.xp).toBe(before + 15);
    expect(album.board?.items).toEqual([]);
    expect(await foundHoggiesOf(asAlice)).toEqual([drawn.hoggie]);
    expect(eventsNamed("item turned").map(({ properties: { source, rarity, is_new } }) => ({ source, rarity, is_new }))).toEqual([{ source: "hoggie", rarity: drawn.rarity, is_new: true }]);
  });
});

describe("LP12: a replayed turn answers the same face and applies nothing", () => {
  test("turning the same item again answers its face with again, pays nothing more and sends nothing more", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [item] = (await boardOf(asAlice)).items;
    const first = await turn(asAlice, item!.item);
    const xp = (await albumOf(asAlice)).level.xp;

    const again = await turn(asAlice, item!.item);
    await settle(t);

    expect(again).toEqual({ ...first, again: true, applied: null });
    expect((await albumOf(asAlice)).level.xp).toBe(xp);
    expect(eventsNamed("item turned")).toHaveLength(1);
    expect(eventsNamed("hoggie dropped")).toHaveLength(1);
  });

  test("two items turned at once both land", async () => {
    await thanks(alice, why, bob, carol);
    const asAlice = await signedIn(alice);
    const items = (await boardOf(asAlice)).items;

    const answers = await Promise.all(items.map(({ item }) => turn(asAlice, item)));

    expect(answers.map(({ kind }) => kind)).toEqual(["turned", "turned"]);
    expect((await boardOf(asAlice)).items).toEqual([]);
  });
});

describe("LP10: turnItem refuses and writes nothing", () => {
  test("another member's item is refused", async () => {
    await thanks(alice, why, bob);
    const [item] = (await boardOf(await signedIn(alice))).items;
    const asBob = await signedIn(bob);
    const before = await everythingWritten();

    expect(await turn(asBob, item!.item)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("a missing item is refused", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const member = await memberOf(alice);
    const gone = await t.run(async (ctx) => {
      const id = await ctx.db.insert("items", { workspace: "T1", member, source: "hoggie", key: "thoughtful:gone", reason: { kind: "thanks", person: member, message: { workspace: "T1", conversation: "C1", message: "1.000001" } }, earnedAt: Date.now() });
      await ctx.db.delete(id);
      return id;
    });
    const before = await everythingWritten();

    expect(await turn(asAlice, gone)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
  });

  test.each([
    ["hidden-items off", albumOpen],
    ["album off", ["collection", "packs", "hidden-items"]],
  ])("with %s the turn is refused", async (_, flags) => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [item] = (await boardOf(asAlice)).items;
    await switchWebsite(t, postHog, true, ...flags);
    const before = await everythingWritten();

    expect(await turn(asAlice, item!.item)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
  });
});

describe("LP6: with hidden-items off, packs, the tray and the open stay as today, and the open marks the item turned", () => {
  test("getAlbum answers no board, the pack waits and opens into the tray, and once hidden-items turns on the opened pack's item no longer waits", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const album = await albumOf(asAlice);
    expect(album.board).toBeUndefined();

    const opened = await asAlice.mutation(api.website.album.openThoughtfulPack, { pack: album.packs[0]!.pack });

    expect(opened).toMatchObject({ kind: "opened", items: [{ kind: "sticker" }, { kind: "hoggie" }] });
    await switchWebsite(t, postHog, true, ...itemsOn);
    expect((await boardOf(asAlice)).items).toEqual([]);
  });
});

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return ts;
}

async function redeliver(giver: Person, words: string, ts: string, ...recipients: Person[]) {
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
}

function turn(reader: Reader, item: ItemId): Promise<TurnAnswer | Denial> {
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

async function packOf(giver: Person) {
  const member = await memberOf(giver);
  const pack = await t.run((ctx) =>
    ctx.db
      .query("thoughtfulPacks")
      .withIndex("by_giver_at", (q) => q.eq("giver", member))
      .first(),
  );
  return pack!._id;
}

async function drawnFor(person: Person, pack: Id<"thoughtfulPacks">) {
  return drawOf({ secret: "", member: await memberOf(person), crate: `thoughtful:${pack}`, version: catalogue.version });
}

function eventsNamed(name: string) {
  return postHog.productEvents().filter(({ event }) => event === name);
}

async function everythingWritten() {
  const tables = await t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  return { tables, scheduled: await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()) };
}
