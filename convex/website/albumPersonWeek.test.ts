import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { deleteMessage, edit, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { channel, emoji, mention, section, text, userGroup } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import { kudosListedAWeek } from "../album/weekKudos";
import type { AlbumPersonRead, AlbumWeekRead } from "./album";

const tuesday = new Date("2026-10-13T10:00:00Z");
const theWeek = "2026-10-12";
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const weekMs = 7 * dayMs;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const dana = { user: "U_DANA", name: "Dana Ferreira" };
const cast = [alice, bob, carol, dana];
const why = "Thanks for untangling the flaky migration";
const longerWhy = "Thanks for untangling the flaky migration and writing up every step of the rollback";
const workspaceUrl = "https://kudos-test.slack.com/";

const lanterns: TeamPage = { slug: "lanterns", name: "Lanterns", profiles: [{ id: 1, firstName: "Alice", lastName: "Marchetti", colour: "teal" }, { id: 2, firstName: "Bob", lastName: "Okonkwo", colour: "blue", cutout: aCutout("bob") }] };
const otters: TeamPage = { slug: "otters", name: "Otters", profiles: [{ id: 2, firstName: "Bob", lastName: "Okonkwo", colour: "blue", cutout: aCutout("bob") }, { id: 3, firstName: "Carol", lastName: "Lindqvist", colour: "red" }] };

type Person = { user: string; name: string };

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;
let clock = tuesday.getTime();

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  messages = 0;
  clock = tuesday.getTime();
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom().withTeams(lanterns, otters);
  slack = new FakeSlack().withWorkspaceUrl(workspaceUrl);
  for (const person of cast) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 1_000, hugBudget: 50 }));
  await switchWebsite(t, postHog, true, "album", "collection", "packs", "hugs", "team-pages");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AL46: getAlbumPerson reads one person's page from its pair tally", { timeout: 120_000 }, () => {
  test("a person's page holds when you first thanked them, kudos and hugs both ways, your best message with its words and Slack link, their name, face and teams, and their hype emoji once a thoughtful kudos earned it", async () => {
    const first = await thanks(alice, "ty", bob);
    const best = await thanks(alice, longerWhy, bob);
    await thanks(alice, why, bob);
    await thanks(bob, why, alice);
    await hugs(alice, bob, nextTs());
    await hugs(bob, alice, nextTs());
    await hugs(dana, alice, nextTs());
    await syncTheCompany();

    const page = await personPageOf(alice, bob);

    expect(page).toEqual({
      kind: "person",
      person: await memberOf(bob),
      name: bob.name,
      face: { kind: "company-profile", image: expect.stringContaining("bob"), colour: expect.any(String), initials: "BO" },
      held: false,
      firstThankedAt: atOf(first),
      kudosGiven: 3,
      kudosReceived: 1,
      hugsGiven: 1,
      hugsReceived: 1,
      best: { message: { kind: "text", segments: expect.arrayContaining([expect.objectContaining({ kind: "text", text: expect.stringContaining("every step of the rollback") })]), edited: false }, permalink: permalinkOf(best), at: atOf(best) },
      teams: [
        { team: "lanterns", name: "Lanterns", art: null },
        { team: "otters", name: "Otters", art: null },
      ],
      hype: { earned: true, name: "bob-okonkwo-hype", picture: expect.any(String), inSlack: false },
      slackProfile: `${workspaceUrl}team/${bob.user}`,
    });
  });

  test("the best message names each member it mentions with their person, and someone the album doesn't know, a group and a channel without one", async () => {
    await t.run((ctx) => ctx.db.insert("userGroups", { workspace: "T1", group: "S_ONCALL", handle: "oncall", name: "On call", enabled: true, automatic: false, asOf: 0 }));
    slack.withMember("U_GONE", { deleted: true });
    await post(t, [section(text(`${longerWhy} `), mention(bob.user), text(" and "), mention(carol.user), text(" with "), mention("U_GONE"), text(" for "), userGroup("S_ONCALL"), text(" in "), channel("C_SHIP"), text(" "), emoji("taco"))], { user: alice.user, ts: nextTs() });
    await settle(t);

    const page = await personPageOf(alice, bob);

    if (page.kind !== "person" || !("best" in page) || page.best?.message.kind !== "text") throw new Error("expected Bob's page with Alice's best message");
    expect(page.best.message.segments.filter(({ kind }) => kind !== "text" && kind !== "emoji")).toEqual([
      { kind: "person", name: bob.name, person: await memberOf(bob) },
      { kind: "person", name: carol.name, person: await memberOf(carol) },
      { kind: "person", name: "A teammate" },
      { kind: "group", handle: "oncall" },
      { kind: "channel" },
    ]);
  });

  test("a person's page opens them in Slack at their profile on the workspace's address, and offers nothing while that address isn't known", async () => {
    await thanks(alice, why, bob);

    expect(await personPageOf(alice, bob)).toMatchObject({ kind: "person", slackProfile: `${workspaceUrl}team/${bob.user}` });

    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("workspaces").collect()) await ctx.db.patch(row._id, { url: undefined });
    });

    expect(await personPageOf(alice, bob)).toMatchObject({ kind: "person", slackProfile: null });
  });

  test("HH6: a person you only thanked briefly shows that kudos as your best message, and one who only thanked you shows none and their hype emoji still locked", async () => {
    const brief = await thanks(alice, "ty", bob);
    await thanks(carol, why, alice);

    expect(await personPageOf(alice, bob)).toMatchObject({ kind: "person", name: bob.name, kudosGiven: 1, kudosReceived: 0, best: { permalink: permalinkOf(brief), at: atOf(brief) }, teams: [] });
    expect(await personPageOf(alice, carol)).toMatchObject({ kind: "person", name: carol.name, firstThankedAt: null, kudosGiven: 0, kudosReceived: 1, best: null, hype: { earned: false, name: null } });
  });

  test("a best message deleted in Slack, or edited so it no longer is a kudos, is no longer quoted", async () => {
    const deleted = await thanks(alice, longerWhy, bob);
    const editedAway = await thanks(alice, longerWhy, carol);

    await deleteMessage(t, { user: alice.user, ts: deleted });
    await edit(t, [section(text(`${longerWhy} `), mention(carol.user))], { user: alice.user, ts: editedAway, editedTs: nextTs() });
    await settle(t);

    expect(await personPageOf(alice, bob)).toMatchObject({ kind: "person", kudosGiven: 1, best: null });
    expect(await personPageOf(alice, carol)).toMatchObject({ kind: "person", kudosGiven: 1, best: null });
  });

  test("a person put in from a pack is held, and someone you never met shows an empty history", async () => {
    await thanks(alice, why, bob);
    await opensAndPutsInEveryPack(alice);

    expect(await personPageOf(alice, bob)).toMatchObject({ kind: "person", held: true });
    expect(await personPageOf(alice, dana)).toEqual(expect.objectContaining({ kind: "person", held: false, firstThankedAt: null, kudosGiven: 0, kudosReceived: 0, hugsGiven: 0, hugsReceived: 0, best: null }));
  });

  test("a member of another workspace, a bot or a document of no member answers no-person", async () => {
    await thanks(alice, "ty", bob);
    const elsewhere = await aMember(t, "U_ELSEWHERE", "member", "T2");
    const bot = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_BOT", kind: "bot", asOf: 0 }));
    const gone = await t.run(async (ctx) => {
      const id = await ctx.db.insert("members", { workspace: "T1", user: "U_GONE", kind: "member", asOf: 0 });
      await ctx.db.delete(id);
      return id;
    });

    for (const person of [elsewhere, bot, gone]) expect(await (await signedIn(alice)).query(api.website.album.getAlbumPerson, { person })).toEqual({ kind: "no-person" });
  });

  test("a person page address naming no document of members, an ID of another table or words, answers no-person", async () => {
    await thanks(alice, "ty", bob);
    const workspace = await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T9", kudosEmoji: "taco", baseAllowance: 5 }));

    for (const person of [workspace, "ines-okafor", ""]) expect(await (await signedIn(alice)).query(api.website.album.getAlbumPerson, { person })).toEqual({ kind: "no-person" });
  });

  test("a pair with 300 kudos reads within Convex's limits", async () => {
    for (let kudos = 0; kudos < 150; kudos += 1) await thanks(alice, kudos % 2 === 0 ? why : "ty", bob);
    for (let kudos = 0; kudos < 150; kudos += 1) await thanks(bob, "ty", alice);

    expect(await personPageOf(alice, bob)).toMatchObject({ kind: "person", kudosGiven: 150, kudosReceived: 150, best: { at: expect.any(Number) } });
  });
});

describe("AL48: getAlbumWeek reads one week's issue from its week tally", { timeout: 180_000 }, () => {
  test("the kudos of the week and every other kudos of the week name each member they mention with their person", async () => {
    await thanks(alice, longerWhy, bob, carol);
    await thanks(alice, why, dana);

    const week = await weekOf(alice);

    if (week.kind !== "week" || week.issue === null) throw new Error("expected this week's issue");
    const peopleIn = (message: { kind: string; segments?: { kind: string }[] }) => (message.segments ?? []).filter(({ kind }) => kind === "person");
    expect(peopleIn(week.issue.kudosOfWeek!.message)).toEqual([
      { kind: "person", name: bob.name, person: await memberOf(bob) },
      { kind: "person", name: carol.name, person: await memberOf(carol) },
    ]);
    expect(week.issue.given.kudos.map(({ message }) => peopleIn(message))).toContainEqual([{ kind: "person", name: dana.name, person: await memberOf(dana) }]);
  });
  test("this week's issue holds its counts, the kudos of the week with its words, who you thanked, who thanked you, who you hugged and who hugged you, the packs you opened, the new faces and hoggies you put in, and each day's count", async () => {
    const thanked = await thanks(alice, longerWhy, bob);
    const thankedBy = await thanks(carol, "ty", alice);
    await hugs(dana, alice, thanked);
    await hugs(dana, alice, nextTs());
    await hugs(alice, carol, nextTs());
    laterBy(dayMs);
    await opensAndPutsInEveryPack(alice);

    const week = await weekOf(alice);

    expect(week).toEqual({
      kind: "week",
      week: theWeek,
      thisWeek: theWeek,
      weeks: [{ week: theWeek, days: [0, 4, 0, 0, 0, 0, 0] }],
      issue: {
        kudosGiven: 1,
        kudosReceived: 1,
        thoughtfulGiven: 1,
        thoughtfulReceived: 1,
        hugsGiven: 1,
        hugsReceived: 1,
        packsOpened: 1,
        kudosOfWeek: {
          giver: { person: await memberOf(alice), name: alice.name, face: expect.objectContaining({ initials: "AM" }) },
          message: { kind: "text", segments: expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining("every step of the rollback") })]), edited: false },
          permalink: permalinkOf(thanked),
          hugs: 1,
          at: atOf(thanked),
        },
        thanked: { people: [await personIn(bob)], more: 0 },
        thankedBy: { people: [await personIn(carol)], more: 0 },
        hugged: { people: [await personIn(carol)], more: 0 },
        huggedBy: { people: [await personIn(dana)], more: 0 },
        newFaces: { people: [await personIn(bob)], more: 0 },
        hoggies: { hoggies: [{ hoggie: expect.any(String), rarity: expect.any(String) }], more: 0 },
        given: { kudos: [], more: false },
        received: { kudos: [await kudosIn("ty", thankedBy, carol)], more: false },
        days: [0, 4, 0, 0, 0, 0, 0],
      },
    });
  });

  test("the issue lists every other kudos the member gave and got that week, newest first, each with its words, Slack link, day and people", async () => {
    await thanks(alice, "ty for last week", bob);
    laterBy(weekMs);
    const lead = await thanks(alice, longerWhy, bob);
    const review = await thanks(alice, "Thanks for the careful review", carol, dana);
    const pairing = await thanks(carol, "Thanks for pairing on the flaky test", alice);
    const docs = await thanks(alice, "Thanks for the docs", dana);
    const ready = await thanks(dana, "Thanks for getting the release ready", alice, bob);

    const week = await weekOf(alice);

    expect(week).toMatchObject({ issue: { kudosOfWeek: { permalink: permalinkOf(lead) } } });
    expect(week).toMatchObject({
      issue: {
        given: { kudos: [await kudosIn("Thanks for the docs", docs, dana), await kudosIn("Thanks for the careful review", review, carol, dana)], more: false },
        received: { kudos: [await kudosIn("Thanks for getting the release ready", ready, dana), await kudosIn("Thanks for pairing on the flaky test", pairing, carol)], more: false },
      },
    });
  });

  test("a kudos deleted in Slack, or edited so it no longer is one, leaves the issue's lists and its kudos of the week", async () => {
    const lead = await thanks(alice, longerWhy, bob);
    const review = await thanks(alice, "Thanks for the careful review", carol);
    const docs = await thanks(alice, "Thanks for the docs", dana);
    const pairing = await thanks(carol, "Thanks for pairing on the flaky test", alice);

    await deleteMessage(t, { user: alice.user, ts: lead });
    await edit(t, [section(text("Thanks for the docs "), mention(dana.user))], { user: alice.user, ts: docs, editedTs: nextTs() });
    await deleteMessage(t, { user: carol.user, ts: pairing });
    await settle(t);

    expect(await weekOf(alice)).toMatchObject({
      issue: { kudosOfWeek: null, given: { kudos: [await kudosIn("Thanks for the careful review", review, carol)], more: false }, received: { kudos: [], more: false } },
    });
  });

  test("the issue lists the kudos the member got newest first by when they were given, whatever day each giver's time zone filed them on", async () => {
    await aMember(t, carol.user, "member", "T1", "Pacific/Auckland");
    await thanks(alice, longerWhy, bob);
    laterBy(2 * 60 * minuteMs);
    await thanks(carol, "Thanks for the late handover", alice);
    await thanks(dana, "Thanks for the morning review", alice);

    const week = await weekOf(alice);

    if (week.kind !== "week" || week.issue === null) throw new Error("no issue");
    expect(week.issue.received.kudos.map(({ message }) => message), "carol's kudos is filed on her Wednesday, dana's later one on Tuesday").toEqual([wordsSaying("Thanks for the morning review"), wordsSaying("Thanks for the late handover")]);
  });

  test("a week of more kudos than an issue lists shows the newest 50 each way besides the kudos of the week, three people named on each, and says more came, within Convex's limits", async () => {
    for (let message = 0; message < kudosListedAWeek + 2; message += 1) {
      await thanks(alice, `Thanks for fix ${message}`, bob, carol, dana);
      await thanks(carol, `Thanks for review ${message}`, alice);
    }

    const week = await weekOf(alice);

    if (week.kind !== "week" || week.issue === null) throw new Error("no issue");
    expect(week.issue.given.more).toBe(true);
    expect(week.issue.received.more).toBe(true);
    expect(week.issue.given.kudos).toHaveLength(kudosListedAWeek);
    expect(week.issue.received.kudos).toHaveLength(kudosListedAWeek);
    expect(week.issue.given.kudos[0]).toMatchObject({ message: wordsSaying(`Thanks for fix ${kudosListedAWeek + 1}`) });
    expect(week.issue.received.kudos.at(-1)).toMatchObject({ message: wordsSaying("Thanks for review 1") });
  });

  test("the week tabs start at the first week with an issue and run to this week, newest first; a quiet week between them reads an empty issue and a week before them none", async () => {
    await thanks(alice, why, bob);
    laterBy(2 * weekMs);
    await thanks(carol, "ty", alice);

    const thisWeek = await weekOf(alice);
    const quiet = await weekOf(alice, "2026-10-19");
    const before = await weekOf(alice, "2026-10-05");

    expect(thisWeek).toMatchObject({ kind: "week", week: "2026-10-26", weeks: [{ week: "2026-10-26" }, { week: "2026-10-19", days: [0, 0, 0, 0, 0, 0, 0] }, { week: theWeek }], issue: { kudosReceived: 1, thankedBy: { people: [await personIn(carol)] } } });
    expect(thisWeek).toMatchObject({ issue: { packsOpened: 0, newFaces: { people: [], more: 0 }, hoggies: { hoggies: [], more: 0 } } });
    expect(quiet).toMatchObject({ kind: "week", week: "2026-10-19", weeks: thisWeek.kind === "week" ? thisWeek.weeks : [], issue: { kudosGiven: 0, kudosReceived: 0, kudosOfWeek: null, thanked: { people: [], more: 0 }, newFaces: { people: [], more: 0 }, hoggies: { hoggies: [], more: 0 } } });
    expect(before).toMatchObject({ kind: "week", week: "2026-10-05", issue: null });
  });

  test("a Monday after the newest tab reads no issue", async () => {
    await thanks(alice, why, bob);

    expect(await weekOf(alice, "2026-10-19")).toMatchObject({ kind: "week", week: "2026-10-19", weeks: [{ week: theWeek }], issue: null });
  });

  test("a kudos a giver east of the member sent on their Monday shows in its week's tab while it is still Sunday for the member", async () => {
    await aMember(t, carol.user, "member", "T1", "Pacific/Auckland");
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
    clock = Date.now();
    await thanks(carol, why, alice);

    expect(await weekOf(alice)).toMatchObject({ kind: "week", week: theWeek, thisWeek: theWeek, weeks: [{ week: "2026-10-19" }], issue: null });
    expect(await weekOf(alice, "2026-10-19")).toMatchObject({ thisWeek: theWeek });
    expect(await weekOf(alice, "2026-10-19")).toMatchObject({ kind: "week", issue: { kudosReceived: 1, thankedBy: { people: [{ person: await memberOf(carol) }] } } });
  });

  test("a pack opened in one week and put in the next counts as opened in the first and its new face and hoggie in the second", async () => {
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    const album = await asAlice.query(api.website.album.getAlbum, {});
    for (const { pack } of "packs" in album ? album.packs : []) await asAlice.mutation(api.website.album.openThoughtfulPack, { pack });
    laterBy(weekMs);
    await (await signedIn(alice)).mutation(api.website.album.putAllIn, {});
    await settle(t);

    expect(await weekOf(alice, theWeek)).toMatchObject({ issue: { packsOpened: 1, newFaces: { people: [], more: 0 }, hoggies: { hoggies: [], more: 0 } } });
    expect(await weekOf(alice, "2026-10-19")).toMatchObject({ issue: { packsOpened: 0, newFaces: { people: [await personIn(bob)], more: 0 }, hoggies: { hoggies: [{ hoggie: expect.any(String) }], more: 0 } } });
  });

  test("a member with no history yet reads this week with no issue and no tabs", async () => {
    await thanks(bob, "ty", carol);
    await memberOf(dana);

    expect(await weekOf(dana)).toEqual({ kind: "week", week: theWeek, thisWeek: theWeek, weeks: [], issue: null });
  });

  test("this week is the member's own week in their time zone", async () => {
    await aMember(t, alice.user, "member", "T1", "Pacific/Auckland");
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));

    expect(await weekOf(alice)).toMatchObject({ week: "2026-10-19" });
  });

  test("a week with 800 recipients reads 12 people a list with the rest counted, within Convex's limits", async () => {
    const crowd = aCrowdOf(800);
    for (let message = 0; message < 8; message += 1) await thanks(alice, "ty", ...crowd.slice(message * 100, (message + 1) * 100));

    const week = await weekOf(alice);

    expect(week).toMatchObject({ kind: "week", issue: { kudosGiven: 800, thanked: { more: 788 } } });
    expect(week.kind === "week" && week.issue?.thanked.people).toHaveLength(12);
    if (week.kind !== "week" || week.issue === null) throw new Error("no issue");
    expect(week.issue.given.more, "the awards read stop at 500, so the message cut short there is left out").toBe(true);
    expect(week.issue.given.kudos.map(({ people, morePeople }) => [people.length, morePeople])).toEqual([
      [3, 97],
      [3, 97],
      [3, 97],
      [3, 97],
    ]);
  });
});

async function personPageOf(member: Person, person: Person): Promise<AlbumPersonRead | { kind: string }> {
  return (await signedIn(member)).query(api.website.album.getAlbumPerson, { person: await memberOf(person) });
}

async function weekOf(member: Person, week?: string): Promise<AlbumWeekRead> {
  const answer = await (await signedIn(member)).query(api.website.album.getAlbumWeek, week === undefined ? {} : { week });
  if (answer.kind !== "week" && answer.kind !== "off") throw new Error(`getAlbumWeek answered ${answer.kind}`);
  return answer;
}

async function kudosIn(words: string, ts: string, ...people: Person[]) {
  return { message: wordsSaying(words), at: atOf(ts), people: await Promise.all(people.map(personIn)), morePeople: 0 };
}

function wordsSaying(words: string) {
  return { kind: "text", segments: expect.arrayContaining([expect.objectContaining({ kind: "text", text: expect.stringMatching(new RegExp(`^${words}\\s*$`)) })]), edited: false };
}

async function personIn(person: Person) {
  return { person: await memberOf(person), name: person.name, face: expect.objectContaining({ initials: expect.any(String) }) };
}

async function opensAndPutsInEveryPack(member: Person) {
  const asMember = await signedIn(member);
  const album = await asMember.query(api.website.album.getAlbum, {});
  for (const { pack } of "packs" in album ? album.packs : []) await asMember.mutation(api.website.album.openThoughtfulPack, { pack });
  await asMember.mutation(api.website.album.putAllIn, {});
  await settle(t);
}

async function syncTheCompany() {
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await settle(t);
}

function aCrowdOf(size: number): Person[] {
  const crowd = Array.from({ length: size }, (_, index) => ({ user: `U_CROWD_${index}`, name: `Crowd Person ${index}` }));
  for (const person of crowd) slack.withMember(person.user, { real_name: person.name });
  return crowd;
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

async function hugs(giver: Person, author: Person, ts: string) {
  await react(t, { user: giver.user, itemUser: author.user, ts, eventId: `EvHug${nextTs()}` });
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
  if (row === null) return aMember(t, person.user);
  return row._id;
}
