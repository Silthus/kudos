import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import type { AlbumAnswer, AlbumPersonRead } from "../website/album";
import type { EmojiMappings, EmojiMappingsRead } from "../website/emojiMappings";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs", "workspace-settings", "random-emojis"];
const ownHypePickOn = [...albumOpen, "own-hype-pick"];
const maintainer = "U_MAINTAINER";

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;

const owner = { user: maintainer, name: "Mona Keeper" };
const alice = person("Alice", "Marchetti");
const bruno = person("Bruno", "Castellane");
const otter = person("Otter", "Quillfeather");
const everyone = [owner, alice, bruno, otter];

const slackPicture = (name: string) => `https://emoji.slack-edge.com/T1/${name}/a1b2c3.png`;

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  vi.stubEnv("KUDOS_MAINTAINER", maintainer);
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  slack = new FakeSlack();
  for (const { user, name } of everyone) slack.withMember(user, { profile: { display_name: name, real_name: name } });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...ownHypePickOn);
  for (const someone of everyone) await memberChanged(t, "team_join", slackUser(someone));
  await settle(t);
  postHogCom.withTeams(otters());
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await settle(t);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a member picks their own hype emoji", { timeout: 90_000 }, () => {
  test("a member picks a free Slack emoji as their own hype emoji, and a second pick replaces it: everyone who earned it keeps it under the new name, and the first is free again", async () => {
    await aliceCollects(bruno);
    await slackHas("bruno-wave", "bruno-cheer");
    const asBruno = await signedIn(bruno);
    const asAlice = await signedIn(alice);

    expect(await asBruno.mutation(api.website.emojiMappings.pickMyHypeEmoji, { emoji: "bruno-wave" })).toEqual({ kind: "picked" });
    expect(await hypeOf(asAlice, bruno)).toMatchObject({ name: "bruno-wave", picture: slackPicture("bruno-wave"), earned: true, inSlack: true });
    expect((await personPageOf(asBruno, bruno)).hype).toMatchObject({ name: "bruno-wave", inSlack: true });

    expect(await asBruno.mutation(api.website.emojiMappings.pickMyHypeEmoji, { emoji: "bruno-cheer" })).toEqual({ kind: "picked" });
    expect(await hypeOf(asAlice, bruno)).toMatchObject({ name: "bruno-cheer", picture: slackPicture("bruno-cheer"), earned: true, inSlack: true });
    expect((await mappingsOf(await signedIn(owner))).emoji).toEqual([
      { name: "bruno-cheer", image: slackPicture("bruno-cheer"), mapping: { kind: "hype", person: expect.any(String) } },
      { name: "bruno-wave", image: slackPicture("bruno-wave"), mapping: null },
    ]);
  });

  test("a member whose hype emoji nobody has earned yet picks one, and picking the one they have changes nothing", async () => {
    await slackHas("otter-splash");
    const asOtter = await signedIn(otter);

    expect(await asOtter.mutation(api.website.emojiMappings.pickMyHypeEmoji, { emoji: "otter-splash" })).toEqual({ kind: "picked" });
    const picked = await everyTable();
    expect(await asOtter.mutation(api.website.emojiMappings.pickMyHypeEmoji, { emoji: "otter-splash" })).toEqual({ kind: "picked" });

    expect(await everyTable()).toEqual(picked);
    expect((await personPageOf(asOtter, otter)).hype).toMatchObject({ name: "otter-splash", inSlack: true });
  });

  test("a Slack emoji mapped to a team, a milestone, a level, the random drops or someone else's hype is refused with the place it holds, and changes nothing", async () => {
    await aliceCollects(otter);
    await slackHas("team-otters", "full-of-friends", "level-10", "lucky-clover", "alice-cheer");
    const asOwner = await signedIn(owner);
    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "lucky-clover", to: { kind: "random" } })).toEqual({ kind: "mapped" });
    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "alice-cheer", to: { kind: "hype", person: keyOf(await mappingsOf(asOwner), alice) } })).toEqual({ kind: "mapped" });
    const asBruno = await signedIn(bruno);
    const before = await everyTable();

    for (const [name, by] of [
      ["team-otters", "team"],
      ["full-of-friends", "milestone"],
      ["level-10", "level"],
      ["lucky-clover", "random"],
      ["alice-cheer", "hype"],
    ] as const) expect(await asBruno.mutation(api.website.emojiMappings.pickMyHypeEmoji, { emoji: name }), name).toEqual({ kind: "taken", by });

    expect(await everyTable()).toEqual(before);
  });

  test("a Slack emoji the workspace doesn't have is refused and changes nothing", async () => {
    const asBruno = await signedIn(bruno);
    const before = await everyTable();

    expect(await asBruno.mutation(api.website.emojiMappings.pickMyHypeEmoji, { emoji: "no-such-emoji" })).toEqual({ kind: "refused" });
    expect(await everyTable()).toEqual(before);
  });

  test("a member replaces a hype emoji the maintainer mapped for them, and the maintainer can still map it again", async () => {
    await slackHas("bruno-by-mona", "bruno-own");
    const asOwner = await signedIn(owner);
    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "bruno-by-mona", to: { kind: "hype", person: keyOf(await mappingsOf(asOwner), bruno) } })).toEqual({ kind: "mapped" });
    const asBruno = await signedIn(bruno);

    expect(await asBruno.mutation(api.website.emojiMappings.pickMyHypeEmoji, { emoji: "bruno-own" })).toEqual({ kind: "picked" });
    expect((await personPageOf(asBruno, bruno)).hype).toMatchObject({ name: "bruno-own" });

    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "bruno-by-mona", to: { kind: "hype", person: keyOf(await mappingsOf(asOwner), bruno) } })).toEqual({ kind: "mapped" });
    expect((await personPageOf(asBruno, bruno)).hype).toMatchObject({ name: "bruno-by-mona" });
  });

  test("the member's own page offers the pick and anyone else's doesn't, and the Slack emoji search answers with emoji-wizard off", async () => {
    await slackHas("bruno-wave");
    const asBruno = await signedIn(bruno);

    expect(await personPageOf(asBruno, bruno)).toMatchObject({ hypePick: true });
    expect(await personPageOf(asBruno, alice)).not.toHaveProperty("hypePick");
    expect(await asBruno.query(api.website.emojiWizard.findSlackEmojis, { near: "bruno-castellane-hype", search: "bruno" })).toEqual({ kind: "matches", matches: [{ name: "bruno-wave", image: slackPicture("bruno-wave"), free: true }] });
  });
});

describe("the own hype pick is dark where own-hype-pick is off", { timeout: 90_000 }, () => {
  test("with own-hype-pick off, pickMyHypeEmoji is refused and writes nothing, the member's own page reads as before and the Slack emoji search stays off", async () => {
    await slackHas("bruno-wave");
    const asBruno = await signedIn(bruno);
    const pageWhileOn = await personPageOf(asBruno, bruno);
    await switchWebsite(t, postHog, true, ...albumOpen);
    const before = await everyTable();

    expect(await asBruno.mutation(api.website.emojiMappings.pickMyHypeEmoji, { emoji: "bruno-wave" })).toEqual({ kind: "refused" });
    expect(withoutFlagRows(await everyTable())).toEqual(withoutFlagRows(before));
    const { hypePick: _shownWhileOn, ...pageBefore } = pageWhileOn;
    expect(await personPageOf(asBruno, bruno)).toStrictEqual(pageBefore);
    expect(await asBruno.query(api.website.emojiWizard.findSlackEmojis, { near: "bruno-castellane-hype", search: "bruno" })).toEqual({ kind: "off" });
  });
});

describe("website commands pass one guard", { timeout: 90_000 }, () => {
  test("WS61: with the website flag off pickMyHypeEmoji answers closed, without a session signed-out, and for a member who left not-a-member, writing nothing at all", async () => {
    await slackHas("bruno-wave");
    const asBruno = await signedIn(bruno);
    const pick = { emoji: "bruno-wave" };
    await switchWebsite(t, postHog, false, ...ownHypePickOn);
    const closed = await everyTable();
    expect(await asBruno.mutation(api.website.emojiMappings.pickMyHypeEmoji, pick)).toEqual({ kind: "closed" });
    expect(await everyTable()).toEqual(closed);
    await switchWebsite(t, postHog, true, ...ownHypePickOn);
    const open = await everyTable();
    expect(await t.mutation(api.website.emojiMappings.pickMyHypeEmoji, pick)).toEqual({ kind: "signed-out" });
    expect(await everyTable()).toEqual(open);
    await memberChanged(t, "user_change", { id: bruno.user, team_id: "T1", deleted: true });
    await settle(t);
    const left = await everyTable();
    expect(await asBruno.mutation(api.website.emojiMappings.pickMyHypeEmoji, pick)).toEqual({ kind: "not-a-member" });
    expect(await everyTable()).toEqual(left);
  });

  test("WS61: the Slack emoji is pickMyHypeEmoji's only argument, so no call picks for any member but the caller", async () => {
    await slackHas("alice-wave");
    const asBruno = await signedIn(bruno);
    const before = await everyTable();

    await expect(asBruno.mutation(api.website.emojiMappings.pickMyHypeEmoji, { emoji: "alice-wave", member: await memberOf(alice) } as never)).rejects.toThrow(/member/);
    expect(await everyTable()).toEqual(before);
  });
});

function otters(): TeamPage {
  return { slug: "otters", name: "Otters", profiles: [{ id: 1, firstName: "Otter", lastName: "Quillfeather", colour: "teal" }] };
}

async function slackHas(...names: string[]) {
  for (const name of names) slack.withCustomEmoji(name, slackPicture(name));
  await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
  await settle(t);
}

async function mappingsOf(reader: Reader): Promise<EmojiMappings> {
  const read: EmojiMappingsRead | { kind: string } = await reader.query(api.website.emojiMappings.getEmojiMappings, {});
  if (read.kind !== "mappings") throw new Error(`expected the mappings, got ${JSON.stringify(read)}`);
  return read as EmojiMappings;
}

function keyOf(mappings: EmojiMappings, someone: Person): string {
  const found = mappings.people.find(({ name }) => name === someone.name);
  if (found === undefined) throw new Error(`${someone.name} is not among the people to map`);
  return found.key;
}

async function hypeOf(reader: Reader, someone: Person) {
  const album: { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  const id = `hype:${await memberOf(someone)}`;
  return (album as AlbumAnswer).emojis.find((entry) => entry.id === id);
}

async function personPageOf(reader: Reader, someone: Person) {
  const page: AlbumPersonRead | { kind: string } = await reader.query(api.website.album.getAlbumPerson, { person: await memberOf(someone) });
  if (page.kind !== "person") throw new Error(`expected a person page, got ${JSON.stringify(page)}`);
  return page as Extract<AlbumPersonRead, { kind: "person" }>;
}

async function aliceCollects(...people: Person[]) {
  await thanks(alice, why, ...people);
  const asAlice = await signedIn(alice);
  const album = await asAlice.query(api.website.album.getAlbum, {});
  for (const { pack } of album.kind === "album" ? album.packs : []) await asAlice.mutation(api.website.album.openThoughtfulPack, { pack });
  for (let placed = await asAlice.mutation(api.website.album.putAllIn, {}); placed.kind === "placed" && placed.more; ) placed = await asAlice.mutation(api.website.album.putAllIn, {});
  await settle(t);
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(messages).padStart(6, "0")}` });
  await settle(t);
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

function person(first: string, last: string): Person {
  return { user: `U_${first}_${last}`.toUpperCase(), name: `${first} ${last}` };
}

function slackUser({ user, name }: Person) {
  return { id: user, team_id: "T1", name, real_name: name, profile: { real_name: name, display_name: name } };
}

function everyTable() {
  return t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
}

function withoutFlagRows(tables: Record<string, unknown[]>) {
  const { flagExposures: _exposures, flagDefinitions: _definitions, ...rest } = tables;
  return rest;
}
