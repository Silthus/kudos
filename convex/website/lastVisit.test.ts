import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";
import type { AlbumAnswer, AlbumRead } from "./album";
import { lastVisitOf, moveLastVisitTo, type ArrivalAnswer } from "./lastVisit";
import type { Denial } from "./memberQuery";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs"];
const itemsOn = [...albumOpen, "hidden-items"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;

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
  await switchWebsite(t, postHog, true, ...itemsOn);
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

describe("LP26: the last visit moves forward once per visit", { timeout: 60_000 }, () => {
  test("an arrival moves the last visit to the newest instant put in or received, never to the clock, and the next arrival from it moves it on to what was put in since", async () => {
    await thanks(alice, bob, carol);
    const asAlice = await signedIn(alice);
    expect((await albumOf(asAlice)).lastVisit).toBeNull();
    const bobTurnedAt = await laterTurnTheSticker(asAlice, bob);
    vi.setSystemTime(Date.now() + 10 * minuteMs);

    expect(await arrive(asAlice, null)).toEqual({ kind: "arrived", lastVisit: bobTurnedAt });
    const carolTurnedAt = await laterTurnTheSticker(asAlice, carol);
    vi.setSystemTime(Date.now() + 10 * minuteMs);
    expect(await arrive(asAlice, bobTurnedAt)).toEqual({ kind: "arrived", lastVisit: carolTurnedAt });

    expect((await albumOf(asAlice)).lastVisit).toBe(carolTurnedAt);
    expect(await t.run((ctx) => lastVisitOfPerson(ctx, alice))).toBe(carolTurnedAt);
  });

  test("a kudos received since the last visit moves it at the next arrival, so the teaser's kudos since the last visit start after what the member came back to", async () => {
    const receivedAt = (await thanks(alice, bob)).decidedAt;
    vi.setSystemTime(Date.now() + 10 * minuteMs);

    expect(await arrive(await signedIn(bob), null)).toEqual({ kind: "arrived", lastVisit: receivedAt });
  });

  test("a stale tab's arrival, holding an older last visit, moves nothing, so two tabs read the same last visit", async () => {
    await thanks(alice, bob, carol);
    const tab = await signedIn(alice);
    const staleTab = await signedIn(alice);
    const bobTurnedAt = await laterTurnTheSticker(tab, bob);
    await arrive(tab, null);
    await laterTurnTheSticker(tab, carol);

    expect(await arrive(staleTab, null)).toEqual({ kind: "arrived", lastVisit: bobTurnedAt });
    expect((await albumOf(tab)).lastVisit).toBe(bobTurnedAt);
    expect((await albumOf(staleTab)).lastVisit).toBe(bobTurnedAt);
  });

  test("moving the last visit to an earlier instant keeps it where it is", async () => {
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    const bobTurnedAt = await laterTurnTheSticker(asAlice, bob);
    await arrive(asAlice, null);
    const member = await memberOf(alice);

    await t.run((ctx) => moveLastVisitTo(ctx, member, bobTurnedAt - minuteMs));

    expect((await albumOf(asAlice)).lastVisit).toBe(bobTurnedAt);
  });

  test("with hidden-items off, getAlbum answers no last visit and no sticker's instant, and arriving answers refused and writes nothing", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    const album = await albumOf(asAlice);
    const before = await everythingWritten();

    expect(await arrive(asAlice, null)).toEqual({ kind: "refused" });

    expect(await everythingWritten()).toEqual(before);
    expect(album).not.toHaveProperty("lastVisit");
    for (const shown of album.people) expect(shown).not.toHaveProperty("at");
  });
});

describe("LP22: getAlbum answers when each sticker was put in", { timeout: 60_000 }, () => {
  test("with hidden-items on, a held person answers the instant their sticker was put in, and a person not held answers none", async () => {
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    const bobTurnedAt = await laterTurnTheSticker(asAlice, bob);

    const { people } = await albumOf(asAlice);

    expect(people.find(({ person }) => person === bobOf(people))).toMatchObject({ held: true, at: bobTurnedAt });
    expect(people.filter(({ held }) => !held).map((shown) => shown.at)).toEqual(people.filter(({ held }) => !held).map(() => undefined));
  });
});

describe("website commands pass one guard", { timeout: 60_000 }, () => {
  test("WS61: with the website flag off, arriving answers closed and writes nothing at all", async () => {
    const asAlice = await signedIn(alice);
    await switchWebsite(t, postHog, false, ...itemsOn);
    const before = await everythingWritten();

    expect(await arrive(asAlice, null)).toEqual({ kind: "closed" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS61: without a session arriving answers signed-out, and for a member who left not-a-member, writing nothing at all", async () => {
    const asAlice = await signedIn(alice);
    const before = await everythingWritten();

    expect(await arrive(t, null)).toEqual({ kind: "signed-out" });
    expect(await everythingWritten()).toEqual(before);
    await memberChanged(t, "user_change", { id: alice.user, team_id: "T1", deleted: true });
    await settle(t);
    const left = await everythingWritten();
    expect(await arrive(asAlice, null)).toEqual({ kind: "not-a-member" });
    expect(await everythingWritten()).toEqual(left);
  });

  test("WS61: the last visit the tab read is the only argument, so no call names a member", async () => {
    const asAlice = await signedIn(alice);
    const before = await everythingWritten();

    await expect(asAlice.mutation(api.website.lastVisit.arrive, { from: null, member: await memberOf(alice) } as never)).rejects.toThrow(/member/);
    expect(await everythingWritten()).toEqual(before);
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

async function thanks(giver: Person, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const at = Date.now();
  const ts = `${at / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${why} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return { decidedAt: await newestAwardDecidedAt(recipients[0]!) };
}

async function newestAwardDecidedAt(recipient: Person) {
  const member = await memberOf(recipient);
  const award = await t.run((ctx) =>
    ctx.db
      .query("awards")
      .withIndex("by_recipient_decided", (q) => q.eq("recipient", member))
      .order("desc")
      .first(),
  );
  return award!._creationTime;
}

function arrive(reader: Reader, from: number | null): Promise<ArrivalAnswer | Denial> {
  return reader.mutation(api.website.lastVisit.arrive, { from });
}

async function laterTurnTheSticker(reader: Reader, of: Person): Promise<number> {
  vi.setSystemTime(Date.now() + minuteMs);
  const turnedAt = Date.now();
  const turned = await reader.mutation(api.website.album.turnItem, { item: await stickerItemOf(alice, of) });
  if (turned.kind !== "turned") throw new Error(`expected the sticker turned, got ${JSON.stringify(turned)}`);
  return turnedAt;
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

function bobOf(people: AlbumAnswer["people"]) {
  return people.find(({ name }) => name === bob.name)!.person;
}

async function lastVisitOfPerson(ctx: Parameters<typeof lastVisitOf>[0], someone: Person) {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", someone.user))
    .unique();
  return lastVisitOf(ctx, member!._id);
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

async function stickerItemOf(giver: Person, thanked: Person): Promise<Id<"items">> {
  const [member, person] = [await memberOf(giver), await memberOf(thanked)];
  const items: Doc<"items">[] = await t.run((ctx) =>
    ctx.db
      .query("items")
      .withIndex("by_member_turned", (q) => q.eq("member", member))
      .collect(),
  );
  const item = items.find((row) => row.source === "sticker" && row.reason.kind === "thanks" && row.reason.person === person);
  if (item === undefined) throw new Error(`no sticker item for thanking ${thanked.name}`);
  return item._id;
}

async function everythingWritten() {
  const tables = await t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  return { tables, scheduled: await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()) };
}
