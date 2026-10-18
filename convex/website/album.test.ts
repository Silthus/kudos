import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aMember, aSession, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import type { AlbumRead } from "./album";

const minuteMs = 60_000;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const dana = { user: "U_DANA", name: "Dana Ferreira" };
const juno = { user: "U_JUNO", name: "Juno Park" };

type Person = { user: string; name: string };

let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date("2026-10-13T10:00:00Z") });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack();
  for (const person of [alice, bob, carol, dana]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  await switchWebsite(t, postHog, true, "album");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the album is private", () => {
  test("getAlbum answers each signed-in member their own name, level and waiting packs, never another member's", async () => {
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    await thanks(bob, "Thanks for pairing on the stubborn cache invalidation", carol, dana);
    await thanks(carol, "Thanks for the thorough onboarding notes you wrote", alice);

    const albums = await Promise.all([alice, bob, carol, dana].map(async (person) => [person, await albumOf(await signedIn(person))] as const));

    for (const [person, album] of albums) expect(album, `${person.name}'s own album`).toMatchObject({ kind: "album", me: { name: person.name, person: await memberOf(person) } });
    expect(await packedPeopleIn(albums)).toEqual({ [alice.name]: [bob.name], [bob.name]: [carol.name, dana.name], [carol.name]: [alice.name], [dana.name]: [] });
  });

  test("an argument that names another member is rejected by the validator", async () => {
    await thanks(alice, "Thanks for the careful review of the billing export", bob);
    const asBob = await signedIn(bob);
    const withAnotherMember = { member: await memberOf(alice) } as unknown as Record<string, never>;

    await expect(asBob.query(api.website.album.getAlbum, withAnotherMember)).rejects.toThrow(/member/);
  });
});

describe("website reads pass one guard", () => {
  test("getAlbum reads closed while the website flag is off, even with album on", async () => {
    const asAlice = await signedIn(alice);
    await switchWebsite(t, postHog, false, "album");

    expect(await albumOf(asAlice)).toEqual({ kind: "closed" });
  });

  test("getAlbum reads signed out without a session", async () => {
    expect(await albumOf(t)).toEqual({ kind: "signed-out" });
  });

  test("getAlbum reads not-a-member for a former member with a live session", async () => {
    await aMember(t, juno.user, "not-a-member");
    const { asSignedIn } = await aSession(t, juno);

    expect(await albumOf(asSignedIn)).toEqual({ kind: "not-a-member" });
  });
});

type Reader = Pick<Backend, "query">;

function albumOf(reader: Reader): Promise<AlbumRead | { kind: string }> {
  return reader.query(api.website.album.getAlbum, {});
}

async function packedPeopleIn(albums: ReadonlyArray<readonly [Person, AlbumRead | { kind: string }]>) {
  const names = new Map<string, string>();
  for (const person of [alice, bob, carol, dana]) names.set(await memberOf(person), person.name);
  return Object.fromEntries(albums.map(([person, album]) => [person.name, "packs" in album ? (album as Extract<AlbumRead, { kind: "album" }>).packs.map(({ person: packed }) => names.get(packed)) : null]));
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
