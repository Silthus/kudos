import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { holds } from "../../testing/hoggies";
import { signedRequest } from "../../testing/signedSlack";
import { publishedHome } from "../../testing/slackInteractions";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { openUnlock } from "../unlocks/unlocks";
import type { AlbumAnswer, AlbumRead } from "../website/album";
import { crestWith } from "../hoggies/catalogue";
import type { CollectionAnswer } from "../website/collection";
import type { MemberId } from "../workspace/directory";

const theDraw = vi.hoisted(() => ({ pinned: null as string | null }));

vi.mock("../hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/draw")>();
  const { hoggieNamed } = await import("../hoggies/catalogue");
  return {
    ...actual,
    drawOf: vi.fn(async (input: Parameters<typeof actual.drawOf>[0]) => (theDraw.pinned === null || !input.crate.startsWith("thoughtful:") ? actual.drawOf(input) : { hoggie: theDraw.pinned, rarity: hoggieNamed(theDraw.pinned)!.rarity })),
  };
});

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;
type PackId = Id<"thoughtfulPacks">;
type ItemId = Id<"trayItems">;

const alice = person("Alice", "Marchetti");
const bob = person("Bob", "Okonkwo");
const carol = person("Carol", "Lindqvist");
const otters = Array.from({ length: 3 }, (_, index) => person("Otter", `Quillfeather${index + 1}`));
const beacons = Array.from({ length: 5 }, (_, index) => person("Beacon", `Brambleton${index + 1}`));
const comets = Array.from({ length: 5 }, (_, index) => person("Comet", `Marrowind${index + 1}`));
const teamless = Array.from({ length: 21 }, (_, index) => person("Drifter", `Nowhereby${index + 1}`));
const [heldComets, trayComets] = [comets.slice(0, 3), comets.slice(3)];
const [lastDrifter, drifters] = [teamless.at(-1)!, teamless.slice(0, -1)];
const everyone = [alice, bob, carol, ...otters, ...beacons, ...comets, ...teamless];

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;
const names = new Map<string, string>();

beforeEach(async () => {
  theDraw.pinned = null;
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  slack = new FakeSlack();
  for (const { user, name } of everyone) slack.withMember(user, { profile: { display_name: name, real_name: name } });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...albumOpen);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AL11 AL17: putting a tray item in", () => {
  test("putting a sticker in holds its person in the album, takes it out of the tray, and sends album sticker collected for the collector, naming nobody", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [sticker, hoggie] = await openEvery(asAlice);

    expect(await putIn(asAlice, sticker!.item)).toEqual({ kind: "placed", item: sticker });
    await settle(t);

    const album = await albumOf(asAlice);
    expect(album.tray).toEqual([hoggie]);
    expect(album.people).toEqual([expect.objectContaining({ person: await memberOf(bob), held: true })]);
    const collected = postHog.productEvents().filter(({ event }) => event === "album sticker collected");
    expect(collected).toHaveLength(1);
    expect(collected[0]!.distinct_id).toBe(await distinctIdOf(alice));
    expect(JSON.stringify(collected[0]!.properties)).not.toContain(await memberOf(bob));
    expect(JSON.stringify(collected[0]!.properties)).not.toContain(bob.user);
  });
});

describe("a tray item is put in once", { timeout: 120_000 }, () => {
  test("AL12: a hoggie from a thoughtful pack counts as found on the Hoggies page only once it is put in", async () => {
    await theBookIsOpen();
    await thanks(alice, why, bob);
    await theBookOpensFor(alice);
    const asAlice = await signedIn(alice);
    const beforeTheOpen = await collectionOf(asAlice);
    const [, hoggie] = await openEvery(asAlice);
    if (hoggie?.kind !== "hoggie") throw new Error("expected the pack's hoggie");
    const inTheTray = await collectionOf(asAlice);
    vi.setSystemTime(Date.now() + minuteMs);

    expect(await putIn(asAlice, hoggie.item)).toEqual({ kind: "placed", item: hoggie });

    const putInAt = Date.now();
    const found = await collectionOf(asAlice);
    expect(inTheTray, "the collection while the hoggie waits in the tray").toEqual(beforeTheOpen);
    const [waiting, putInHoggie] = [countOf(inTheTray, hoggie.hoggie), countOf(found, hoggie.hoggie)];
    expect(putInHoggie.count, "the hoggie's count once put in").toBe(waiting.count + 1);
    expect(found.owned, "the hoggies found").toBe(inTheTray.owned + (waiting.count === 0 ? 1 : 0));
    if (waiting.count === 0) expect([waiting.firstAt, putInHoggie.firstAt], "first found when put in").toEqual([null, putInAt]);
  });

  test("putting an item in a second time answers the fixed refusal and changes no table, and its hoggie counts once", async () => {
    await theBookIsOpen();
    await thanks(alice, why, bob);
    await theBookOpensFor(alice);
    const asAlice = await signedIn(alice);
    const items = await openEvery(asAlice);
    for (const { item } of items) await putIn(asAlice, item);
    await settle(t);
    const putInOnce = await collectionOf(asAlice);
    const before = await everyTable();

    for (const { item } of items) expect(await putIn(asAlice, item), "the same item put in again").toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(before);
    expect(await collectionOf(asAlice)).toEqual(putInOnce);
  });

  test("putting them all in a second time, from another device, places nothing, says no more, and changes no table", async () => {
    await thanks(alice, why, bob, carol);
    const asAlice = await signedIn(alice);
    const items = await openEvery(asAlice);
    expect(await putAllIn(asAlice)).toEqual({ kind: "placed", items: [...hoggiesIn(items), ...stickersIn(items)], more: false });
    const onThePhone = await signedIn(alice);
    await settle(t);
    const before = await everyTable();

    expect(await putAllIn(onThePhone), "a retried call").toEqual({ kind: "placed", items: [], more: false });
    await settle(t);

    expect(await everyTable()).toEqual(before);
    expect(postHog.productEvents().filter(({ event }) => event === "album sticker collected")).toHaveLength(2);
  });

  test("an item put in one at a time is not placed again by put them all in", async () => {
    await thanks(alice, why, bob, carol);
    const asAlice = await signedIn(alice);
    const [bobsSticker, ...rest] = await openEvery(asAlice);
    await putIn(asAlice, bobsSticker!.item);

    expect(await putAllIn(asAlice)).toEqual({ kind: "placed", items: [...hoggiesIn(rest), ...stickersIn(rest)], more: false });
  });

  test("a sticker whose person the album already holds leaves the tray, records no second album sticker and sends nothing", async () => {
    await thanks(alice, why, bob);
    await anAlbumStickerAsHistoryWillRecordIt(alice, bob);
    const asAlice = await signedIn(alice);
    const [sticker] = await openEvery(asAlice);

    expect(await putIn(asAlice, sticker!.item)).toEqual({ kind: "placed", item: sticker });
    await settle(t);

    const album = await albumOf(asAlice);
    expect(album.tray.map(({ kind }) => kind)).toEqual(["hoggie"]);
    expect(album.people).toEqual([expect.objectContaining({ person: await memberOf(bob), held: true })]);
    expect(postHog.productEvents().filter(({ event }) => event === "album sticker collected")).toEqual([]);
  });

  test("two waiting copies of one hoggie count one copy at each put-in, and only the first can complete its crest", async () => {
    await theBookIsOpen("crests", "activity");
    theDraw.pinned = "doctor";
    await thanks(alice, why, bob, carol);
    await theBookOpensFor(alice);
    const asAlice = await signedIn(alice);
    const [, first, , second] = await openEvery(asAlice);
    await holds(t, await memberOf(alice), ...rosterBeside("doctor"));
    const waiting = countOf(await collectionOf(asAlice), "doctor").count;

    await putIn(asAlice, first!.item);
    const afterFirst = await collectionOf(asAlice);
    await putIn(asAlice, second!.item);
    const afterSecond = await collectionOf(asAlice);

    expect([waiting, countOf(afterFirst, "doctor").count, countOf(afterSecond, "doctor").count], "doctor's count waiting, after one put-in and after both").toEqual([waiting, waiting + 1, waiting + 2]);
    expect(crestCompletionsIn(await activityOf(asAlice)), "the finds that answer doctor's crest").toEqual([crestWith("doctor")!.crest]);
  });

  test("putting in an item of another member's tray answers the fixed refusal and changes no table", async () => {
    await thanks(alice, why, bob);
    await thanks(bob, "Thanks for pairing on the gnarly cache bug", alice);
    const [asAlice, asBob] = [await signedIn(alice), await signedIn(bob)];
    const alicesItems = await openEvery(asAlice);
    await settle(t);
    const before = await everyTable();

    for (const { item } of alicesItems) expect(await putIn(asBob, item), "Bob putting in Alice's item").toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(before);
  });

  test("a tray of 60 items goes in over three calls from two devices: hoggies first in opening order, then stickers by team page, the member's team first, then the most held, then people on no team, and a pack opened during the sequence takes its place in the next call", async () => {
    await theCompanyCopyHolds(
      { slug: "beacons", name: "Beacons", profiles: profilesOf(otters[0]!, ...beacons) },
      { slug: "comets", name: "Comets", profiles: profilesOf(...comets) },
      { slug: "otters", name: "Otters", profiles: profilesOf(alice, ...otters) },
    );
    await thanks(alice, "ty", ...heldComets);
    for (const comet of heldComets) await anAlbumStickerAsHistoryWillRecordIt(alice, comet);
    await thanks(alice, why, ...otters, ...beacons, ...trayComets, ...teamless);
    await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
    await settle(t);
    const [onTheLaptop, onThePhone] = [await signedIn(alice), await signedIn(alice)];
    const opened = await openPacksFor(onTheLaptop, [...drifters].reverse(), [...beacons].reverse(), trayComets, otters);
    expect(opened).toHaveLength(60);

    const first = await putAllIn(onTheLaptop);
    const second = await putAllIn(onThePhone);
    const openedBetween = await openPacksFor(onTheLaptop, [lastDrifter]);
    const third = await putAllIn(onTheLaptop);
    await settle(t);

    const hoggies = hoggiesIn(opened);
    const inPutInOrder = [...otters, ...trayComets, ...beacons.toReversed(), ...drifters.toReversed()];
    const stickers = await stickersFor(opened, inPutInOrder);
    expect(first).toEqual({ kind: "placed", items: hoggies.slice(0, 25), more: true });
    expect(peopleIn(second).map(nameOf), "the second call's stickers").toEqual(inPutInOrder.slice(0, 20).map(({ name }) => name));
    expect(second).toEqual({ kind: "placed", items: [...hoggies.slice(25), ...stickers.slice(0, 20)], more: true });
    expect(peopleIn(third).map(nameOf), "the third call's stickers").toEqual([...inPutInOrder.slice(20), lastDrifter].map(({ name }) => name));
    expect(third).toEqual({ kind: "placed", items: [...hoggiesIn(openedBetween), ...stickers.slice(20), ...stickersIn(openedBetween)], more: false });
    const album = await albumOf(onThePhone);
    expect(album.tray).toEqual([]);
    expect(album.people.filter(({ held }) => held)).toHaveLength(34);
    expect(postHog.productEvents().filter(({ event }) => event === "album sticker collected")).toHaveLength(31);
  });
});

describe("AL12: a tray hoggie is found when it is put in", () => {
  test("a crest a put-in completes is collected at the put-in, and the find of the hoggie put in answers it", async () => {
    await theBookIsOpen("crests", "activity");
    theDraw.pinned = "doctor";
    await thanks(alice, why, bob);
    await theBookOpensFor(alice);
    const asAlice = await signedIn(alice);
    const [, hoggie] = await openEvery(asAlice);
    vi.setSystemTime(Date.now() + minuteMs);
    await holds(t, await memberOf(alice), ...rosterBeside("doctor"));
    const crest = crestWith("doctor")!.crest;
    const waiting = crestOf(await collectionOf(asAlice), crest);
    vi.setSystemTime(Date.now() + minuteMs);

    await putIn(asAlice, hoggie!.item);

    const putInAt = Date.now();
    expect(waiting.collectedAt, "the crest while doctor waits in the tray").toBeNull();
    expect(crestOf(await collectionOf(asAlice), crest).collectedAt, "the crest once doctor is put in").toBe(putInAt);
    expect(crestCompletionsIn(await activityOf(asAlice)), "the finds that answer the crest").toEqual([crest]);
  });

  test("the activity feed leaves a waiting hoggie out and lists it once it is put in", async () => {
    await theBookIsOpen("activity");
    theDraw.pinned = "doctor";
    await thanks(alice, why, bob);
    await theBookOpensFor(alice);
    const asAlice = await signedIn(alice);
    const [, hoggie] = await openEvery(asAlice);
    const waiting = foundIn(await activityOf(asAlice));

    await putIn(asAlice, hoggie!.item);

    expect(foundIn(await activityOf(asAlice)), "the finds once doctor is put in, newest opened first").toEqual(["doctor", ...waiting]);
  });

  test("App Home's last find names the hoggie put in, even after a newer crate dropped one", async () => {
    await theBookIsOpen();
    theDraw.pinned = "doctor";
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [, hoggie] = await openEvery(asAlice);
    vi.setSystemTime(Date.now() + minuteMs);
    await theBookOpensFor(alice);
    vi.setSystemTime(Date.now() + minuteMs);

    await putIn(asAlice, hoggie!.item);
    await openAppHome(alice);

    expect(JSON.stringify(publishedHome(slack, alice.user))).toContain("last found: Doctor");
  });
});

describe("the album is private", () => {
  test("putIn given another member's tray item answers the fixed refusal and changes no table, and putAllIn places only the member's own tray", async () => {
    await thanks(alice, why, bob);
    await thanks(bob, "Thanks for pairing on the gnarly cache bug", alice);
    const [asAlice, asBob] = [await signedIn(alice), await signedIn(bob)];
    const alicesItems = await openEvery(asAlice);
    const bobsItems = await openEvery(asBob);
    await settle(t);
    const before = await everyTable();

    for (const { item } of alicesItems) expect(await putIn(asBob, item), "Bob putting in Alice's item").toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(before);
    expect(await putAllIn(asBob)).toEqual({ kind: "placed", items: [...hoggiesIn(bobsItems), ...stickersIn(bobsItems)], more: false });
    expect((await albumOf(asAlice)).tray).toEqual(alicesItems);
  });
});

describe("AL39: the album is dark where album is off, shows only to the members it is on for, and nothing exposes it", () => {
  test("turned off after a member opened their packs, putting in answers the fixed refusal and changes no table", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [sticker] = await openEvery(asAlice);
    await switchWebsite(t, postHog, true, "collection", "packs");
    await settle(t);
    const before = await everyTable();

    expect(await putIn(asAlice, sticker!.item)).toEqual({ kind: "refused" });
    expect(await putAllIn(asAlice)).toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(before);
  });
});

describe("website commands pass one guard", () => {
  test("WS61: with the website flag off, putting in answers closed and writes nothing at all", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [sticker] = await openEvery(asAlice);
    await switchWebsite(t, postHog, false, ...albumOpen);
    const before = await everyTable();

    expect(await putIn(asAlice, sticker!.item)).toEqual({ kind: "closed" });
    expect(await putAllIn(asAlice)).toEqual({ kind: "closed" });
    expect(await everyTable()).toEqual(before);
  });

  test("WS61: without a session putting in answers signed-out, and for a member who left not-a-member, writing nothing at all", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [sticker] = await openEvery(asAlice);
    const before = await everyTable();

    expect(await putIn(t, sticker!.item)).toEqual({ kind: "signed-out" });
    expect(await putAllIn(t)).toEqual({ kind: "signed-out" });
    expect(await everyTable()).toEqual(before);
    await memberChanged(t, "user_change", { id: alice.user, team_id: "T1", deleted: true });
    await settle(t);
    const left = await everyTable();
    expect(await putIn(asAlice, sticker!.item)).toEqual({ kind: "not-a-member" });
    expect(await putAllIn(asAlice)).toEqual({ kind: "not-a-member" });
    expect(await everyTable()).toEqual(left);
  });

  test("WS61: an item is putIn's only argument and putAllIn takes none, so no call names a member", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const [sticker] = await openEvery(asAlice);
    const before = await everyTable();
    const member = await memberOf(alice);

    await expect(asAlice.mutation(api.website.album.putIn, { item: sticker!.item, member } as never)).rejects.toThrow(/member/);
    await expect(asAlice.mutation(api.website.album.putAllIn, { member } as never)).rejects.toThrow(/member/);
    expect(await everyTable()).toEqual(before);
  });
});

function person(first: string, last: string): Person {
  return { user: `U_${first}_${last}`.toUpperCase(), name: `${first} ${last}` };
}

function profilesOf(...people: Person[]): TeamPage["profiles"] {
  return people.map(({ name }) => {
    const [firstName, lastName] = name.split(" ") as [string, string];
    return { id: everyone.findIndex((someone) => someone.name === name) + 1, firstName, lastName, colour: "teal" };
  });
}

async function theBookIsOpen(...alsoOn: string[]) {
  await switchWebsite(t, postHog, true, ...albumOpen, "xp-levels", "unlocks", "achievements", "everyone-board", "skill-tree", ...alsoOn);
  await bookShippedBeforeAnyoneJoined(t);
}

async function theBookOpensFor(someone: Person) {
  const member = await memberOf(someone);
  await t.run((ctx) => openUnlock(ctx, member, "book", "slack"));
}

async function theCompanyCopyHolds(...teams: TeamPage[]) {
  postHogCom.withTeams(...teams);
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(messages).padStart(6, "0")}` });
  await settle(t);
  for (const someone of [giver, ...recipients]) names.set(await memberOf(someone), someone.name);
}

async function openEvery(reader: Reader) {
  const items = [];
  for (const pack of await waitingPacksOf(reader)) items.push(...itemsOf(await reader.mutation(api.website.album.openThoughtfulPack, { pack })));
  return items;
}

async function openPacksFor(reader: Reader, ...groups: Person[][]) {
  const packs = (await albumOf(reader)).packs;
  const items = [];
  for (const someone of groups.flat()) {
    const member = await memberOf(someone);
    const pack = packs.find((waiting) => waiting.person === member);
    if (pack === undefined) throw new Error(`no pack waits for ${someone.name}`);
    vi.setSystemTime(Date.now() + 1_000);
    items.push(...itemsOf(await reader.mutation(api.website.album.openThoughtfulPack, { pack: pack.pack })));
  }
  return items;
}

function putIn(reader: Reader, item: ItemId) {
  return reader.mutation(api.website.album.putIn, { item });
}

function putAllIn(reader: Reader) {
  return reader.mutation(api.website.album.putAllIn, {});
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

async function collectionOf(reader: Reader) {
  const collection: CollectionAnswer | { kind: string } = await reader.query(api.website.collection.getCollection, {});
  if (collection.kind !== "collection") throw new Error(`expected the collection, got ${JSON.stringify(collection)}`);
  return collection as Extract<CollectionAnswer, { kind: "collection" }>;
}

function rosterBeside(hoggie: string) {
  return crestWith(hoggie)!.roster.filter((onRoster) => onRoster !== hoggie);
}

function crestOf(collection: Awaited<ReturnType<typeof collectionOf>>, crest: string) {
  return collection.crests!.find((entry) => entry.crest === crest)!;
}

type Activity = Array<{ kind: string; drop?: { hoggie: string; crest?: { crest: string } | null } }>;

async function activityOf(reader: Reader): Promise<Activity> {
  const answer = (await reader.query(api.website.activity.getActivity, { filter: "all", cursor: null })) as { entries?: Activity };
  if (answer.entries === undefined) throw new Error(`expected the activity feed, got ${JSON.stringify(answer)}`);
  return answer.entries;
}

function foundIn(entries: Activity) {
  return entries.flatMap(({ kind, drop }) => (kind === "found" && drop !== undefined ? [drop.hoggie] : []));
}

function crestCompletionsIn(entries: Activity) {
  return entries.flatMap(({ drop }) => (drop?.crest ? [drop.crest.crest] : []));
}

async function openAppHome(someone: Person) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(someone.user)));
  await settle(t);
}

function countOf(collection: Awaited<ReturnType<typeof collectionOf>>, hoggie: string) {
  return collection.hoggies.find((entry) => entry.hoggie === hoggie)!;
}

async function waitingPacksOf(reader: Reader): Promise<PackId[]> {
  return (await albumOf(reader)).packs.map(({ pack }) => pack);
}

type Opened = Awaited<ReturnType<typeof openEvery>>;

function itemsOf(answer: unknown) {
  if (typeof answer !== "object" || answer === null || !("items" in answer)) throw new Error(`expected an open, got ${JSON.stringify(answer)}`);
  return (answer as { items: AlbumAnswer["tray"] }).items;
}

function hoggiesIn(items: Opened) {
  return items.filter(({ kind }) => kind === "hoggie");
}

function stickersIn(items: Opened) {
  return items.filter(({ kind }) => kind === "sticker");
}

async function stickersFor(items: Opened, people: Person[]) {
  const stickers = stickersIn(items);
  const members = await Promise.all(people.map(memberOf));
  return members.map((member) => stickers.find((sticker) => sticker.kind === "sticker" && sticker.person === member)!);
}

function peopleIn(answer: unknown) {
  return itemsOf(answer).flatMap((item) => (item.kind === "sticker" ? [item.person] : []));
}

function nameOf(member: string) {
  return names.get(member) ?? member;
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

async function distinctIdOf(someone: Person) {
  const member = await memberOf(someone);
  return t.run(async (ctx) => (await ctx.db.query("analyticsIds").collect()).find((row) => row.member === member)?.analyticsId);
}

async function anAlbumStickerAsHistoryWillRecordIt(member: Person, someone: Person) {
  const [memberId, personId] = [await memberOf(member), await memberOf(someone)];
  await t.run((ctx) => ctx.db.insert("albumStickers", { member: memberId, person: personId, from: "history", at: Date.now() }));
}

function everyTable() {
  return t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
}
