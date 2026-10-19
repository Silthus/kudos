import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { catalogue } from "../hoggies/catalogue";
import { drawOf } from "../hoggies/draw";
import { recordReward } from "../progression/progression";
import schema from "../schema";
import type { AlbumAnswer, AlbumRead } from "../website/album";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;
type PackId = Id<"thoughtfulPacks">;

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
  await switchWebsite(t, postHog, true, ...albumOpen);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AL8 AL10: opening a thoughtful pack puts its sticker and its hoggie in the stored tray", () => {
  test("an opened pack leaves the waiting packs, its sticker and then its hoggie wait in the tray, and another device reads the same tray", async () => {
    await thanks(alice, why, bob, carol);
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);

    const opened = await open(asAlice, forBob!);

    const drawn = await drawnFor(alice, forBob!);
    expect(opened).toMatchObject({ kind: "opened", items: [{ kind: "sticker", person: await memberOf(bob) }, { kind: "hoggie", hoggie: drawn.hoggie, rarity: drawn.rarity, isNew: true }] });
    const album = await albumOf(asAlice);
    expect(album.packs.map(({ person }) => person)).toEqual([await memberOf(carol)]);
    expect(storedItemsOf(album.tray)).toEqual("items" in opened ? opened.items : null);
    expect((await albumOf(await signedIn(alice))).tray).toEqual(album.tray);
  });

  test("the tray lists every opened pack's items in opening order", async () => {
    await thanks(alice, why, bob, carol);
    const asAlice = await signedIn(alice);
    const [forBob, forCarol] = await waitingPacksOf(asAlice);

    await open(asAlice, forCarol!);
    vi.setSystemTime(Date.now() + minuteMs);
    await open(asAlice, forBob!);

    const { tray } = await albumOf(asAlice);
    expect(tray.map((item) => (item.kind === "sticker" ? `sticker of ${nameOf(item.person)}` : "hoggie"))).toEqual([`sticker of ${carol.name}`, "hoggie", `sticker of ${bob.name}`, "hoggie"]);
    expect(new Set(tray.map(({ item }) => item)).size).toBe(4);
  });
});

describe("AL10: getAlbum's tray is bounded", () => {
  test("a tray of 102 items, from 51 opened packs, shows its oldest 100 in opening order with moreTray", async () => {
    const crowd = Array.from({ length: 52 }, (_, index) => ({ user: `U_CROWD_${index}`, name: `Crowd Person ${index}` }));
    for (const person of crowd) slack.withMember(person.user, { real_name: person.name });
    await thanks(alice, why, ...crowd);
    const asAlice = await signedIn(alice);
    const opened = [];
    for (const pack of await waitingPacksOf(asAlice)) opened.push(...itemsOf(await open(asAlice, pack)));
    const [fiftyFirst] = await waitingPacksOf(asAlice);
    opened.push(...itemsOf(await open(asAlice, fiftyFirst!)));

    const album = await albumOf(asAlice);

    expect(opened).toHaveLength(102);
    expect(storedItemsOf(album.tray)).toEqual(opened.slice(0, 100));
    expect(album.moreTray).toBe(true);
  });
});

describe("a pack's sticker is decided at its grant", () => {
  test("two packs for one new person put the sticker in the tray from the first granted, opened in either order, and a pack for someone held holds only a hoggie", async () => {
    await thanks(alice, why, bob);
    vi.setSystemTime(Date.now() + 7 * dayMs);
    await thanks(alice, "Thanks for reviewing the quarterly runbook", bob);
    const asAlice = await signedIn(alice);
    const [first, second] = await waitingPacksOf(asAlice);

    expect(kindsIn(await open(asAlice, second!)), "the later pack opened first").toEqual(["hoggie"]);
    expect(kindsIn(await open(asAlice, first!)), "the first granted pack opened second").toEqual(["sticker", "hoggie"]);

    await thanks(bob, "ty", carol);
    await anAlbumStickerAsHistoryWillRecordIt(alice, carol);
    await thanks(alice, "Thanks for the steady hand during the outage", carol);
    const [forHeldCarol] = await waitingPacksOf(asAlice);
    expect(kindsIn(await open(asAlice, forHeldCarol!)), "a pack for someone already in the album").toEqual(["hoggie"]);
  });

  test("a history sticker recorded between the grant and the open leaves the pack's sticker as the grant decided it", async () => {
    await thanks(alice, why, bob);
    await anAlbumStickerAsHistoryWillRecordIt(alice, bob);
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);

    expect(kindsIn(await open(asAlice, forBob!))).toEqual(["sticker", "hoggie"]);
  });
});

describe("AL7 AL8: the open draws its hoggie through Hoggies", () => {
  test("it draws for the crate thoughtful:<pack ID> and sends hoggie dropped with crate_kind thoughtful, surface website and the pack's bonus", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);

    const opened = await open(asAlice, forBob!);
    await settle(t);

    const drawn = await drawnFor(alice, forBob!);
    expect(opened).toMatchObject({ kind: "opened", items: [{ kind: "sticker" }, { kind: "hoggie", hoggie: drawn.hoggie }] });
    expect(hoggieDroppedEvents()).toEqual([{ crate_kind: "thoughtful", surface: "website", rarity: drawn.rarity, is_new: true, pack_xp: 15, pack_coins: 0 }]);
  });
});

describe("AL9: a thoughtful pack pays 15 XP and no coins", () => {
  test("with packs on, the open answers 15 XP and no coins applied, and getAlbum's level counts them", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const before = (await albumOf(asAlice)).level.xp;
    const [forBob] = await waitingPacksOf(asAlice);

    const opened = await open(asAlice, forBob!);

    expect(opened).toMatchObject({ kind: "opened", applied: { xp: 15, coins: 0 } });
    const applied = "applied" in opened ? opened.applied : null;
    expect(applied?.to.coins).toBe(applied?.from.coins);
    expect((await albumOf(asAlice)).level.xp).toBe(before + 15);
  });

  test("while coins aren't shown to the member, the answer shows none of them, as the website's other opens do", async () => {
    await thanks(alice, why, bob);
    const member = await memberOf(alice);
    await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:earned:120", xp: 0, coins: 120, item: null, catalogueVersion: "2", at: 0 }));
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);

    const opened = await open(asAlice, forBob!);

    expect(opened).toMatchObject({ kind: "opened", applied: { xp: 15, coins: 0, from: { coins: 0 }, to: { coins: 0 } } });
  });

  test("with packs off, the open still fills the tray and pays nothing", async () => {
    await switchWebsite(t, postHog, true, "album", "collection");
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const before = (await albumOf(asAlice)).level.xp;
    const [forBob] = await waitingPacksOf(asAlice);

    const opened = await open(asAlice, forBob!);

    expect(opened).toMatchObject({ kind: "opened", applied: null });
    expect(kindsIn(opened)).toEqual(["sticker", "hoggie"]);
    expect((await albumOf(asAlice)).level.xp).toBe(before);
  });
});

describe("AL8: a second open and an open while album or collection is off change nothing", () => {
  test("a second open of the same pack answers the fixed refusal and changes no table", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);
    await open(asAlice, forBob!);
    await settle(t);
    const before = await everyTable();

    expect(await open(asAlice, forBob!)).toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(before);
  });

  test("with album off, the open answers the fixed refusal and changes no table", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);
    await switchWebsite(t, postHog, true, "collection", "packs");
    await settle(t);
    const before = await everyTable();

    expect(await open(asAlice, forBob!)).toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(before);
  });

  test("with collection off, the open answers the fixed refusal, changes no table, and the pack keeps waiting", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);
    await switchWebsite(t, postHog, true, "album", "packs");
    await settle(t);
    const before = await everyTable();

    expect(await open(asAlice, forBob!)).toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(before);
    expect(await waitingPacksOf(asAlice)).toEqual([forBob]);
  });
});

describe("website commands pass one guard", () => {
  test("WS61: with the website flag off, opening a pack answers closed and writes nothing at all", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);
    await switchWebsite(t, postHog, false, ...albumOpen);
    const before = await everyTable();

    expect(await open(asAlice, forBob!)).toEqual({ kind: "closed" });
    expect(await everyTable()).toEqual(before);
  });

  test("WS61: without a session it answers signed-out, and for a member who left not-a-member, writing nothing at all", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);
    const before = await everyTable();

    expect(await open(t, forBob!)).toEqual({ kind: "signed-out" });
    expect(await everyTable()).toEqual(before);
    await memberChanged(t, "user_change", { id: alice.user, team_id: "T1", deleted: true });
    await settle(t);
    const left = await everyTable();
    expect(await open(asAlice, forBob!)).toEqual({ kind: "not-a-member" });
    expect(await everyTable()).toEqual(left);
  });

  test("WS61: the pack is the only argument, so no call names a member", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);
    const before = await everyTable();

    await expect(asAlice.mutation(api.website.album.openThoughtfulPack, { pack: forBob!, member: await memberOf(alice) } as never)).rejects.toThrow(/member/);
    expect(await everyTable()).toEqual(before);
  });
});

describe("a website command never launches unlocks", () => {
  test("WS62 P77: with xp-levels and unlocks on and no unlocks launch recorded, opening a pack answers refused, launches nothing, and getAlbum lists no pack to open", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);
    await switchWebsite(t, postHog, true, ...albumOpen, "xp-levels", "unlocks");
    await settle(t);
    const before = await everythingWritten();

    expect(await open(asAlice, forBob!)).toEqual({ kind: "refused" });
    await settle(t);

    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.unlockLaunches).toEqual([]);
    expect(await albumOf(asAlice)).toMatchObject({ packs: [], morePacks: false });
  });

  test("WS62 P91: with quests on and no Journey launch, opening a pack answers refused, doesn't launch the Journey, and getAlbum lists no pack to open", async () => {
    await unlocksShippedBeforeAnyoneJoined(t);
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [forBob] = await waitingPacksOf(asAlice);
    await switchWebsite(t, postHog, true, ...albumOpen, "xp-levels", "unlocks", "quests");
    await settle(t);
    const before = await everythingWritten();

    expect(await open(asAlice, forBob!)).toEqual({ kind: "refused" });
    await settle(t);

    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.journeyLaunches).toEqual([]);
    expect(await albumOf(asAlice)).toMatchObject({ packs: [], morePacks: false });
  });
});

const names = new Map<string, string>();

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(messages).padStart(6, "0")}` });
  await settle(t);
  for (const person of [alice, bob, carol]) {
    const member = await memberOrNullOf(person);
    if (member !== null) names.set(member, person.name);
  }
}

function open(reader: Reader, pack: PackId) {
  return reader.mutation(api.website.album.openThoughtfulPack, { pack });
}

function storedItemsOf(tray: AlbumAnswer["tray"]) {
  return tray.map((shown) => {
    if (shown.kind !== "sticker") return shown;
    const { thanked: _shownPerson, ...stored } = shown;
    return stored;
  });
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

async function waitingPacksOf(reader: Reader): Promise<PackId[]> {
  return (await albumOf(reader)).packs.map(({ pack }) => pack);
}

function itemsOf(answer: Awaited<ReturnType<typeof open>>) {
  if (!("items" in answer)) throw new Error(`expected an open, got ${JSON.stringify(answer)}`);
  return answer.items;
}

function kindsIn(answer: Awaited<ReturnType<typeof open>>) {
  return itemsOf(answer).map(({ kind }) => kind);
}

async function drawnFor(person: Person, pack: PackId) {
  return drawOf({ secret: "", member: await memberOf(person), crate: `thoughtful:${pack}`, version: catalogue.version });
}

function nameOf(member: string) {
  return names.get(member) ?? member;
}

async function signedIn(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: person.user, name: person.name });
  return asSignedIn;
}

async function memberOf(person: Person): Promise<MemberId> {
  return (await memberOrNullOf(person))!;
}

async function memberOrNullOf(person: Person): Promise<MemberId | null> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  return row?._id ?? null;
}

async function anAlbumStickerAsHistoryWillRecordIt(member: Person, person: Person) {
  const [memberId, personId] = [await memberOf(member), await memberOf(person)];
  await t.run((ctx) => ctx.db.insert("albumStickers", { member: memberId, person: personId, from: "history", at: Date.now() }));
}

function hoggieDroppedEvents() {
  return postHog
    .productEvents()
    .filter(({ event }) => event === "hoggie dropped")
    .map(({ properties: { crate_kind, surface, rarity, is_new, pack_xp, pack_coins } }) => ({ crate_kind, surface, rarity, is_new, pack_xp, pack_coins }));
}

function everyTable() {
  return t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
}

async function everythingWritten() {
  return { tables: await everyTable(), scheduled: await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()) };
}
