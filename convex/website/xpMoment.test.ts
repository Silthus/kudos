import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { deleteMessage, memberChanged, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import type { Infer } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { kudosGivenEventValidator } from "../bus/events";
import { onboardingGoalOf } from "../quests/onboarding";
import { startQuests } from "../quests/start";
import { weeklyQuestsOf } from "../quests/weekly";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";
import type { AlbumAnswer, AlbumRead } from "./album";
import { moveLastVisitTo, type ArrivalAnswer } from "./lastVisit";
import type { Denial } from "./memberQuery";
import type { XpMoment, XpMomentAnswer, XpMomentEndReply } from "./xpMoment";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs", "xp-levels", "unlocks", "hugs"];
const everyFlagOfTheMoment = [...albumOpen, "hidden-items", "xp-moments"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;

const alice = person("Alice", "Marchetti");
const bob = person("Bob", "Okonkwo");
const carol = person("Carol", "Lindqvist");
const everyone = [alice, bob, carol];

let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack();
  for (const { user, name } of everyone) slack.withMember(user, { real_name: name, profile: { display_name: name, real_name: name } });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment);
  for (const { user, name } of everyone) await memberChanged(t, "team_join", { id: user, team_id: "T1", name, real_name: name, profile: { real_name: name, display_name: name } });
  await settle(t);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP27 LP28: getXpMoment plays what happened since the last visit", { timeout: 60_000 }, () => {
  test("answers none with the last visit to arrive from before the member's first last visit and when nothing was decided since it", async () => {
    const asAlice = await signedIn(alice);
    await thanks(bob, alice);

    expect(await momentOf(asAlice)).toEqual({ kind: "none", lastVisit: null });
    const arrived = await arrive(asAlice, null);
    expect(await momentOf(asAlice)).toEqual({ kind: "none", lastVisit: (arrived as { lastVisit: number }).lastVisit });
  });

  test("a busy return answers each kind since the last visit oldest first with its XP, the climb from the standing before the moment's XP to now, and the waiting items", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);
    await thanks(alice, carol);
    await hug(bob, alice, aMessageNow());
    await hug(alice, carol, aMessageNow());

    const moment = await theMomentOf(asAlice);

    expect(moment.excerpts.map(({ entry, xp }) => [entry.kind, xp])).toEqual([
      ["kudosReceived", 5],
      ["kudosGiven", 10],
      ["levelUp", 0],
      ["hugReceived", 1],
      ["hugGiven", 1],
    ]);
    expect(moment.fold).toBeNull();
    expect(moment.moments).toBe(4);
    expect([moment.climb.from.level, moment.climb.to.level]).toEqual([1, 2]);
    expect(moment.xp).toBe(17);
    const { level, board } = await albumOf(asAlice);
    expect(moment.climb.to).toEqual(level);
    expect(moment.climb.to.xp - moment.climb.from.xp).toBe(17);
    expect(moment.waiting).toBe(board!.items.length);
    expect(moment.excerpts[0]!.entry).toMatchObject({ kind: "kudosReceived", giver: { name: bob.name } });
  });

  test("each mention in an excerpt names the member it means, so the reader's own mention tells apart from a namesake's", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);

    const { entry } = (await theMomentOf(asAlice)).excerpts[0]!;

    expect(entry).toMatchObject({ kind: "kudosReceived", message: { segments: expect.arrayContaining([{ kind: "person", name: alice.name, person: await memberOf(alice) }]) } });
  });

  test("past five, the newest five show oldest first and the rest fold into one line with their XP", async () => {
    const asAlice = await aReturningMember(alice);
    const received: number[] = [];
    for (let kudos = 0; kudos < 7; kudos += 1) received.push((await thanks(kudos % 2 === 0 ? bob : carol, alice)).at);

    const moment = await theMomentOf(asAlice);

    expect(moment.excerpts.map(({ entry }) => entry.kind)).toEqual(["levelUp", "kudosReceived", "kudosReceived", "kudosReceived", "kudosReceived"]);
    expect(moment.excerpts.slice(1).map(({ entry }) => entry.at)).toEqual(received.slice(3));
    expect(moment.fold).toEqual({ count: 3, xp: 15 });
    expect(moment.moments).toBe(7);
    expect(moment.xp).toBe(35);
  });

  test("a kudos deleted in Slack since the last visit leaves the moment and its count, the kudos before it still plays, and the next arrival moves past both", async () => {
    const asAlice = await aReturningMember(alice);
    const kept = await thanks(bob, alice);
    const deleted = await thanks(carol, alice);
    await deleteMessage(t, { user: carol.user, ts: deleted.ts });
    await settle(t);

    const moment = await theMomentOf(asAlice);
    expect(moment.excerpts.filter(({ entry }) => entry.kind === "kudosReceived").map(({ entry }) => entry.at)).toEqual([kept.at]);
    const ended = await endOf(asAlice, moment, { skipped: true });
    await settle(t);

    expect(postHog.productEvents().filter(({ event }) => event === "xp moment ended").map(({ properties }) => properties)).toEqual([expect.objectContaining({ excerpts_shown: moment.excerpts.length, folded: 0 })]);
    expect(await momentOf(asAlice)).toMatchObject({ kind: "none" });
    const arrived = await arrive(asAlice, (ended as { lastVisit: number }).lastVisit);
    expect((arrived as { lastVisit: number }).lastVisit).toBeGreaterThan(moment.until);
  });

  test("a moment whose newest kudos is taken back in Slack while it plays still ends past it, counting what it played", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);
    const newest = await thanks(carol, alice);
    const moment = await theMomentOf(asAlice);

    await deleteMessage(t, { user: carol.user, ts: newest.ts });
    await settle(t);

    expect(await endAsTheWebsiteDoes(asAlice, moment)).toMatchObject({ kind: "arrived", lastVisit: moment.until });
    await settle(t);

    expect(await momentOf(asAlice)).toMatchObject({ kind: "none" });
    expect(postHog.productEvents().filter(({ event }) => event === "xp moment ended").map(({ properties }) => properties)).toEqual([expect.objectContaining({ excerpts_shown: moment.excerpts.length, folded: 0 })]);
  });

  test("a level crossed is always among the excerpts, however many newer kudos came in", async () => {
    const asCarol = await aReturningMember(carol);
    await thanks(carol, alice, bob);
    for (let kudos = 0; kudos < 6; kudos += 1) await thanks(kudos % 2 === 0 ? bob : alice, carol);

    const moment = await theMomentOf(asCarol);

    expect(moment.excerpts.map(({ entry }) => entry.kind)).toEqual(["levelUp", "kudosReceived", "kudosReceived", "kudosReceived", "kudosReceived"]);
    expect(moment.excerpts[0]!.entry).toMatchObject({ kind: "levelUp", level: 2 });
    expect(moment.fold).toEqual({ count: 3, xp: 30 });
    expect(moment.climb.from.level).toBe(1);
    expect(moment.climb.to.level).toBe(2);
  });

  test("hugs on the member's message count only those since the last visit", async () => {
    const message = aMessageNow();
    await hug(bob, alice, message);
    const asAlice = await signedIn(alice);
    await arrive(asAlice, null);
    later();
    await hug(carol, alice, message);

    const moment = await theMomentOf(asAlice);

    expect(moment.excerpts.map(({ entry, xp }) => [entry.kind, "hugs" in entry ? entry.hugs : null, xp])).toEqual([["hugReceived", 1, 1]]);
  });

  test("a kudos whose XP progression hasn't recorded yet waits out of the moment, with everything after it, and plays with its XP once recorded", async () => {
    const asAlice = await aReturningMember(alice);
    const recorded = await thanks(bob, alice);
    const held = await thanksWhileItsXpWaits(carol, alice);
    const after = await thanks(bob, alice);

    const moment = await theMomentOf(asAlice);
    expect(moment.excerpts.map(({ entry }) => entry.at), "the moment while the XP waits").toEqual([recorded.at]);
    await endOf(asAlice, moment);
    await held.record();

    const next = await theMomentOf(asAlice);
    expect(next.excerpts.filter(({ entry }) => entry.kind === "kudosReceived").map(({ entry, xp }) => [entry.at, xp]), "the next moment").toEqual([
      [held.at, 5],
      [after.at, 5],
    ]);
  });

  test("a moment held short of a kudos whose XP waits climbs from the standing at the last visit by only the XP it plays, and the next moment climbs on from where it ended", async () => {
    const asAlice = await aReturningMember(alice);
    const before = (await albumOf(asAlice)).level;
    await thanks(bob, alice);
    const held = await thanksWhileItsXpWaits(carol, alice);
    await thanks(bob, alice);

    const moment = await theMomentOf(asAlice);
    expect(moment.climb.from, "the held-short moment's start").toEqual(before);
    expect(moment.climb.to.xp - moment.climb.from.xp, "the held-short moment's climb").toBe(moment.xp);
    await endOf(asAlice, moment);
    await held.record();

    const next = await theMomentOf(asAlice);
    expect(next.climb.from, "the next moment's start").toEqual(moment.climb.to);
    expect(next.climb.to, "the next moment's end").toEqual((await albumOf(asAlice)).level);
  });

  test("a kudos whose XP progression never records stops holding the moment ten minutes after it was decided", async () => {
    const asAlice = await aReturningMember(alice);
    const held = await thanksWhileItsXpWaits(carol, alice);
    expect(await momentOf(asAlice), "while the XP waits").toMatchObject({ kind: "none" });

    vi.setSystemTime(Date.now() + 10 * minuteMs);

    expect((await theMomentOf(asAlice)).excerpts.map(({ entry }) => entry.at), "ten minutes on").toEqual([held.at]);
  });

  test("LP40 LP41: the moment carries this week's thoughtful givers where xp-moments is on, with teasers off, and none below three", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(alice, bob);
    expect((await theMomentOf(asAlice)).thoughtfulGivers).toBeNull();

    await thanks(carol, bob);

    expect((await theMomentOf(asAlice)).thoughtfulGivers).toBe(3);
  });

  test("with xp-moments off, getXpMoment answers off and the arrival moves the last visit as it did before", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen, "hidden-items");
    await thanks(bob, alice);
    const receivedAt = await newestKudosDecidedFor(alice);
    const asAlice = await signedIn(alice);
    await thanks(alice, carol);

    expect(await momentOf(asAlice)).toEqual({ kind: "off" });
    expect(await arrive(asAlice, null)).toEqual({ kind: "arrived", lastVisit: receivedAt });
  });

  test("with xp-moments on and hidden-items off, the last visit is still kept so the moment can play", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen, "xp-moments");
    const asAlice = await signedIn(alice);
    await thanks(bob, alice);
    expect(await arrive(asAlice, null)).toMatchObject({ kind: "arrived", lastVisit: expect.any(Number) });
    later();
    await thanks(bob, alice);

    const moment = await theMomentOf(asAlice);

    expect(moment.excerpts.map(({ entry }) => entry.kind)).toEqual(["kudosReceived"]);
    expect(moment.waiting).toBe(0);
  });
});

describe("LP26 LP35: endXpMoment moves the last visit to the newest instant the moment read", { timeout: 60_000 }, () => {
  test("ending moves the last visit to the newest instant read, never the clock, so what was decided while it played waits for the next moment", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);
    const moment = await theMomentOf(asAlice);
    const whilePlaying = await thanks(carol, alice);
    later();

    expect(await endOf(asAlice, moment)).toEqual({ kind: "arrived", lastVisit: moment.until });

    const next = await theMomentOf(asAlice);
    expect(next.since).toBe(moment.until);
    expect(next.excerpts.map(({ entry }) => entry.at)).toEqual([whilePlaying.at]);
  });

  test("an arrival after a read that answered none moves nothing past a kudos decided since that read, so the next read plays it", async () => {
    const asAlice = await aReturningMember(alice);
    const read = await momentOf(asAlice);
    expect(read).toMatchObject({ kind: "none" });
    const lastVisit = (read as { lastVisit: number }).lastVisit;
    const sinceTheRead = await thanks(bob, alice);

    expect(await arrive(asAlice, lastVisit), "the arrival after the read").toEqual({ kind: "arrived", lastVisit });

    const next = await theMomentOf(asAlice);
    expect(next.excerpts.map(({ entry }) => entry.at), "the next read").toEqual([sinceTheRead.at]);
  });

  test("a second tab reads the same moment until one ends it, and ending the older moment moves nothing", async () => {
    const tab = await aReturningMember(alice);
    const otherTab = await signedIn(alice);
    await thanks(bob, alice);
    const moment = await theMomentOf(tab);
    expect(await theMomentOf(otherTab)).toEqual(moment);
    await endOf(tab, moment);
    await thanks(carol, alice);
    const before = await everythingWritten();

    expect(await endOf(otherTab, moment)).toEqual({ kind: "arrived", lastVisit: moment.until });
    expect(await everythingWritten()).toEqual(before);
  });

  test("LP61: a moment started from the glow after the visit's own one ended moves the last visit on to the newest instant it read, and never plays or moves for the collected one again", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);
    const visitsOwn = await theMomentOf(asAlice);
    await endOf(asAlice, visitsOwn);
    const cameInSince = await thanks(carol, alice);
    later();

    const missed = await theMomentOf(asAlice);
    expect(missed.since, "the glow's moment starts where the visit's own ended").toBe(visitsOwn.until);
    expect(missed.excerpts.map(({ entry }) => entry.at)).toEqual([cameInSince.at]);
    expect(await endOf(asAlice, missed)).toEqual({ kind: "arrived", lastVisit: missed.until });
    expect(await momentOf(asAlice), "the collected moments").toEqual({ kind: "none", lastVisit: missed.until });

    const before = await everythingWritten();
    expect(await endOf(asAlice, visitsOwn), "ending the visit's own moment again").toEqual({ kind: "arrived", lastVisit: missed.until });
    expect(await everythingWritten()).toEqual(before);
  });

  test("an instant no moment read moves nothing", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);
    const moment = await theMomentOf(asAlice);
    const before = await everythingWritten();

    expect(await endOf(asAlice, { ...moment, until: moment.until + minuteMs })).toEqual({ kind: "arrived", lastVisit: moment.since });
    expect(await everythingWritten()).toEqual(before);
  });

  test("LP36: ending records xp moment ended with skipped, excerpts_shown and folded, a crossed level among the excerpts shown", async () => {
    const asAlice = await aReturningMember(alice);
    for (let kudos = 0; kudos < 6; kudos += 1) await thanks(bob, alice);
    const moment = await theMomentOf(asAlice);

    await endOf(asAlice, moment, { skipped: true });
    await settle(t);

    expect(postHog.productEvents().filter(({ event }) => event === "xp moment ended").map(({ properties }) => properties)).toEqual([expect.objectContaining({ skipped: true, excerpts_shown: 5, folded: 2 })]);
  });

  test("with xp-moments off, ending answers refused and writes nothing at all", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);
    const moment = await theMomentOf(asAlice);
    await switchWebsite(t, postHog, true, ...albumOpen, "hidden-items");
    const before = await everythingWritten();

    expect(await endOf(asAlice, moment)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
  });
});

describe("LP22 LP26: an item the member turned is never New at a later visit", { timeout: 60_000 }, () => {
  test("ending a moment that read only what was decided while the visit before played answers a last visit at the sticker that visit turned, while the stored last visit stays where the moment read", async () => {
    await thanks(alice, carol);
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);
    const before = await theMomentOf(asAlice);
    const whilePlaying = await thanks(bob, alice);
    await endOf(asAlice, before);
    await laterTurnTheSticker(asAlice, carol);
    later();

    const moment = await theMomentOf(asAlice);
    const ended = await endOf(asAlice, moment);

    expect(moment.excerpts.map(({ entry }) => entry.at), "what was decided while the visit before played").toEqual([whilePlaying.at]);
    expect(ended).toEqual({ kind: "arrived", lastVisit: await stickerPutInAt(asAlice, carol) });
    expect((await albumOf(asAlice)).lastVisit).toBe(moment.until);
  });

  test("an arrival held short by a kudos whose XP waits answers a last visit at the sticker the visit before turned, and the kudos still plays once its XP records", async () => {
    await thanks(alice, carol);
    await thanks(bob, alice);
    const asAlice = await aReturningMember(alice);
    await laterTurnTheSticker(asAlice, carol);
    const waiting = await thanksWhileItsXpWaits(bob, alice);
    const read = await momentOf(asAlice);
    expect(read).toMatchObject({ kind: "none" });

    const arrived = await arrive(asAlice, (read as { lastVisit: number }).lastVisit);

    expect(arrived).toEqual({ kind: "arrived", lastVisit: await stickerPutInAt(asAlice, carol) });
    await waiting.record();
    expect((await theMomentOf(asAlice)).excerpts.map(({ entry }) => entry.at), "the next read").toEqual([waiting.at]);
  });
});

describe("website reads pass one guard", { timeout: 60_000 }, () => {
  test("WS61: getXpMoment answers closed with the website off, and signed-out without a session", async () => {
    const asAlice = await signedIn(alice);
    expect(await t.query(api.website.xpMoment.getXpMoment, {})).toEqual({ kind: "signed-out" });
    await switchWebsite(t, postHog, false, ...everyFlagOfTheMoment);
    expect(await asAlice.query(api.website.xpMoment.getXpMoment, {})).toEqual({ kind: "closed" });
  });
});

describe("website commands pass one guard", { timeout: 60_000 }, () => {
  test("WS61: ending answers closed with the website off and signed-out without a session, writing nothing at all", async () => {
    const asAlice = await signedIn(alice);
    const ending = { from: 1, until: 2, skipped: false };
    const before = await everythingWritten();

    expect(await t.mutation(api.website.xpMoment.endXpMoment, ending)).toEqual({ kind: "signed-out" });
    await switchWebsite(t, postHog, false, ...everyFlagOfTheMoment);
    const closed = await everythingWritten();
    expect(await asAlice.mutation(api.website.xpMoment.endXpMoment, ending)).toEqual({ kind: "closed" });
    expect(await everythingWritten()).toEqual(closed);
    expect(closed.tables.lastVisits).toEqual(before.tables.lastVisits);
  });

  test("WS61: the moment's instants are the only arguments, so no call names a member", async () => {
    const asAlice = await signedIn(alice);

    await expect(asAlice.mutation(api.website.xpMoment.endXpMoment, { from: 1, until: 2, skipped: false, member: "someone" } as never)).rejects.toThrow(/member/);
  });
});

describe("LP72: the XP moment carries the first-thanks top-up", { timeout: 60_000 }, () => {
  test("a returning member's first kudos shows in its excerpt with the top-up's XP, and the climb starts from before that kudos and crosses level 2", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "onboarding");
    const asAlice = await aReturningMember(alice);

    await thanks(alice, carol);

    const moment = await theMomentOf(asAlice);
    expect(moment.excerpts.map(({ entry, xp }) => [entry.kind, xp]), "the excerpts with their XP").toEqual([
      ["kudosGiven", 15],
      ["levelUp", 0],
    ]);
    expect(moment.xp, "the orb's total").toBe(15);
    expect([moment.climb.from, moment.climb.to].map(({ level, xp }) => [level, xp]), "the climb").toEqual([
      [1, 5],
      [2, 20],
    ]);
  });

  test("a member who thanked before they ever visited plays the moment from the instant before that kudos at their first visit, then ends it as any moment", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "onboarding");
    await thanks(bob, alice);
    const { at } = await thanks(alice, carol);
    const asAlice = await signedIn(alice);

    const moment = await theMomentOf(asAlice);

    expect(moment.excerpts.map(({ entry, xp }) => [entry.kind, xp]), "the excerpts with their XP").toEqual([
      ["kudosGiven", 15],
      ["levelUp", 0],
    ]);
    expect(moment.excerpts[0]!.entry.at, "the first kudos' excerpt").toBe(at);
    expect([moment.climb.from, moment.climb.to].map(({ level, xp }) => [level, xp]), "the climb").toEqual([
      [1, 5],
      [2, 20],
    ]);
    expect(await endOf(asAlice, moment), "the moment's end").toMatchObject({ kind: "arrived", lastVisit: moment.until });
    expect(await momentOf(asAlice), "the next read").toEqual({ kind: "none", lastVisit: moment.until });
  });

  test.each([
    ["before", false],
    ["after", true],
  ])("a newcomer's first arrival read while their first kudos' XP waits holds %s the top-up lands, so the moment still plays", async (_, landsBeforeArrival) => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "onboarding");
    const asAlice = await signedIn(alice);
    const held = await thanksWhileItsXpWaits(alice, carol);
    expect(await momentOf(asAlice), "the first read").toEqual({ kind: "none", lastVisit: null });

    if (landsBeforeArrival) await held.record();
    await arrive(asAlice, null);
    if (!landsBeforeArrival) await held.record();

    expect((await theMomentOf(asAlice)).excerpts.map(({ entry, xp }) => [entry.kind, xp]), "the excerpts with their XP").toEqual([
      ["kudosGiven", 20],
      ["levelUp", 0],
    ]);
  });

  test("a newcomer whose first kudos' XP never records stops holding their first arrival once the moment stops waiting for it", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "onboarding");
    const asAlice = await signedIn(alice);
    await thanksWhileItsXpWaits(alice, carol);
    vi.setSystemTime(Date.now() + 11 * minuteMs);

    await arrive(asAlice, null);

    expect(await momentOf(asAlice), "the next read").toMatchObject({ kind: "none", lastVisit: await newestKudosDecidedFor(carol) });
  });

  test("a newcomer who has only received kudos arrives past them at their first visit, as before", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "onboarding");
    const asAlice = await signedIn(alice);
    await thanks(bob, alice);

    await arrive(asAlice, null);

    expect(await momentOf(asAlice), "the next read").toMatchObject({ kind: "none", lastVisit: await newestKudosDecidedFor(alice) });
  });

  test("a later kudos plays at its own XP, without the top-up", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "onboarding");
    const asAlice = await signedIn(alice);
    await thanks(alice, carol);
    const first = await theMomentOf(asAlice);
    await endOf(asAlice, first);
    later();

    await thanks(alice, bob);

    expect((await theMomentOf(asAlice)).excerpts.map(({ entry, xp }) => [entry.kind, xp]), "the excerpts with their XP").toEqual([["kudosGiven", 10]]);
  });

  test("while onboarding is off, a first kudos plays at its 10 XP and a member with no last visit reads none, as before", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(alice, carol);
    const asCarol = await signedIn(carol);
    await thanks(carol, bob);

    expect((await theMomentOf(asAlice)).excerpts.map(({ entry, xp }) => [entry.kind, xp]), "the returning member's excerpts").toEqual([["kudosGiven", 10]]);
    expect(await momentOf(asCarol), "the member with no last visit").toEqual({ kind: "none", lastVisit: null });
  });
});

describe("LP104: a quest finished since the last visit gets its own beat", { timeout: 60_000 }, () => {
  const onTheMondayPath = [...everyFlagOfTheMoment, "monday-quest"];

  test("answers each quest finished since the last visit, oldest first, and climbs from before its XP, counting it once", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath, "quest-beats");
    const asAlice = await aReturningMember(alice);

    await thanks(alice, carol);
    await thanks(alice, bob);

    const moment = await theMomentOf(asAlice);
    expect(moment.quests, "the quests finished").toEqual([
      { kind: "journey", goal: "Give a kudos that says why.", xp: 50, waiting: false, hoggie: true },
      { kind: "journey", goal: "Thank someone you haven't thanked before.", xp: 50, waiting: false, hoggie: true },
    ]);
    expect(moment.climb.to, "the climb's end").toEqual((await albumOf(asAlice)).level);
    expect(moment.climb.to.xp - moment.climb.from.xp, "the climb").toBe(moment.xp + 100);
  });

  test("a quest finished by a kudos folded out of the excerpts still gets its beat", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath, "quest-beats");
    const asAlice = await aReturningMember(alice);
    await thanks(alice, carol);

    for (let kudos = 0; kudos < 6; kudos += 1) await thanks(kudos % 2 === 0 ? bob : carol, alice);

    const moment = await theMomentOf(asAlice);
    expect(moment.excerpts.map(({ entry }) => entry.kind), "the excerpts").not.toContain("kudosGiven");
    expect(moment.quests.map(({ goal }) => goal), "the quests finished").toEqual(["Give a kudos that says why."]);
  });

  test("a kudos whose quests aren't judged yet waits out of the moment, and plays its quest's beat once they are", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath, "quest-beats");
    const asAlice = await aReturningMember(alice);
    const before = await thanks(bob, alice);
    const held = await thanksWhileHeldBack(followingQuests, alice, carol);

    const moment = await theMomentOf(asAlice);
    expect(moment.excerpts.map(({ entry }) => entry.at), "the moment while the quests wait").toEqual([before.at]);
    expect(moment.quests, "the quests while they wait").toEqual([]);
    await endOf(asAlice, moment);
    await held.record();

    const next = await theMomentOf(asAlice);
    expect(next.quests.map(({ goal }) => goal), "the next moment's quests").toEqual(["Give a kudos that says why."]);
    expect(next.climb.to.xp - next.climb.from.xp, "the next moment's climb").toBe(next.xp + 50);
  });

  test("a first thanks whose quests aren't judged yet waits out of the moment with its top-up, so the moment climbs only by what it plays", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath, "onboarding", "quest-beats");
    const asAlice = await signedIn(alice);
    const member = await memberOf(alice);
    await t.run((ctx) => moveLastVisitTo(ctx, member, Date.now()));
    const atTheVisit = (await albumOf(asAlice)).level.xp;
    await thanks(bob, alice);
    await thanksWhileHeldBack(followingQuests, alice, carol);

    const moment = await theMomentOf(asAlice);
    expect(moment.excerpts.map(({ entry, xp }) => [entry.kind, xp]), "the moment while the quests wait").toEqual([["kudosReceived", 5]]);
    expect([moment.climb.from.xp, moment.climb.to.xp], "the climb").toEqual([atTheVisit, atTheVisit + 5]);
  });

  test("a quest finished on the unlock path, off the Monday path, gets no beat and climbs as before", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "quests", "quest-beats");
    const asAlice = await aReturningMember(alice);

    await thanks(alice, carol);

    const moment = await theMomentOf(asAlice);
    expect(moment.excerpts.flatMap(({ entry }) => (entry.kind === "kudosGiven" ? (entry.earned?.questsDone ?? []) : [])), "the quests Activity shows on the kudos").not.toEqual([]);
    expect(moment.quests, "the quests finished").toEqual([]);
    expect(moment.climb.to.xp - moment.climb.from.xp, "the climb").toBe(moment.xp);
  });

  test("a quest finished on the unlock path before the member moved onto the Monday path gets no beat and climbs as before", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "quests", "quest-beats");
    const asAlice = await aReturningMember(alice);
    await thanks(alice, carol);

    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "quests", "quest-beats", "monday-quest");

    const moment = await theMomentOf(asAlice);
    expect(moment.excerpts.flatMap(({ entry }) => (entry.kind === "kudosGiven" ? (entry.earned?.questsDone ?? []) : [])), "the quests Activity shows on the kudos").not.toEqual([]);
    expect(moment.quests, "the quests finished").toEqual([]);
    expect(moment.climb.to.xp - moment.climb.from.xp, "the climb").toBe(moment.xp);
  });

  test("while quest-beats is off the moment answers no quest and climbs as before", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath);
    const asAlice = await aReturningMember(alice);

    await thanks(alice, carol);

    const moment = await theMomentOf(asAlice);
    expect(moment.quests, "the quests finished").toEqual([]);
    expect(moment.climb.to.xp - moment.climb.from.xp, "the climb").toBe(moment.xp);
  });
});

describe("LP107: a quest or milestone that progressed since the last visit gets its own beat", { timeout: 60_000 }, () => {
  const onTheMondayPath = [...everyFlagOfTheMoment, "monday-quest"];

  test("answers each drawn quest that moved without finishing, from where it stood at the last visit to now", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath, "progress-beats");
    await thanks(alice, bob);
    await thanks(alice, carol);
    vi.setSystemTime(Date.now() + dayMs);
    await thanks(alice, bob);
    await thanks(alice, bob);
    await arrive(await signedIn(alice), null);
    const atTheVisit = await weekOf(alice);
    vi.setSystemTime(Date.now() + dayMs);

    await thanks(alice, bob);
    const asAlice = await signedIn(alice);

    const now = await weekOf(alice);
    const moved = now.slots.flatMap((slot, index) => {
      const from = atTheVisit.slots[index]!.progress;
      return slot.progress > from && slot.finishedAt === null ? [{ kind: "quest", name: slot.goal.replace(/\.$/, ""), from, to: slot.progress, of: slot.target }] : [];
    });
    expect(moved, "the drawn quests that moved without finishing").not.toEqual([]);
    expect((await theMomentOf(asAlice)).progressed.filter(({ kind }) => kind === "quest")).toEqual(moved);
  });

  test("a kudos whose quests aren't judged yet waits out of the moment, and its drawn quests move from the last visit once they are", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath, "progress-beats");
    await thanks(alice, bob);
    await thanks(alice, carol);
    vi.setSystemTime(Date.now() + dayMs);
    await thanks(alice, bob);
    await thanks(alice, bob);
    await arrive(await signedIn(alice), null);
    const atTheVisit = await weekOf(alice);
    vi.setSystemTime(Date.now() + dayMs);
    const held = await thanksWhileHeldBack(followingQuests, alice, bob);
    const asAlice = await signedIn(alice);

    expect(await momentOf(asAlice), "the moment while the quests wait").toMatchObject({ kind: "none" });
    await held.record();

    const now = await weekOf(alice);
    const moved = now.slots.flatMap((slot, index) => {
      const from = atTheVisit.slots[index]!.progress;
      return slot.progress > from && slot.finishedAt === null ? [{ kind: "quest", name: slot.goal.replace(/\.$/, ""), from, to: slot.progress, of: slot.target }] : [];
    });
    expect(moved, "the drawn quests that moved without finishing").not.toEqual([]);
    expect((await theMomentOf(asAlice)).progressed.filter(({ kind }) => kind === "quest"), "the next moment's drawn quests").toEqual(moved);
  });

  test("answers the Thoughtful milestone moving toward its next tier by the thoughtful kudos given since the last visit", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "progress-beats");
    await thanks(alice, bob);
    const asAlice = await aReturningMember(alice);

    await thanks(alice, carol);
    await thanks(alice, bob, carol);

    expect((await theMomentOf(asAlice)).progressed).toEqual([{ kind: "milestone", name: "Generous soul", from: 1, to: 4, of: 25 }]);
  });

  test("a kudos sent before the last visit and decided after it moves the drawn quests and the milestone since the visit", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath, "progress-beats");
    await thanks(alice, bob);
    await thanks(alice, carol);
    vi.setSystemTime(Date.now() + dayMs);
    await thanks(alice, bob);
    await thanks(alice, bob);
    await signedIn(alice);
    later();
    const sentBeforeTheVisit = Date.now();
    const asAlice = await aReturningMember(alice);
    const atTheVisit = await weekOf(alice);

    await thanksSentAt(sentBeforeTheVisit, alice, carol);

    const now = await weekOf(alice);
    const drawnMoved = now.slots.flatMap((slot, index) => {
      const from = atTheVisit.slots[index]!.progress;
      return slot.progress > from && slot.finishedAt === null ? [{ kind: "quest", name: slot.goal.replace(/\.$/, ""), from, to: slot.progress, of: slot.target }] : [];
    });
    expect(drawnMoved, "the drawn quests that moved without finishing").not.toEqual([]);
    expect((await theMomentOf(asAlice)).progressed).toEqual([...drawnMoved, { kind: "milestone", name: "Generous soul", from: 4, to: 5, of: 25 }]);
  });

  test("a kudos sent before the last visit and decided after it moves the two-days quest since the visit", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "progress-beats");
    const member = await memberOf(alice);
    await t.run((ctx) => startQuests(ctx, member, Date.now()));
    later();
    const sentBeforeTheVisit = Date.now();
    const asAlice = await aReturningMember(alice);

    await thanksSentAt(sentBeforeTheVisit, alice, carol);

    expect((await theMomentOf(asAlice)).progressed.filter(({ kind }) => kind === "quest")).toEqual([{ kind: "quest", name: onboardingGoalOf("two-days"), from: 0, to: 1, of: 2 }]);
  });

  test("a kudos on last week's draw moves no quest once a new week has begun", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath, "progress-beats");
    await thanks(alice, bob);
    await thanks(alice, carol);
    vi.setSystemTime(Date.now() + dayMs);
    await thanks(alice, bob);
    await thanks(alice, bob);
    await arrive(await signedIn(alice), null);
    const atTheVisit = await weekOf(alice);
    vi.setSystemTime(new Date("2026-10-17T10:00:00Z"));
    await thanks(alice, bob);
    const lastWeek = await weekOf(alice);
    expect(lastWeek.slots.some((slot, index) => slot.progress > atTheVisit.slots[index]!.progress && slot.finishedAt === null), "a drawn quest moved on Saturday").toBe(true);

    vi.setSystemTime(new Date("2026-10-19T10:00:00Z"));
    const asAlice = await signedIn(alice);

    expect((await theMomentOf(asAlice)).progressed.filter(({ kind }) => kind === "quest")).toEqual([]);
  });

  test("a thoughtful kudos whose tally waits stays out of the moment, and the milestone moves from where it stood once it is tallied", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "progress-beats");
    await thanks(alice, bob);
    const asAlice = await aReturningMember(alice);
    const held = await thanksWhileHeldBack(tallying, alice, carol);

    expect(await momentOf(asAlice), "the moment while the tally waits").toMatchObject({ kind: "none" });
    await held.record();
    const first = await theMomentOf(asAlice);
    expect(first.progressed, "the first moment").toEqual([{ kind: "milestone", name: "Generous soul", from: 1, to: 2, of: 25 }]);
    await endOf(asAlice, first);
    await thanks(alice, bob);

    expect((await theMomentOf(asAlice)).progressed, "the next moment").toEqual([{ kind: "milestone", name: "Generous soul", from: 2, to: 3, of: 25 }]);
  });

  test("a thoughtful kudos whose tally never runs moves the milestone in no moment, once the moment stops waiting on it", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "progress-beats");
    await thanks(alice, bob);
    const asAlice = await aReturningMember(alice);
    await thanksWhileHeldBack(tallying, alice, carol);
    vi.setSystemTime(Date.now() + 11 * minuteMs);

    const first = await theMomentOf(asAlice);
    expect(first.progressed, "the moment that plays the untallied kudos").toEqual([]);
    await endOf(asAlice, first);
    await thanks(alice, bob);

    expect((await theMomentOf(asAlice)).progressed, "the next moment").toEqual([{ kind: "milestone", name: "Generous soul", from: 1, to: 2, of: 25 }]);
  });

  test("the two-days quest moves by the kudos the moment plays while a later kudos that finishes it waits on its XP", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath, "progress-beats");
    const member = await memberOf(alice);
    await t.run((ctx) => startQuests(ctx, member, Date.now()));
    await aReturningMember(alice);
    await thanks(alice, carol);
    vi.setSystemTime(Date.now() + dayMs);

    await thanksWhileItsXpWaits(alice, bob);

    expect((await theMomentOf(await signedIn(alice))).progressed.filter(({ name }) => name === onboardingGoalOf("two-days"))).toEqual([{ kind: "quest", name: onboardingGoalOf("two-days"), from: 0, to: 1, of: 2 }]);
  });

  test("the two-days quest moves by the kudos the moment plays while a later kudos, sent on another day before the last visit, finishes it and waits on its XP", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath, "progress-beats");
    const member = await memberOf(alice);
    await t.run((ctx) => startQuests(ctx, member, Date.now()));
    later();
    const sentOnTheFirstDay = Date.now();
    vi.setSystemTime(Date.now() + dayMs);
    const sentOnTheSecondDay = Date.now();
    await aReturningMember(alice);

    await thanksSentAt(sentOnTheFirstDay, alice, carol);
    await thanksSentWhileHeldBack(sentOnTheSecondDay, recordingXp, alice, bob);

    expect((await theMomentOf(await signedIn(alice))).progressed.filter(({ name }) => name === onboardingGoalOf("two-days"))).toEqual([{ kind: "quest", name: onboardingGoalOf("two-days"), from: 0, to: 1, of: 2 }]);
  });

  test("past 50 awards given since the last visit the moment answers no milestone or two-days progress, and still plays", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "progress-beats");
    const member = await memberOf(alice);
    await t.run((ctx) => startQuests(ctx, member, Date.now()));
    await aReturningMember(alice);
    for (let given = 0; given < 26; given += 1) await thanks(alice, bob, carol);

    const moment = await theMomentOf(await signedIn(alice));

    expect(moment.moments, "the kudos the moment plays").toBe(26);
    expect(moment.progressed).toEqual([]);
  });

  test("50 awards given since the two-days quest started still move it, whatever was given the day before it started", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "progress-beats");
    await thanks(alice, bob);
    const member = await memberOf(alice);
    later();
    await t.run((ctx) => startQuests(ctx, member, Date.now()));
    await aReturningMember(alice);
    for (let given = 0; given < 25; given += 1) await thanks(alice, bob, carol);

    const progressed = (await theMomentOf(await signedIn(alice))).progressed;

    expect(progressed.filter(({ name }) => name === onboardingGoalOf("two-days"))).toEqual([{ kind: "quest", name: onboardingGoalOf("two-days"), from: 0, to: 1, of: 2 }]);
  });

  test("a drawn quest with more than 50 counted kudos this week answers no progress", async () => {
    await switchWebsite(t, postHog, true, ...onTheMondayPath, "progress-beats");
    await thanks(alice, bob);
    await thanks(alice, carol);
    vi.setSystemTime(Date.now() + dayMs);
    await thanks(alice, bob);
    await thanks(alice, bob);
    await arrive(await signedIn(alice), null);
    const atTheVisit = await weekOf(alice);
    vi.setSystemTime(Date.now() + dayMs);
    await thanks(alice, bob);
    const now = await weekOf(alice);
    const movedIndex = now.slots.findIndex((slot, index) => slot.progress > atTheVisit.slots[index]!.progress && slot.finishedAt === null);
    const moved = now.slots[movedIndex]!;
    const member = await memberOf(alice);
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("questProgress").withIndex("by_member_week_slot", (q) => q.eq("member", member).eq("week", now.week).eq("slot", moved.slot)).collect();
      const { _id, _creationTime, ...newest } = rows.at(-1)!;
      for (let copy = 0; copy < 51; copy += 1) await ctx.db.insert("questProgress", newest);
    });

    const progressed = (await theMomentOf(await signedIn(alice))).progressed;

    expect(progressed.map(({ name }) => name)).not.toContain(moved.goal.replace(/\.$/, ""));
  });

  test("a kudos to two teammates that ends a moment without a level moves the milestone once, and the next moment moves on from it", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment, "progress-beats");
    await thanks(alice, bob);
    await thanks(alice, carol);
    await thanks(alice, bob);
    const asAlice = await aReturningMember(alice);
    await thanks(alice, bob, carol);
    const first = await theMomentOf(asAlice);
    expect(first.progressed, "the first moment").toEqual([{ kind: "milestone", name: "Generous soul", from: 3, to: 5, of: 25 }]);
    await endOf(asAlice, first);

    await thanks(alice, bob);

    expect((await theMomentOf(asAlice)).progressed, "the next moment").toEqual([{ kind: "milestone", name: "Generous soul", from: 5, to: 6, of: 25 }]);
  });

  test("while progress-beats is off the moment answers no progress", async () => {
    await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment);
    await thanks(alice, bob);
    const asAlice = await aReturningMember(alice);

    await thanks(alice, carol);

    expect((await theMomentOf(asAlice)).progressed).toEqual([]);
  });
});

function person(first: string, last: string): Person {
  return { user: `U_${first}_${last}`.toUpperCase(), name: `${first} ${last}` };
}

function later() {
  vi.setSystemTime(Date.now() + minuteMs);
}

async function thanks(giver: Person, ...recipients: Person[]) {
  later();
  return thanksSentAt(Date.now(), giver, ...recipients);
}

async function thanksSentAt(at: number, giver: Person, ...recipients: Person[]) {
  messages += 1;
  const ts = `${Math.floor(at / 1000)}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${why} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return { at: Number(ts.split(".")[0]) * 1000, ts };
}

function thanksWhileItsXpWaits(giver: Person, ...recipients: Person[]) {
  return thanksWhileHeldBack(recordingXp, giver, ...recipients);
}

function thanksWhileHeldBack(job: Job, giver: Person, ...recipients: Person[]) {
  later();
  return thanksSentWhileHeldBack(Date.now(), job, giver, ...recipients);
}

async function thanksSentWhileHeldBack(at: number, job: Job, giver: Person, ...recipients: Person[]) {
  messages += 1;
  const ts = `${Math.floor(at / 1000)}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${why} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts });
  const heldBack = await settleHoldingBack(job.name);
  return { at: Number(ts.split(".")[0]) * 1000, record: async () => {
    for (const args of heldBack) await t.mutation(job.run, args);
    await settle(t);
  } };
}

type Job = { name: string; run: typeof internal.progression.progression.recordEffects | typeof internal.quests.quests.followKudosGiven | typeof internal.album.tallies.tallyKudosGiven };

const recordingXp: Job = { name: "progression/progression:recordEffects", run: internal.progression.progression.recordEffects };

const followingQuests: Job = { name: "quests/quests:followKudosGiven", run: internal.quests.quests.followKudosGiven };

const tallying: Job = { name: "album/tallies:tallyKudosGiven", run: internal.album.tallies.tallyKudosGiven };

async function settleHoldingBack(name: string) {
  const heldBack: { event: Infer<typeof kudosGivenEventValidator> }[] = [];
  for (let round = 0; round < 200; round += 1) {
    heldBack.push(...(await cancelled(name)));
    if ((await t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).some(({ state }) => state.kind === "pending" || state.kind === "inProgress"))) === false) return heldBack;
    vi.advanceTimersToNextTimer();
    await t.finishInProgressScheduledFunctions();
  }
  throw new Error("the jobs never settled");
}

function cancelled(name: string) {
  return t.run(async (ctx) => {
    const jobs = (await ctx.db.system.query("_scheduled_functions").collect()).filter((job) => job.name === name && job.state.kind === "pending");
    for (const job of jobs) await ctx.scheduler.cancel(job._id);
    return jobs.map(({ args }) => args[0] as { event: Infer<typeof kudosGivenEventValidator> });
  });
}

function aMessageNow() {
  messages += 1;
  return `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
}

async function hug(giver: Person, author: Person, ts: string) {
  later();
  await react(t, { user: giver.user, itemUser: author.user, ts, eventTs: `${Math.floor(Date.now() / 1000)}.000200`, reaction: "taco" });
  await settle(t);
}

async function newestKudosDecidedFor(recipient: Person) {
  return t.run(async (ctx) => {
    const member = (await ctx.db.query("members").take(20)).find(({ user }) => user === recipient.user)!._id;
    const award = await ctx.db
      .query("awards")
      .withIndex("by_recipient_decided", (q) => q.eq("recipient", member))
      .order("desc")
      .first();
    return award!._creationTime;
  });
}

async function aReturningMember(someone: Person): Promise<Reader> {
  const reader = await signedIn(someone);
  await thanks(everyone.find((other) => other !== someone)!, someone);
  expect(await arrive(reader, null)).toMatchObject({ kind: "arrived", lastVisit: expect.any(Number) });
  later();
  return reader;
}

function arrive(reader: Reader, from: number | null): Promise<ArrivalAnswer | Denial> {
  return reader.mutation(api.website.lastVisit.arrive, { from });
}

function momentOf(reader: Reader): Promise<XpMomentAnswer | Denial> {
  return reader.query(api.website.xpMoment.getXpMoment, {});
}

async function theMomentOf(reader: Reader): Promise<XpMoment> {
  const moment = await momentOf(reader);
  if (moment.kind !== "moment") throw new Error(`expected a moment, got ${JSON.stringify(moment)}`);
  return moment;
}

function endOf(reader: Reader, { since, until }: Pick<XpMoment, "since" | "until">, { skipped = false } = {}): Promise<XpMomentEndReply | Denial> {
  return reader.mutation(api.website.xpMoment.endXpMoment, { from: since, until, skipped });
}

function endAsTheWebsiteDoes(reader: Reader, moment: XpMoment): Promise<XpMomentEndReply | Denial> {
  return reader.mutation(api.website.xpMoment.endXpMoment, { from: moment.since, until: moment.until, skipped: false, played: { shown: moment.excerpts.length, folded: moment.fold?.count ?? 0 } });
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

async function laterTurnTheSticker(reader: Reader, of: Person) {
  later();
  const turned = await reader.mutation(api.website.album.turnItem, { item: await stickerItemOf(alice, of) });
  if (turned.kind !== "turned") throw new Error(`expected the sticker turned, got ${JSON.stringify(turned)}`);
}

async function stickerPutInAt(reader: Reader, of: Person) {
  const { people } = await albumOf(reader);
  return people.find(({ name }) => name === of.name)!.at;
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

async function weekOf(someone: Person) {
  const member = await memberOf(someone);
  const week = await t.run((ctx) => weeklyQuestsOf(ctx, member, Date.now()));
  if (week === null) throw new Error("no week drawn");
  return week;
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

async function signedIn(someone: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: someone.user, name: someone.name });
  return asSignedIn;
}

async function everythingWritten() {
  const tables = await t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  return { tables, scheduled: await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()) };
}
