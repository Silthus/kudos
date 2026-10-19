import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import type { AlbumAnswer, AlbumRead } from "../website/album";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;
type AlbumTeam = AlbumAnswer["teams"][number];

const alice = person("Alice", "Marchetti");
const lanterns = Array.from({ length: 8 }, (_, index) => person("Lantern", `Wickfield${index + 1}`));
const otters = Array.from({ length: 3 }, (_, index) => person("Otter", `Quillfeather${index + 1}`));
const newcomer = person("Newt", "Latecomer");
const nobodyInSlack = person("Ghost", "Unmatchedly");
const everyone = [alice, ...lanterns, ...otters, newcomer, nobodyInSlack];
const inSlack = everyone.filter((someone) => someone !== nobodyInSlack);
const ottersCrest = aCutout("otters-crest");

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
  for (const { user, name } of inSlack) slack.withMember(user, { profile: { display_name: name, real_name: name } });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...albumOpen);
  for (const { user, name } of inSlack) await memberChanged(t, "team_join", slackUser(user, name));
  await settle(t);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AL18: team pages are company teams", { timeout: 60_000 }, () => {
  test("a team of eight is one page counting the member's album stickers of its matched people, the member excluded, everyone kept and an unmatched person shown but not counted", async () => {
    await theCompanyCopyHolds({ slug: "lanterns", name: "Lanterns", profiles: profilesOf(alice, ...lanterns, nobodyInSlack) });
    await aliceCollects(...lanterns.slice(0, 5));
    const asAlice = await signedIn(alice);

    expect(await teamsOf(asAlice)).toEqual([
      { team: "lanterns", name: "Lanterns", art: null, mine: true, people: await membersOf(lanterns), unmatched: [nobodyInSlack.name], held: 5, total: 8, state: "progress", unlockedAt: null },
    ]);
  });

  test("pages come in sidebar order: the member's own team first, then pages ready to unlock, then the most held", async () => {
    await theCompanyCopyHolds(
      { slug: "beacons", name: "Beacons", profiles: profilesOf(...lanterns.slice(0, 4)) },
      { slug: "comets", name: "Comets", profiles: profilesOf(...lanterns.slice(4)) },
      { slug: "otters", name: "Otters", profiles: profilesOf(...otters) },
      { slug: "zephyrs", name: "Zephyrs", profiles: profilesOf(alice, newcomer) },
    );
    await aliceCollects(...lanterns.slice(0, 3), lanterns[4]!, ...otters);

    expect((await teamsOf(await signedIn(alice))).map(({ team, state }) => [team, state])).toEqual([
      ["zephyrs", "progress"],
      ["otters", "ready"],
      ["beacons", "progress"],
      ["comets", "progress"],
    ]);
  });
});

describe("AL19: unlocking a team sticker", { timeout: 60_000 }, () => {
  test("a complete page reads ready, and the member's click unlocks its team sticker once, storing the team's name, crest art and its emoji name from the registry", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", crest: ottersCrest, profiles: profilesOf(...otters) });
    await aliceCollects(...otters);
    const asAlice = await signedIn(alice);
    const ready = await teamNamed(asAlice, "otters");
    expect(ready).toMatchObject({ state: "ready", unlockedAt: null, held: 3, total: 3, art: { kind: "image" } });
    vi.setSystemTime(Date.now() + minuteMs);

    const unlocked = await unlock(asAlice, "otters");

    const at = Date.now();
    expect(unlocked).toEqual({ kind: "unlocked", sticker: { team: "otters", name: "Otters", art: ready.art, emoji: "otters", at } });
    expect(await teamNamed(asAlice, "otters")).toEqual({ ...ready, state: "unlocked", unlockedAt: at });
  });

  test("an incomplete page, an unknown team and a second click each answer the fixed refusal and change no table", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", profiles: profilesOf(...otters) }, { slug: "lanterns", name: "Lanterns", profiles: profilesOf(...lanterns) });
    await aliceCollects(...otters, ...lanterns.slice(0, 7));
    const asAlice = await signedIn(alice);
    await unlock(asAlice, "otters");
    const before = await everyTable();

    expect(await unlock(asAlice, "lanterns"), "a page missing one person").toEqual({ kind: "refused" });
    expect(await unlock(asAlice, "unheard-of"), "a team the company copy doesn't hold").toEqual({ kind: "refused" });
    expect(await unlock(asAlice, "otters"), "a second click").toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(before);
  });

  test("a page completed from the album's history alone, before any thoughtful pack opened the emoji name registry, unlocks with its team's name reserved in the registry's order", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", profiles: profilesOf(...otters) }, { slug: "lanterns", name: "Lanterns", profiles: profilesOf(...lanterns) });
    await thanks(alice, "ty", ...otters);
    await t.mutation(internal.album.history.startAlbumHistory, { workspace: "T1" });
    await settle(t);
    const asAlice = await signedIn(alice);
    expect(await emojiNamesIn("T1"), "no name before the unlock").toEqual([]);

    expect(await unlock(asAlice, "otters")).toMatchObject({ kind: "unlocked", sticker: { team: "otters", emoji: "otters" } });

    expect(await emojiNamesIn("T1")).toEqual(expect.arrayContaining(["level-5", "lanterns", "otters"]));
  });

  test("a page with nobody to collect is never complete", async () => {
    await theCompanyCopyHolds({ slug: "soloists", name: "Soloists", profiles: profilesOf(alice, nobodyInSlack) });
    const asAlice = await signedIn(alice);

    expect(await teamNamed(asAlice, "soloists")).toMatchObject({ mine: true, held: 0, total: 0, state: "progress" });
    expect(await unlock(asAlice, "soloists")).toEqual({ kind: "refused" });
  });
});

describe("a team sticker stays unlocked", { timeout: 60_000 }, () => {
  test("a team joined, a match lost and the team leaving posthog.com never take the sticker back or change how it shows, and a second click unlocks nothing", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", crest: ottersCrest, profiles: profilesOf(...otters) });
    await aliceCollects(...otters);
    const asAlice = await signedIn(alice);
    await unlock(asAlice, "otters");
    const unlocked = await teamNamed(asAlice, "otters");
    const shown = { team: unlocked.team, name: unlocked.name, art: unlocked.art, state: "unlocked", unlockedAt: unlocked.unlockedAt };

    await theCompanyCopyHolds({ slug: "otters", name: "Otters", crest: ottersCrest, profiles: profilesOf(...otters, newcomer) });
    expect(await teamNamed(asAlice, "otters"), "a newcomer joined the team").toMatchObject({ ...shown, held: 3, total: 4 });

    await memberChanged(t, "user_change", slackUser(otters[0]!.user, "Someone Else Entirely"));
    await settle(t);
    expect(await teamNamed(asAlice, "otters"), "a match lost").toMatchObject({ ...shown, held: 2, total: 3 });

    await theCompanyCopyHolds({ slug: "lanterns", name: "Lanterns", profiles: profilesOf(...lanterns) });
    expect(await teamNamed(asAlice, "otters"), "the team left posthog.com").toEqual({ ...shown, mine: false, people: [], unmatched: [], held: 0, total: 0 });

    expect(await unlock(asAlice, "otters"), "a second click").toEqual({ kind: "refused" });
  });

  test("a team renamed on posthog.com is a new slug, so a new page, beside the unlocked sticker's stored name", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", profiles: profilesOf(...otters) });
    await aliceCollects(...otters);
    const asAlice = await signedIn(alice);
    await unlock(asAlice, "otters");

    await theCompanyCopyHolds({ slug: "river-otters", name: "River Otters", profiles: profilesOf(...otters) });

    expect((await teamsOf(asAlice)).map(({ team, name, state }) => [team, name, state])).toEqual([
      ["river-otters", "River Otters", "ready"],
      ["otters", "Otters", "unlocked"],
    ]);
  });
});

describe("AL39: the album is dark where album is off, shows only to the members it is on for, and nothing exposes it", { timeout: 60_000 }, () => {
  test("turned off once a page is complete, unlocking its team sticker answers the fixed refusal and changes no table", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", profiles: profilesOf(...otters) });
    await aliceCollects(...otters);
    const asAlice = await signedIn(alice);
    await switchWebsite(t, postHog, true, "collection", "packs");
    await settle(t);
    const before = await everyTable();

    expect(await unlock(asAlice, "otters")).toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(before);
  });
});

describe("the album is private", { timeout: 60_000 }, () => {
  test("unlockTeamSticker unlocks only the signed-in member's own page: a team complete in another member's album answers the fixed refusal and changes no table", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", profiles: profilesOf(...otters) });
    await aliceCollects(...otters);
    const [asAlice, asNewt] = [await signedIn(alice), await signedIn(newcomer)];
    await settle(t);
    const before = await everyTable();

    expect(await unlock(asNewt, "otters"), "Newt clicking the page complete in Alice's album").toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(before);
    expect(await teamNamed(asAlice, "otters")).toMatchObject({ state: "ready" });
    expect(await unlock(asAlice, "otters")).toMatchObject({ kind: "unlocked" });
    expect(await teamNamed(asNewt, "otters")).toMatchObject({ state: "progress", held: 0 });
  });
});

describe("website commands pass one guard", { timeout: 60_000 }, () => {
  test("WS61: with the website flag off, unlocking answers closed and writes nothing at all", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", profiles: profilesOf(...otters) });
    await aliceCollects(...otters);
    const asAlice = await signedIn(alice);
    await switchWebsite(t, postHog, false, ...albumOpen);
    const before = await everyTable();

    expect(await unlock(asAlice, "otters")).toEqual({ kind: "closed" });
    expect(await everyTable()).toEqual(before);
  });

  test("WS61: without a session unlocking answers signed-out, and for a member who left not-a-member, writing nothing at all", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", profiles: profilesOf(...otters) });
    await aliceCollects(...otters);
    const asAlice = await signedIn(alice);
    const before = await everyTable();

    expect(await unlock(t, "otters")).toEqual({ kind: "signed-out" });
    expect(await everyTable()).toEqual(before);
    await memberChanged(t, "user_change", { ...slackUser(alice.user, alice.name), deleted: true });
    await settle(t);
    const left = await everyTable();
    expect(await unlock(asAlice, "otters")).toEqual({ kind: "not-a-member" });
    expect(await everyTable()).toEqual(left);
  });

  test("WS61: the team is unlockTeamSticker's only argument, so no call names a member", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", profiles: profilesOf(...otters) });
    await aliceCollects(...otters);
    const asAlice = await signedIn(alice);
    const before = await everyTable();

    await expect(asAlice.mutation(api.website.album.unlockTeamSticker, { team: "otters", member: await memberOf(alice) } as never)).rejects.toThrow(/member/);
    expect(await everyTable()).toEqual(before);
  });
});

function person(first: string, last: string): Person {
  return { user: `U_${first}_${last}`.toUpperCase(), name: `${first} ${last}` };
}

function slackUser(id: string, name: string) {
  return { id, team_id: "T1", name, real_name: name, profile: { real_name: name, display_name: name } };
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

function unlock(reader: Reader, team: string) {
  return reader.mutation(api.website.album.unlockTeamSticker, { team });
}

async function teamsOf(reader: Reader): Promise<AlbumTeam[]> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return (album as AlbumAnswer).teams;
}

async function teamNamed(reader: Reader, team: string): Promise<AlbumTeam> {
  const page = (await teamsOf(reader)).find((page) => page.team === team);
  if (page === undefined) throw new Error(`no page for ${team}`);
  return page;
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

function membersOf(people: Person[]) {
  return Promise.all(people.map(memberOf));
}

function emojiNamesIn(workspace: string) {
  return t.run(async (ctx) => (await ctx.db.query("emojiNames").collect()).filter((row) => row.workspace === workspace).map(({ name }) => name));
}

function everyTable() {
  return t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
}
