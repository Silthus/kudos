import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { catalogue } from "../hoggies/catalogue";
import type { AlbumAnswer, AlbumRead } from "../website/album";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;
type Milestone = AlbumAnswer["milestones"][number];
type Earned = Partial<Record<"bronze" | "silver" | "gold" | "diamond", number>>;

const alice = person("Alice", "Marchetti");
const lanterns = Array.from({ length: 4 }, (_, index) => person("Lantern", `Wickfield${index + 1}`));
const otters = Array.from({ length: 3 }, (_, index) => person("Otter", `Quillfeather${index + 1}`));
const everyone = [alice, ...lanterns, ...otters];

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
  await switchWebsite(t, postHog, true, ...albumOpen);
  for (const { user, name } of everyone) await memberChanged(t, "team_join", slackUser(user, name));
  await settle(t);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AL21: five milestones count album facts and record each tier once with its date", { timeout: 60_000 }, () => {
  test("a newcomer reads the five milestones in order, each with its bronze, silver, gold and diamond steps and names, nothing counted and nothing earned", async () => {
    expect(await milestonesOf(await signedIn(alice))).toEqual([
      milestone("people", 0, [1, 10, 25, 50], ["First face", "Familiar faces", "Full of friends", "Everyone's album"]),
      milestone("teams", 0, [1, 5, 15, 50], ["First full page", "Five teams strong", "Most of the company", "Every page"]),
      milestone("reach", 0, [3, 10, 25, 50], ["Next door", "Bridge builder", "Well travelled", "All hands"]),
      milestone("hoggies", 0, [10, 40, 100, catalogue.hoggies.length], ["Curious", "Collector", "Hoarder", "Completionist"]),
      milestone("thoughtful", 0, [1, 25, 100, 500], ["First thank-you", "Generous soul", "Heart of the team", "Patron of praise"]),
    ]);
  });

  test("a first thoughtful kudos records Kind words at bronze, and the first put-in Faces in the album and the hoggie found, each dated when its count got there", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", profiles: profilesOf(...otters) });
    const thankedAt = await thanks(alice, why, otters[0]!);
    const asAlice = await signedIn(alice);
    await opensEveryPack(asAlice);
    expect(await countsOf(asAlice), "nothing is in the album before the put-in").toEqual({ people: 0, teams: 0, reach: 0, hoggies: 0, thoughtful: 1 });
    vi.setSystemTime(Date.now() + dayMs);

    const later = await signedIn(alice);

    const putInAt = await putsEverythingIn(later);

    expect(await countsOf(later)).toEqual({ people: 1, teams: 0, reach: 1, hoggies: 1, thoughtful: 1 });
    expect(await earnedOf(later)).toEqual({ people: { bronze: putInAt }, teams: {}, reach: {}, hoggies: {}, thoughtful: { bronze: thankedAt } });
  });

  test("a short kudos counts no kind words", async () => {
    await thanks(alice, "ty", otters[0]!);

    expect(await countsOf(await signedIn(alice))).toMatchObject({ thoughtful: 0 });
  });

  test("Across the company counts the company teams holding an album sticker, and Full pages the team stickers unlocked", async () => {
    await theCompanyCopyHolds(
      { slug: "beacons", name: "Beacons", profiles: profilesOf(lanterns[0]!) },
      { slug: "comets", name: "Comets", profiles: profilesOf(lanterns[1]!, lanterns[2]!) },
      { slug: "otters", name: "Otters", profiles: profilesOf(...otters) },
    );
    const reachedAt = await aliceCollects(lanterns[0]!, lanterns[1]!, otters[0]!);
    vi.setSystemTime(Date.now() + dayMs);

    const later = await signedIn(alice);
    await later.mutation(api.website.album.unlockTeamSticker, { team: "beacons" });

    expect(await countsOf(later)).toMatchObject({ people: 3, teams: 1, reach: 3 });
    expect(await earnedOf(later)).toMatchObject({ teams: { bronze: Date.now() }, reach: { bronze: reachedAt } });
  });

  test("a tier keeps its first date while its count grows, falls back when a team leaves posthog.com, and climbs again", async () => {
    const beacons = { slug: "beacons", name: "Beacons", profiles: profilesOf(lanterns[0]!) };
    const comets = { slug: "comets", name: "Comets", profiles: profilesOf(lanterns[1]!) };
    const otterTeam = { slug: "otters", name: "Otters", profiles: profilesOf(...otters) };
    await theCompanyCopyHolds(beacons, comets, otterTeam);
    await aliceCollects(lanterns[0]!, lanterns[1]!, otters[0]!);
    const asAlice = await signedIn(alice);
    const first = await earnedOf(asAlice);
    vi.setSystemTime(Date.now() + dayMs);

    await theCompanyCopyHolds(beacons, otterTeam);
    const fallenBack = await signedIn(alice);
    expect(await countsOf(fallenBack), "a team gone from posthog.com").toMatchObject({ reach: 2 });
    expect(await earnedOf(fallenBack), "a tier stays earned below its step").toEqual(first);
    await aliceCollects(otters[1]!);
    await theCompanyCopyHolds(beacons, comets, otterTeam);
    await aliceCollects(otters[2]!);

    const later = await signedIn(alice);
    expect(await countsOf(later)).toMatchObject({ people: 5, reach: 3, thoughtful: 5 });
    expect(await earnedOf(later)).toEqual(first);
  });

  test("the tiers are recorded whatever album says, and show with their dates once it is on", async () => {
    await switchWebsite(t, postHog, true, "collection", "packs");
    const thankedAt = await thanks(alice, why, otters[0]!);
    expect(await (await signedIn(alice)).query(api.website.album.getAlbum, {})).toEqual({ kind: "off" });
    vi.setSystemTime(Date.now() + dayMs);

    await switchWebsite(t, postHog, true, ...albumOpen);

    expect(await earnedOf(await signedIn(alice))).toMatchObject({ thoughtful: { bronze: thankedAt } });
  });

  test("the album's history records the tiers its stickers reach once it is done", async () => {
    await thanks(alice, "ty", otters[0]!, otters[1]!);
    vi.setSystemTime(Date.now() + dayMs);

    await t.mutation(internal.album.history.startAlbumHistory, { workspace: "T1" });
    await settle(t);

    const asAlice = await signedIn(alice);
    expect(await countsOf(asAlice)).toMatchObject({ people: 2 });
    expect(await earnedOf(asAlice)).toMatchObject({ people: { bronze: Date.now() } });
  });
});

function milestone(id: Milestone["id"], count: number, steps: number[], names: string[]): Milestone {
  const tiers = (["bronze", "silver", "gold", "diamond"] as const).map((tier, index) => ({ tier, at: steps[index]!, name: names[index]!, earnedAt: null }));
  return { id, count, tiers };
}

async function milestonesOf(reader: Reader): Promise<Milestone[]> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return (album as AlbumAnswer).milestones;
}

async function countsOf(reader: Reader): Promise<Record<string, number>> {
  return Object.fromEntries((await milestonesOf(reader)).map(({ id, count }) => [id, count]));
}

async function earnedOf(reader: Reader): Promise<Record<string, Earned>> {
  return Object.fromEntries((await milestonesOf(reader)).map(({ id, tiers }) => [id, Object.fromEntries(tiers.flatMap(({ tier, earnedAt }) => (earnedAt === null ? [] : [[tier, earnedAt]])))]));
}

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
  await opensEveryPack(asAlice);
  return putsEverythingIn(asAlice);
}

async function opensEveryPack(reader: Reader) {
  const album = await reader.query(api.website.album.getAlbum, {});
  for (const { pack } of album.kind === "album" ? album.packs : []) await reader.mutation(api.website.album.openThoughtfulPack, { pack });
  await settle(t);
}

async function putsEverythingIn(reader: Reader) {
  const at = Date.now();
  for (let placed = await reader.mutation(api.website.album.putAllIn, {}); placed.kind === "placed" && placed.more; ) placed = await reader.mutation(api.website.album.putAllIn, {});
  await settle(t);
  return at;
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const at = Date.now();
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${at / 1000}.${String(messages).padStart(6, "0")}` });
  await settle(t);
  return at;
}

async function signedIn(someone: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: someone.user, name: someone.name });
  return asSignedIn;
}
