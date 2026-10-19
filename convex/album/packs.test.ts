import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { deleteMessage, edit, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const grantJob = vi.hoisted(() => "album/packs:grantThoughtfulPacks");
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const dana = { user: "U_DANA", name: "Dana Ferreira" };
const why = "Thanks for untangling the flaky migration";

type Person = { user: string; name: string };

const theGrants = vi.hoisted(() => ({ holding: false, held: [] as unknown[] }));

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  actual.subscribers.kudosGiven = actual.subscribers.kudosGiven.map((subscription) => {
    if (!("subscriber" in subscription) || getFunctionName(subscription.subscriber) !== grantJob) return subscription;
    const { subscriber, only } = subscription;
    return {
      subscriber,
      only: (event: KudosGivenEvent) => {
        if (theGrants.holding && only(event)) theGrants.held.push(event);
        return !theGrants.holding && only(event);
      },
    };
  });
  return actual;
});

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack();
  for (const person of [alice, bob, carol, dana]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  theGrants.holding = false;
  theGrants.held = [];
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, "album");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a thoughtful pack is earned once per giver, person and week", () => {
  test("a thoughtful kudos to three people earns its giver one waiting pack for each, oldest first", async () => {
    await thanks(alice, why, bob, carol, dana);

    expect(await packsOf(alice)).toEqual([bob.name, carol.name, dana.name]);
    expect(await packsOf(bob)).toEqual([]);
  });

  test("a second thoughtful kudos to one of them that week, a short kudos and a hug earn none", async () => {
    const first = await thanks(alice, why, bob, carol, dana);
    await thanks(alice, "Thanks again for pairing on the rollback", bob);
    await thanks(alice, "ty", carol);
    await thanks(bob, "ty", alice);
    await hugs(carol, alice, first);

    expect(await packsOf(alice)).toEqual([bob.name, carol.name, dana.name]);
    expect(await packsOf(bob)).toEqual([]);
    expect(await packsOf(carol)).toEqual([]);
  });

  test("a giver earns one more pack for the same person the next week", async () => {
    await thanks(alice, why, bob);
    vi.setSystemTime(Date.now() + 7 * dayMs);
    await thanks(alice, "Thanks for reviewing the quarterly runbook", bob);

    expect(await packsOf(alice)).toEqual([bob.name, bob.name]);
  });

  test("a redelivered kudosGiven and two grants run in reverse order earn each pack once", async () => {
    const [first, second] = await heldGrantsOf(async () => {
      await thanks(alice, why, bob, carol);
      await thanks(alice, "Thanks for writing up the incident timeline", carol, dana);
    });

    await grant(second!);
    await grant(first!);
    await grant(second!);
    await grant(first!);
    await settle(t);

    expect((await packsOf(alice)).toSorted()).toEqual([bob.name, carol.name, dana.name]);
  });

  test("an edit and a deletion of the kudos message never take a pack back", async () => {
    const ts = nextTs();
    await post(t, [section(text(`${why} `), mention(bob.user), emoji("taco"))], { user: alice.user, ts });
    await settle(t);
    await edit(t, [section(text("ty "), mention(bob.user), emoji("taco"))], { user: alice.user, ts, editedTs: nextTs() });
    await settle(t);
    await deleteMessage(t, { user: alice.user, ts });
    await settle(t);

    expect(await packsOf(alice)).toEqual([bob.name]);
  });
});

describe("AL4 AL5: each grant records its outcome", () => {
  test("a first pack holds the person's sticker, a later week's pack finds it waiting, one for someone already in the album finds them held, and a second in a week makes none", async () => {
    await thanks(alice, why, bob);
    await thanks(alice, "Thanks again for pairing on the rollback", bob);
    vi.setSystemTime(Date.now() + 7 * dayMs);
    await thanks(alice, "Thanks for reviewing the quarterly runbook", bob);
    await thanks(dana, "ty", carol);
    await anAlbumStickerAsHistoryWillRecordIt(alice, carol);
    await thanks(alice, "Thanks for the steady hand during the outage", carol);

    expect(await grantOutcomesOf(alice)).toEqual([
      [bob.name, "new"],
      [bob.name, "nextWeek"],
      [bob.name, "waiting"],
      [carol.name, "held"],
    ]);
  });
});

describe("a message's packs are told once", { timeout: 30_000 }, () => {
  test("a thoughtful kudos to three people sends one packs earned with packs_earned 3, and a second to one of them one with 0 and recipients 1", async () => {
    await thanks(alice, why, bob, carol, dana);
    await thanks(alice, "Thanks again for pairing on the rollback", bob);
    await thanks(alice, "ty", carol);

    expect(packsEarnedEvents()).toEqual([
      { packs_earned: 3, recipients: 3 },
      { packs_earned: 0, recipients: 1 },
    ]);
  });

  test("a message to 120 people pages its grants and is told once, after its last page, also when its last page runs again", async () => {
    const crowd = Array.from({ length: 120 }, (_, index) => ({ user: `U_CROWD_${index}`, name: `Crowd Person ${index}` }));
    for (const person of crowd) slack.withMember(person.user, { real_name: person.name });
    await thanks(alice, why, bob);
    const [event] = await heldGrantsOf(() => thanks(alice, why, bob, ...crowd));

    await t.mutation(internal.album.packs.grantThoughtfulPacks, { event: event!, from: 100 });
    await settle(t);
    expect(packsEarnedEvents()).toEqual([{ packs_earned: 1, recipients: 1 }]);

    await grant(event!);
    await t.mutation(internal.album.packs.grantThoughtfulPacks, { event: event!, from: 100 });
    await settle(t);

    expect(packsEarnedEvents()).toEqual([
      { packs_earned: 1, recipients: 1 },
      { packs_earned: 120, recipients: 121 },
    ]);
    const album = await (await signedIn(alice)).query(api.website.album.getAlbum, {});
    expect(album).toMatchObject({ kind: "album", morePacks: true });
    const shown = "packs" in album ? album.packs.map(({ person }) => person) : [];
    expect(shown).toHaveLength(50);
    expect(shown[0]).toBe(await memberOf(bob));
    expect(new Set(shown).size).toBe(50);
  });
});

function nextTs() {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  return `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  const ts = nextTs();
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return ts;
}

async function hugs(giver: Person, author: Person, ts: string) {
  await react(t, { user: giver.user, itemUser: author.user, ts, eventId: `EvHug${nextTs()}` });
  await settle(t);
}

async function heldGrantsOf(give: () => Promise<unknown>): Promise<KudosGivenEvent[]> {
  theGrants.holding = true;
  await give();
  theGrants.holding = false;
  return theGrants.held.splice(0) as KudosGivenEvent[];
}

async function grant(event: KudosGivenEvent) {
  await t.mutation(internal.album.packs.grantThoughtfulPacks, { event });
}

async function signedIn(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: person.user, name: person.name });
  return asSignedIn;
}

async function memberOf(person: Person): Promise<MemberId> {
  return (await memberOrNullOf(person))!;
}

async function memberOrNullOf(person: Person): Promise<MemberId | null> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  return row?._id ?? null;
}

async function packsOf(person: Person) {
  const album = await (await signedIn(person)).query(api.website.album.getAlbum, {});
  if (!("packs" in album)) throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  const names = new Map<string, string>();
  for (const someone of [alice, bob, carol, dana]) names.set((await memberOrNullOf(someone)) ?? someone.user, someone.name);
  return album.packs.map(({ person: packed }) => names.get(packed) ?? packed);
}

async function anAlbumStickerAsHistoryWillRecordIt(member: Person, person: Person) {
  const [memberId, personId] = [await memberOf(member), await memberOf(person)];
  await t.run((ctx) => ctx.db.insert("albumStickers", { member: memberId, person: personId, from: "history", at: Date.now() }));
}

async function grantOutcomesOf(giver: Person) {
  const member = await memberOf(giver);
  const names = new Map<string, string>();
  for (const someone of [alice, bob, carol, dana]) names.set((await memberOrNullOf(someone)) ?? someone.user, someone.name);
  const records = await t.run(async (ctx) => (await ctx.db.query("grantRecords").collect()).filter((record) => record.giver === member));
  return records.map(({ recipient, outcome }) => [names.get(recipient), outcome]);
}

function packsEarnedEvents() {
  return postHog
    .productEvents()
    .filter(({ event }) => event === "packs earned")
    .map(({ properties }) => ({ packs_earned: properties.packs_earned, recipients: properties.recipients }));
}
