import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aMember, aSession, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import schema from "../schema";
import type { AlbumRead, ThoughtfulBoardsRead } from "./album";

const minuteMs = 60_000;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const dana = { user: "U_DANA", name: "Dana Ferreira" };
const juno = { user: "U_JUNO", name: "Juno Park" };

type Person = { user: string; name: string };

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date("2026-10-13T10:00:00Z") });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack();
  postHogCom = new FakePostHogCom();
  for (const person of [alice, bob, carol, dana]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
  await switchWebsite(t, postHog, true, "album");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the album is private", () => {
  test("getAlbum answers each signed-in member their own name, level, waiting packs and people, never another member's", async () => {
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    await thanks(bob, "Thanks for pairing on the stubborn cache invalidation", carol, dana);
    await thanks(carol, "Thanks for the thorough onboarding notes you wrote", alice);
    await t.mutation(internal.album.history.startAlbumHistory, { workspace: "T1" });
    await settle(t);

    const albums = await Promise.all([alice, bob, carol, dana].map(async (person) => [person, await albumOf(await signedIn(person))] as const));

    for (const [person, album] of albums) expect(album, `${person.name}'s own album`).toMatchObject({ kind: "album", me: { name: person.name, person: await memberOf(person) } });
    expect(await packedPeopleIn(albums)).toEqual({ [alice.name]: [bob.name], [bob.name]: [carol.name, dana.name], [carol.name]: [alice.name], [dana.name]: [] });
    expect(heldPeopleIn(albums)).toEqual({ [alice.name]: [bob.name], [bob.name]: [carol.name, dana.name], [carol.name]: [alice.name], [dana.name]: [] });
  });

  test("openThoughtfulPack opens only the signed-in member's own pack: another member's answers the fixed refusal and changes no table", async () => {
    await switchWebsite(t, postHog, true, "album", "collection", "packs");
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    const asAlice = await signedIn(alice);
    const before = await albumOf(asAlice);
    const [forBob] = "packs" in before ? before.packs : [];
    const asBob = await signedIn(bob);
    await settle(t);
    const tables = await everyTable();

    expect(await asBob.mutation(api.website.album.openThoughtfulPack, { pack: forBob!.pack })).toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(tables);
    expect(await albumOf(asAlice)).toEqual(before);
  });

  test("an argument that names another member is rejected by the validator", async () => {
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    const asBob = await signedIn(bob);
    const withAnotherMember = { member: await memberOf(alice) } as unknown as Record<string, never>;

    await expect(asBob.query(api.website.album.getAlbum, withAnotherMember)).rejects.toThrow(/member/);
  });

  test("getThoughtfulBoards pins each signed-in member's own row, never another member's", async () => {
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    await thanks(bob, "Thanks for pairing on the stubborn cache invalidation", carol, dana);
    await thanks(carol, "Thanks for the thorough onboarding notes you wrote", alice);

    for (const person of [alice, bob, carol, dana]) {
      const boards = await boardsOf(await signedIn(person));
      expect(boards, `${person.name}'s own pinned row`).toMatchObject({ kind: "boards", pinned: { me: { name: person.name, you: true } } });
      expect((boards as Extract<ThoughtfulBoardsRead, { kind: "boards" }>).people.filter(({ you }) => you).map(({ name }) => name), `${person.name} is the only you`).toEqual(person === dana ? [] : [person.name]);
    }
  });

  test("getThoughtfulBoards rejects an argument that names another member", async () => {
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    const asBob = await signedIn(bob);
    const withAnotherMember = { member: await memberOf(alice) } as unknown as Record<string, never>;

    await expect(asBob.query(api.website.album.getThoughtfulBoards, withAnotherMember)).rejects.toThrow(/member/);
  });
});

describe("AL40: getAlbum shows the member's face without reading the directory", () => {
  test("with team-pages on, a member matched on posthog.com shows their stored company face and a member matched to no profile their sign-in face", async () => {
    await switchWebsite(t, postHog, true, "album", "team-pages");
    postHogCom.withTeams({ slug: "lanterns", name: "Lanterns", profiles: [{ id: 7, firstName: "Alice", lastName: "Marchetti", colour: "teal", cutout: aCutout("alice") }] });
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
    await settle(t);

    const [aliceAlbum, bobAlbum] = [await albumOf(await signedIn(alice)), await albumOf(await signedIn(bob))];

    expect(aliceAlbum).toMatchObject({ kind: "album", me: { face: { kind: "company-profile", image: expect.stringContaining("alice"), colour: expect.any(String) } } });
    expect(bobAlbum).toMatchObject({ kind: "album", me: { face: { kind: "initials", initials: "BO" } } });
  });
});

describe("website reads pass one guard", () => {
  test("getAlbum and getThoughtfulBoards read closed while the website flag is off, even with album on", async () => {
    const asAlice = await signedIn(alice);
    await switchWebsite(t, postHog, false, "album");

    expect(await albumOf(asAlice)).toEqual({ kind: "closed" });
    expect(await boardsOf(asAlice)).toEqual({ kind: "closed" });
  });

  test("getAlbum and getThoughtfulBoards read signed out without a session", async () => {
    expect(await albumOf(t)).toEqual({ kind: "signed-out" });
    expect(await boardsOf(t)).toEqual({ kind: "signed-out" });
  });

  test("getAlbum and getThoughtfulBoards read not-a-member for a former member with a live session", async () => {
    await aMember(t, juno.user, "not-a-member");
    const { asSignedIn } = await aSession(t, juno);

    expect(await albumOf(asSignedIn)).toEqual({ kind: "not-a-member" });
    expect(await boardsOf(asSignedIn)).toEqual({ kind: "not-a-member" });
  });
});

type Reader = Pick<Backend, "query">;

function albumOf(reader: Reader): Promise<AlbumRead | { kind: string }> {
  return reader.query(api.website.album.getAlbum, {});
}

function boardsOf(reader: Reader): Promise<ThoughtfulBoardsRead | { kind: string }> {
  return reader.query(api.website.album.getThoughtfulBoards, {});
}

async function packedPeopleIn(albums: ReadonlyArray<readonly [Person, AlbumRead | { kind: string }]>) {
  const names = new Map<string, string>();
  for (const person of [alice, bob, carol, dana]) names.set(await memberOf(person), person.name);
  return Object.fromEntries(albums.map(([person, album]) => [person.name, "packs" in album ? (album as Extract<AlbumRead, { kind: "album" }>).packs.map(({ person: packed }) => names.get(packed)) : null]));
}

function heldPeopleIn(albums: ReadonlyArray<readonly [Person, AlbumRead | { kind: string }]>) {
  return Object.fromEntries(albums.map(([person, album]) => [person.name, "people" in album ? (album as Extract<AlbumRead, { kind: "album" }>).people.map(({ name }) => name).toSorted() : null]));
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(messages).padStart(6, "0")}` });
  await settle(t);
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

function everyTable() {
  return t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
}
