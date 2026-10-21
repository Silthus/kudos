import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, allowedWorkspace, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import { xpToReach } from "../progression/levels";
import schema from "../schema";
import type { AlbumAnswer, AlbumRead } from "./album";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const saysWhy = "Thanks for untangling the flaky migration before the release";
const albumOpen = ["album", "collection", "packs", "hugs"];
const onboardingOn = [...albumOpen, "hidden-items", "onboarding"];
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const taco = { kudosEmoji: "taco", kudosEmojiImage: null };
const slack = `https://app.slack.com/client/${allowedWorkspace}`;

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;

let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const fakeSlack = new FakeSlack();
  for (const person of [juno, bob]) fakeSlack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, fakeSlack.fetch));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: allowedWorkspace, kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...onboardingOn);
  for (const person of [juno, bob]) {
    await memberChanged(t, "team_join", { id: person.user, team_id: allowedWorkspace, real_name: person.name });
    await settle(t);
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP67 LP68: getAlbum answers the how-it-works card to a member who never gave a kudos and never closed it", { timeout: 60_000 }, () => {
  test("a newcomer reads the card with their Slack workspace's address and the level-2 lines, beside the workspace's kudos emoji", async () => {
    const album = await albumOf(await signedIn(juno));

    expect(album.howItWorks, "the newcomer's card").toEqual({ slack, toLevelTwo: true, kudos: taco });
  });

  test("a member who has given a kudos reads no card, while the teammate they thanked still does", async () => {
    await thanks(juno, saysWhy, bob);

    expect(await albumOf(await signedIn(juno)), "the giver's album").not.toHaveProperty("howItWorks");
    expect((await albumOf(await signedIn(bob))).howItWorks, "the recipient's card").toBeDefined();
  });

  test("a never-giver already at level 2 reads the card without the level-2 lines", async () => {
    await reachesXp(juno, xpToReach(2));

    expect((await albumOf(await signedIn(juno))).howItWorks, "the card at level 2").toEqual({ slack, toLevelTwo: false, kudos: taco });
  });

  test.each([
    ["onboarding off", [...albumOpen, "hidden-items"]],
    ["hidden-items off", [...albumOpen, "onboarding"]],
  ])("with %s, getAlbum answers no card", async (_, flags) => {
    await switchWebsite(t, postHog, true, ...flags);

    expect(await albumOf(await signedIn(juno))).not.toHaveProperty("howItWorks");
  });
});

describe("LP69: closeHowItWorks stores the member's close once and records onboarding card closed", { timeout: 60_000 }, () => {
  test("a close stores it, takes the card away for good and records tried_slack once; a second close stores and records nothing", async () => {
    const asJuno = await signedIn(juno);

    expect(await asJuno.mutation(api.website.onboarding.closeHowItWorks, { triedSlack: true })).toEqual({ kind: "closed" });
    await settle(t);
    const stored = await everyTable();
    expect(await asJuno.mutation(api.website.onboarding.closeHowItWorks, { triedSlack: false }), "the second close").toEqual({ kind: "closed" });
    await settle(t);

    expect(await albumOf(asJuno), "the album after the close").not.toHaveProperty("howItWorks");
    expect(await everyTable(), "what the second close stored").toEqual(stored);
    expect(closesRecorded(), "the usage facts PostHog took").toEqual([{ tried_slack: true }]);
  });

  test("Got it and Esc record tried_slack false", async () => {
    await (await signedIn(juno)).mutation(api.website.onboarding.closeHowItWorks, { triedSlack: false });
    await settle(t);

    expect(closesRecorded()).toEqual([{ tried_slack: false }]);
  });

  test("a close outlives onboarding turning off and back on: the card never comes back", async () => {
    const asJuno = await signedIn(juno);
    await asJuno.mutation(api.website.onboarding.closeHowItWorks, { triedSlack: false });
    await switchWebsite(t, postHog, true, ...albumOpen, "hidden-items");
    await switchWebsite(t, postHog, true, ...onboardingOn);

    expect(await albumOf(asJuno)).not.toHaveProperty("howItWorks");
  });

  test("with onboarding off, a close is refused and stores and records nothing", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen, "hidden-items");
    const asJuno = await signedIn(juno);
    await settle(t);
    const before = await everyTable();

    expect(await asJuno.mutation(api.website.onboarding.closeHowItWorks, { triedSlack: true })).toEqual({ kind: "refused" });
    await settle(t);

    expect(await everyTable()).toEqual(before);
    expect(closesRecorded()).toEqual([]);
  });
});

describe("LP76: getAlbum answers the onboarding steps, each done from one read", { timeout: 60_000 }, () => {
  test("a newcomer has done none of the four steps", async () => {
    expect((await albumOf(await signedIn(juno))).gettingStarted).toEqual({ steps: { hugged: false, thoughtful: false, turned: false, levelTwo: false }, kudos: taco });
  });

  test("a hug the member gave does Give a hug, and one they received does not", async () => {
    await thanks(bob, "Shipped the fix for the flaky deploy", juno);
    await hug(bob, juno);

    expect((await albumOf(await signedIn(bob))).gettingStarted?.steps, "the hugger's steps").toMatchObject({ hugged: true });
    expect((await albumOf(await signedIn(juno))).gettingStarted?.steps, "the hugged member's steps").toMatchObject({ hugged: false });
  });

  test("a thoughtful kudos the member gave does Give a thoughtful kudos, and turning its item does Turn an item", async () => {
    await thanks(juno, saysWhy, bob);
    const asJuno = await signedIn(juno);
    expect((await albumOf(asJuno)).gettingStarted?.steps, "after the thoughtful kudos").toMatchObject({ thoughtful: true, turned: false });

    for (const { item } of (await albumOf(asJuno)).board?.items ?? []) await asJuno.mutation(api.website.album.turnItem, { item });

    expect((await albumOf(asJuno)).gettingStarted?.steps, "after the turn").toMatchObject({ thoughtful: true, turned: true });
    expect((await albumOf(await signedIn(bob))).gettingStarted?.steps, "the thanked member's steps").toMatchObject({ thoughtful: false });
  });

  test("a kudos that says no why leaves Give a thoughtful kudos undone", async () => {
    await thanks(juno, "ty", bob);

    expect((await albumOf(await signedIn(juno))).gettingStarted?.steps).toMatchObject({ thoughtful: false });
  });

  test("reaching level 2 does Reach level 2", async () => {
    await reachesXp(juno, xpToReach(2));

    expect((await albumOf(await signedIn(juno))).gettingStarted?.steps).toMatchObject({ levelTwo: true });
  });

  test.each([
    ["onboarding off", [...albumOpen, "hidden-items"]],
    ["hidden-items off", [...albumOpen, "onboarding"]],
  ])("with %s, getAlbum answers no Getting started", async (_, flags) => {
    await switchWebsite(t, postHog, true, ...flags);

    expect(await albumOf(await signedIn(juno))).not.toHaveProperty("gettingStarted");
  });
});

function closesRecorded() {
  return postHog
    .productEvents()
    .filter(({ event }) => event === "onboarding card closed")
    .map(({ properties }) => ({ tried_slack: properties.tried_slack }));
}

async function thanks(giver: Person, words: string, recipient: Person) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  await post(t, [section(text(`${words} `), mention(recipient.user), emoji("taco"))], { user: giver.user, ts: tsOf(messages) });
  await settle(t);
}

async function hug(giver: Person, author: Person) {
  vi.setSystemTime(Date.now() + minuteMs);
  await react(t, { user: giver.user, itemUser: author.user, ts: tsOf(messages) });
  await settle(t);
}

function tsOf(message: number) {
  return `${tuesday.getTime() / 1000 + message}.${String(message).padStart(6, "0")}`;
}

async function reachesXp(someone: Person, xp: number) {
  const member = await memberOf(someone);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    if (progress === null) await ctx.db.insert("memberProgress", { member, xp, pointsSpent: 0 });
    else await ctx.db.patch(progress._id, { xp });
  });
}

async function signedIn(someone: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: someone.user, name: someone.name });
  return asSignedIn;
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

async function memberOf(someone: Person) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", allowedWorkspace).eq("user", someone.user))
      .unique(),
  );
  if (row === null) throw new Error(`${someone.name} is no member`);
  return row._id;
}

function everyTable() {
  return t.run(async (ctx) => {
    const tables: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as (keyof typeof schema.tables)[]) tables[table] = await ctx.db.query(table).collect();
    return tables;
  });
}
