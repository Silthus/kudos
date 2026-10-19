import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { holds } from "../../testing/hoggies";
import { post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { catalogue, hoggieNamed, hoggiesOfRarity, rarities } from "../hoggies/catalogue";
import type { AlbumAnswer, AlbumHoggiesAnswer, AlbumRead, OpenAnswer } from "../website/album";
import type { MemberId } from "../workspace/directory";

const theDraw = vi.hoisted(() => ({ pinned: [] as string[] }));

vi.mock("../hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/draw")>();
  const { hoggieNamed } = await import("../hoggies/catalogue");
  return {
    ...actual,
    drawOf: vi.fn(async (input: Parameters<typeof actual.drawOf>[0]) => {
      const pinned = input.crate.startsWith("thoughtful:") ? theDraw.pinned.shift() : undefined;
      return pinned === undefined ? actual.drawOf(input) : { hoggie: pinned, rarity: hoggieNamed(pinned)!.rarity };
    }),
  };
});

const minuteMs = 60_000;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;
type ItemId = Id<"trayItems">;

const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };

const [common, otherCommon] = hoggiesOfRarity("common").map(({ hoggie }) => hoggie);
const [uncommon] = hoggiesOfRarity("uncommon").map(({ hoggie }) => hoggie);
const [rare] = hoggiesOfRarity("rare").map(({ hoggie }) => hoggie);
const [epic, otherEpic] = hoggiesOfRarity("epic").map(({ hoggie }) => hoggie);
const [legendary, otherLegendary] = hoggiesOfRarity("legendary").map(({ hoggie }) => hoggie);

let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  theDraw.pinned = [];
  vi.useFakeTimers({ now: new Date("2026-10-13T10:00:00Z") });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack();
  for (const { user, name } of [alice, bob, carol]) slack.withMember(user, { profile: { display_name: name, real_name: name } });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => slack.fetch(input, init)));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const whateverTheBookSays = [
  { book: "achievements and unlocks off and so no Book", alsoOn: [], collection: "not-found" },
  { book: "unlocks and achievements on and the Book open", alsoOn: ["xp-levels", "unlocks", "achievements"], collection: "collection" },
];

describe("AL73: the album's hoggies", { timeout: 60_000 }, () => {
  test.each(whateverTheBookSays)("with $book, getAlbumHoggies answers every catalogue hoggie, the one put in found and the one still in the tray hidden, the same whatever getCollection answers", async ({ alsoOn, collection }) => {
    await switchWebsite(t, postHog, true, ...albumOpen, ...alsoOn);
    theDraw.pinned = [epic!, legendary!];
    await thanks(alice, why, bob, carol);
    const asAlice = await signedIn(alice);
    const [putInHoggie, waitingHoggie] = hoggiesIn(await openEvery(asAlice));
    vi.setSystemTime(Date.now() + minuteMs);
    await putIn(asAlice, putInHoggie!.item);
    const putInAt = Date.now();

    const hoggies = await albumHoggiesOf(asAlice);

    expect(hoggies.hoggies.map(({ hoggie }) => hoggie), "every hoggie of the catalogue, in its order").toEqual(catalogue.hoggies.map(({ hoggie }) => hoggie));
    expect(entryOf(hoggies, epic!), "the hoggie put in").toEqual({ hoggie: epic, name: hoggieNamed(epic!)!.name, rarity: "epic", art: { kind: "hoggie", slug: epic }, found: true, count: 1, spares: 0, firstAt: putInAt });
    expect(entryOf(hoggies, legendary!), "the hoggie still in the tray").toEqual({ hoggie: legendary, name: hoggieNamed(legendary!)!.name, rarity: "legendary", art: { kind: "hoggie", slug: legendary }, found: false, count: 0, spares: 0, firstAt: null });
    expect(hoggies.hoggies.filter(({ found }) => found).map(({ hoggie }) => hoggie), "the hoggies found").toEqual([epic]);
    expect([hoggies.found, hoggies.total]).toEqual([1, catalogue.hoggies.length]);
    expect(hoggies.rarities).toEqual(rarities.map(({ rarity, weight }) => ({ rarity, chance: weight, found: rarity === "epic" ? 1 : 0, total: hoggiesOfRarity(rarity).length })));
    expect(hoggies.rarest.map(({ hoggie }) => hoggie), "the rarest finds leave the tray's legendary out").toEqual([epic]);
    expect(waitingHoggie).toMatchObject({ hoggie: legendary });
    expect((await collectionRead(asAlice)).kind, "getCollection's answer").toBe(collection);
  });

  test("two copies of one hoggie put in count two with one spare, first found at the first put-in, and a hoggie from an older crate is found as it was", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    await thanks(alice, why, bob);
    await holds(t, await memberOf(alice), common!);
    const heldAt = Date.now();
    theDraw.pinned = [rare!, rare!];
    await thanks(alice, why, carol);
    const asAlice = await signedIn(alice);
    const items = await openEvery(asAlice);
    vi.setSystemTime(Date.now() + minuteMs);
    const [firstCopy, secondCopy] = hoggiesIn(items).filter(({ hoggie }) => hoggie === rare);
    await putIn(asAlice, firstCopy!.item);
    const firstPutInAt = Date.now();
    vi.setSystemTime(Date.now() + minuteMs);
    await putIn(asAlice, secondCopy!.item);

    const hoggies = await albumHoggiesOf(asAlice);

    expect(entryOf(hoggies, rare!)).toMatchObject({ found: true, count: 2, spares: 1, firstAt: firstPutInAt });
    expect(entryOf(hoggies, common!)).toMatchObject({ found: true, count: 1, spares: 0, firstAt: heldAt });
  });

  test("the rarest finds are the five found hoggies of the highest rarity, the newest first within a rarity, counting a tray hoggie only once it is put in", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    await thanks(alice, why, bob);
    const member = await memberOf(alice);
    for (const hoggie of [common!, epic!, uncommon!, rare!, legendary!, otherCommon!, otherEpic!]) {
      vi.setSystemTime(Date.now() + minuteMs);
      await holds(t, member, hoggie);
    }
    theDraw.pinned = [otherLegendary!];
    const asAlice = await signedIn(alice);
    await openEvery(asAlice);

    const waiting = await albumHoggiesOf(asAlice);

    expect(waiting.rarest.map(({ hoggie }) => hoggie)).toEqual([legendary, otherEpic, epic, rare, uncommon]);
    expect(waiting.rarest[0], "a rarest find is the hoggie's whole entry").toEqual(entryOf(waiting, legendary!));
  });
});

describe("the album is private", { timeout: 60_000 }, () => {
  test("getAlbumHoggies answers each signed-in member the hoggies they found, never another member's", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    await thanks(alice, why, bob);
    await thanks(bob, "Thanks for pairing on the gnarly cache bug", carol);
    await holds(t, await memberOf(alice), epic!);
    await holds(t, await memberOf(bob), legendary!);

    const found = Object.fromEntries(await Promise.all([alice, bob, carol].map(async (someone) => [someone.name, foundIn(await albumHoggiesOf(await signedIn(someone)))])));

    expect(found).toEqual({ [alice.name]: [epic], [bob.name]: [legendary], [carol.name]: [] });
  });

  test("getAlbumHoggies rejects an argument that names another member", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    await thanks(alice, why, bob);
    const withAnotherMember = { member: await memberOf(alice) } as unknown as Record<string, never>;

    await expect((await signedIn(bob)).query(api.website.album.getAlbumHoggies, withAnotherMember)).rejects.toThrow(/member/);
  });
});

describe("CL11: turning collection off hides every hoggie and takes nothing away; on again shows the same", { timeout: 60_000 }, () => {
  test("with album on, turning collection off makes getAlbumHoggies answer off and keeps every find, and on again shows the same hoggies", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    await thanks(alice, why, bob);
    await holds(t, await memberOf(alice), epic!);
    const asAlice = await signedIn(alice);
    const before = await albumHoggiesOf(asAlice);

    await switchWebsite(t, postHog, true, "album", "packs");
    const whileOff = await asAlice.query(api.website.album.getAlbumHoggies, {});
    await switchWebsite(t, postHog, true, ...albumOpen);

    expect(whileOff, "getAlbumHoggies while collection is off").toEqual({ kind: "off" });
    expect(await albumHoggiesOf(asAlice), "on again").toEqual(before);
    expect(foundIn(before)).toEqual([epic]);
  });
});

describe("AL40: getAlbumHoggies answers off while album is off for the member", () => {
  test("with album off, getAlbumHoggies answers off whatever the member found", async () => {
    await switchWebsite(t, postHog, true, "collection", "packs");
    await thanks(alice, why, bob);
    await holds(t, await memberOf(alice), epic!);

    expect(await (await signedIn(alice)).query(api.website.album.getAlbumHoggies, {})).toEqual({ kind: "off" });
  });
});

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(messages).padStart(6, "0")}` });
  await settle(t);
}

type OpenAnswerItems = Extract<OpenAnswer, { kind: "opened" }>["items"];

async function openEvery(reader: Reader) {
  const items: OpenAnswerItems = [];
  for (const { pack } of (await albumOf(reader)).packs) {
    vi.setSystemTime(Date.now() + 1_000);
    const opened = await reader.mutation(api.website.album.openThoughtfulPack, { pack });
    if (opened.kind !== "opened") throw new Error(`expected an open, got ${JSON.stringify(opened)}`);
    items.push(...opened.items);
  }
  return items;
}

function hoggiesIn(items: OpenAnswerItems) {
  return items.flatMap((item) => (item.kind === "hoggie" ? [item] : []));
}

function putIn(reader: Reader, item: ItemId) {
  return reader.mutation(api.website.album.putIn, { item });
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

async function albumHoggiesOf(reader: Reader): Promise<AlbumHoggiesAnswer> {
  const hoggies: { kind: string } = await reader.query(api.website.album.getAlbumHoggies, {});
  if (hoggies.kind !== "hoggies") throw new Error(`expected the album's hoggies, got ${JSON.stringify(hoggies)}`);
  return hoggies as AlbumHoggiesAnswer;
}

function collectionRead(reader: Reader): Promise<{ kind: string }> {
  return reader.query(api.website.collection.getCollection, {});
}

function entryOf(hoggies: AlbumHoggiesAnswer, hoggie: string) {
  return hoggies.hoggies.find((entry) => entry.hoggie === hoggie);
}

function foundIn(hoggies: AlbumHoggiesAnswer) {
  return hoggies.hoggies.filter(({ found }) => found).map(({ hoggie }) => hoggie);
}

async function signedIn(someone: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: someone.user, name: someone.name });
  return asSignedIn;
}

async function memberOf(someone: Person): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", someone.user))
      .unique(),
  );
  if (row === null) throw new Error(`${someone.name} is no member`);
  return row._id;
}

