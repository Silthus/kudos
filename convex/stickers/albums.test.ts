import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack, type UserGroupOptions } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest } from "../../testing/signedSlack";
import { everyoneHeldBy, seededGroups, seededMembers, type Person } from "../../testing/stickerBook";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, userGroupEvent } from "../../testing/slackMessages";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { CollectionAnswer } from "../website/collection";
import { seenKeyOf } from "../website/seen";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-16T10:00:00Z");
const minuteMs = 60_000;
const bookFlags = ["xp-levels", "unlocks", "achievements", "everyone-board", "skill-tree", "collection"];
const alice = { user: "U_E", name: "Alice Archer" };
const bob = { user: "U_D", name: "Bob Brandt" };
const carol = { user: "U_C", name: "Carol Chen" };
const dan = { user: "U_B", name: "Dan Dorsey" };
const eve = { user: "U_A", name: "Eve Ekwueme" };
const owls = "S_1";
const cats = "S_2";
const bees = "S_3";
const ants = "S_4";

type Reader = Awaited<ReturnType<typeof aSignedInSession>>["asSignedIn"];

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack();
  for (const person of [alice, bob, carol, dan, eve]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function albumsOn(...alsoOn: string[]) {
  await switchWebsite(t, postHog, true, ...bookFlags, "sticker-book", "groups", ...alsoOn);
  await bookShippedBeforeAnyoneJoined(t);
}

async function joined(...people: Person[]) {
  for (const person of people) {
    await memberChanged(t, "team_join", { id: person.user, real_name: person.name });
    await settle(t);
  }
}

async function groupIs(group: string, name: string, people: Person[], options: UserGroupOptions = {}) {
  slack.withUserGroup(group, { name, users: people.map(({ user }) => user), ...options });
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_created", group)));
  await settle(t);
}

async function groupChanged(group: string, name: string, people: Person[], options: UserGroupOptions = {}) {
  slack.withUserGroup(group, { name, users: people.map(({ user }) => user), ...options });
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_updated", group)));
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_members_changed", group)));
  await settle(t);
}

async function thanks(giver: Person, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  await post(t, [section(...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(messages).padStart(6, "0")}` });
  await settle(t);
}

async function memberOf(person: Person): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  if (row === null) throw new Error(`${person.user} is not in the directory`);
  return row._id;
}

async function withTheBookOpen(person: Person): Promise<Reader> {
  const member = await memberOf(person);
  await reachesLevel(t, member, 4);
  await opens(t, member, "book");
  return (await aSignedInSession(t, person)).asSignedIn;
}

async function collectionOf(reader: Reader): Promise<Extract<CollectionAnswer, { kind: "collection" }>> {
  const answer = await reader.query(api.website.collection.getCollection, {});
  if (answer.kind !== "collection") throw new Error(`expected the collection, got ${JSON.stringify(answer)}`);
  return answer;
}

async function albumsOf(reader: Reader) {
  return (await collectionOf(reader)).albums;
}

async function groupIdOf(group: string) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("userGroups")
      .withIndex("by_group", (q) => q.eq("workspace", "T1").eq("group", group))
      .unique(),
  );
  if (row === null) throw new Error(`${group} is not in the user group copy`);
  return row._id;
}

async function personIn(owner: Person, person: Person, held: boolean) {
  const initials = person.name.split(" ").map((word) => word[0]).join("");
  return { name: person.name, face: { kind: "initials", initials }, former: false, key: await seenKeyOf(await memberOf(owner), `sticker:${await memberOf(person)}`), held };
}

describe("SB7 SB11: every counting group is a group album of the people I hold and who's left", { timeout: 60_000 }, () => {
  test("every counting group is an album with held of total, empty ones included, my own groups first and then by name", async () => {
    await albumsOn();
    await joined(alice, bob, carol, dan, eve);
    await groupIs(owls, "Owls", [alice]);
    await groupIs(ants, "Ants", [carol, alice, bob]);
    await groupIs(bees, "Bees", [eve, dan]);
    await groupIs(cats, "Cats", []);
    await groupIs("S_ADMINS", "Admins", [alice, bob], { autoType: "admin" });
    await groupIs("S_GONE", "Gone", [alice, bob], { disabled: true });
    await thanks(alice, bob);
    await thanks(eve, alice);
    const reader = await withTheBookOpen(alice);

    expect(await albumsOf(reader)).toEqual([
      { group: await groupIdOf(ants), name: "Ants", mine: true, held: 1, total: 2, people: [await personIn(alice, bob, true), await personIn(alice, carol, false)] },
      { group: await groupIdOf(owls), name: "Owls", mine: true, held: 0, total: 0, people: [] },
      { group: await groupIdOf(bees), name: "Bees", mine: false, held: 1, total: 2, people: [await personIn(alice, dan, false), await personIn(alice, eve, true)] },
      { group: await groupIdOf(cats), name: "Cats", mine: false, held: 0, total: 0, people: [] },
    ]);
  });
});

describe("SB7: an album's people are the members in its user group other than its owner", { timeout: 60_000 }, () => {
  test("I'm never one of my own album's people, and a bot, a deactivated person or someone the directory doesn't know isn't a person", async () => {
    await albumsOn();
    const robot = { user: "U_ROBOT", name: "Robot" };
    await joined(alice, bob, carol);
    await memberChanged(t, "team_join", { id: robot.user, real_name: robot.name, is_bot: true });
    await groupIs(ants, "Ants", [alice, bob, carol, robot, { user: "U_STRANGER", name: "Stranger" }]);
    await memberChanged(t, "user_change", { id: carol.user, team_id: "T1", deleted: true });
    await settle(t);

    expect(await albumsOf(await withTheBookOpen(alice))).toEqual([{ group: await groupIdOf(ants), name: "Ants", mine: true, held: 0, total: 1, people: [await personIn(alice, bob, false)] }]);
  });
});

describe("SB8: an album follows its group on the next read", { timeout: 60_000 }, () => {
  test("a join adds a person, a departure removes one, and a group that stops counting drops out of the Book", async () => {
    await albumsOn();
    await joined(alice, bob, carol, dan);
    await groupIs(ants, "Ants", [alice, bob]);
    await groupIs(bees, "Bees", [dan]);
    await thanks(alice, bob, carol);
    const reader = await withTheBookOpen(alice);

    await groupChanged(ants, "Ants", [alice, carol, dan]);
    expect(await albumsOf(reader)).toEqual([
      { group: await groupIdOf(ants), name: "Ants", mine: true, held: 1, total: 2, people: [await personIn(alice, carol, true), await personIn(alice, dan, false)] },
      { group: await groupIdOf(bees), name: "Bees", mine: false, held: 0, total: 1, people: [await personIn(alice, dan, false)] },
    ]);

    await groupChanged(bees, "Bees", [dan], { disabled: true });
    expect((await albumsOf(reader))?.map(({ name }) => name)).toEqual(["Ants"]);
  });
});

describe("SB9: no groups shown, no albums", { timeout: 60_000 }, () => {
  test("with groups off, or no group counting, the collection has its stickers and no albums field", async () => {
    await switchWebsite(t, postHog, true, ...bookFlags, "sticker-book");
    await bookShippedBeforeAnyoneJoined(t);
    await joined(alice, bob);
    await groupIs(ants, "Ants", [alice, bob]);
    await groupIs("S_ADMINS", "Admins", [alice, bob], { autoType: "admin" });
    await thanks(alice, bob);
    const reader = await withTheBookOpen(alice);

    const groupsOff = await collectionOf(reader);
    expect(groupsOff.stickers).toHaveLength(1);
    expect(groupsOff).not.toHaveProperty("albums");

    await albumsOn();
    await groupChanged(ants, "Ants", [alice, bob], { disabled: true });
    const noneCounting = await collectionOf(reader);
    expect(noneCounting.stickers).toHaveLength(1);
    expect(noneCounting).not.toHaveProperty("albums");
  });
});

describe("SB12: the people part of getCollection answers the supported size inside Convex's limits", { timeout: 60_000 }, () => {
  test("a workspace of 2,000 members in 60 counting groups of 100, 6,000 memberships, answers every album under 2 MiB", { timeout: 600_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await albumsOn();
    await joined(alice, bob);
    await thanks(alice, bob);
    const people = [alice, bob, ...(await seededMembers(t, 1_998))];
    await seededGroups(t, people, { groups: 60, size: 100 });
    await everyoneHeldBy(t, await memberOf(alice), people);

    const answer = await collectionOf(await withTheBookOpen(alice));

    expect(answer.stickers).toHaveLength(1_999);
    expect(answer.albums).toHaveLength(60);
    expect(answer.albums?.filter(({ mine }) => mine).map(({ name, held, total }) => ({ name, held, total }))).toEqual([
      { name: "Group 00", held: 99, total: 99 },
      { name: "Group 20", held: 99, total: 99 },
      { name: "Group 40", held: 99, total: 99 },
    ]);
    expect(answer.albums?.filter(({ mine }) => !mine).every(({ held, total }) => held === 100 && total === 100)).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(answer)).length).toBeLessThan(2 * 1024 * 1024);
  });
});
