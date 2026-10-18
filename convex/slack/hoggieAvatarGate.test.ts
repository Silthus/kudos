import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type FakePostHog, type FlagDefinition, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { holds, withoutExposureOf } from "../../testing/hoggies";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, publishedHome, staleMenuOptionOf } from "../../testing/slackInteractions";
import { appHomeOpened, slashCommandResponseUrl } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { aSession, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { xpToReach } from "../progression/levels";
import schema from "../schema";
import { openUnlock } from "../unlocks/unlocks";

const theAvatar = vi.hoisted(() => ({ removed: false }));

vi.mock("../hoggies/flag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/flag")>();
  return {
    ...actual,
    avatarShownTo: vi.fn((...args: Parameters<typeof actual.avatarShownTo>) => (theAvatar.removed ? Promise.resolve(false) : actual.avatarShownTo(...args))),
    avatarOpenFor: vi.fn((...args: Parameters<typeof actual.avatarOpenFor>) => (theAvatar.removed ? Promise.resolve(false) : actual.avatarOpenFor(...args))),
  };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const siteUrl = "https://kudos-site.test";
const form = { contentType: "application/x-www-form-urlencoded" };
const hoggieAvatar = "hoggie-avatar";
const everyOtherFlag = ["xp-levels", "unlocks", "achievements", "profile-card", "collection"];
const alice = { user: "U_ALICE", name: "Alice Moreau", email: "alice@example.com" };
const bob = { user: "U_BOB", name: "Bob Okafor", email: "bob@example.com" };
const members = [alice, bob];

type Person = typeof alice;

let slack: FakeSlack;
let postHog: FakePostHog;
let t: Backend;
let avatarFlag: FlagDefinition[] = [];
let namedIds = new Map<string, string>();
let steps = 0;

beforeEach(() => {
  theAvatar.removed = false;
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

const avatarOff: Array<{ condition: string; flag: FlagDefinition[]; turnOff?: () => void }> = [
  { condition: "with hoggie-avatar off", flag: [offForEveryone(hoggieAvatar)] },
  { condition: "while PostHog has no hoggie-avatar flag", flag: [] },
  { condition: "without the flags key, even when PostHog turned hoggie-avatar on", flag: [onForEveryone(hoggieAvatar)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "") },
  { condition: "in production, while hoggie-avatar is on in the sandbox and for the product owner's email only", flag: [asTheShipCreatesIt()], turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production") },
];

describe("HA3: the avatar is dark where hoggie-avatar is off, shows only to and for the members it is on for, and only a set exposes it", { timeout: 120_000 }, () => {
  test.each(avatarOff)("$condition, a walk setting avatars in Slack and on the website leaves what the same walk leaves without avatars, apart from the flag's own exposure", async ({ flag, turnOff }) => {
    theAvatar.removed = true;
    const withoutAvatars = await walkIn(await aliceAndBobHoldingHoggies(flag, turnOff));
    freshFakes();
    theAvatar.removed = false;

    const walk = await walkIn(await aliceAndBobHoldingHoggies(flag, turnOff));

    expect(walk).toEqual(withoutAvatars);
    expect(JSON.stringify([walk.answers, walk.homes, walk.cards])).not.toMatch(/avatar/i);
  });

  test("with hoggie-avatar on, the same walk sets each member's avatar in Slack and on the website and shows it on every surface", async () => {
    const walk = await walkIn(await aliceAndBobHoldingHoggies([onForEveryone(hoggieAvatar)]));

    for (const { user } of members) {
      expect(walk.answers[user]!.sets).toEqual([{ kind: "set", avatar: expect.objectContaining({ hoggie: "banana" }) }, { kind: "set", avatar: null }, { kind: "set", avatar: expect.objectContaining({ hoggie: "banana" }) }]);
      expect(walk.answers[user]!.profile).toMatchObject({ avatar: { hoggie: "banana" } });
      expect(walk.answers[user]!.card).toMatchObject({ avatar: { hoggie: "banana" } });
      expect(walk.homes.inSlack[user]!.join("\n")).toContain("Avatar: Rocket (🟧 Legendary)");
      expect(walk.homes.frontDoor[user]!).toContain("section: Avatar: Banana (⬜ Common) [select: Banana (⬜ Common)]");
    }
    expect(walk.cards.inSlack).toEqual([`*<@${bob.user}>*\nAvatar: Rocket (🟧 Legendary)\nLevel 4`, `*<@${alice.user}>*\nAvatar: Rocket (🟧 Legendary)\nLevel 4`]);
    expect(walk.tables.hoggieAvatars.map(({ member, hoggie }) => ({ member, hoggie }))).toEqual([
      { member: "<member U_ALICE>", hoggie: "banana" },
      { member: "<member U_BOB>", hoggie: "banana" },
    ]);
  });

  test("with hoggie-avatar on for one member's email only, only that member sets and shows an avatar, and every other member's Slack calls and reads equal those with it off", async () => {
    const off = await walkIn(await aliceAndBobHoldingHoggies([offForEveryone(hoggieAvatar)]));
    freshFakes();

    const onForAlice = await walkIn(await aliceAndBobHoldingHoggies([onForEmails(hoggieAvatar, alice.email)]));

    expect(onForAlice.homes.inSlack.U_BOB).toEqual(off.homes.inSlack.U_BOB);
    expect(onForAlice.homes.frontDoor.U_BOB).toEqual(off.homes.frontDoor.U_BOB);
    expect(onForAlice.answers.U_BOB).toEqual(off.answers.U_BOB);
    expect(onForAlice.cards.seenBy.U_BOB).toEqual(off.cards.seenBy.U_BOB);
    expect(onForAlice.slackCallsTo.U_BOB).toEqual(off.slackCallsTo.U_BOB);
    expect(onForAlice.answers.U_ALICE).not.toEqual(off.answers.U_ALICE);
    expect(onForAlice.tables.hoggieAvatars.map(({ member }) => member)).toEqual(["<member U_ALICE>"]);
  });

  test("hoggie-avatar's exposure is sent once per member and value, only by a set in Slack or on the website, never by App Home, a card or a website read", async () => {
    await aliceAndBobHoldingHoggies([onForEveryone(hoggieAvatar)]);
    namedIds = await idsNamedByTheirMember();
    for (const member of members) {
      await openHome(member.user);
      await card(member.user, member.user);
      await serveTheWebsite(true);
      const asSignedIn = await signedIn(member);
      await asSignedIn.query(api.website.profile.getMyProfile, {});
      await asSignedIn.query(api.website.profileCard.getProfileCard, {});
      await serveTheWebsite(false);
    }
    await settleInTimeOrder(t);
    expect(avatarExposures()).toEqual({});

    await pickInSlack(alice.user, "rocket");
    await pickInSlack(alice.user, "banana");
    await serveTheWebsite(true);
    await (await signedIn(bob)).mutation(api.website.commands.setAvatar, { hoggie: "rocket" });
    await settleInTimeOrder(t);

    expect(avatarExposures()).toEqual({ [await analyticsIdOf(alice.user)]: [true], [await analyticsIdOf(bob.user)]: [true] });
  });
});

function asTheShipCreatesIt(): FlagDefinition {
  return {
    key: hoggieAvatar,
    filters: {
      groups: [
        { properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 },
        { properties: [{ key: "email", type: "person", value: ["product-owner@example.com"], operator: "exact" }], rollout_percentage: 100 },
      ],
    },
  };
}

async function aliceAndBobHoldingHoggies(flag: FlagDefinition[], turnOff?: () => void): Promise<Backend> {
  vi.useFakeTimers({ now: tuesday });
  steps = 0;
  avatarFlag = flag;
  t = await flagsFromPostHog(testBackend(), postHog, ...everyOtherFlag.filter((each) => each !== "collection").map(onForEveryone), offForEveryone("website"));
  turnOff?.();
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await bookShippedBeforeAnyoneJoined(t);
  for (const person of members) {
    await memberChanged(t, "team_join", { id: person.user, profile: { display_name: person.name, email: person.email } });
    await settleInTimeOrder(t);
    const member = await memberOf(person.user);
    await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: xpToReach(4), pointsSpent: 0 }));
    await reachesLevel(t, member, 4);
    await t.run((ctx) => openUnlock(ctx, member, "book", "slack"));
    await holds(t, member, "banana", "rocket");
  }
  await serveTheWebsite(false);
  await settleInTimeOrder(t);
  return t;
}

async function serveTheWebsite(open: boolean) {
  await flagsFromPostHog(t, postHog, ...everyOtherFlag.map(onForEveryone), open ? onForEveryone("website") : offForEveryone("website"), ...avatarFlag);
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
}

async function walkIn(backend: Backend) {
  t = backend;
  namedIds = await idsNamedByTheirMember();
  for (const { user } of members) {
    await openHome(user);
    await pickInSlack(user, "rocket");
  }
  const inSlack = Object.fromEntries(members.map(({ user }) => [user, publishedHome(slack, user)]));
  const cardsInSlack = [await card(alice.user, bob.user), await card(bob.user, alice.user)];
  await serveTheWebsite(true);
  const answers: Record<string, Awaited<ReturnType<typeof onTheWebsite>>> = {};
  for (const member of members) answers[member.user] = await onTheWebsite(member);
  for (const { user } of members) await openHome(user);
  const seenBy = { U_ALICE: [await card(alice.user, alice.user), await card(alice.user, bob.user)], U_BOB: [await card(bob.user, bob.user), await card(bob.user, alice.user)] };
  return {
    homes: { inSlack, frontDoor: Object.fromEntries(members.map(({ user }) => [user, publishedHome(slack, user)])) },
    answers,
    cards: { inSlack: cardsInSlack, seenBy },
    slackCallsTo: Object.fromEntries(members.map(({ user }) => [user, slackCallsAbout(user)])),
    slackCalls: slack.calls.map((call) => JSON.stringify(call)).sort(),
    productEvents: orderFree(withStableIds(postHog.productEvents().filter(({ properties }) => properties.$feature_flag !== hoggieAvatar).map(({ event, distinct_id, properties }) => ({ event, distinct_id, properties })))),
    tables: await rowsWritten(),
  } satisfies Record<string, unknown>;
}

async function onTheWebsite(person: Person) {
  nextStep();
  const asSignedIn = await signedIn(person);
  const sets = [];
  for (const hoggie of ["banana", null, "banana"]) sets.push(await asSignedIn.mutation(api.website.commands.setAvatar, { hoggie }));
  await settleInTimeOrder(t);
  const profile = withStableIds(await asSignedIn.query(api.website.profile.getMyProfile, {}));
  const card = withStableIds(await asSignedIn.query(api.website.profileCard.getProfileCard, {}));
  return { sets, profile, card };
}

async function signedIn(person: Person) {
  const identity = { user: person.user, name: person.name };
  const { asSignedIn } = await aSignedInSession(t, identity).catch(() => aSession(t, identity));
  return asSignedIn;
}

function orderFree<T>(rows: T[]): T[] {
  return rows.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

const convexTestId = /^\d+[a-zA-Z]+$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const positioned = new Set(["cursor", "seen", "eventId", "position"]);

function withStableIds<T>(value: T): T {
  const seen = new Map<string, string>();
  const stable = (kind: string, id: string) => seen.get(id) ?? seen.set(id, `<${kind} ${seen.size + 1}>`).get(id)!;
  return JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? `${field}n` : field)), (key, field) => {
    if (key === "_id" || key === "_creationTime" || key === "uuid") return undefined;
    if (positioned.has(key) && field !== null) return "<position>";
    if (typeof field !== "string") return field;
    if (namedIds.has(field)) return namedIds.get(field);
    if (convexTestId.test(field)) return stable("document", field);
    return uuid.test(field) ? stable("uuid", field) : field;
  });
}

type TableName = keyof typeof schema.tables;

async function rowsWritten() {
  const tables = await t.run(async (ctx) => {
    const rows = {} as Record<TableName, Record<string, unknown>[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  const written = withStableIds(withoutExposureOf(hoggieAvatar, tables));
  return Object.fromEntries(Object.entries(written).map(([table, rows]) => [table, orderFree(rows)])) as typeof written;
}

async function idsNamedByTheirMember() {
  const named = new Map<string, string>();
  for (const { user } of members) {
    const member = await memberOf(user);
    named.set(member, `<member ${user}>`);
    const analytics = await t.run((ctx) =>
      ctx.db
        .query("analyticsIds")
        .withIndex("by_member", (q) => q.eq("member", member))
        .unique(),
    );
    if (analytics !== null) named.set(analytics.analyticsId, `<analytics ID of ${user}>`);
  }
  return named;
}

function slackCallsAbout(user: string) {
  return slack.calls
    .filter((call) => JSON.stringify(call).includes(user))
    .map((call) => JSON.stringify(call))
    .sort();
}

function avatarExposures() {
  const exposures = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === hoggieAvatar);
  const asPostHogKeepsThem = new Map(exposures.map((exposure) => [exposure.uuid, exposure]));
  const byMember: Record<string, unknown[]> = {};
  for (const { distinct_id, properties } of asPostHogKeepsThem.values()) (byMember[distinct_id] ??= []).push(properties.$feature_flag_response);
  return byMember;
}

function nextStep() {
  steps += 1;
  vi.setSystemTime(tuesday + steps * minuteMs);
}

async function pickInSlack(user: string, hoggie: string) {
  nextStep();
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, staleMenuOptionOf({ type: "setAvatar", hoggie })), form));
  await settleInTimeOrder(t);
}

async function openHome(user: string) {
  nextStep();
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleInTimeOrder(t);
}

async function card(viewer: string, user: string) {
  nextStep();
  const body = new URLSearchParams({ team_id: "T1", channel_id: "C1", channel_name: "general", user_id: viewer, command: "/hedgehug", text: `<@${user}>`, response_url: slashCommandResponseUrl, trigger_id: "1.2.3" }).toString();
  const response = await t.fetch("/slack/commands", await signedRequest(body, form));
  const reply = await response.text();
  await settleInTimeOrder(t);
  return reply === "" ? reply : ((JSON.parse(reply) as { text?: string }).text ?? reply);
}

async function memberOf(user: string) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique(),
  );
  return row!._id;
}

async function analyticsIdOf(user: string) {
  const member = await memberOf(user);
  const row = await t.run((ctx) =>
    ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique(),
  );
  return row!.analyticsId;
}

function freshFakes() {
  slack = new FakeSlack().withMember(alice.user, { profile: { display_name: alice.name, email: alice.email } }).withMember(bob.user, { profile: { display_name: bob.name, email: bob.email } });
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
}
