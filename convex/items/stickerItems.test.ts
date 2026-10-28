import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { kudosReceived, memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import type { AlbumAnswer, AlbumRead, TurnAnswer } from "../website/album";
import type { AlbumPersonAnswer } from "../website/albumPages";
import type { Denial } from "../website/memberQuery";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const weekMs = 7 * 24 * 60 * minuteMs;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs"];
const itemsOn = [...albumOpen, "hidden-items"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;
type Turned = Extract<TurnAnswer, { kind: "turned" }>;

const alice = person("Alice", "Marchetti");
const bob = person("Bob", "Okonkwo");
const carol = person("Carol", "Lindqvist");
const erin = person("Erin", "Teamless");
const everyone = [alice, bob, carol, erin];
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
  await switchWebsite(t, postHog, true, ...itemsOn);
  for (const { user, name } of everyone) await memberChanged(t, "team_join", { id: user, team_id: "T1", name, real_name: name, profile: { real_name: name, display_name: name } });
  await settle(t);
  await theCompanyCopyHolds(lanterns);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP7: a thanks earns its hoggie and, where the pack holds one, the person's sticker", { timeout: 60_000 }, () => {
  test("a thanks to a new face earns the hoggie and the sticker, each once, and the redelivered event earns nothing more", async () => {
    const ts = await thanks(alice, bob);
    await redeliver(alice, ts, bob);

    const pack = await packOf(alice, bob);
    expect(await thanksItemsEarnedBy(alice)).toEqual([
      { source: "hoggie", key: `thoughtful:${pack}`, reason: { kind: "thanks", person: await memberOf(bob) } },
      { source: "sticker", key: pack, reason: { kind: "thanks", person: await memberOf(bob) } },
    ]);
    expect(await thanksItemsOf(await signedIn(alice))).toHaveLength(2);
  });

  test("a thanks whose pack holds no sticker, because the person's sticker already waits, earns only its hoggie", async () => {
    await thanks(alice, bob);
    vi.setSystemTime(Date.now() + weekMs);
    await thanks(alice, bob);

    expect((await thanksItemsEarnedBy(alice)).map(({ source }) => source)).toEqual(["hoggie", "sticker", "hoggie"]);
  });
});

describe("LP13: a sticker's turn is today's put-in", { timeout: 60_000 }, () => {
  test("the sticker's turn puts the person in the album on their first team page, sends album sticker collected and item turned once, and a replay answers the same face and changes nothing", async () => {
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);

    const turned = await turnTheSticker(asAlice, bob);
    await settle(t);
    const written = await everythingWritten();
    const again = await turn(asAlice, await itemOf(alice, "sticker", bob));
    await settle(t);

    expect(turned).toMatchObject({ kind: "turned", face: { kind: "sticker", person: await memberOf(bob), isNew: true, thanked: { name: bob.name } }, applied: null, page: { kind: "team", team: "lanterns" }, again: false });
    expect((await albumOf(asAlice)).people).toContainEqual(expect.objectContaining({ person: await memberOf(bob), held: true }));
    expect(again).toMatchObject({ ...turned, again: true, unlocked: { teamStickers: [], hype: null, milestones: [] } });
    expect(await everythingWritten()).toEqual(written);
    expect(eventsNamed("album sticker collected")).toHaveLength(1);
    const stickersTurned = eventsNamed("item turned").filter(({ properties }) => properties.source === "sticker");
    expect(stickersTurned.map(({ properties: { source, rarity, is_new } }) => ({ source, rarity, is_new }))).toEqual([{ source: "sticker", rarity: undefined, is_new: true }]);
  });

  test("a person on no team page lands on their person page", async () => {
    await thanks(alice, erin);

    expect(await turnTheSticker(await signedIn(alice), erin)).toMatchObject({ kind: "turned", page: { kind: "person", person: await memberOf(erin) } });
  });
});

describe("LP14 LP19: a sticker that fills a team unlocks its team sticker and team emoji on that page", { timeout: 60_000 }, () => {
  test("the sticker of the team's last person answers the team, unlocks its sticker and its emoji as seen, and a replay changes nothing", async () => {
    await thanks(alice, bob, carol);
    const asAlice = await signedIn(alice);

    const first = await turnTheSticker(asAlice, bob);
    const filling = await turnTheSticker(asAlice, carol);
    const written = await everythingWritten();
    await turn(asAlice, await itemOf(alice, "sticker", carol));

    expect(first.unlocked.teamStickers).toEqual([]);
    expect(filling).toMatchObject({ page: { kind: "team", team: "lanterns" }, unlocked: { teamStickers: [{ team: "lanterns", name: "Lanterns", emoji: "team-lanterns", at: Date.now() }] } });
    const album = await albumOf(asAlice);
    expect(album.teams.find(({ team }) => team === "lanterns")).toMatchObject({ state: "unlocked", unlockedAt: Date.now() });
    expect(album.emojis.find(({ id }) => id === "team:lanterns")).toMatchObject({ earned: true, seen: true });
    expect(await everythingWritten()).toEqual(written);
  });
});

describe("LP14: the first item turned from thanking a person unlocks their hype emoji once", { timeout: 60_000 }, () => {
  test("with hidden-items on a hoggie turned while the person's sticker waits leaves the hype emoji waiting, and the sticker's turn answers it with its person's name and marks it seen", async () => {
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    const hype = `hype:${await memberOf(bob)}`;
    expect((await albumOf(asAlice)).emojis.find(({ id }) => id === hype)).toMatchObject({ earned: false, seen: false });

    const hoggie = await turn(asAlice, await itemOf(alice, "hoggie", bob));
    expect(hoggie, "the hoggie turned while the sticker waits").toMatchObject({ kind: "turned", unlocked: { hype: null } });
    expect((await albumOf(asAlice)).emojis.find(({ id }) => id === hype), "the hype emoji after the hoggie's turn").toMatchObject({ earned: false, seen: false });
    const sticker = await turnTheSticker(asAlice, bob);

    expect(sticker.unlocked.hype, "the sticker's turn").toMatchObject({ name: "bob-okonkwo-hype", from: bob.name });
    expect((await albumOf(asAlice)).emojis.find(({ id }) => id === hype)).toMatchObject({ earned: true, seen: true });
  });

  test("a thanks whose pack holds no sticker, because the person's sticker is already in the album, unlocks the hype emoji with its hoggie's turn", async () => {
    await saysLittle(alice, bob);
    await t.mutation(internal.album.history.startAlbumHistory, { workspace: "T1" });
    await settle(t);
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);

    const hoggie = await turn(asAlice, await itemOf(alice, "hoggie", bob));

    expect(hoggie, "the only item of the thanks").toMatchObject({ kind: "turned", unlocked: { hype: { name: "bob-okonkwo-hype", from: bob.name } } });
  });

  test("with hidden-items on the hype emoji reads unearned on the person's page and gives no kudos in Slack until its item turns", async () => {
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    expect((await personPageOf(asAlice, bob)).hype, "the person page before the turn").toMatchObject({ earned: false });
    await thanksWith(alice, "bob-okonkwo-hype", carol);
    expect(await kudosReceived(t, carol.user), "a kudos with the waiting hype emoji").toBe(0);

    await turnTheSticker(asAlice, bob);
    await picksForKudos(asAlice, `hype:${await memberOf(bob)}`);
    await thanksWith(alice, "bob-okonkwo-hype", carol);

    expect((await personPageOf(asAlice, bob)).hype, "the person page after the turn").toMatchObject({ earned: true });
    expect(await kudosReceived(t, carol.user), "a kudos with the unlocked hype emoji").toBe(1);
  });

  test("LP6: a hype emoji earned through the old put-in stays earned once hidden-items is on, while a later thanks to the same person waits face down", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    for (const { pack } of (await albumOf(asAlice)).packs) await asAlice.mutation(api.website.album.openThoughtfulPack, { pack });
    await asAlice.mutation(api.website.album.putAllIn, {});
    vi.setSystemTime(Date.now() + weekMs);
    await switchWebsite(t, postHog, true, ...itemsOn);
    await thanks(alice, bob);
    const asAliceAWeekOn = await signedIn(alice);
    expect((await thanksItemsOf(asAliceAWeekOn)).map(({ reason }) => reason.kind === "thanks" && reason.thanked.name), "the later thanks waits").toEqual([bob.name]);

    await picksForKudos(asAliceAWeekOn, `hype:${await memberOf(bob)}`);
    await thanksWith(alice, "bob-okonkwo-hype", carol);

    expect((await personPageOf(asAliceAWeekOn, bob)).hype, "the person page").toMatchObject({ earned: true });
    expect(await kudosReceived(t, carol.user), "a kudos with the hype emoji earned before").toBe(1);
  });

  test("with hidden-items off the hype emoji is earned and unseen at the thanks, on the person's page and in Slack, as today", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);

    const hype = `hype:${await memberOf(bob)}`;
    expect((await albumOf(asAlice)).emojis.find(({ id }) => id === hype)).toMatchObject({ earned: true, seen: false });
    expect((await personPageOf(asAlice, bob)).hype).toMatchObject({ earned: true });
    await picksForKudos(asAlice, hype);
    await thanksWith(alice, "bob-okonkwo-hype", carol);
    expect(await kudosReceived(t, carol.user)).toBe(1);
  });
});

describe("LP13 LP14: every turn answers the milestone tiers it unlocks", { timeout: 60_000 }, () => {
  test("a hoggie's turn answers the thoughtful tier its thanks reached in Slack, and each sticker's turn exactly the tiers recorded in its mutation, the teams tier when it fills a team", async () => {
    await thanks(alice, bob, carol);
    const asAlice = await signedIn(alice);

    const hoggie = await turn(asAlice, await itemOf(alice, "hoggie", bob));
    vi.setSystemTime(Date.now() + minuteMs);
    const first = await turnTheSticker(asAlice, bob);
    const firstTiers = await tiersRecordedAt(alice, Date.now());
    vi.setSystemTime(Date.now() + minuteMs);
    const filling = await turnTheSticker(asAlice, carol);
    const fillingTiers = await tiersRecordedAt(alice, Date.now());

    expect(hoggie).toMatchObject({ kind: "turned", unlocked: { milestones: [{ milestone: "thoughtful", tier: "bronze" }] } });
    expect(first.unlocked.milestones).toEqual(expect.arrayContaining(firstTiers));
    expect(first.unlocked.milestones).toHaveLength(firstTiers.length);
    expect(filling.unlocked.milestones).toEqual(expect.arrayContaining(fillingTiers));
    expect(filling.unlocked.milestones).toHaveLength(fillingTiers.length);
    expect(filling.unlocked.milestones).toContainEqual({ milestone: "teams", tier: "bronze" });
  });
});

describe("LP6: the old put-in and put-all-in mark the sticker item turned", { timeout: 60_000 }, () => {
  test("with hidden-items off a sticker put in, and the stickers put all in, no longer wait once the flag turns on, while the tray's hoggies wait until they are put in", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    await thanks(alice, bob, carol);
    const asAlice = await signedIn(alice);
    for (const { pack } of (await albumOf(asAlice)).packs) await asAlice.mutation(api.website.album.openThoughtfulPack, { pack });
    const bobMember = await memberOf(bob);
    const bobsSticker = (await albumOf(asAlice)).tray.find((item) => item.kind === "sticker" && item.person === bobMember);
    await asAlice.mutation(api.website.album.putIn, { item: bobsSticker!.item });

    await switchWebsite(t, postHog, true, ...itemsOn);
    expect((await thanksItemsOf(asAlice)).map(({ reason }) => reason.kind === "thanks" && reason.thanked.name).sort()).toEqual([bob.name, carol.name, carol.name]);
    await switchWebsite(t, postHog, true, ...albumOpen);
    await asAlice.mutation(api.website.album.putAllIn, {});
    await switchWebsite(t, postHog, true, ...itemsOn);
    expect(await thanksItemsOf(asAlice)).toEqual([]);
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

async function theCompanyCopyHolds(...teams: TeamPage[]) {
  postHogCom.withTeams(...teams);
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await settle(t);
}

async function thanks(giver: Person, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  await redeliver(giver, ts, ...recipients);
  return ts;
}

async function saysLittle(giver: Person, recipient: Person) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  await post(t, [section(text("ty "), mention(recipient.user), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(messages).padStart(6, "0")}` });
  await settle(t);
}

async function picksForKudos(reader: Reader, emoji: string) {
  expect(await reader.mutation(api.website.album.pickKudosEmoji, { emoji, picked: true })).toMatchObject({ kind: "picked" });
}

async function thanksWith(giver: Person, emojiName: string, recipient: Person) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  await post(t, [section(text(`${why} `), mention(recipient.user), text(" "), emoji(emojiName))], { user: giver.user, ts: `${Date.now() / 1000}.${String(messages).padStart(6, "0")}` });
  await settle(t);
}

async function personPageOf(reader: Reader, of: Person): Promise<AlbumPersonAnswer> {
  const page = await reader.query(api.website.album.getAlbumPerson, { person: await memberOf(of) });
  if (page.kind !== "person") throw new Error(`expected a person page, got ${JSON.stringify(page)}`);
  return page;
}

async function redeliver(giver: Person, ts: string, ...recipients: Person[]) {
  await post(t, [section(text(`${why} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
}

function turn(reader: Reader, item: Id<"items">): Promise<TurnAnswer | Denial> {
  return reader.mutation(api.website.album.turnItem, { item });
}

async function turnTheSticker(reader: Reader, of: Person): Promise<Turned> {
  const turned = await turn(reader, await itemOf(alice, "sticker", of));
  if (turned.kind !== "turned") throw new Error(`expected the sticker turned, got ${JSON.stringify(turned)}`);
  return turned;
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

async function itemsOf(giver: Person): Promise<Doc<"items">[]> {
  const member = await memberOf(giver);
  return t.run((ctx) =>
    ctx.db
      .query("items")
      .withIndex("by_member_turned", (q) => q.eq("member", member))
      .collect(),
  );
}

async function thanksItemsEarnedBy(giver: Person) {
  return (await itemsOf(giver)).flatMap(({ source, key, reason }) => (reason.kind === "thanks" ? [{ source, key, reason: { kind: reason.kind, person: reason.person } }] : []));
}

async function itemOf(giver: Person, source: Doc<"items">["source"], thanked: Person): Promise<Id<"items">> {
  const person = await memberOf(thanked);
  const item = (await itemsOf(giver)).find((row) => row.source === source && row.reason.kind === "thanks" && row.reason.person === person);
  if (item === undefined) throw new Error(`no ${source} item for thanking ${thanked.name}`);
  return item._id;
}

async function packOf(giver: Person, recipient: Person) {
  const [member, person] = [await memberOf(giver), await memberOf(recipient)];
  const pack = await t.run((ctx) =>
    ctx.db
      .query("thoughtfulPacks")
      .withIndex("by_giver_recipient_week", (q) => q.eq("giver", member).eq("recipient", person))
      .first(),
  );
  return pack!._id;
}

async function tiersRecordedAt(someone: Person, at: number) {
  const member = await memberOf(someone);
  const tiers = await t.run((ctx) =>
    ctx.db
      .query("milestoneTiers")
      .withIndex("by_member_milestone_tier", (q) => q.eq("member", member))
      .collect(),
  );
  return tiers.filter((tier) => tier.at === at).map(({ milestone, tier }) => ({ milestone, tier }));
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
