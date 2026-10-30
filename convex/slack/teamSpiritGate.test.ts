import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type FakePostHog, type FlagDefinition, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage as PostHogComTeam } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { withoutExposureOf } from "../../testing/hoggies";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, post, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, section, text, userGroupEvent } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { aSession, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { xpToReach } from "../progression/levels";
import schema from "../schema";
import { teamSpiritFlag, teamSpiritShownTo } from "../stickers/flag";
import { openUnlock } from "../unlocks/unlocks";

const teamSpiritRemoved = vi.hoisted(() => ({ removed: false }));
const teamSpiritExposed = vi.hoisted(() => [] as Array<{ byTeamSpiritAppliesTo: boolean }>);
const teamSpiritApplied = vi.hoisted(() => [] as Array<{ byTheCheck: boolean }>);

vi.mock("../stickers/flag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../stickers/flag")>();
  return {
    ...actual,
    teamSpiritShownTo: vi.fn((...args: Parameters<typeof actual.teamSpiritShownTo>) => (teamSpiritRemoved.removed ? Promise.resolve(false) : actual.teamSpiritShownTo(...args))),
    teamSpiritAppliesTo: vi.fn((...args: Parameters<typeof actual.teamSpiritAppliesTo>) => {
      teamSpiritApplied.push({ byTheCheck: calledFrom(/^handler \(.*convex[\\/]stickers[\\/]completions\.ts/) });
      return teamSpiritRemoved.removed ? Promise.resolve(false) : actual.teamSpiritAppliesTo(...args);
    }),
  };
});

vi.mock("../stickers/completions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../stickers/completions")>();
  return {
    ...actual,
    checkTeamPagesAfter: vi.fn((...args: Parameters<typeof actual.checkTeamPagesAfter>) => (teamSpiritRemoved.removed ? Promise.resolve() : actual.checkTeamPagesAfter(...args))),
  };
});

vi.mock("../analytics/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../analytics/flags")>();
  return {
    ...actual,
    exposed: vi.fn((...args: Parameters<typeof actual.exposed>) => {
      if (args[1].key === "team-spirit") teamSpiritExposed.push({ byTeamSpiritAppliesTo: calledFrom(/teamSpiritAppliesTo \(.*convex[\\/]stickers[\\/]flag\.ts/) });
      return actual.exposed(...args);
    }),
  };
});

vi.mock("../quests/rank", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../quests/rank")>();
  return { ...actual, drawRank: vi.fn((key: string) => actual.drawRank(key.replace(/^[^:]+/, (member) => namedIds.get(member) ?? member))) };
});

vi.mock("../website/seen", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../website/seen")>();
  return { ...actual, seenKeyOf: vi.fn((member: Parameters<typeof actual.seenKeyOf>[0], crate: string) => actual.seenKeyOf((namedIds.get(member) ?? member) as typeof member, namedWithin(crate))) };
});

vi.mock("../album/hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../album/hoggies/draw")>();
  const named = <T extends { member: string; crate: string }>(input: T): T => ({ ...input, member: namedIds.get(input.member) ?? input.member, crate: namedWithin(input.crate) });
  return {
    ...actual,
    drawOf: vi.fn((input: Parameters<typeof actual.drawOf>[0]) => actual.drawOf(named(input))),
    packBonusOf: vi.fn((input: Parameters<typeof actual.packBonusOf>[0]) => actual.packBonusOf(named(input))),
  };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const siteUrl = "https://kudos-site.test";
const teamSpirit = "team-spirit";
const form = { contentType: "application/x-www-form-urlencoded" };
const everyOtherFlag = [
  "xp-levels",
  "unlocks",
  "achievements",
  "collection",
  "crests",
  "crate-store",
  "crate-rewards",
  "coins",
  "store",
  "quests",
  "group-quest",
  "groups",
  "activity",
  "everyone-board",
  "profile-card",
  "hoggie-avatar",
  "message-settings",
  "custom-kudos-emoji",
  "monday-post",
  "skill-tree",
  "sticker-book",
  "team-pages",
  "hugs",
  "book-spread",
  "packs",
];
const theCheck = "stickers/completions:checkTeamPages";
const exposureDelivery = ["analytics/drain:drain", "analytics/drain:recover", "analytics/person:identifyNewPeople"];
const deliveringMore = ["analytics/drain:drain", "analytics/drain:recover"];
const alice = { user: "U_ALICE", name: "Alice Moreau", email: "alice@example.com" };
const bob = { user: "U_BOB", name: "Bob Okafor", email: "bob@example.com" };
const carol = { user: "U_CAROL", name: "Carol Diaz", email: "carol@example.com" };
const dana = { user: "U_DANA", name: "Dana Lindqvist", email: "dana@example.com" };
const members = [alice, bob, carol, dana];
const ants = "S_ANTS";
const erin = { user: "U_ERIN", name: "Erin Castellanos", email: "erin@example.com" };
const teamSpiritText = /"completion"|Team Spirit|All Hands|Tight-Knit|Unbreakable Crew|team pages? completed|Team complete|crest earned|handshake/i;

const aliceProfile = { id: 1, firstName: "Alice", lastName: "Moreau", colour: "blue", cutout: aCutout("alice"), role: "Product Engineer" };
const bobProfile = { id: 2, firstName: "Bob", lastName: "Okafor", colour: "orange", cutout: aCutout("bob"), role: "Team Lead" };
const carolProfile = { id: 3, firstName: "Carol", lastName: "Diaz", colour: "teal", cutout: aCutout("carol") };
const danaProfile = { id: 4, firstName: "Dana", lastName: "Lindqvist", colour: "lilac", cutout: aCutout("dana") };
const patProfile = { id: 5, firstName: "Pat", lastName: "Quill", colour: "green", cutout: aCutout("pat") };
const hedgerow: PostHogComTeam = { slug: "hedgerow", name: "Hedgerow", leads: [2], profiles: [aliceProfile, bobProfile, carolProfile] };
const lantern: PostHogComTeam = { slug: "lantern", name: "Lantern", crest: aCutout("lantern-crest"), leads: [5], profiles: [danaProfile, patProfile] };

type Person = typeof alice;
type TableName = keyof typeof schema.tables;

let slack: FakeSlack;
let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let t: Backend;
let namedIds = new Map<string, string>();
let steps = 0;

beforeEach(() => {
  teamSpiritRemoved.removed = false;
  teamSpiritExposed.length = 0;
  teamSpiritApplied.length = 0;
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  freshFakes();
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const teamSpiritOff: Array<{ condition: string; flag: FlagDefinition[]; turnOff?: () => void }> = [
  { condition: "with team-spirit off", flag: [offForEveryone(teamSpirit)] },
  { condition: "while PostHog has no team-spirit flag", flag: [] },
  { condition: "without the flags key, even when PostHog turned team-spirit on", flag: [onForEveryone(teamSpirit)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "") },
  { condition: "in production, while team-spirit is on in the sandbox and for the product owner's email only", flag: [asTheShipCreatesIt()], turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production") },
];

describe("CV37 CV38: Team Spirit is dark where team-spirit is off, shows only to the members it is on for, keeps what it hid, and only the check exposes it", { timeout: 180_000 }, () => {
  test.each(teamSpiritOff)("$condition, a walk of kudos that fills team pages, App Home and every website read leaves what the same walk leaves without Team Spirit, apart from the check's jobs and the flag's exposure", async ({ flag, turnOff }) => {
    teamSpiritRemoved.removed = true;
    const withoutTeamSpirit = await walkIn(await everyoneInTheWorkspace(flag, { turnOff }));
    freshFakes();
    teamSpiritRemoved.removed = false;

    const walk = await walkIn(await everyoneInTheWorkspace(flag, { turnOff }));

    expect(walk.seen, "the walk with team-spirit off against the walk without Team Spirit").toEqual(withoutTeamSpirit.seen);
    expect(walk.checks, "a check scheduled for each member at each new sticker").toEqual(Object.fromEntries(members.map(({ user }) => [`<member ${user}>`, expect.any(Number)])));
    expect(leftAfterRemoving(withoutTeamSpirit.deliveryJobs, walk.deliveryJobs).filter(({ name }) => !deliveringMore.includes(name))).toEqual([]);
    expect(leftAfterRemoving(walk.deliveryJobs, withoutTeamSpirit.deliveryJobs).every(({ name }) => deliveringMore.includes(name))).toBe(true);
    expect(JSON.stringify(walk.seen), "nothing of Team Spirit in any answer, App Home, Slack call, event or row").not.toMatch(teamSpiritText);
    expect(onlyTheCheckExposes(), "team-spirit exposed only through teamSpiritAppliesTo, and that only from the check").toEqual({ exposedOutside: 0, appliedOutside: 0 });
    expect(await decidedWithoutTheWebsite(dana)).toBe(false);
  });

  test("with team-spirit on, the same walk records the filled pages, tells the later ones privately under their kudos, and shows completions and Team Spirit in the Book", async () => {
    const walk = await walkIn(await everyoneInTheWorkspace([onForEveryone(teamSpirit)]));
    const { answers } = walk.seen;

    expect(completionsOn(answers.U_ALICE!.collection)).toEqual(["hedgerow", "lantern"]);
    expect(completionsOn(answers.U_CAROL!.collection)).toEqual(["lantern"]);
    expect(completionsOn(answers.U_BOB!.collection)).toEqual([]);
    expect(JSON.stringify(answers.U_ALICE!.book)).toMatch(/All Hands/);
    expect(tierItemsIn(answers.U_ALICE!.profile)).toContain("kudos-emoji-handshake");
    expect(walk.seen.cards["U_DANA sees U_ALICE"]).toMatch(/All Hands/);
    expect(orderFree((walk.seen.tables.teamPageCompletions ?? []).map(({ member, team, told }) => ({ member, team, told })))).toEqual([
      { member: "<member U_ALICE>", team: "hedgerow", told: false },
      { member: "<member U_ALICE>", team: "lantern", told: true },
      { member: "<member U_CAROL>", team: "lantern", told: true },
    ]);
    expect(completionLinesTo(alice)).toEqual(["Team complete · Lantern crest earned"]);
    expect(completionLinesTo(carol)).toEqual(["Team complete · Lantern crest earned"]);
    expect(publicLinesNamingTeamSpirit()).toEqual([]);
  });

  test("with team-spirit on for one member's email only, only that member's answers, Slack calls, events and rows change", async () => {
    const off = await walkIn(await everyoneInTheWorkspace([offForEveryone(teamSpirit)]));
    const offIds = namedIds;
    freshFakes();

    const onForAlice = await walkIn(await everyoneInTheWorkspace([onForEmails(teamSpirit, alice.email)]));

    expect(onForAlice.seen.answers.U_ALICE).not.toEqual(off.seen.answers.U_ALICE);
    expect(completionsOn(onForAlice.seen.answers.U_ALICE!.collection)).toEqual(["hedgerow", "lantern"]);
    expect(withoutTheAnswersOf(alice, onForAlice.seen, namedIds)).toEqual(withoutTheAnswersOf(alice, off.seen, offIds));
  });

  test("turned off after completions it keeps them and their tiers but hides them, and turned on again shows them as they were and tells nothing twice", async () => {
    await everyoneInTheWorkspace([onForEveryone(teamSpirit)]);
    namedIds = await idsNamedByTheirMember();
    for (const { user } of members) await openHome(user);
    await kudosOfTheWalk();
    for (const { user } of members) await openHome(user);
    const whileOn = { answers: await everyonesAnswers(), kept: await keptRows(), inSlack: await homesAndCards() };

    await flagsWith([offForEveryone(teamSpirit)]);
    await thanks(bob, "Thanks for the steady hand on the on-call handover", dana);
    for (const { user } of members) await openHome(user);
    const whileOff = { answers: await everyonesAnswers(), kept: await keptRows(), inSlack: await homesAndCards() };

    await flagsWith([onForEveryone(teamSpirit)]);
    for (const { user } of members) await openHome(user);
    const onAgain = { answers: await everyonesAnswers(), kept: await keptRows() };
    await thanks(bob, "Thanks for untangling the release notes with me", carol);
    const afterTheNextSticker = { answers: await everyonesAnswers(), kept: await keptRows() };

    await joins(erin);
    await thanksUntilItsNoticeWaits(dana, "Thanks for the warm welcome note", erin);
    await flagsWith([offForEveryone(teamSpirit)]);
    await settleInTimeOrder(t);
    const deliveredWhileOff = await keptRows();
    await flagsWith([onForEveryone(teamSpirit)]);
    await openHome(dana.user);

    expect(whileOff.kept, "completions, checks and tiers kept while off").toEqual(whileOn.kept);
    expect(ownedHandshakes(whileOff.answers), "an earned handshake stays in its earner's inventory (d-58192288)").toEqual(["U_ALICE"]);
    expect(JSON.stringify(withoutTheOwnedHandshake(whileOff.answers)), "nothing else of Team Spirit shown while off").not.toMatch(teamSpiritText);
    expect(JSON.stringify(whileOff.inSlack), "nothing of Team Spirit in App Home or a profile card while off").not.toMatch(teamSpiritText);
    expect(crestCountsIn(whileOff.inSlack.homes), "App Home counts no crest of a completed page while off").toEqual({ U_ALICE: 0, U_BOB: 0, U_CAROL: 0, U_DANA: 0 });
    expect(crestCountsIn(whileOn.inSlack.homes), "the positive control counts them while on").toEqual({ U_ALICE: 2, U_BOB: 0, U_CAROL: 1, U_DANA: 0 });
    expect(whileOn.inSlack.cards["U_DANA sees U_ALICE"]).toMatch(/All Hands/);
    expect(onAgain.kept).toEqual(whileOn.kept);
    expect(teamSpiritIn(whileOn.answers), "the positive control shows Team Spirit while on").toMatchObject({ U_ALICE: { ladder: { count: 2 } }, U_CAROL: { ladder: { count: 1 } } });
    expect(teamSpiritIn(whileOff.answers), "nothing of Team Spirit while off").toEqual(Object.fromEntries(members.map(({ user }) => [user, { completed: [], ladder: null }])));
    expect(JSON.stringify(teamSpiritIn(whileOff.answers))).not.toMatch(/"completion"/);
    expect(crestsOnPages(whileOff.answers), "no page carries an earned crest while off; nobody holds a roster crest").toEqual(Object.fromEntries(members.map(({ user }) => [user, []])));
    expect(crestsOnPages(whileOn.answers), "the positive control: pages carry the earned crests while on").toEqual({ U_ALICE: ["hedgerow", "lantern"], U_BOB: [], U_CAROL: ["lantern"], U_DANA: [] });
    expect(teamSpiritIn(onAgain.answers), "on again shows what was shown before it was turned off").toEqual(teamSpiritIn(whileOn.answers));
    expect(completionsOn(afterTheNextSticker.answers.U_BOB!.collection), "pages filled while off are recorded at the next new sticker").toEqual(["hedgerow", "lantern"]);
    expect(completionLinesTo(alice), "each completion told once").toEqual(["Team complete · Lantern crest earned"]);
    expect(completionLinesTo(carol).toSorted(), "each completion told once").toEqual(["Team complete · Hedgerow crest earned", "Team complete · Lantern crest earned"]);
    expect(completionLinesTo(bob).toSorted(), "each completion told once").toEqual(["Team complete · Hedgerow crest earned", "Team complete · Lantern crest earned"]);
    expect(Object.fromEntries(members.map((member) => [member.user, tierLinesToldTo(member)])), "each Team Spirit tier told once").toEqual({
      U_ALICE: ["You earned All Hands (Team Spirit, silver)."],
      U_BOB: ["You earned All Hands (Team Spirit, silver).", "You earned Team Spirit (Team Spirit, bronze)."],
      U_CAROL: ["You earned All Hands (Team Spirit, silver).", "You earned Team Spirit (Team Spirit, bronze)."],
      U_DANA: [],
    });
    expect(orderFree(deliveredWhileOff.completions.map(({ member, team, told }) => ({ member, team, told }))), "the completion recorded under the held notice").toContainEqual({ member: "<member U_DANA>", team: "hedgerow", told: true });
    expect(completionLinesTo(dana), "a notice that waited past the flag turning off tells nothing, then or later").toEqual([]);
    const checkedWhileOff = [bob, dana];
    expect(teamSpiritExposures(), "once per member and value: false only for those checked while off").toEqual(Object.fromEntries(await Promise.all([...members, erin].map(async (member) => [await analyticsIdOf(member), checkedWhileOff.includes(member) ? [true, false] : [true]]))));
  });

  test("team-spirit's exposure goes once per member and value, only from the check, never from App Home, a kudos mutation or a website read", async () => {
    const walk = await walkIn(await everyoneInTheWorkspace([onForEveryone(teamSpirit)]));
    for (const member of members) await onTheWebsite(member);
    for (const { user } of members) await openHome(user);
    await settleInTimeOrder(t);

    expect(walk.checks).toEqual(Object.fromEntries(members.map(({ user }) => [`<member ${user}>`, expect.any(Number)])));
    expect(teamSpiritExposures()).toEqual(Object.fromEntries(await Promise.all(members.map(async (member) => [await analyticsIdOf(member), [true]]))));
    expect(teamSpiritExposed.length, "the check exposes team-spirit at each new sticker").toBeGreaterThan(members.length);
    expect(onlyTheCheckExposes(), "team-spirit exposed only through teamSpiritAppliesTo, and that only from the check").toEqual({ exposedOutside: 0, appliedOutside: 0 });
  });
});

async function homesAndCards() {
  return { homes: Object.fromEntries(members.map(({ user }) => [user, publishedHome(slack, user)])), cards: await cardsInSlack() };
}

function crestCountsIn(homes: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(homes).map(([user, home]) => [user, Number(/(\d+) crests? ·/.exec(JSON.stringify(home))?.[1] ?? Number.NaN)]));
}

async function joins(person: Person) {
  slack.withMember(person.user, { is_admin: false, profile: { display_name: person.name, real_name: person.name, email: person.email } });
  nextStep();
  await memberChanged(t, "team_join", { id: person.user, is_admin: false, profile: { display_name: person.name, real_name: person.name, email: person.email } });
  await settleInTimeOrder(t);
  namedIds.set(await memberOf(person), `<member ${person.user}>`);
}

const deliverDirectMessage = "slack/directMessages:deliverDirectMessage";

async function thanksUntilItsNoticeWaits(giver: Person, why: string, ...recipients: Person[]) {
  nextStep();
  await post(t, [section(text(`${why} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(steps).padStart(6, "0")}` });
  for (let fired = 0; fired < 200; fired += 1) {
    await t.finishInProgressScheduledFunctions();
    if (await aTierNoticeWaitsFor(giver)) return;
    if (vi.getTimerCount() === 0) throw new Error(`no tier notice waited for ${giver.user}`);
    vi.advanceTimersToNextTimer();
  }
  throw new Error("thanksUntilItsNoticeWaits: more than 200 timers fired");
}

async function aTierNoticeWaitsFor(person: Person) {
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return scheduled.some(({ name, args, state }) => {
    const [delivery] = args as Array<{ user?: string; notification?: { kind?: string } }>;
    return name === deliverDirectMessage && state.kind === "pending" && delivery?.user === person.user && delivery.notification?.kind === "tiers-earned";
  });
}

function calledFrom(caller: RegExp) {
  const frames = (new Error().stack ?? "").split("\n").slice(1).map((frame) => frame.trim().replace(/^at /, ""));
  const callerFrame = frames.find((frame) => !frame.includes("teamSpiritGate.test.ts") && !frame.includes("node_modules"));
  return caller.test(callerFrame ?? "");
}

function onlyTheCheckExposes() {
  return { exposedOutside: teamSpiritExposed.filter(({ byTeamSpiritAppliesTo }) => !byTeamSpiritAppliesTo).length, appliedOutside: teamSpiritApplied.filter(({ byTheCheck }) => !byTheCheck).length };
}

function asTheShipCreatesIt(): FlagDefinition {
  return {
    key: teamSpirit,
    filters: {
      groups: [
        { properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 },
        { properties: [{ key: "email", type: "person", value: ["product-owner@example.com"], operator: "exact" }], rollout_percentage: 100 },
      ],
    },
  };
}

async function everyoneInTheWorkspace(flag: FlagDefinition[], { turnOff }: { turnOff?: () => void } = {}): Promise<Backend> {
  vi.useFakeTimers({ now: tuesday });
  spotlightPositionsFromTheStart();
  steps = 0;
  namedIds = new Map();
  t = await flagsFromPostHog(testBackend(), postHog, ...everyOtherFlag.map(onForEveryone), onForEveryone("website"), ...flag);
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await journeyShippedBeforeAnyoneJoined(t);
  await bookShippedBeforeAnyoneJoined(t);
  for (const person of members) {
    await memberChanged(t, "team_join", { id: person.user, is_admin: person === alice, profile: { display_name: person.name, real_name: person.name, email: person.email } });
    await settleInTimeOrder(t);
    const member = await memberOf(person);
    namedIds.set(member, `<member ${person.user}>`);
    await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: xpToReach(6), pointsSpent: 0 }));
    for (const level of [4, 5, 6]) await reachesLevel(t, member, level);
    for (const feature of ["book", "leaderboard", "quests", "skillTree", "coins"] as const) await t.run((ctx) => openUnlock(ctx, member, feature, "slack"));
  }
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_created", ants)));
  await settleInTimeOrder(t);
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  turnOff?.();
  return t;
}

async function flagsWith(flag: FlagDefinition[]) {
  await flagsFromPostHog(t, postHog, ...everyOtherFlag.map(onForEveryone), onForEveryone("website"), ...flag);
}

async function walkIn(backend: Backend) {
  t = backend;
  namedIds = await idsNamedByTheirMember();
  for (const { user } of members) await openHome(user);
  await kudosOfTheWalk();
  for (const { user } of members) await openHome(user);
  const cards = await cardsInSlack();
  const answers = await everyonesAnswers();
  const seen = {
    cards,
    homes: Object.fromEntries(members.map(({ user }) => [user, publishedHome(slack, user)])),
    answers,
    slackCallsTo: Object.fromEntries(members.map(({ user }) => [user, slackCallsAbout(user)])),
    slackCalls: slack.calls.map((call) => JSON.stringify(call)).sort(),
    postHogEvents: orderFree(withStableIds(postHog.events().filter(({ properties }) => properties.$feature_flag !== teamSpirit).map(({ event, distinct_id, properties }) => ({ event, distinct_id, properties })))),
    tables: await rowsWritten(),
    jobs: await jobsInContentOrder({ delivering: false }),
  };
  const deliveryJobs = (await jobsInContentOrder({ delivering: true, checks: true })).map(({ name, state }) => ({ name, state }));
  return { seen, deliveryJobs, checks: await checksScheduled() };
}

async function kudosOfTheWalk() {
  await thanks(alice, "Thanks for the calm rollback of the billing service", bob, carol);
  await thanks(bob, "Thanks for reviewing the incident write-up so quickly", alice);
  await thanks(carol, "Thanks for pairing on the flaky deploy", dana);
  await thanks(dana, "ty", alice);
}

async function everyonesAnswers() {
  const answers: Record<string, Awaited<ReturnType<typeof onTheWebsite>>> = {};
  for (const member of members) answers[member.user] = await onTheWebsite(member);
  return answers;
}

async function decidedWithoutTheWebsite(person: Person) {
  const member = await memberOf(person);
  return t.run(async (ctx) => {
    const decided = await teamSpiritShownTo(ctx, member);
    expect(teamSpiritFlag.safeDefault).toBe(decided);
    return decided;
  });
}

async function onTheWebsite(person: Person) {
  nextStep();
  const asSignedIn = await signedIn(person);
  const read = async <T>(answer: Promise<T>) => withStableIds(await answer);
  return {
    collection: await read(asSignedIn.query(api.website.collection.getCollection, {})),
    book: await read(asSignedIn.query(api.website.book.getBook, {})),
    profile: await read(asSignedIn.query(api.website.profile.getMyProfile, {})),
    card: await read(asSignedIn.query(api.website.profileCard.getProfileCard, {})),
    quests: await read(asSignedIn.query(api.website.quests.getQuests, {})),
    settings: await read(asSignedIn.query(api.website.settings.getSettings, {})),
    skillTree: await read(asSignedIn.query(api.website.skillTree.getSkillTree, {})),
    activity: await read(asSignedIn.query(api.website.activity.getActivity, { filter: "all", cursor: null })),
    recentKudos: await read(asSignedIn.query(api.website.activity.getRecentKudos, { direction: "received" })),
    spotlight: await read(asSignedIn.query(api.website.activity.getSpotlight, { seed: 0 })),
    leaderboard: await read(asSignedIn.query(api.website.leaderboard.getLeaderboard, { period: "week" })),
    groupBoards: await read(asSignedIn.query(api.website.groupBoards.getGroupBoards, { period: "week" })),
    frontDoor: await read(t.query(internal.website.link.frontDoorLinksOf, { workspace: "T1", user: person.user })),
  };
}

async function cardsInSlack() {
  const cards: Record<string, string> = {};
  for (const [at, viewer] of members.entries()) {
    const owner = members[(at + 1) % members.length]!;
    nextStep();
    const body = new URLSearchParams({ team_id: "T1", channel_id: "C1", channel_name: "general", user_id: viewer.user, command: "/hedgehug", text: `<@${owner.user}>`, response_url: "https://hooks.slack.test/commands/1", trigger_id: "1.2.3" }).toString();
    const response = await t.fetch("/slack/commands", await signedRequest(body, form));
    cards[`${viewer.user} sees ${owner.user}`] = await response.text();
    await settleInTimeOrder(t);
  }
  return cards;
}

function teamSpiritIn(answers: Answers) {
  const shown = (answer: Awaited<ReturnType<typeof onTheWebsite>>) => {
    const { teams = [] } = answer.collection as { teams?: Array<{ team: string; complete: boolean; crest: unknown; completion?: unknown }> };
    const { ladders = [] } = answer.book as { ladders?: Array<{ ladder: string }> };
    const completed = teams.filter(({ completion }) => completion !== undefined && completion !== null);
    return { completed: completed.map(({ team, complete, crest, completion }) => ({ team, complete, crest, completion })), ladder: ladders.find(({ ladder }) => ladder === teamSpirit) ?? null };
  };
  return Object.fromEntries(Object.entries(answers).map(([user, answer]) => [user, shown(answer)]));
}

type Answers = Record<string, Awaited<ReturnType<typeof onTheWebsite>>>;
type InventoryEntry = { item: string };
const handshake = "kudos-emoji-handshake";

function ownedHandshakes(answers: Answers) {
  return Object.entries(answers)
    .filter(([, { profile }]) => (inventoryIn(profile)?.owned ?? []).some(({ item }) => item === handshake))
    .map(([user]) => user);
}

function withoutTheOwnedHandshake(answers: Answers): Answers {
  const withoutIt = (entries: InventoryEntry[]) => entries.filter(({ item }) => item !== handshake);
  const owners = ownedHandshakes(answers);
  return Object.fromEntries(
    Object.entries(answers).map(([user, answer]) => {
      const inventory = inventoryIn(answer.profile);
      if (inventory === null || !owners.includes(user)) return [user, answer];
      return [user, { ...answer, profile: { ...(answer.profile as object), inventory: { ...inventory, owned: withoutIt(inventory.owned), catalogue: withoutIt(inventory.catalogue) } } }];
    }),
  ) as Answers;
}

function inventoryIn(profile: unknown) {
  const { inventory = null } = profile as { inventory?: { owned: InventoryEntry[]; catalogue: InventoryEntry[] } | null };
  return inventory;
}

function tierItemsIn(profile: unknown) {
  const { inventory } = profile as { inventory?: { catalogue: Array<{ item: string; source: { kind: string } }> } | null };
  if (inventory === undefined || inventory === null) throw new Error(`expected an inventory, got ${JSON.stringify(profile)}`);
  return inventory.catalogue.filter(({ source }) => source.kind === "tier").map(({ item }) => item);
}

function crestsOnPages(answers: Answers) {
  const crested = (collection: unknown) => {
    const { teams = [] } = collection as { teams?: Array<{ team: string; crest: unknown }> };
    return teams.filter(({ crest }) => crest !== null && crest !== undefined).map(({ team }) => team).toSorted();
  };
  return Object.fromEntries(Object.entries(answers).map(([user, { collection }]) => [user, crested(collection)]));
}

function completionsOn(collection: unknown) {
  const { teams = [] } = collection as { teams?: Array<{ team: string; completion?: unknown }> };
  return teams.filter(({ completion }) => completion !== undefined && completion !== null).map(({ team }) => team).toSorted();
}

function linesOf(call: { method: string; args?: Record<string, unknown> }) {
  return JSON.stringify(call.args ?? {})
    .split(/\\n|"/)
    .filter((line) => /Team complete/.test(line));
}

function completionLinesTo(person: Person) {
  return slack.calls.filter((call) => isPrivateTo(person, call)).flatMap(linesOf);
}

function isPrivateTo(person: Person, { method, args = {} }: { method: string; args?: Record<string, unknown> }) {
  return (method === "chat.postMessage" || method === "chat.postEphemeral") && (args.channel === person.user || args.user === person.user || String(args.channel ?? "").startsWith("D"));
}

function publicLinesNamingTeamSpirit() {
  return slack.calls.filter(({ method, args = {} }) => method === "chat.postMessage" && typeof args.thread_ts === "string" && /Team Spirit|Team complete/.test(JSON.stringify(args)));
}

function tierLinesToldTo(person: Person) {
  const told = slack.calls.filter((call) => isPrivateTo(person, call)).flatMap((call) => JSON.stringify(call.args ?? {}).match(/[\w -]+ \(Team Spirit, \w+\)\./g) ?? []);
  return told.map((line) => line.trim()).toSorted();
}

type Seen = Awaited<ReturnType<typeof walkIn>>["seen"];

function withoutTheAnswersOf(person: Person, seen: Seen, named: Map<string, string>) {
  const { [person.user]: _answers, ...answers } = seen.answers;
  const { [person.user]: _home, ...homes } = seen.homes;
  const { [person.user]: _calls, ...slackCallsTo } = seen.slackCallsTo;
  const slackCalls = seen.slackCalls.filter((call) => !addresses(person, JSON.parse(call) as { args?: Record<string, unknown> }));
  const theirs = new Set([...named.values()].filter((name) => name.endsWith(` ${person.user}>`)).concat(person.user));
  const notAbout = (row: unknown) => !ownedBy(theirs, row);
  const tables = Object.fromEntries(Object.entries(seen.tables).map(([table, rows]) => [table, rows.filter(notAbout)]));
  return { ...seen, answers, homes, slackCallsTo, slackCalls, tables, postHogEvents: seen.postHogEvents.filter(notAbout), jobs: seen.jobs.filter(notAbout) };
}

const ownershipFields = ["member", "user", "distinct_id", "owner"];

function ownedBy(theirs: Set<string>, row: unknown): boolean {
  if (row === null || typeof row !== "object") return false;
  const record = row as Record<string, unknown>;
  if (ownershipFields.some((field) => typeof record[field] === "string" && theirs.has(record[field]))) return true;
  return ["args", "event", "subject", "check", "properties"].some((nested) => {
    const inside = record[nested];
    return Array.isArray(inside) ? inside.some((each) => ownedBy(theirs, each)) : ownedBy(theirs, inside);
  });
}

function addresses(person: Person, { args = {} }: { args?: Record<string, unknown> }) {
  return [args.user_id, args.user, args.channel].includes(person.user);
}

async function signedIn(person: Person) {
  const identity = { user: person.user, name: person.name };
  const { asSignedIn } = await aSignedInSession(t, identity).catch(() => aSession(t, identity));
  return asSignedIn;
}

function teamSpiritExposures() {
  const exposures = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === teamSpirit);
  const asPostHogKeepsThem = new Map(exposures.map((exposure) => [exposure.uuid, exposure]));
  const byMember: Record<string, unknown[]> = {};
  for (const { distinct_id, properties } of asPostHogKeepsThem.values()) (byMember[distinct_id] ??= []).push(properties.$feature_flag_response);
  return byMember;
}

async function keptRows() {
  const kept = await t.run(async (ctx) => ({
    completions: await ctx.db.query("teamPageCompletions").collect(),
    checks: await ctx.db.query("teamPageChecks").collect(),
    tiers: (await ctx.db.query("earnedTiers").collect()).filter(({ ladder }) => ladder === teamSpirit),
  }));
  return withStableIds(kept);
}

async function checksScheduled() {
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  const byMember: Record<string, number> = {};
  for (const { name, args } of scheduled) {
    if (name !== theCheck) continue;
    const member = namedIds.get((args[0] as { check: { member: string } }).check.member) ?? "an unnamed member";
    byMember[member] = (byMember[member] ?? 0) + 1;
  }
  return byMember;
}

function orderFree<T>(rows: T[]): T[] {
  return rows.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

const convexTestId = /^\d+[a-zA-Z_]+$/;
const keyedId = /^([a-z-]+):(\d+[a-zA-Z_]+)$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const createdInTheSameMillisecond = /(\d{13})\.\d+$/;
const opaque = new Set(["cursor", "eventId"]);

function withStableIds<T>(value: T): T {
  const seen = new Map<string, string>();
  const stable = (kind: string, id: string) => seen.get(id) ?? seen.set(id, `<${kind} ${seen.size + 1}>`).get(id)!;
  return JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? `${field}n` : field)), (key, field) => {
    if (key === "_id" || key === "_creationTime" || key === "uuid" || key === "fact") return undefined;
    if (opaque.has(key) && typeof field === "string") return stable(key, field);
    if (typeof field !== "string") return field;
    if (namedIds.has(field)) return namedIds.get(field);
    if (namedWithin(field) !== field) return namedWithin(field);
    if (createdInTheSameMillisecond.test(field)) return field.replace(createdInTheSameMillisecond, "$1.<tie>");
    if (keyedId.test(field)) return field.replace(keyedId, (_, kind: string, id: string) => `${kind}:${stable("document", id)}`);
    if (convexTestId.test(field)) return stable("document", field);
    return uuid.test(field) ? stable("uuid", field) : field;
  });
}

function namedWithin(text: string) {
  let named = text;
  for (const [id, name] of namedIds) named = named.replaceAll(id, name);
  return named;
}

async function rowsWritten() {
  const tables = await t.run(async (ctx) => {
    const rows = {} as Record<TableName, Record<string, unknown>[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) if (table !== "recordedFacts") rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  const written = withoutExposureOf(teamSpirit, tables);
  const inContentOrder = Object.fromEntries(Object.entries(written).map(([table, rows]) => [table, rows.toSorted((a, b) => contentOf(a).localeCompare(contentOf(b)))]));
  return withStableIds(inContentOrder);
}

async function jobsInContentOrder({ delivering, checks = false }: { delivering: boolean; checks?: boolean }) {
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  const jobs = scheduled.filter(({ name }) => name !== theCheck || checks).filter(({ name }) => delivering === exposureDelivery.includes(name)).map(({ name, args, scheduledTime, state }) => ({ name, args, scheduledTime, state: state.kind }));
  return withStableIds(jobs.toSorted((a, b) => contentOf(a).localeCompare(contentOf(b))));
}

function leftAfterRemoving<T>(rows: T[], removed: T[]): T[] {
  const left = rows.map((row) => JSON.stringify(row));
  for (const row of removed.map((each) => JSON.stringify(each))) {
    const at = left.indexOf(row);
    if (at !== -1) left.splice(at, 1);
  }
  return left.map((row) => JSON.parse(row) as T);
}

function contentOf(row: Record<string, unknown>) {
  return JSON.stringify(withStableIds(row), (key, field) => (opaque.has(key) || convexTestId.test(String(field)) ? undefined : field));
}

async function idsNamedByTheirMember() {
  const named = new Map<string, string>();
  for (const person of members) {
    const member = await memberOf(person);
    named.set(member, `<member ${person.user}>`);
    const analytics = await t.run((ctx) =>
      ctx.db
        .query("analyticsIds")
        .withIndex("by_member", (q) => q.eq("member", member))
        .unique(),
    );
    if (analytics !== null) named.set(analytics.analyticsId, `<analytics ID of ${person.user}>`);
  }
  return named;
}

function slackCallsAbout(user: string) {
  return slack.calls
    .filter((call) => JSON.stringify(call).includes(user))
    .map((call) => JSON.stringify(call))
    .sort();
}

function spotlightPositionsFromTheStart() {
  let drawn = 0;
  vi.spyOn(Math, "random").mockImplementation(() => ((drawn += 1) * 0.618_033_988_7) % 1);
}

function nextStep() {
  steps += 1;
  vi.setSystemTime(tuesday + steps * minuteMs);
}

async function thanks(giver: Person, why: string, ...recipients: Person[]) {
  nextStep();
  await post(t, [section(text(`${why} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(steps).padStart(6, "0")}` });
  await settleInTimeOrder(t);
}

async function openHome(user: string) {
  nextStep();
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleInTimeOrder(t);
}

async function memberOf(person: Person) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  return row!._id;
}

async function analyticsIdOf(person: Person) {
  const member = await memberOf(person);
  const row = await t.run((ctx) =>
    ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique(),
  );
  return row!.analyticsId;
}

function freshFakes() {
  slack = new FakeSlack();
  for (const person of members) slack.withMember(person.user, { is_admin: person === alice, profile: { display_name: person.name, real_name: person.name, email: person.email } });
  slack.withUserGroup(ants, { name: "Ants", users: [alice.user, carol.user] });
  postHog = postHogDeciding();
  postHogCom = new FakePostHogCom().withTeams(hedgerow, lantern);
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(urlOf(input)) ? postHogCom.fetch(input) : slack.fetch(input, init))));
}

function urlOf(input: string | URL | Request) {
  return new URL(input instanceof Request ? input.url : input);
}
