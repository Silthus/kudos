import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import type { AlbumAnswer, AlbumRead, TurnAnswer } from "../website/album";
import type { Denial } from "../website/memberQuery";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs"];
const itemsOn = [...albumOpen, "hidden-items"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;
type Turned = Extract<TurnAnswer, { kind: "turned" }>;

const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const everyone = [alice, bob, carol];

let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack();
  for (const { user, name } of everyone) slack.withMember(user, { real_name: name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...albumOpen);
  for (const { user, name } of everyone) await memberChanged(t, "team_join", { id: user, team_id: "T1", name, real_name: name });
  await settle(t);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP23: with hidden-items on, the open, put-in and put-all-in refuse and write nothing", { timeout: 60_000 }, () => {
  test("each refuses with the flag on, writing nothing, and works as today once it is off", async () => {
    await thanks(alice, bob, carol);
    const asAlice = await signedIn(alice);
    const [first, second] = (await albumOf(asAlice)).packs;
    await asAlice.mutation(api.website.album.openThoughtfulPack, { pack: first!.pack });
    const [inTheTray] = (await albumOf(asAlice)).tray;
    await switchWebsite(t, postHog, true, ...itemsOn);
    const before = await everythingWritten();

    expect(await asAlice.mutation(api.website.album.openThoughtfulPack, { pack: second!.pack })).toEqual({ kind: "refused" });
    expect(await asAlice.mutation(api.website.album.putIn, { item: inTheTray!.item })).toEqual({ kind: "refused" });
    expect(await asAlice.mutation(api.website.album.putAllIn, {})).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);

    await switchWebsite(t, postHog, true, ...albumOpen);
    expect(await asAlice.mutation(api.website.album.putIn, { item: inTheTray!.item })).toMatchObject({ kind: "placed", item: { item: inTheTray!.item } });
    expect(await asAlice.mutation(api.website.album.openThoughtfulPack, { pack: second!.pack })).toMatchObject({ kind: "opened", items: [{ kind: "sticker" }, { kind: "hoggie" }] });
    expect(await asAlice.mutation(api.website.album.putAllIn, {})).toMatchObject({ kind: "placed", items: [{}, {}, {}], more: false });
  });
});

describe("LP23: a tray item not yet put in waits face down, and its turn finishes today's put-in", { timeout: 60_000 }, () => {
  test("the tray's sticker and hoggie wait on the board for thanking their person, and their turns put them in from the tray's drop, paying no second XP", async () => {
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    const opened = await asAlice.mutation(api.website.album.openThoughtfulPack, { pack: (await albumOf(asAlice)).packs[0]!.pack });
    const trayHoggie = opened.kind === "opened" ? opened.items.find((item) => item.kind === "hoggie") : undefined;
    await switchWebsite(t, postHog, true, ...itemsOn);
    const xp = (await albumOf(asAlice)).level.xp;
    const dropsBefore = (await everythingWritten()).tables.drops;

    const waiting = await thanksItemsOf(asAlice);
    expect(waiting.map(({ reason }) => reason.kind === "thanks" && reason.thanked.name)).toEqual([bob.name, bob.name]);
    const turned: Turned[] = [];
    for (const { item } of waiting) turned.push(await turnOf(asAlice, item));

    expect(turned.map(({ face }) => face.kind).sort()).toEqual(["hoggie", "sticker"]);
    expect(turned.find(({ face }) => face.kind === "hoggie")).toMatchObject({ face: { drop: { hoggie: trayHoggie?.kind === "hoggie" && trayHoggie.hoggie } }, applied: null, page: { kind: "hoggies" } });
    expect(turned.find(({ face }) => face.kind === "sticker")).toMatchObject({ face: { person: await memberOf(bob), isNew: true }, applied: null });
    expect((await albumOf(asAlice)).level.xp).toBe(xp);
    expect(await thanksItemsOf(asAlice)).toEqual([]);
    expect((await everythingWritten()).tables.drops).toEqual(dropsBefore);
    expect(await foundHoggiesOf(asAlice)).toEqual([trayHoggie?.kind === "hoggie" && trayHoggie.hoggie]);
    expect((await albumOf(asAlice)).people).toContainEqual(expect.objectContaining({ person: await memberOf(bob), held: true }));
    await switchWebsite(t, postHog, true, ...albumOpen);
    expect((await albumOf(asAlice)).tray).toEqual([]);
  });

  test("a tray hoggie put in while hidden-items is off no longer waits once it turns on", async () => {
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    await asAlice.mutation(api.website.album.openThoughtfulPack, { pack: (await albumOf(asAlice)).packs[0]!.pack });
    await asAlice.mutation(api.website.album.putAllIn, {});

    await switchWebsite(t, postHog, true, ...itemsOn);

    expect(await thanksItemsOf(asAlice)).toEqual([]);
  });
});

describe("LP23: a flag reversal never counts anything twice", { timeout: 60_000 }, () => {
  test("items turned with hidden-items on leave no pack to open once it is off, so the hoggie is found once and paid once", async () => {
    await switchWebsite(t, postHog, true, ...itemsOn);
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    for (const { item } of await thanksItemsOf(asAlice)) await turnOf(asAlice, item);
    const xp = (await albumOf(asAlice)).level.xp;
    const found = await hoggiesTalliedFor(alice);

    await switchWebsite(t, postHog, true, ...albumOpen);
    await asAlice.mutation(api.website.album.putAllIn, {});

    expect((await albumOf(asAlice)).packs).toEqual([]);
    expect(await hoggiesTalliedFor(alice)).toEqual(found);
    expect((await albumOf(asAlice)).level.xp).toBe(xp);
  });

  test("a pack whose hoggie turned with hidden-items on opens into only its sticker once it is off, and the hoggie is found once", async () => {
    await switchWebsite(t, postHog, true, ...itemsOn);
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    const [hoggie] = await thanksItemsOf(asAlice);
    await turnOf(asAlice, hoggie!.item);
    const found = await hoggiesTalliedFor(alice);

    await switchWebsite(t, postHog, true, ...albumOpen);
    const opened = await asAlice.mutation(api.website.album.openThoughtfulPack, { pack: (await albumOf(asAlice)).packs[0]!.pack });
    await asAlice.mutation(api.website.album.putAllIn, {});

    expect(opened).toMatchObject({ kind: "opened", items: [{ kind: "sticker" }], applied: null });
    expect(await hoggiesTalliedFor(alice)).toEqual(found);
  });

  test("a tray hoggie turned with hidden-items on leaves only its sticker in the tray once the flag is off, and the hoggie is found once", async () => {
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    await asAlice.mutation(api.website.album.openThoughtfulPack, { pack: (await albumOf(asAlice)).packs[0]!.pack });
    await switchWebsite(t, postHog, true, ...itemsOn);
    const hoggie = await trayHoggieItemOf(alice);
    await turnOf(asAlice, hoggie);
    const found = await hoggiesTalliedFor(alice);

    await switchWebsite(t, postHog, true, ...albumOpen);
    expect((await albumOf(asAlice)).tray.map(({ kind }) => kind)).toEqual(["sticker"]);
    await asAlice.mutation(api.website.album.putAllIn, {});

    expect(await hoggiesTalliedFor(alice)).toEqual(found);
  });
});

describe("LP24: fillItems earns every pack not yet opened and every tray item not yet put in, once", { timeout: 60_000 }, () => {
  test("the packs and tray of a member from before the ledger wait on the board after the fill, and a rerun earns nothing", async () => {
    await thanks(alice, bob, carol);
    const asAlice = await signedIn(alice);
    const opening = (await albumOf(asAlice)).packs[0]!;
    await asAlice.mutation(api.website.album.openThoughtfulPack, { pack: opening.pack });
    await everyItemForgotten();

    await fillItems();
    const filled = await everythingWritten();
    await fillItems();

    await switchWebsite(t, postHog, true, ...itemsOn);
    const board = await thanksItemsOf(asAlice);
    expect(board.map(({ reason }) => reason.kind === "thanks" && reason.thanked.name).sort()).toEqual([bob.name, bob.name, carol.name, carol.name]);
    expect((await everythingWritten()).tables.items).toEqual(filled.tables.items);
    for (const { item } of board) await turnOf(asAlice, item);
    expect(await thanksItemsOf(asAlice)).toEqual([]);
  });

  test("a member with more than 100 packs and 100 tray items continues in the next mutation, one member a mutation", async () => {
    const [giver, other] = [await memberOf(alice), await memberOf(bob)];
    await waitingRowsFor(giver, 101);
    await waitingRowsFor(other, 1);

    await t.mutation(internal.items.fill.fillItems, {});
    expect(await itemCountsOf(giver, other)).toEqual([100, 0]);
    await settle(t);

    expect(await itemCountsOf(giver, other)).toEqual([202, 2]);
  });
});

async function thanks(giver: Person, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${why} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
}

async function fillItems() {
  await t.mutation(internal.items.fill.fillItems, {});
  await settle(t);
}

async function turnOf(reader: Reader, item: Id<"items">): Promise<Turned> {
  const answer: TurnAnswer | Denial = await reader.mutation(api.website.album.turnItem, { item });
  if (answer.kind !== "turned") throw new Error(`expected the item turned, got ${JSON.stringify(answer)}`);
  return answer;
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

async function thanksItemsOf(reader: Reader) {
  const { board } = await albumOf(reader);
  if (board === undefined) throw new Error("expected the item board");
  return board.items.filter(({ reason }) => reason.kind === "thanks");
}

async function foundHoggiesOf(reader: Reader) {
  const answer = await reader.query(api.website.album.getAlbumHoggies, {});
  return answer.kind === "hoggies" ? answer.hoggies.filter(({ found }) => found).map(({ hoggie }) => hoggie) : [];
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
  return row!._id;
}

async function itemsOf(member: MemberId): Promise<Doc<"items">[]> {
  return t.run((ctx) =>
    ctx.db
      .query("items")
      .withIndex("by_member_turned", (q) => q.eq("member", member))
      .collect(),
  );
}

async function itemCountsOf(...members: MemberId[]) {
  const counts: number[] = [];
  for (const member of members) counts.push((await itemsOf(member)).length);
  return counts;
}

async function trayHoggieItemOf(giver: Person): Promise<Id<"items">> {
  const item = (await itemsOf(await memberOf(giver))).find(({ source, key, turnedAt }) => source === "hoggie" && key.startsWith("tray:") && turnedAt === undefined);
  if (item === undefined) throw new Error("no tray hoggie item waits");
  return item._id;
}

async function hoggiesTalliedFor(someone: Person) {
  const member = await memberOf(someone);
  const weeks = await t.run((ctx) =>
    ctx.db
      .query("weekTallies")
      .withIndex("by_member_week", (q) => q.eq("member", member))
      .collect(),
  );
  const counts = await t.run((ctx) =>
    ctx.db
      .query("hoggieTallies")
      .withIndex("by_member_hoggie", (q) => q.eq("member", member))
      .collect(),
  );
  return { weeks: weeks.map(({ hoggiesFound }) => hoggiesFound), counts: counts.map(({ hoggie, count }) => ({ hoggie, count })) };
}

async function everyItemForgotten() {
  await t.run(async (ctx) => {
    for (const item of await ctx.db.query("items").collect()) await ctx.db.delete(item._id);
  });
}

async function waitingRowsFor(member: MemberId, count: number) {
  await t.run(async (ctx) => {
    for (let n = 0; n < count; n += 1) {
      const message = { workspace: "T1", conversation: "C1", message: `${n}.${member}` };
      const waiting = { workspace: "T1", giver: member, recipient: member, week: "2026-10-12", message, at: Date.now() };
      await ctx.db.insert("thoughtfulPacks", { ...waiting, holdsSticker: false });
      const opened = await ctx.db.insert("thoughtfulPacks", { ...waiting, holdsSticker: false, openedAt: Date.now() });
      await ctx.db.insert("trayItems", { member, pack: opened, at: Date.now(), kind: "hoggie", hoggie: "toilet", rarity: "common", isNew: true });
    }
  });
}

async function everythingWritten() {
  const tables = await t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  return { tables, scheduled: await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()) };
}
