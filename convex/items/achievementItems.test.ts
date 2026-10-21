import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { catalogue, rarities, type Rarity } from "../hoggies/catalogue";
import { drawOf } from "../hoggies/draw";
import type { AlbumAnswer, AlbumRead, TurnAnswer } from "../website/album";
import type { Denial } from "../website/memberQuery";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs"];
const itemsOn = [...albumOpen, "hidden-items"];
const achievementsOn = [...itemsOn, "achievement-hoggies"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;
type Turned = Extract<TurnAnswer, { kind: "turned" }>;
type HoggieTurned = Turned & { face: { kind: "hoggie" } };

const alice = person("Alice", "Marchetti");
const bob = person("Bob", "Okonkwo");
const carol = person("Carol", "Lindqvist");
const everyone = [alice, bob, carol];
const lanterns: TeamPage = { slug: "lanterns", name: "Lanterns", profiles: profilesOf(alice, bob, carol) };

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  const slack = new FakeSlack();
  for (const { user, name } of everyone) slack.withMember(user, { profile: { display_name: name, real_name: name } });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...achievementsOn);
  for (const { user, name } of everyone) await memberChanged(t, "team_join", { id: user, team_id: "T1", name, real_name: name, profile: { real_name: name, display_name: name } });
  await settle(t);
  postHogCom.withTeams(lanterns);
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await settle(t);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP61 LP62: a filled team page earns one hoggie the member does not own, rare or rarer", { timeout: 60_000 }, () => {
  test("filling the team earns one rare-floored item named for the team, and its turn draws a rare or rarer hoggie the member does not own yet", async () => {
    const asAlice = await signedIn(alice);
    const usual = await drawOf({ secret: "", member: await memberOf(alice), crate: "team:lanterns", version: catalogue.version, floor: "rare" });
    await owns(alice, usual.hoggie);

    await fillsLanterns(asAlice);

    expect(await achievementItemsOf(alice)).toContainEqual({ key: "team:lanterns", floor: "rare", reason: { kind: "team", team: "lanterns", name: "Lanterns" } });
    const teamItem = (await boardOf(asAlice)).find(({ reason }) => reason.kind === "team");
    expect(teamItem?.reason).toEqual({ kind: "team", team: "lanterns", name: "Lanterns" });
    const turned = await turnHoggie(asAlice, teamItem!.item);
    expect(turned.face.drop.hoggie, "the hoggie the member already owns is never drawn again").not.toBe(usual.hoggie);
    expect(turned.face.drop.isNew).toBe(true);
    expect(rankOf(turned.face.drop.rarity)).toBeGreaterThanOrEqual(rankOf("rare"));
    expect(turned.applied).toBeNull();
  });
});

describe("LP61 LP62: each milestone tier earns one hoggie the member does not own, at or above its tier's floor", { timeout: 60_000 }, () => {
  test("each tier the turn reaches earns one item with its tier's floor, and each turns into a hoggie the member does not own, at or above that floor", async () => {
    await ownsEvery(alice, (hoggie) => hoggie.rarity === "common" || hoggie.rarity === "uncommon");
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);

    await turnTheSticker(asAlice, bob);

    const floors = Object.fromEntries((await achievementItemsOf(alice)).filter(({ key }) => key.startsWith("milestone:hoggies:")).map(({ key, floor }) => [key, floor]));
    expect(floors).toEqual({ "milestone:hoggies:bronze": "uncommon", "milestone:hoggies:silver": "rare", "milestone:hoggies:gold": "epic" });
    for (const [key, floor] of Object.entries(floors)) {
      const turned = await turnHoggie(asAlice, await itemKeyed(alice, key));
      expect(turned.face.drop.isNew, `${key} draws a hoggie the member does not own`).toBe(true);
      expect(rankOf(turned.face.drop.rarity), `${key} draws at or above ${floor}`).toBeGreaterThanOrEqual(rankOf(floor!));
    }
  });

  test("a tier reached twice over earns its item once", async () => {
    await ownsEvery(alice, (hoggie) => hoggie.rarity === "common");
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    await turnTheSticker(asAlice, bob);

    await t.mutation(internal.album.milestones.recordMilestonesInWorkspace, { workspace: "T1", cursor: null });
    await settle(t);

    expect((await achievementItemsOf(alice)).filter(({ key }) => key === "milestone:hoggies:silver")).toHaveLength(1);
  });
});

describe("LP63: a reward whose floor and above the member owns whole draws a duplicate at or above its floor", { timeout: 60_000 }, () => {
  test("with every hoggie owned, the gold tier's item draws an owned epic or legendary, and the diamond tier's an owned legendary", async () => {
    await ownsEvery(alice, () => true);
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    await turnTheSticker(asAlice, bob);

    const gold = await turnHoggie(asAlice, await itemKeyed(alice, "milestone:hoggies:gold"));
    const diamond = await turnHoggie(asAlice, await itemKeyed(alice, "milestone:hoggies:diamond"));

    expect(gold.face.drop).toMatchObject({ isNew: false });
    expect(rankOf(gold.face.drop.rarity)).toBeGreaterThanOrEqual(rankOf("epic"));
    expect(diamond.face.drop).toMatchObject({ rarity: "legendary", isNew: false });
  });
});

describe("LP62: every other draw keeps its duplicates", { timeout: 60_000 }, () => {
  test("a thanks item still draws the hoggie its crate key draws, owned or not", async () => {
    await thanks(alice, bob);
    const crate = (await itemsOf(alice)).find(({ key }) => key.startsWith("thoughtful:"))!.key;
    const usual = await drawOf({ secret: "", member: await memberOf(alice), crate, version: catalogue.version });
    await owns(alice, usual.hoggie);
    const asAlice = await signedIn(alice);

    const turned = await turnHoggie(asAlice, await itemKeyed(alice, crate));

    expect(turned.face.drop).toMatchObject({ hoggie: usual.hoggie, isNew: false });
  });
});

describe("LP64: achievement items wait unseen while achievement-hoggies or hidden-items is off, and nothing is lost", { timeout: 60_000 }, () => {
  test("with achievement-hoggies off the filled team's item is earned but neither shown nor turned, and it shows once the flag turns on", async () => {
    await switchWebsite(t, postHog, true, ...itemsOn);
    const asAlice = await signedIn(alice);
    await fillsLanterns(asAlice);
    const item = await itemKeyed(alice, "team:lanterns");

    expect((await boardOf(asAlice)).map(({ reason }) => reason.kind)).not.toContain("team");
    expect((await boardOf(asAlice)).map(({ reason }) => reason.kind)).not.toContain("milestone");
    expect(await turn(asAlice, item)).toEqual({ kind: "refused" });
    expect(await dropsOf(alice, "team:lanterns")).toEqual([]);

    await switchWebsite(t, postHog, true, ...achievementsOn);
    expect((await boardOf(asAlice)).filter(({ item: shown }) => shown === item)).toHaveLength(1);
    expect(await turn(asAlice, item)).toMatchObject({ kind: "turned", again: false });
  });

  test("with hidden-items off the old unlock earns the filled team's item, which waits face down until the flag turns back on", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen, "achievement-hoggies");
    await thanks(alice, bob, carol);
    const asAlice = await signedIn(alice);
    for (const { pack } of (await albumOf(asAlice)).packs) await asAlice.mutation(api.website.album.openThoughtfulPack, { pack });
    await asAlice.mutation(api.website.album.putAllIn, {});
    await asAlice.mutation(api.website.album.unlockTeamSticker, { team: "lanterns" });

    expect(await achievementItemsOf(alice)).toContainEqual({ key: "team:lanterns", floor: "rare", reason: { kind: "team", team: "lanterns", name: "Lanterns" } });
    expect(await dropsOf(alice, "team:lanterns")).toEqual([]);

    await switchWebsite(t, postHog, true, ...achievementsOn);
    const teamItem = (await boardOf(asAlice)).find(({ reason }) => reason.kind === "team");
    expect(await turnHoggie(asAlice, teamItem!.item)).toMatchObject({ face: { drop: { isNew: true } } });
  });

  test("an item waiting when achievement-hoggies turns back off waits on, undrawn, and shows once when it turns on again", async () => {
    const asAlice = await signedIn(alice);
    await fillsLanterns(asAlice);
    const item = await itemKeyed(alice, "team:lanterns");

    await switchWebsite(t, postHog, true, ...itemsOn);
    expect((await boardOf(asAlice)).map(({ item: shown }) => shown)).not.toContain(item);
    await switchWebsite(t, postHog, true, ...achievementsOn);

    expect((await boardOf(asAlice)).filter(({ item: shown }) => shown === item)).toHaveLength(1);
    expect(await dropsOf(alice, "team:lanterns")).toEqual([]);
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

function rankOf(rarity: Rarity) {
  return rarities.findIndex((listed) => listed.rarity === rarity);
}

async function fillsLanterns(asAlice: Reader) {
  await thanks(alice, bob, carol);
  await turnTheSticker(asAlice, bob);
  await turnTheSticker(asAlice, carol);
}

async function thanks(giver: Person, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${why} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
}

async function owns(someone: Person, hoggie: string) {
  const member = await memberOf(someone);
  await t.run((ctx) => ctx.db.insert("hoggieTallies", { member, hoggie, count: 1, firstAt: Date.now(), firstN: 1 }));
}

async function ownsEvery(someone: Person, which: (hoggie: (typeof catalogue.hoggies)[number]) => boolean) {
  for (const { hoggie } of catalogue.hoggies.filter(which)) await owns(someone, hoggie);
}

function turn(reader: Reader, item: Id<"items">): Promise<TurnAnswer | Denial> {
  return reader.mutation(api.website.album.turnItem, { item });
}

async function turnHoggie(reader: Reader, item: Id<"items">): Promise<HoggieTurned> {
  const turned = await turn(reader, item);
  if (turned.kind !== "turned" || turned.face.kind !== "hoggie") throw new Error(`expected a hoggie turned, got ${JSON.stringify(turned)}`);
  return turned as HoggieTurned;
}

async function turnTheSticker(reader: Reader, of: Person): Promise<Turned> {
  const person = await memberOf(of);
  const item = (await itemsOf(alice)).find((row) => row.source === "sticker" && row.reason.kind === "thanks" && row.reason.person === person);
  const turned = await turn(reader, item!._id);
  if (turned.kind !== "turned") throw new Error(`expected the sticker turned, got ${JSON.stringify(turned)}`);
  return turned;
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

async function boardOf(reader: Reader) {
  const { board } = await albumOf(reader);
  if (board === undefined) throw new Error("expected the item board");
  return board.items;
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

async function itemsOf(someone: Person): Promise<Doc<"items">[]> {
  const member = await memberOf(someone);
  return t.run((ctx) =>
    ctx.db
      .query("items")
      .withIndex("by_member_turned", (q) => q.eq("member", member))
      .collect(),
  );
}

async function achievementItemsOf(someone: Person) {
  return (await itemsOf(someone)).flatMap(({ key, floor, reason }) => (reason.kind === "team" || reason.kind === "milestone" ? [{ key, floor, reason }] : []));
}

async function itemKeyed(someone: Person, key: string): Promise<Id<"items">> {
  const item = (await itemsOf(someone)).find((row) => row.key === key);
  if (item === undefined) throw new Error(`no item keyed ${key}`);
  return item._id;
}

async function dropsOf(someone: Person, crate: string) {
  const member = await memberOf(someone);
  return t.run((ctx) =>
    ctx.db
      .query("drops")
      .withIndex("by_member_crate", (q) => q.eq("member", member).eq("crate", crate))
      .collect(),
  );
}
