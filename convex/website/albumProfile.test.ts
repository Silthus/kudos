import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import type { AlbumProfileRead } from "./album";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const dana = { user: "U_DANA", name: "Dana Ferreira" };
const erin = { user: "U_ERIN", name: "Erin Solberg" };
const finn = { user: "U_FINN", name: "Finn Achebe" };
const cast = [alice, bob, carol, dana, erin, finn];
const why = "Thanks for untangling the flaky migration";
const workspaceUrl = "https://kudos-test.slack.com/";

type Person = { user: string; name: string };

let postHog: FakePostHog;
let t: Backend;
let messages = 0;
let clock = tuesday.getTime();

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  messages = 0;
  clock = tuesday.getTime();
  postHog = new FakePostHog();
  const slack = new FakeSlack().withWorkspaceUrl(workspaceUrl);
  for (const person of cast) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => slack.fetch(input, init)));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 1_000, hugBudget: 50 }));
  await switchWebsite(t, postHog, true, "album", "collection", "packs");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AL52: getAlbumProfile reads the profile's kind note and newest people", { timeout: 120_000 }, () => {
  test("the kind note is the last thoughtful kudos someone sent you, with its giver, words and Slack link, past any briefer kudos since", async () => {
    await thanks(carol, "Thanks for the thorough onboarding notes you wrote", alice);
    const kind = await thanks(bob, why, alice);
    await thanks(dana, "ty", alice);
    await thanks(alice, "Thanks for pairing on the stubborn cache invalidation", bob);

    expect(await profileOf(alice)).toMatchObject({
      kind: "profile",
      note: {
        giver: { person: await memberOf(bob), name: bob.name, face: { kind: "initials", initials: "BO" } },
        message: { kind: "text", segments: expect.arrayContaining([expect.objectContaining({ kind: "text", text: expect.stringContaining("flaky migration") })]), edited: false },
        permalink: permalinkOf(kind),
        at: atOf(kind),
      },
    });
  });

  test("the newest people are the four who joined your album last, newest first, with when each joined", async () => {
    const joined: number[] = [];
    for (const person of [bob, carol, dana, erin, finn]) {
      laterBy(dayMs);
      await thanks(alice, why, person);
      joined.push(await opensAndPutsInEveryPack(alice));
    }

    const profile = await profileOf(alice);

    expect(profile.kind === "profile" && profile.newest.map(({ name, at }) => [name, at])).toEqual([
      [finn.name, joined[4]],
      [erin.name, joined[3]],
      [dana.name, joined[2]],
      [carol.name, joined[1]],
    ]);
  });

  test("a member nobody thanked with a why, whose album holds nobody yet, reads no note and no newest people", async () => {
    await thanks(bob, "ty", alice);

    expect(await profileOf(alice)).toEqual({ kind: "profile", note: null, newest: [] });
  });

  test("with album off for the member, the profile reads off", async () => {
    await thanks(bob, why, alice);
    await switchWebsite(t, postHog, true, "packs");

    expect(await profileOf(alice)).toEqual({ kind: "off" });
  });
});

async function profileOf(person: Person): Promise<AlbumProfileRead> {
  return (await signedIn(person)).query(api.website.album.getAlbumProfile, {});
}

async function opensAndPutsInEveryPack(member: Person) {
  const asMember = await signedIn(member);
  const album = await asMember.query(api.website.album.getAlbum, {});
  for (const { pack } of "packs" in album ? album.packs : []) await asMember.mutation(api.website.album.openThoughtfulPack, { pack });
  laterBy(minuteMs);
  const at = Date.now();
  await asMember.mutation(api.website.album.putAllIn, {});
  await settle(t);
  return at;
}

function laterBy(ms: number) {
  clock += ms;
  vi.setSystemTime(Math.max(Date.now(), clock));
}

function nextTs() {
  messages += 1;
  laterBy(minuteMs);
  return `${clock / 1000}.${String(messages).padStart(6, "0")}`;
}

function atOf(ts: string) {
  return Number(ts.split(".")[0]) * 1000;
}

function permalinkOf(ts: string) {
  return `${workspaceUrl}archives/C1/p${ts.replace(".", "")}`;
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  const ts = nextTs();
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return ts;
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
  if (row === null) return aMember(t, person.user);
  return row._id;
}
