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

  test("getAlbumPerson and getAlbumWeek answer each signed-in member their own side of a history, never the other's", async () => {
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    await thanks(bob, "Thanks for pairing on the stubborn cache invalidation", carol);
    const [asAlice, asBob, asCarol] = [await signedIn(alice), await signedIn(bob), await signedIn(carol)];
    const [aliceId, bobId, carolId] = [await memberOf(alice), await memberOf(bob), await memberOf(carol)];

    expect(await asAlice.query(api.website.album.getAlbumPerson, { person: bobId })).toMatchObject({ kind: "person", person: bobId, kudosGiven: 1, kudosReceived: 0, hype: { earned: true } });
    expect(await asBob.query(api.website.album.getAlbumPerson, { person: aliceId })).toMatchObject({ kind: "person", person: aliceId, kudosGiven: 0, kudosReceived: 1, best: null, hype: { earned: false } });
    expect(await asCarol.query(api.website.album.getAlbumPerson, { person: bobId })).toMatchObject({ kind: "person", kudosGiven: 0, kudosReceived: 1, best: null });
    expect(await weekListsOf(asAlice)).toEqual({ thanked: [bob.name], thankedBy: [] });
    expect(await weekListsOf(asBob)).toEqual({ thanked: [carol.name], thankedBy: [alice.name] });
    expect(await weekListsOf(asCarol)).toEqual({ thanked: [], thankedBy: [bob.name] });
  });

  test("getAlbumWeek lists each signed-in member the kudos they gave and got that week, never another member's", async () => {
    await thanks(alice, "Thanks for the careful review of the billing export and the notes", bob);
    await thanks(bob, "Thanks for pairing on the stubborn cache invalidation", carol);
    await thanks(carol, "Thanks for the quick unblock", alice);
    await thanks(alice, "Thanks for the docs", carol);

    expect(await weekKudosOf(await signedIn(alice)), "alice's issue, led by her kudos to bob").toEqual({ given: [[carol.name]], received: [[carol.name]] });
    expect(await weekKudosOf(await signedIn(bob)), "bob's issue, led by alice's kudos to him").toEqual({ given: [[carol.name]], received: [] });
    expect(await weekKudosOf(await signedIn(carol)), "carol's issue, led by bob's kudos to her").toEqual({ given: [[alice.name]], received: [[alice.name]] });
  });

  test("getAlbumProfile answers each signed-in member the kind note sent to them, never one they sent", async () => {
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    await thanks(bob, "Thanks for pairing on the stubborn cache invalidation", carol);

    expect(await kindNoteGiverOf(await signedIn(alice))).toBeNull();
    expect(await kindNoteGiverOf(await signedIn(bob))).toBe(alice.name);
    expect(await kindNoteGiverOf(await signedIn(carol))).toBe(bob.name);
  });

  test("getAlbumProfile rejects an argument that names another member", async () => {
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    const withAnotherMember = { member: await memberOf(bob) } as unknown as Record<string, never>;

    await expect((await signedIn(alice)).query(api.website.album.getAlbumProfile, withAnotherMember)).rejects.toThrow(/member/);
  });

  test("getAlbumPerson and getAlbumWeek reject an argument that names another member", async () => {
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    const asBob = await signedIn(bob);
    const member = await memberOf(alice);

    await expect(asBob.query(api.website.album.getAlbumPerson, { person: member, member } as never)).rejects.toThrow(/member/);
    await expect(asBob.query(api.website.album.getAlbumWeek, { member } as never)).rejects.toThrow(/member/);
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
  test("getAlbum, getAlbumHoggies, getThoughtfulBoards, getAlbumPerson, getAlbumWeek and getAlbumProfile read closed while the website flag is off, even with album on", async () => {
    const asAlice = await signedIn(alice);
    await switchWebsite(t, postHog, false, "album");

    expect(await everyAlbumReadOf(asAlice, await aMember(t, dana.user))).toEqual(everyAnswer({ kind: "closed" }));
  });

  test("getAlbum, getAlbumHoggies, getThoughtfulBoards, getAlbumPerson, getAlbumWeek and getAlbumProfile read signed out without a session", async () => {
    expect(await everyAlbumReadOf(t, await aMember(t, dana.user))).toEqual(everyAnswer({ kind: "signed-out" }));
  });

  test("getAlbum, getAlbumHoggies, getThoughtfulBoards, getAlbumPerson, getAlbumWeek and getAlbumProfile read not-a-member for a former member with a live session", async () => {
    const former = await aMember(t, juno.user, "not-a-member");
    const { asSignedIn } = await aSession(t, juno);

    expect(await everyAlbumReadOf(asSignedIn, former)).toEqual(everyAnswer({ kind: "not-a-member" }));
  });
});

type Reader = Pick<Backend, "query">;

function albumOf(reader: Reader): Promise<AlbumRead | { kind: string }> {
  return reader.query(api.website.album.getAlbum, {});
}

function boardsOf(reader: Reader): Promise<ThoughtfulBoardsRead | { kind: string }> {
  return reader.query(api.website.album.getThoughtfulBoards, {});
}

const everyAlbumRead = [api.website.album.getAlbum, api.website.album.getAlbumHoggies, api.website.album.getThoughtfulBoards, api.website.album.getAlbumWeek, api.website.album.getAlbumProfile];

function everyAlbumReadOf(reader: Reader, person: MemberId): Promise<Array<{ kind: string }>> {
  return Promise.all([...everyAlbumRead.map((read) => reader.query(read, {})), reader.query(api.website.album.getAlbumPerson, { person })]);
}

function everyAnswer(answer: { kind: string }) {
  return [...everyAlbumRead, api.website.album.getAlbumPerson].map(() => answer);
}

async function kindNoteGiverOf(reader: Reader) {
  const profile = await reader.query(api.website.album.getAlbumProfile, {});
  return profile.kind === "profile" ? (profile.note?.giver.name ?? null) : profile;
}

async function weekListsOf(reader: Reader) {
  const week = await reader.query(api.website.album.getAlbumWeek, {});
  if (week.kind !== "week" || week.issue === null) return week;
  return { thanked: week.issue.thanked.people.map(({ name }) => name), thankedBy: week.issue.thankedBy.people.map(({ name }) => name) };
}

async function weekKudosOf(reader: Reader) {
  const week = await reader.query(api.website.album.getAlbumWeek, {});
  if (week.kind !== "week" || week.issue === null) return week;
  const namesIn = ({ kudos }: { kudos: Array<{ people: Array<{ name: string }> }> }) => kudos.map(({ people }) => people.map(({ name }) => name));
  return { given: namesIn(week.issue.given), received: namesIn(week.issue.received) };
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
