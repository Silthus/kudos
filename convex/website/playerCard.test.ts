import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const dana = { user: "U_DANA", name: "Dana Ferreira" };
const cast = [alice, bob, carol, dana];
const why = "Thanks for untangling the flaky migration before the release";
const workspaceUrl = "https://kudos-test.slack.com/";
const flag = "person-page-d";

type Person = { user: string; name: string };

let postHog: FakePostHog;
let t: Backend;
let messages = 0;
let clock = tuesday.getTime();

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  messages = 0;
  clock = tuesday.getTime();
  postHog = new FakePostHog();
  const slack = new FakeSlack().withWorkspaceUrl(workspaceUrl);
  for (const person of cast) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => slack.fetch(input, init)));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 1_000, hugBudget: 50 }));
  await switchWebsite(t, postHog, true, "album", "collection", "packs", "xp-levels", flag);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP94 LP95 LP98: getPlayerCard answers one card model for your own page and a teammate's", { timeout: 120_000 }, () => {
  test("a teammate's card carries their level, XP, place this week, people, hoggies and medals", async () => {
    await thanks(bob, why, alice);
    await thanks(bob, "Thanks for reviewing the long migration plan so carefully", carol);
    await opensAndPutsInEveryPack(bob);

    const card = await cardOf(alice, bob);

    expect(card).toMatchObject({
      kind: "card",
      card: {
        person: await memberOf(bob),
        name: bob.name,
        face: { kind: "initials", initials: "BO" },
        level: { level: expect.any(Number), xp: expect.any(Number), startsAt: expect.any(Number), nextAt: expect.any(Number) },
        place: { rank: 1, tied: false, thoughtful: 2 },
        people: { held: 2, newest: expect.arrayContaining([expect.objectContaining({ person: await memberOf(alice) }), expect.objectContaining({ person: await memberOf(carol) })]) },
        hoggies: { found: expect.any(Number), total: expect.any(Number) },
        medals: { count: expect.any(Number), best: expect.any(Array) },
      },
    });
  });

  test("a teammate's week shows its totals and its public thoughtful kudos of the week, never the individual kudos lines", async () => {
    await thanks(alice, why, bob);
    const kudos = await thanks(bob, "Thanks for pairing on the stubborn cache invalidation all day", carol);

    const answer = await cardOf(dana, bob);

    if (answer.kind !== "card" || answer.week === undefined) throw new Error("expected Bob's card with his week");
    expect(answer.week).toEqual({
      days: [0, 2, 0, 0, 0, 0, 0],
      thanked: 1,
      thankedBy: 1,
      packsOpened: 0,
      hugs: 0,
      kudosOfWeek: { giver: expect.objectContaining({ person: await memberOf(bob), name: bob.name }), message: expect.objectContaining({ kind: "text" }), permalink: `${workspaceUrl}archives/C1/p${kudos.replace(".", "")}`, at: atOf(kudos), hugs: 0 },
    });
    expect(answer.week).not.toHaveProperty("given");
    expect(answer.week).not.toHaveProperty("received");
    expect(JSON.stringify(answer)).not.toContain("flaky migration");
  });

  test("HH6: a short kudos can be a teammate's kudos of the week", async () => {
    await thanks(alice, "ty", bob);

    const answer = await cardOf(dana, bob);

    expect(answer).toMatchObject({ kind: "card", week: { thankedBy: 1, kudosOfWeek: { giver: expect.objectContaining({ person: await memberOf(alice) }), message: expect.objectContaining({ kind: "text" }) } } });
  });

  test("a quiet new member's card has no place, no finds and an empty week", async () => {
    await memberOf(dana);

    const answer = await cardOf(alice, dana);

    expect(answer).toMatchObject({
      kind: "card",
      card: { person: await memberOf(dana), place: null, people: { held: 0, newest: [] }, hoggies: { found: 0, rarest: null }, medals: { count: 0, best: [] } },
      week: { days: [0, 0, 0, 0, 0, 0, 0], thanked: 0, thankedBy: 0, packsOpened: 0, hugs: 0, kudosOfWeek: null },
    });
  });

  test("your own card carries no week, since your own page reads your whole week", async () => {
    await thanks(alice, why, bob);

    const answer = await cardOf(alice, alice);

    expect(answer).toMatchObject({ kind: "card", card: { person: await memberOf(alice), place: { rank: 1, thoughtful: 1 } } });
    expect(answer).not.toHaveProperty("week");
  });

  test("a person outside your workspace has no card", async () => {
    const stranger = await aMember(t, "U_STRANGER", "member", "T_OTHER");

    expect(await (await signedIn(alice)).query(api.website.playerCard.getPlayerCard, { person: stranger })).toEqual({ kind: "no-person" });
    expect(await (await signedIn(alice)).query(api.website.playerCard.getPlayerCard, { person: "not-an-id" })).toEqual({ kind: "no-person" });
  });

  test("while person-page-d is off, the card is off", async () => {
    await switchWebsite(t, postHog, true, "album", "collection", "packs", "xp-levels");

    expect(await cardOf(alice, bob)).toEqual({ kind: "off" });
    expect(await (await signedIn(alice)).query(api.website.playerCard.getPlayerCardEmojis, { person: await memberOf(bob) })).toEqual({ kind: "off" });
  });

  test("getAlbum says personPageD only while person-page-d is on", async () => {
    expect(await (await signedIn(alice)).query(api.website.album.getAlbum, {})).toMatchObject({ personPageD: true });

    await switchWebsite(t, postHog, true, "album", "collection", "packs", "xp-levels");

    expect(await (await signedIn(alice)).query(api.website.album.getAlbum, {})).not.toHaveProperty("personPageD");
  });
});

describe("LP94: a card's medals and place follow the album and the board", { timeout: 120_000 }, () => {
  test("while hidden-items is on, a medal counts on the card only once its owner has turned its tier, as on their Milestones page", async () => {
    await switchWebsite(t, postHog, true, "album", "collection", "packs", "xp-levels", "hidden-items", flag);
    await thanks(bob, why, alice);
    await opensAndPutsInEveryPack(bob);

    const album = await (await signedIn(bob)).query(api.website.album.getAlbum, {});
    const held = "milestones" in album ? album.milestones.flatMap(({ tiers }) => tiers.filter(({ earnedAt }) => earnedAt !== null)) : [];
    const bobsId = await memberOf(bob);
    const reached = await t.run(async (ctx) => (await ctx.db.query("milestoneTiers").collect()).filter(({ member }) => member === bobsId));

    expect(reached.length).toBeGreaterThan(held.length);
    expect(await cardOf(dana, bob)).toMatchObject({ kind: "card", card: { medals: { count: held.length } } });
  });

  test("the card of the last of 1,400 givers this week reads in one query, sharing its place with a giver on equal awards", async () => {
    const givers = 1400;
    const last = await t.run(async (ctx) => {
      const members: MemberId[] = [];
      for (let n = 1; n <= givers; n += 1) {
        const member = await ctx.db.insert("members", { workspace: "T1", user: `U${n}`, kind: "member", asOf: 0, name: `Giver ${n}` });
        await ctx.db.insert("thoughtfulBoardTallies", { workspace: "T1", period: "week:2026-10-12", giver: member, awards: Math.max(2, n) });
        members.push(member);
      }
      return members[0]!;
    });

    const answer = await (await signedIn(alice)).query(api.website.playerCard.getPlayerCard, { person: last });

    expect(answer).toMatchObject({ kind: "card", card: { place: { rank: givers - 1, tied: true, thoughtful: 2 } } });
  });
});

describe("LP94: getPlayerCardEmojis counts a person's emojis unlocked in a read of its own", { timeout: 120_000 }, () => {
  test("the count is the album Emojis tab's earned count for its owner, and the stack shows their pictures", async () => {
    await thanks(bob, why, alice);
    await thanks(bob, "Thanks for reviewing the long migration plan so carefully", carol);
    await opensAndPutsInEveryPack(bob);

    const album = await (await signedIn(bob)).query(api.website.album.getAlbum, {});
    const earned = "emojis" in album ? album.emojis.filter(({ earned: isEarned }) => isEarned) : [];

    const emojis = await (await signedIn(dana)).query(api.website.playerCard.getPlayerCardEmojis, { person: await memberOf(bob) });

    expect(earned.map(({ name }) => name)).toEqual(expect.arrayContaining(["alice-marchetti-hype", "carol-lindqvist-hype"]));
    expect(emojis).toEqual({ kind: "emojis", count: earned.length, shown: expect.arrayContaining([expect.objectContaining({ name: "alice-marchetti-hype", picture: expect.any(String) })]) });
  });

  test("an emoji with a second name shows on the stack under its first name", async () => {
    await thanks(bob, why, alice);
    await opensAndPutsInEveryPack(bob);
    expect(await t.mutation(internal.album.emojiNames.giveEmojiASecondName, { workspace: "T1", emoji: `hype:${await memberOf(alice)}`, name: "alice-heart" })).toBe(true);

    const emojis = await (await signedIn(dana)).query(api.website.playerCard.getPlayerCardEmojis, { person: await memberOf(bob) });

    const names = "shown" in emojis ? emojis.shown.map(({ name }) => name) : [];
    expect(names).toContain("alice-marchetti-hype");
    expect(names).not.toContain("alice-heart");
  });

  test("a quiet member has no emojis", async () => {
    expect(await (await signedIn(alice)).query(api.website.playerCard.getPlayerCardEmojis, { person: await memberOf(dana) })).toEqual({ kind: "emojis", count: 0, shown: [] });
  });
});

async function cardOf(viewer: Person, person: Person) {
  return (await signedIn(viewer)).query(api.website.playerCard.getPlayerCard, { person: await memberOf(person) });
}

async function opensAndPutsInEveryPack(member: Person) {
  const asMember = await signedIn(member);
  const album = await asMember.query(api.website.album.getAlbum, {});
  for (const { pack } of "packs" in album ? album.packs : []) await asMember.mutation(api.website.album.openThoughtfulPack, { pack });
  laterBy(minuteMs);
  await asMember.mutation(api.website.album.putAllIn, {});
  await settle(t);
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

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  const ts = nextTs();
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return ts;
}

async function signedIn(person: Person) {
  await memberOf(person);
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
