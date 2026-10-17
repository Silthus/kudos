import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage as PostHogComTeam } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { holds } from "../../testing/hoggies";
import { signedRequest } from "../../testing/signedSlack";
import { memberChanged, post, settleInTimeOrder as settle, testBackend, type Backend } from "../../testing/slackBackend";
import { publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, section } from "../../testing/slackMessages";
import { everyoneHeldBy, seededCompany, seededMembers, type Person } from "../../testing/stickerBook";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { awardsOfMessage } from "../engine/awards";
import { setMessageSetting } from "../messageSettings/messageSettings";
import type { CollectionAnswer } from "../website/collection";
import { seenKeyOf } from "../website/seen";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-16T10:00:00Z");
const minuteMs = 60_000;
const bookFlags = ["xp-levels", "unlocks", "achievements", "everyone-board", "skill-tree", "collection", "crests", "groups", "sticker-book", "team-pages"];
const stickerJob = "stickers/stickers:recordStickers";
const checkJob = "stickers/completions:checkTeamPages";
const deliveryJob = "slack/directMessages:deliverDirectMessage";

const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const wren = { user: "U_WREN", name: "Wren Halloway" };
const oriel = { user: "U_ORIEL", name: "Oriel Pemberton" };
const tamsin = { user: "U_TAMSIN", name: "Tamsin Vale" };
const sam = { user: "U_SAM", name: "Sam Okafor" };
const ivo = { user: "U_IVO", name: "Ivo Marchetti" };
const zed = { user: "U_ZED", name: "Zed Zimmer" };

const junoProfile = { id: 1, firstName: "Juno", lastName: "Whitlock" };
const wrenProfile = { id: 2, firstName: "Wren", lastName: "Halloway" };
const orielProfile = { id: 3, firstName: "Oriel", lastName: "Pemberton" };
const tamsinProfile = { id: 4, firstName: "Tamsin", lastName: "Vale" };
const ivoProfile = { id: 5, firstName: "Ivo", lastName: "Marchetti" };

const batchExports: PostHogComTeam = { slug: "batch-exports", name: "Batch Exports", profiles: [junoProfile, wrenProfile, tamsinProfile] };
const lantern: PostHogComTeam = { slug: "lantern", name: "Lantern", crest: aCutout("lantern-crest"), profiles: [orielProfile, wrenProfile] };
const zephyr: PostHogComTeam = { slug: "zephyr", name: "Zephyr", profiles: [tamsinProfile] };

const lanternArt = { kind: "image", url: `https://res.cloudinary.com/posthog-test/image/upload/c_limit,w_160,f_auto,q_auto/v1/lantern-crest.png` };

type Reader = Awaited<ReturnType<typeof aSignedInSession>>["asSignedIn"];
type Collection = Extract<CollectionAnswer, { kind: "collection" }>;
type HeldJob = { name: string; args: Record<string, unknown> };

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;
const tsOfMessageAt = new Map<number, string>();
const memberIds = new Map<string, MemberId>();

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  slack = new FakeSlack();
  for (const person of [juno, wren, oriel, tamsin, sam, ivo, zed]) slack.withMember(person.user, { real_name: person.name });
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

async function teamSpirit(on: boolean, ...alsoOn: string[]) {
  await switchWebsite(t, postHog, true, ...bookFlags, ...alsoOn, ...(on ? ["team-spirit"] : []));
}

async function teamSpiritShipped(on: boolean, ...alsoOn: string[]) {
  await teamSpirit(on, ...alsoOn);
  await bookShippedBeforeAnyoneJoined(t);
}

async function joined(...people: Person[]) {
  for (const person of people) {
    await memberChanged(t, "team_join", { id: person.user, real_name: person.name });
    await settle(t);
    await memberOf(person);
  }
}

async function given(giver: Person, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const at = Date.now();
  const ts = `${at / 1000}.${String(messages).padStart(6, "0")}`;
  tsOfMessageAt.set(at, ts);
  await post(t, [section(...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  return at;
}

async function thanks(giver: Person, ...recipients: Person[]) {
  const at = await given(giver, ...recipients);
  await settle(t);
  return at;
}

async function memberOf(person: Person): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  if (row === null) throw new Error(`${person.user} is not in the directory`);
  memberIds.set(person.user, row._id);
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

async function pagesOf(reader: Reader) {
  return (await collectionOf(reader)).teams ?? [];
}

async function pageOf(reader: Reader, team: string) {
  const page = (await pagesOf(reader)).find((each) => each.team === team);
  if (page === undefined) throw new Error(`no page ${team}`);
  return page;
}

async function completionOf(reader: Reader, team: string) {
  const { held, total, complete, completion, crest } = await pageOf(reader, team);
  return { held, total, complete, completion, crest };
}

async function recordedAt(owner: Person, team: string, at: number, held: number, total = held) {
  const member = await memberOf(owner);
  return { held, total, complete: true, completion: { at, seen: await seenKeyOf(member, `page:${team}:${at}`) }, crest: { collectedAt: at, seen: await seenKeyOf(member, `team:${team}:${at}`) } };
}

function unrecorded(held: number, total: number) {
  return { held, total, complete: held === total && total > 0, completion: null, crest: null };
}

async function analyticsIdOf(person: Person) {
  const member = await memberOf(person);
  return t.run(async (ctx) => (await ctx.db.query("analyticsIds").collect()).find((row) => row.member === member)?.analyticsId);
}

async function pagesCompletedBy(person: Person) {
  const analyticsId = await analyticsIdOf(person);
  return postHog
    .productEvents()
    .filter(({ event, distinct_id }) => event === "team page completed" && distinct_id === analyticsId)
    .map(({ properties }) => properties);
}

function pageCompleted(team: string, people: number, told: boolean) {
  return { environment: "sandbox", workspace_key: expect.any(String), taxonomy_version: 1, team, people, told };
}

function storedCompletions() {
  return t.run((ctx) => ctx.db.query("teamPageCompletions").collect());
}

function completionLinesTo(person: Person) {
  return [...slack.callsTo("chat.postMessage"), ...slack.callsTo("chat.postEphemeral")]
    .filter(({ channel, user }) => channel === person.user || user === person.user)
    .flatMap(({ text }) => String(text).split("\n"))
    .filter((line) => line.startsWith("Team complete"));
}

function publicLinesNamingACompletion() {
  return [...slack.callsTo("chat.postMessage"), ...slack.callsTo("chat.update")]
    .filter(({ channel }) => String(channel).startsWith("C"))
    .map(({ text, blocks }) => `${String(text)} ${JSON.stringify(blocks ?? [])}`)
    .filter((text) => /Team complete|crest earned/.test(text));
}

async function awardOf(at: number) {
  const [award] = await t.run((ctx) => awardsOfMessage(ctx, { workspace: "T1", conversation: "C1", message: tsOfMessageAt.get(at)! }));
  return award!.award;
}

async function heldBack(...names: string[]): Promise<HeldJob[]> {
  const held: HeldJob[] = [];
  for (let fired = 0; fired < 200; fired += 1) {
    await t.finishInProgressScheduledFunctions();
    held.push(...(await cancelPending(names)));
    if (vi.getTimerCount() === 0) return held;
    vi.advanceTimersToNextTimer();
  }
  throw new Error("the kudos never settled");
}

async function cancelPending(names: string[]): Promise<HeldJob[]> {
  return t.run(async (ctx) => {
    const pending = (await ctx.db.system.query("_scheduled_functions").collect()).filter((job) => names.includes(job.name) && job.state.kind === "pending");
    for (const job of pending) await ctx.scheduler.cancel(job._id);
    return pending.map((job) => ({ name: job.name, args: job.args[0] as Record<string, unknown> }));
  });
}

function isCheckOf(args: Record<string, unknown>, person: Person) {
  return (args.check as { member: string }).member === memberIds.get(person.user);
}

async function runs(job: HeldJob) {
  await t.mutation(makeFunctionReference<"mutation">(job.name), job.args);
}

async function checksOf(person: Person) {
  return (await heldBack(checkJob)).filter(({ args }) => isCheckOf(args, person));
}

async function deliveriesScheduled() {
  return t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter(({ name }) => name === deliveryJob).map((job) => job.args[0] as { notification: { teams?: unknown[] }; kudos?: { message: string } }));
}

describe("CV34: a member's first check records every page already complete, silently", { timeout: 60_000 }, () => {
  test("a page filled while team-spirit was off is recorded untold, under the kudos that filled it, at the first new sticker after it turns on, and every later one is told", async () => {
    await onPostHogCom(batchExports, lantern, zephyr);
    await teamSpiritShipped(false);
    await joined(juno, wren, oriel, tamsin, sam);
    const filled = await thanks(juno, wren, oriel);
    const reader = await withTheBookOpen(juno);

    await teamSpirit(true);
    expect(await completionOf(reader, "lantern"), "a page filled while team-spirit was off reads complete before it is recorded").toEqual(unrecorded(2, 2));
    await thanks(sam, juno);

    expect(await completionOf(reader, "lantern")).toEqual(await recordedAt(juno, "lantern", filled, 2));
    expect(await completionOf(reader, "batch-exports")).toEqual(unrecorded(1, 2));
    expect(await pagesCompletedBy(juno)).toEqual([pageCompleted("lantern", 2, false)]);
    expect(completionLinesTo(juno), "the first check told a completion").toEqual([]);

    await thanks(juno, tamsin);

    expect(completionLinesTo(juno)).toEqual(["Team complete · Batch Exports crest earned", "Team complete · Zephyr crest earned"]);
    expect(await pagesCompletedBy(juno)).toEqual([pageCompleted("lantern", 2, false), pageCompleted("batch-exports", 2, true), pageCompleted("zephyr", 1, true)]);
    expect(publicLinesNamingACompletion()).toEqual([]);
  });
});


describe("CV31 CV34: thanking a page's last missing person records it once under that kudos and tells it privately", { timeout: 60_000 }, () => {
  test("the page is recorded once with the award that gave the last sticker and the team's name and crest then, and told by DM in one message with the tier it reached", async () => {
    await onPostHogCom(lantern, zephyr);
    await teamSpiritShipped(true, "coins", "store");
    await joined(juno, wren, oriel, tamsin);
    const reader = await withTheBookOpen(juno);
    await thanks(juno, tamsin);
    await thanks(juno, wren);
    expect(completionLinesTo(juno), "the silent first check told a completion").toEqual([]);

    const last = await thanks(juno, oriel);

    expect(await completionOf(reader, "lantern")).toEqual(await recordedAt(juno, "lantern", last, 2));
    expect((await pageOf(reader, "lantern")).art).toEqual(lanternArt);
    const lanternRecords = (await storedCompletions()).filter(({ team }) => team === "lantern");
    expect(lanternRecords.map(({ member, award, at, people, told, name, crestImage }) => ({ member, award, at, people, told, name, crestImage }))).toEqual([
      { member: await memberOf(juno), award: await awardOf(last), at: last, people: 2, told: true, name: "Lantern", crestImage: lanternArt.url },
    ]);
    const toJuno = slack
      .callsTo("chat.postMessage")
      .filter(({ channel }) => channel === juno.user)
      .map(({ text }) => String(text));
    expect(toJuno.filter((text) => text.includes("Team complete"))).toEqual([expect.stringMatching(/^Team complete · Lantern crest earned\n🏅 You earned All Hands \(Team Spirit, silver\)\./)]);
    expect(publicLinesNamingACompletion()).toEqual([]);
  });

  test("a member whose tiers go beside the kudos is told there, and one who turned tiers off is told nothing", async () => {
    await onPostHogCom(lantern, zephyr);
    await teamSpiritShipped(true, "message-settings");
    await joined(juno, wren, oriel, tamsin);
    await withTheBookOpen(juno);
    await withTheBookOpen(wren);
    await thanks(juno, tamsin);
    await thanks(tamsin, wren);
    await thanks(juno, wren);
    const [junoMember, wrenMember] = [await memberOf(juno), await memberOf(wren)];
    await t.run(async (ctx) => {
      await setMessageSetting(ctx, junoMember, "achievements", "channel");
      await setMessageSetting(ctx, wrenMember, "achievements", "none");
    });

    await thanks(oriel, juno, wren);

    expect(await pagesCompletedBy(wren)).toEqual([pageCompleted("zephyr", 1, false), pageCompleted("lantern", 1, true)]);
    const besideTheKudos = slack.callsTo("chat.postEphemeral").filter(({ user, text }) => user === juno.user && String(text).includes("Team complete"));
    expect(besideTheKudos.map(({ channel, text }) => ({ channel, text: String(text).split("\n")[0] }))).toEqual([{ channel: "C1", text: "Team complete · Lantern crest earned" }]);
    expect(completionLinesTo(wren)).toEqual([]);
  });

  test("a completion whose crest the member already holds by its roster says the team is complete and keeps the roster's crest", async () => {
    await onPostHogCom(batchExports);
    await teamSpiritShipped(true);
    await joined(juno, wren, tamsin, sam);
    const reader = await withTheBookOpen(juno);
    await thanks(juno, sam);
    await holds(t, await memberOf(juno), "coffee-run", "waiter");
    const roster = (await pageOf(reader, "batch-exports")).crest;
    expect(roster, "the roster's crest isn't on the page").not.toBeNull();
    await thanks(juno, wren);

    const last = await thanks(juno, tamsin);

    expect(completionLinesTo(juno)).toEqual(["Team complete · Batch Exports"]);
    expect(await completionOf(reader, "batch-exports")).toEqual({ ...(await recordedAt(juno, "batch-exports", last, 2)), crest: roster });
  });
});

describe("CV31: a check that runs after a later kudos still credits the kudos that filled the page", { timeout: 60_000 }, () => {
  test("the record, its event and its line go under the filling kudos, never the one whose sticker triggered the check", async () => {
    await onPostHogCom(lantern, zephyr);
    await teamSpiritShipped(true, "message-settings");
    await joined(juno, wren, oriel, tamsin, sam);
    const reader = await withTheBookOpen(juno);
    await thanks(juno, tamsin);
    await thanks(juno, wren);

    const filling = await given(juno, oriel);
    const [fillingCheck] = await checksOf(juno);
    await thanks(sam, juno);
    await runs(fillingCheck!);
    const toldUnder = (await deliveriesScheduled()).filter(({ notification }) => notification.teams !== undefined).map(({ kudos }) => kudos?.message);
    await settle(t);

    expect(await completionOf(reader, "lantern")).toEqual(await recordedAt(juno, "lantern", filling, 2));
    expect((await storedCompletions()).find(({ team }) => team === "lantern")?.award).toEqual(await awardOf(filling));
    expect(toldUnder).toEqual([tsOfMessageAt.get(filling)]);
    expect(completionLinesTo(juno)).toEqual(["Team complete · Lantern crest earned"]);
  });
});

describe("a completed team page stays complete", { timeout: 60_000 }, () => {
  test("someone joining the team, a lost match and later new stickers keep it complete, and record it no second time", async () => {
    await onPostHogCom(lantern);
    await teamSpiritShipped(true);
    await joined(juno, wren, oriel, ivo);
    const reader = await withTheBookOpen(juno);
    const completed = await thanks(juno, wren, oriel);

    await onPostHogCom({ ...lantern, profiles: [...lantern.profiles, ivoProfile] });
    expect(await completionOf(reader, "lantern"), "a join un-completed the page").toEqual(await recordedAt(juno, "lantern", completed, 2, 3));

    await onPostHogCom({ ...lantern, profiles: [{ ...orielProfile, lastName: "Pemberton-Hale" }, wrenProfile, ivoProfile] });
    expect(await completionOf(reader, "lantern"), "a lost match un-completed the page").toEqual(await recordedAt(juno, "lantern", completed, 1, 2));

    await thanks(juno, ivo);
    expect(await completionOf(reader, "lantern")).toEqual(await recordedAt(juno, "lantern", completed, 2, 2));
    expect(await pagesCompletedBy(juno), "a second completion was recorded").toEqual([pageCompleted("lantern", 2, false)]);
    expect((await storedCompletions()).filter(({ member }) => member === memberIds.get(juno.user))).toHaveLength(1);
  });

  test("a team leaving posthog.com stays as an unlisted complete page with its name and crest from the record", async () => {
    await onPostHogCom(lantern, zephyr);
    await teamSpiritShipped(true);
    await joined(juno, wren, oriel);
    const reader = await withTheBookOpen(juno);
    const completed = await thanks(juno, wren, oriel);

    await onPostHogCom(zephyr);

    expect(await pageOf(reader, "lantern")).toEqual({
      team: "lantern",
      name: "Lantern",
      art: lanternArt,
      mine: false,
      listed: false,
      leads: [],
      unmatched: 0,
      unmatchedPeople: [],
      people: [],
      ...(await recordedAt(juno, "lantern", completed, 0, 0)),
    });
  });

  test("a redelivered kudosGiven and a retried check record nothing twice", async () => {
    await onPostHogCom(lantern);
    await teamSpiritShipped(true);
    await joined(juno, wren, oriel);
    const reader = await withTheBookOpen(juno);
    await thanks(juno, wren);
    const completed = await given(juno, oriel);
    const [stickers] = await heldBack(stickerJob);
    await runs(stickers!);
    const checks = await heldBack(checkJob);
    for (const check of checks) await runs(check);
    await settle(t);
    const recorded = await storedCompletions();

    await runs(stickers!);
    for (const check of checks) await runs(check);
    await settle(t);

    expect(await completionOf(reader, "lantern")).toEqual(await recordedAt(juno, "lantern", completed, 2));
    expect(await pagesCompletedBy(juno)).toEqual([pageCompleted("lantern", 2, true)]);
    expect(completionLinesTo(juno)).toEqual(["Team complete · Lantern crest earned"]);
    expect(await storedCompletions()).toEqual(recorded);
  });
});

describe("CV33: App Home counts every crest the member holds, by roster or by page, once per slug", { timeout: 60_000 }, () => {
  test("a roster crest and a completed page of the same slug count once, and a completed page with no roster counts too", async () => {
    await onPostHogCom(batchExports, lantern);
    await teamSpiritShipped(true);
    await joined(juno, wren, oriel, tamsin);
    await withTheBookOpen(juno);
    await holds(t, await memberOf(juno), "coffee-run", "waiter");
    await thanks(juno, wren, oriel, tamsin);

    await t.fetch("/slack/events", await signedRequest(appHomeOpened(juno.user)));
    await settle(t);

    expect(publishedHome(slack, juno.user).find((line) => line.startsWith("section: Hoggies:"))).toContain(" · 2 crests · ");
  });
});

describe("CV37: with team-spirit off no check writes anything", { timeout: 60_000 }, () => {
  test("filling a page records no completion and no check, tells nothing, sends no team page completed, and pages answer as stopping point 3", async () => {
    await onPostHogCom(batchExports, lantern);
    await teamSpiritShipped(false);
    await joined(juno, wren, oriel);
    const reader = await withTheBookOpen(juno);
    await thanks(juno, wren, oriel);

    const page = await pageOf(reader, "lantern");
    expect(page).toMatchObject({ held: 2, total: 2, complete: true, crest: null });
    expect(page).not.toHaveProperty("completion");
    expect(await storedCompletions()).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("teamPageChecks").collect())).toEqual([]);
    expect(postHog.productEvents().filter(({ event }) => event === "team page completed")).toEqual([]);
    expect(completionLinesTo(juno)).toEqual([]);
    const exposures = await t.run(async (ctx) => (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flag === "team-spirit"));
    expect(exposures.map(({ value }) => value), "the check didn't decide team-spirit with exposure for each member with a new sticker").toEqual([false, false, false]);
  });
});

describe("CV32: a member completing 60 pages at once stays inside Convex's limits", { timeout: 60_000 }, () => {
  test("the last missing person on 60 pages of the supported size records all 60, 25 per check mutation, told", { timeout: 600_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await teamSpiritShipped(true);
    await joined(juno, wren, zed);
    await thanks(juno, wren);
    const people = [juno, wren, zed, ...(await seededMembers(t, 1_997))];
    await seededCompany(t, people, { teams: 60, size: 100, onEvery: zed });
    await everyoneHeldBy(t, await memberOf(juno), people, { except: [await memberOf(zed)] });
    const reader = await withTheBookOpen(juno);

    const last = await thanks(juno, zed);

    const pages = await pagesOf(reader);
    expect(pages).toHaveLength(60);
    expect(pages.every(({ complete, completion }) => complete && completion?.at === last)).toBe(true);
    expect(await pagesCompletedBy(juno)).toHaveLength(60);
    expect(await checksRun(), "two checks of the first kudos, three pages of 25, 25 and 10 for Juno, and one for Zed").toEqual({ succeeded: 6, failed: 0 });
  });
});

async function checksRun() {
  const checks = await t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter(({ name }) => name === checkJob));
  return { succeeded: checks.filter(({ state }) => state.kind === "success").length, failed: checks.filter(({ state }) => state.kind === "failed").length };
}
