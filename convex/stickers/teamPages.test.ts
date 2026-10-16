import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage as PostHogComTeam, type TeamPageProfile } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { holds } from "../../testing/hoggies";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest } from "../../testing/signedSlack";
import { emoji, mention, section, userGroupEvent } from "../../testing/slackMessages";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { CollectionAnswer, TeamPage } from "../website/collection";
import { seenKeyOf } from "../website/seen";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-16T10:00:00Z");
const minuteMs = 60_000;
const bookFlags = ["xp-levels", "unlocks", "achievements", "everyone-board", "skill-tree", "collection", "crests", "groups"];

const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const wren = { user: "U_WREN", name: "Wren Halloway" };
const oriel = { user: "U_ORIEL", name: "Oriel Pemberton" };
const sam = { user: "U_SAM", name: "Sam Okafor" };
const tamsin = { user: "U_TAMSIN", name: "Tamsin Vale" };

const junoProfile = { id: 1, firstName: "Juno", lastName: "Whitlock", colour: "blue", cutout: aCutout("juno"), role: "Product Manager" };
const wrenProfile = { id: 2, firstName: "Wren", lastName: "Halloway", colour: "lilac", cutout: aCutout("wren"), role: "Product Engineer" };
const orielProfile = { id: 3, firstName: "Oriel", lastName: "Pemberton", colour: "teal", cutout: null };
const samanthaProfile = { id: 4, firstName: "Samantha", lastName: "Okafor", colour: "orange", cutout: aCutout("samantha"), role: "  Team Lead  " };
const tamsinProfile = { id: 5, firstName: "Tamsin", lastName: "Vale", colour: null, cutout: null };

const batchExports: PostHogComTeam = { slug: "batch-exports", name: "Batch Exports", leads: [4], profiles: [samanthaProfile, wrenProfile, junoProfile, tamsinProfile] };
const lantern: PostHogComTeam = { slug: "lantern", name: "Lantern", crest: aCutout("lantern-crest"), leads: [3, 2], profiles: [orielProfile, wrenProfile] };
const zephyr: PostHogComTeam = { slug: "zephyr", name: "Zephyr", leads: [5], profiles: [tamsinProfile] };

const sized = (file: string) => `https://res.cloudinary.com/posthog-test/image/upload/c_limit,w_160,f_auto,q_auto/v1/${file}.png`;

type Person = { user: string; name: string };
type Reader = Awaited<ReturnType<typeof aSignedInSession>>["asSignedIn"];
type Collection = Extract<CollectionAnswer, { kind: "collection" }>;

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  slack = new FakeSlack();
  for (const person of [juno, wren, oriel, sam, tamsin]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(urlOf(input)) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function urlOf(input: string | URL | Request) {
  return new URL(input instanceof Request ? input.url : input);
}

async function onPostHogCom(...teams: PostHogComTeam[]) {
  postHogCom.withTeams(...teams);
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
}

async function flagsOn(...flags: string[]) {
  await switchWebsite(t, postHog, true, ...bookFlags, ...flags);
}

async function teamPagesOn() {
  await flagsOn("sticker-book", "team-pages");
  await bookShippedBeforeAnyoneJoined(t);
}

async function joined(...people: Person[]) {
  for (const person of people) {
    await memberChanged(t, "team_join", { id: person.user, real_name: person.name });
    await settle(t);
  }
}

async function groupIs(group: string, name: string, people: Person[]) {
  slack.withUserGroup(group, { name, users: people.map(({ user }) => user) });
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_created", group)));
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

async function collectionOf(reader: Reader): Promise<Collection> {
  const answer = await reader.query(api.website.collection.getCollection, {});
  if (answer.kind !== "collection") throw new Error(`expected the collection, got ${JSON.stringify(answer)}`);
  return answer;
}

async function teamsOf(reader: Reader) {
  return (await collectionOf(reader)).teams;
}

async function heldAtOf(owner: Person, person: Person) {
  const [member, held] = await Promise.all([memberOf(owner), memberOf(person)]);
  const sticker = await t.run((ctx) =>
    ctx.db
      .query("stickers")
      .withIndex("by_member_person", (q) => q.eq("member", member).eq("person", held))
      .unique(),
  );
  if (sticker === null) throw new Error(`${owner.name} holds no sticker of ${person.name}`);
  return sticker.firstAt;
}

type Slot = { face: TeamPage["people"][number]["face"]; role?: string; lead?: boolean; held?: boolean };

async function slotOf(owner: Person, person: Person, { face, role, lead = false, held = false }: Slot) {
  return {
    key: await seenKeyOf(await memberOf(owner), `sticker:${await memberOf(person)}`),
    name: person.name,
    role: role ?? null,
    face,
    lead,
    held,
    heldAt: held ? await heldAtOf(owner, person) : null,
  };
}

const initialsOf = ({ name }: Person) =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("");

const companyFace = (person: Person, file: string, colour: string) => ({ kind: "company-profile" as const, image: sized(file), colour, initials: initialsOf(person) });

const initialsFace = (person: Person) => ({ kind: "initials" as const, initials: initialsOf(person) });

const aPage = { mine: false, listed: true, leads: [], held: 0, total: 0, unmatched: 0, complete: false, people: [], unmatchedPeople: [], crest: null };

describe("CV22 CV24: a team page's people are my matched teammates, held where I hold their sticker", { timeout: 60_000 }, () => {
  test("every company team is a page of its matched people other than me, in posthog.com's order, my teams first and then by name, with its leads, roles and faces", async () => {
    await onPostHogCom(zephyr, lantern, batchExports);
    await teamPagesOn();
    await joined(juno, wren, oriel, sam);
    await thanks(juno, wren);
    const reader = await withTheBookOpen(juno);

    expect(await teamsOf(reader)).toEqual([
      {
        ...aPage,
        team: "batch-exports",
        name: "Batch Exports",
        art: { kind: "crest", slug: "batch-exports" },
        mine: true,
        leads: ["Samantha Okafor"],
        held: 1,
        total: 1,
        unmatched: 2,
        complete: true,
        people: [await slotOf(juno, wren, { face: companyFace(wren, "wren", "#8567FF"), role: "Product Engineer", held: true })],
        unmatchedPeople: [
          { name: "Samantha Okafor", role: "Team Lead" },
          { name: "Tamsin Vale", role: null },
        ],
      },
      {
        ...aPage,
        team: "lantern",
        name: "Lantern",
        art: { kind: "image", url: sized("lantern-crest") },
        leads: ["Oriel Pemberton", "Wren Halloway"],
        held: 1,
        total: 2,
        people: [
          await slotOf(juno, oriel, { face: initialsFace(oriel), lead: true }),
          await slotOf(juno, wren, { face: companyFace(wren, "wren", "#8567FF"), role: "Product Engineer", lead: true, held: true }),
        ],
      },
      { ...aPage, team: "zephyr", name: "Zephyr", art: null, leads: ["Tamsin Vale"], unmatched: 1, unmatchedPeople: [{ name: "Tamsin Vale", role: null }] },
    ]);
  });

  test("a page whose people I hold every one of is complete, however many of its people are unmatched, and an empty page never is", async () => {
    await onPostHogCom(batchExports, zephyr);
    await teamPagesOn();
    await joined(juno, wren);
    const reader = await withTheBookOpen(juno);

    expect((await teamsOf(reader))?.map(({ team, held, total, unmatched, complete }) => ({ team, held, total, unmatched, complete }))).toEqual([
      { team: "batch-exports", held: 0, total: 1, unmatched: 2, complete: false },
      { team: "zephyr", held: 0, total: 0, unmatched: 1, complete: false },
    ]);

    await thanks(wren, juno);
    expect((await teamsOf(reader))?.map(({ team, held, total, complete }) => ({ team, held, total, complete }))).toEqual([
      { team: "batch-exports", held: 1, total: 1, complete: true },
      { team: "zephyr", held: 0, total: 0, complete: false },
    ]);
  });
});

describe("CV23: a team page follows posthog.com, the matcher and the directory on the next read", { timeout: 60_000 }, () => {
  test("a new member matched by name, an own link and a resync add people, and someone leaving the team or a team leaving posthog.com removes them", async () => {
    await onPostHogCom(batchExports, zephyr);
    await teamPagesOn();
    await joined(juno, wren, sam);
    const reader = await withTheBookOpen(juno);
    const peopleOf = async () => (await teamsOf(reader))?.map(({ team, people, unmatched }) => ({ team, people: people.map(({ name }) => name), unmatched }));

    expect(await peopleOf()).toEqual([
      { team: "batch-exports", people: ["Wren Halloway"], unmatched: 2 },
      { team: "zephyr", people: [], unmatched: 1 },
    ]);

    await joined(tamsin);
    const { asSignedIn: asSam } = await aSignedInSession(t, sam);
    expect(await asSam.mutation(api.website.commands.linkMyCompanyProfile, { profile: samanthaProfile.id })).toEqual({ kind: "linked" });
    expect(await peopleOf()).toEqual([
      { team: "batch-exports", people: ["Sam Okafor", "Wren Halloway", "Tamsin Vale"], unmatched: 0 },
      { team: "zephyr", people: ["Tamsin Vale"], unmatched: 0 },
    ]);

    await onPostHogCom({ ...batchExports, profiles: [samanthaProfile, junoProfile] }, lantern);
    expect(await peopleOf()).toEqual([
      { team: "batch-exports", people: ["Sam Okafor"], unmatched: 0 },
      { team: "lantern", people: ["Wren Halloway"], unmatched: 1 },
    ]);
  });

  test("a matched person keeps the slot of a teammate who left the workspace no longer", async () => {
    await onPostHogCom(batchExports);
    await teamPagesOn();
    await joined(juno, wren);
    await thanks(juno, wren);
    const reader = await withTheBookOpen(juno);

    await memberChanged(t, "user_change", { id: wren.user, team_id: "T1", deleted: true });
    await settle(t);

    expect((await teamsOf(reader))?.map(({ people, unmatched, unmatchedPeople }) => ({ people, unmatched, unmatchedPeople }))).toEqual([
      {
        people: [],
        unmatched: 3,
        unmatchedPeople: [
          { name: "Samantha Okafor", role: "Team Lead" },
          { name: "Wren Halloway", role: "Product Engineer" },
          { name: "Tamsin Vale", role: null },
        ],
      },
    ]);
  });
});

describe("CV25: crests collected with hoggies stay", { timeout: 60_000 }, () => {
  test("a roster crest stays on its team's page with its seen key, and one posthog.com has no team for stays on an unlisted page", async () => {
    await onPostHogCom(batchExports, lantern);
    await flagsOn("sticker-book");
    await bookShippedBeforeAnyoneJoined(t);
    await joined(juno, wren);
    const reader = await withTheBookOpen(juno);
    await holds(t, await memberOf(juno), "coffee-run", "waiter", "roller-coaster", "dynamite");
    const crestsBefore = (await collectionOf(reader)).crests ?? [];
    const crestOf = (crest: string) => crestsBefore.find((each) => each.crest === crest)!;

    await switchWebsite(t, postHog, true, ...bookFlags, "sticker-book", "team-pages");
    const pages = (await teamsOf(reader)) ?? [];

    expect(pages.map(({ team, listed, crest }) => ({ team, listed, crest }))).toEqual([
      { team: "batch-exports", listed: true, crest: { collectedAt: crestOf("batch-exports").collectedAt, seen: crestOf("batch-exports").seen } },
      { team: "apm", listed: false, crest: { collectedAt: crestOf("apm").collectedAt, seen: crestOf("apm").seen } },
      { team: "lantern", listed: true, crest: null },
    ]);
    expect(pages[1]).toEqual({ ...aPage, team: "apm", name: "APM", art: { kind: "crest", slug: "apm" }, listed: false, crest: { collectedAt: crestOf("apm").collectedAt, seen: crestOf("apm").seen } });
  });

  test("with crests off no crest shows on a page and no unlisted page appears", async () => {
    await onPostHogCom(batchExports);
    await switchWebsite(t, postHog, true, ...bookFlags.filter((flag) => flag !== "crests"), "sticker-book", "team-pages");
    await bookShippedBeforeAnyoneJoined(t);
    await joined(juno);
    const reader = await withTheBookOpen(juno);
    await holds(t, await memberOf(juno), "coffee-run", "waiter", "roller-coaster", "dynamite");

    expect((await teamsOf(reader))?.map(({ team, crest }) => ({ team, crest }))).toEqual([{ team: "batch-exports", crest: null }]);
  });
});

describe("CV24 CV26: team pages replace group albums and crests in the Book", { timeout: 60_000 }, () => {
  test("while team-pages is on the collection answers teams and no albums or crests; while it is off it answers albums and crests as before", async () => {
    await onPostHogCom(batchExports);
    await flagsOn("sticker-book");
    await bookShippedBeforeAnyoneJoined(t);
    await joined(juno, wren);
    await groupIs("S_OWLS", "Owls", [juno, wren]);
    await thanks(juno, wren);
    const reader = await withTheBookOpen(juno);
    await holds(t, await memberOf(juno), "coffee-run", "waiter");

    const off = await collectionOf(reader);
    await switchWebsite(t, postHog, true, ...bookFlags, "sticker-book", "team-pages");
    const on = await collectionOf(reader);
    await switchWebsite(t, postHog, true, ...bookFlags, "sticker-book");
    const offAgain = await collectionOf(reader);

    expect(off).toHaveProperty("albums");
    expect(off).toHaveProperty("crests");
    expect(off).not.toHaveProperty("teams");
    const { albums: _albums, crests: _crests, ...shownEither } = off;
    const { teams, ...rest } = on;
    expect(rest).toEqual(shownEither);
    expect(teams?.map(({ team }) => team)).toEqual(["batch-exports"]);
    expect(offAgain).toEqual(off);
  });

  test("where sticker-book is off team-pages shows no teams, no albums and no crests", async () => {
    await onPostHogCom(batchExports);
    await flagsOn("team-pages");
    await bookShippedBeforeAnyoneJoined(t);
    await joined(juno, wren);
    await groupIs("S_OWLS", "Owls", [juno, wren]);
    await thanks(juno, wren);
    const reader = await withTheBookOpen(juno);
    await holds(t, await memberOf(juno), "coffee-run", "waiter");

    const answer = await collectionOf(reader);

    expect(answer).not.toHaveProperty("teams");
    expect(answer).not.toHaveProperty("albums");
    expect(answer).not.toHaveProperty("crests");
    expect(answer).not.toHaveProperty("stickers");
  });
});

describe("the sticker book is private", { timeout: 60_000 }, () => {
  test("CV30: each member's call answers their own team pages, keyed and held by their own stickers, and takes no member to read another's", async () => {
    await onPostHogCom(batchExports);
    await teamPagesOn();
    await joined(juno, wren, sam);
    await thanks(juno, wren);
    const asJuno = await withTheBookOpen(juno);
    const asWren = await withTheBookOpen(wren);
    const asSam = await withTheBookOpen(sam);
    const faceOfWren = companyFace(wren, "wren", "#8567FF");
    const faceOfJuno = companyFace(juno, "juno", "#2F80FA");

    expect((await teamsOf(asJuno))?.map(({ mine, people }) => ({ mine, people }))).toEqual([
      { mine: true, people: [await slotOf(juno, wren, { face: faceOfWren, role: "Product Engineer", held: true })] },
    ]);
    expect((await teamsOf(asWren))?.map(({ mine, people }) => ({ mine, people }))).toEqual([
      { mine: true, people: [await slotOf(wren, juno, { face: faceOfJuno, role: "Product Manager", held: true })] },
    ]);
    expect((await teamsOf(asSam))?.map(({ mine, people }) => ({ mine, people }))).toEqual([
      {
        mine: false,
        people: [await slotOf(sam, wren, { face: faceOfWren, role: "Product Engineer" }), await slotOf(sam, juno, { face: faceOfJuno, role: "Product Manager" })],
      },
    ]);
    await expect(asSam.query(api.website.collection.getCollection, { member: await memberOf(juno) } as never)).rejects.toThrow();
  });
});

describe("CV27: the teams part of getCollection answers the supported size inside Convex's limits", { timeout: 60_000 }, () => {
  test("2,000 members, 2,000 profiles half matched by name and half by own links, 100 teams and 6,000 memberships answer every page under 3 MiB, inside Convex's 8 MiB", { timeout: 600_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await onPostHogCom(batchExports);
    await teamPagesOn();
    await joined(juno, wren);
    await thanks(juno, wren);
    const people = [juno, wren, ...(await seededMembers(1_998))];
    await seededCompany(people, { teams: 100, teamsEach: 3 });
    await everyoneHeldBy(juno, people);

    const answer = await collectionOf(await withTheBookOpen(juno));

    expect(answer.stickers).toHaveLength(1_999);
    expect(answer.teams).toHaveLength(100);
    expect(answer.teams?.filter(({ mine }) => mine).map(({ held, total, unmatched }) => ({ held, total, unmatched }))).toEqual([
      { held: 59, total: 59, unmatched: 0 },
      { held: 59, total: 59, unmatched: 0 },
      { held: 59, total: 59, unmatched: 0 },
    ]);
    expect(answer.teams?.filter(({ mine }) => !mine).every(({ held, total, complete }) => held === 60 && total === 60 && complete)).toBe(true);
    expect(answer.teams?.flatMap(({ people }) => people)).toHaveLength(6_000 - 3);
    expect(new TextEncoder().encode(JSON.stringify(answer)).length).toBeLessThan(3 * 1024 * 1024);
  });
});

async function seededMembers(count: number): Promise<Person[]> {
  const people = Array.from({ length: count }, (_, index) => ({ user: `U0${String(index).padStart(9, "0")}`, name: `Teammate Number${index}` }));
  await t.run(async (ctx) => {
    for (const { user, name } of people) {
      const picture = `https://avatars.slack-edge.com/2026-10-16/${user}_5f3e7c1a2b9d4e6f8a01_192.jpg`;
      await ctx.db.insert("members", { workspace: "T1", user, kind: "member", name, realName: name, displayName: name, picture, asOf: 0 });
    }
  });
  return people;
}

async function seededCompany(people: Person[], { teams, teamsEach }: { teams: number; teamsEach: number }) {
  const members = await Promise.all(people.map(memberOf));
  const slugOf = (team: number) => `team-${String(team).padStart(3, "0")}`;
  const teamsOf = (index: number) => Array.from({ length: teamsEach }, (_, seat) => (index * teamsEach + seat) % teams);
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("companyProfiles").collect()) await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("companyTeams").collect()) await ctx.db.delete(row._id);
    for (const [index, { name }] of people.entries()) {
      const linked = index % 2 === 1;
      const [firstName, lastName] = linked ? ["Profile", `Person${index}`] : name.split(" ");
      const image = `https://res.cloudinary.com/dmukukwp6/image/upload/c_limit,w_160,f_auto,q_auto/v1/posthog.com/src/images/people/cutout_${index}_a1b2c3d4e5.png`;
      const profile = 10_000 + index;
      await ctx.db.insert("companyProfiles", { profile, firstName: firstName!, lastName: lastName!, normalisedName: `${firstName} ${lastName}`.toLowerCase(), image, colour: "#8567FF", teams: teamsOf(index).map(slugOf), role: "Product Engineer", asOf: Date.now() });
      if (linked) await ctx.db.insert("companyProfileLinks", { workspace: "T1", member: members[index]!, profile, by: "self", setBy: members[index]!, at: Date.now() });
    }
    for (let team = 0; team < teams; team += 1) {
      const onTeam = people.flatMap((_, index) => (teamsOf(index).includes(team) ? [10_000 + index] : []));
      const crestImage = `https://res.cloudinary.com/dmukukwp6/image/upload/c_limit,w_160,f_auto,q_auto/v1/crests/${slugOf(team)}.png`;
      await ctx.db.insert("companyTeams", { team: slugOf(team), name: `Team ${String(team).padStart(3, "0")}`, crestImage, leads: onTeam.slice(0, 2), people: onTeam, asOf: Date.now() });
    }
  });
}

async function everyoneHeldBy(owner: Person, people: Person[]) {
  const member = await memberOf(owner);
  const { firstAward, firstAt } = (await t.run((ctx) => ctx.db.query("stickers").first()))!;
  const others = await t.run(async (ctx) => (await ctx.db.query("members").collect()).filter(({ _id }) => _id !== member).map(({ _id }) => _id));
  await t.run(async (ctx) => {
    const held = new Set((await ctx.db.query("stickers").collect()).filter((sticker) => sticker.member === member).map(({ person }) => person));
    for (const person of others) if (!held.has(person)) await ctx.db.insert("stickers", { member, person, firstAward, firstAt });
  });
  expect(others).toHaveLength(people.length - 1);
}
