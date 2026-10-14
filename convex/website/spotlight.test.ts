import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { blockActions } from "../../testing/slackInteractions";
import { signedRequest } from "../../testing/signedSlack";
import { deleteMessage, edit, memberChanged, post, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { channelMessage, emoji, mention, section, text, type RichElement } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Spotlight } from "./activity";

const capture = vi.hoisted(() => ({ shipped: true }));

vi.mock("../engine/kudosText", async (importOriginal) => {
  const original = await importOriginal<typeof import("../engine/kudosText")>();
  return {
    ...original,
    keepWords: async (...args: Parameters<typeof original.keepWords>) => (capture.shipped ? original.keepWords(...args) : undefined),
  };
});

const now = new Date("2026-10-14T10:00:00Z");
const firstTs = 1760435000;
const day = 24 * 60 * 60;
const alice = { user: "U_ALICE", name: "Alice Archer" };
const bob = { user: "U_BOB", name: "Bob Brandt" };
const carol = { user: "U_CAROL", name: "Carol Chen" };
const dave = { user: "U_DAVE", name: "Dave Dunn" };
const reason = "for the calm rollback of the billing service";
const form = { contentType: "application/x-www-form-urlencoded" };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack().withWorkspaceUrl("https://kudos-test.slack.com/");
  for (const person of [alice, bob, carol, dave]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  capture.shipped = true;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function spotlightOn() {
  await switchWebsite(t, postHog, true, "activity", "everyone-board");
  await joined(carol, dave);
}

async function joined(...people: Array<{ user: string; name: string }>) {
  for (const person of people) await memberChanged(t, "team_join", { id: person.user, real_name: person.name });
  await settle(t);
}

function tsOn(dayNumber: number) {
  return `${firstTs + dayNumber * day}.000100`;
}

function thanks(recipient: { user: string }, words = `thanks ${reason} `) {
  return [section(text(words), mention(recipient.user), text(" "), emoji("taco"))];
}

async function give(blocks: RichElement[], options: { user: string; ts: string; channelType?: "channel" | "group"; team?: string }) {
  await post(t, blocks, options);
  await settle(t);
}

async function spotlightSeenBy(person: { user: string; name: string }, from: { seed: number } | { after: string }): Promise<Spotlight> {
  const { asSignedIn } = await aSession(t, person);
  const answer = await asSignedIn.query(api.website.activity.getSpotlight, from);
  if (answer.kind !== "empty" && answer.kind !== "skipped" && answer.kind !== "kudos") throw new Error(`expected the spotlight, got ${answer.kind}`);
  return answer;
}

async function wordsOfEveryDrawn(person: { user: string; name: string }, draws: number) {
  const seen: string[] = [];
  let answer = await spotlightSeenBy(person, { seed: 0 });
  for (let draw = 0; draw < draws; draw += 1) {
    if (answer.kind !== "kudos") {
      seen.push(answer.kind);
      break;
    }
    seen.push(firstWordsOf(answer));
    answer = await spotlightSeenBy(person, { after: answer.after });
  }
  return seen;
}

function firstWordsOf(answer: Spotlight) {
  if (answer.kind !== "kudos") return answer.kind;
  const [first] = answer.message.segments;
  return first?.kind === "text" ? first.text.trim() : "";
}

async function leaveTheBoards(person: { user: string }, visible = false) {
  const command = JSON.stringify({ type: "setLeaderboardVisibility", visible });
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(person.user, { type: "button", action_id: command, value: command }), form));
  expect(response.status).toBe(200);
  vi.runOnlyPendingTimers();
  await t.finishInProgressScheduledFunctions();
}

describe("AT31 AT34: the spotlight draws only public, said-why kudos of the member's workspace", () => {
  test("draws a public kudos that said why with its people, its link and its words", async () => {
    await spotlightOn();
    await give(thanks(bob), { user: alice.user, ts: tsOn(0) });

    expect(await spotlightSeenBy(carol, { seed: 0.5 })).toEqual({
      kind: "kudos",
      after: expect.any(String),
      at: firstTs * 1000,
      giver: { name: "Alice Archer", face: { kind: "initials", initials: "AA" } },
      recipients: [{ name: "Bob Brandt", face: { kind: "initials", initials: "BB" } }],
      permalink: `https://kudos-test.slack.com/archives/C1/p${firstTs}000100`,
      message: {
        kind: "text",
        segments: [
          { kind: "text", text: `thanks ${reason} ` },
          { kind: "person", name: "Bob Brandt" },
          { kind: "text", text: " " },
          { kind: "emoji", name: "taco" },
        ],
        edited: false,
      },
    });
  });

  test("never draws a private channel's kudos, a bare one, one that didn't give, or one whose words were backfilled", async () => {
    await spotlightOn();
    await give(thanks(bob, "public and kind with a reason "), { user: alice.user, ts: tsOn(0) });
    await give(thanks(bob, "private and kind with a reason "), { user: alice.user, ts: tsOn(1), channelType: "group" });
    await give(thanks(bob, "ty "), { user: alice.user, ts: tsOn(2) });
    await give(thanks(alice, "thanking myself for a long reason "), { user: alice.user, ts: tsOn(3) });
    await givenBeforeCapture(thanks(bob, "backfilled and kind with a reason "), { user: alice.user, ts: tsOn(4) });

    expect(await wordsOfEveryDrawn(carol, 3)).toEqual(["public and kind with a reason", "public and kind with a reason", "public and kind with a reason"]);
    expect(await wordsReceivedBy(bob)).toContain("backfilled and kind with a reason ");
  });

  test("never draws another workspace's kudos", async () => {
    await spotlightOn();
    slack.withMember("U_ERIN", { team_id: "T2", real_name: "Erin Ek" }).withMember("U_FRED", { team_id: "T2", real_name: "Fred Fox" });
    await give(thanks({ user: "U_FRED" }, "in another workspace with a reason "), { user: "U_ERIN", ts: tsOn(0), team: "T2" });

    expect(await spotlightSeenBy(carol, { seed: 0 })).toEqual({ kind: "empty" });

    await give(thanks(bob, "in our workspace with a reason "), { user: alice.user, ts: tsOn(1) });
    expect(await wordsOfEveryDrawn(carol, 2)).toEqual(["in our workspace with a reason", "in our workspace with a reason"]);
  });

  test("an edit that drops the reason drops the kudos, and editing the reason back draws it again", async () => {
    await spotlightOn();
    await give(thanks(bob), { user: alice.user, ts: tsOn(0) });

    await edit(t, thanks(bob, "ty "), { user: alice.user, ts: tsOn(0), editedTs: `${firstTs + 60}.000100` });
    await settle(t);
    expect(await spotlightSeenBy(carol, { seed: 0 })).toEqual({ kind: "empty" });

    await edit(t, thanks(bob, `thanks again ${reason} `), { user: alice.user, ts: tsOn(0), editedTs: `${firstTs + 120}.000100` });
    await settle(t);
    expect(await spotlightSeenBy(carol, { seed: 0 })).toMatchObject({ kind: "kudos", message: { kind: "text", edited: true } });
  });

  test("a kudos deleted in Slack, or whose author left Slack, leaves the draw", async () => {
    await spotlightOn();
    await give(thanks(bob), { user: alice.user, ts: tsOn(0) });
    await give(thanks(alice), { user: dave.user, ts: tsOn(1) });

    await deleteMessage(t, { user: alice.user, ts: tsOn(0), previous: thanks(bob) });
    await memberChanged(t, "user_change", { id: dave.user, team_id: "T1", deleted: true });
    await settle(t);

    expect(await spotlightSeenBy(carol, { seed: 0 })).toEqual({ kind: "empty" });
  });
});

describe("AT32 AT33: Next walks every drawable kudos", () => {
  test("walks each kudos once before any repeat, wraps, and never shows one twice in a row", async () => {
    await spotlightOn();
    for (const [index, words] of ["first reason given to the team ", "second reason given to the team ", "third reason given to the team "].entries()) {
      await give(thanks(bob, words), { user: alice.user, ts: tsOn(index) });
    }

    const seen = await wordsOfEveryDrawn(carol, 7);

    expect(new Set(seen.slice(0, 3))).toEqual(new Set(["first reason given to the team", "second reason given to the team", "third reason given to the team"]));
    expect(seen.slice(3)).toEqual([...seen.slice(0, 3), seen[0]]);
  });

  test("answers the only drawable kudos again when it is the only one", async () => {
    await spotlightOn();
    await give(thanks(bob), { user: alice.user, ts: tsOn(0) });

    expect(await wordsOfEveryDrawn(carol, 3)).toEqual([`thanks ${reason}`, `thanks ${reason}`, `thanks ${reason}`]);
  });

  test("a cursor whose kudos was deleted still advances to the next one", async () => {
    await spotlightOn();
    await give(thanks(bob, "kept reason given to the team "), { user: alice.user, ts: tsOn(0) });
    await give(thanks(bob, "deleted reason given to the team "), { user: alice.user, ts: tsOn(1) });
    const shown = await shownUntil(carol, "deleted reason given to the team");

    await deleteMessage(t, { user: alice.user, ts: tsOn(1), previous: thanks(bob, "deleted reason given to the team ") });
    await settle(t);

    expect(firstWordsOf(await spotlightSeenBy(carol, { after: shown }))).toBe("kept reason given to the team");
  });

  test("answers empty with nothing drawable", async () => {
    await spotlightOn();

    expect(await spotlightSeenBy(carol, { seed: 0.25 })).toEqual({ kind: "empty" });
  });
});

describe("AT31 G22: a member who left the leaderboards", () => {
  test("their kudos stay out of the draw before the recompute, leave it after, and come back when they rejoin", async () => {
    await spotlightOn();
    await give(thanks(bob, "to bob with a reason given "), { user: alice.user, ts: tsOn(0) });
    await give(thanks(carol, "to carol with a reason given "), { user: alice.user, ts: tsOn(1) });

    await leaveTheBoards(bob);
    expect(await wordsOfEveryDrawn(dave, 2)).toEqual(["to carol with a reason given", "to carol with a reason given"]);

    await settle(t);
    expect(await wordsOfEveryDrawn(dave, 2)).toEqual(["to carol with a reason given", "to carol with a reason given"]);
    await leaveTheBoards(carol);
    await settle(t);
    expect(await spotlightSeenBy(dave, { seed: 0 })).toEqual({ kind: "empty" });

    await leaveTheBoards(bob, true);
    await settle(t);
    expect(await wordsOfEveryDrawn(dave, 2)).toEqual(["to bob with a reason given", "to bob with a reason given"]);
  });

  test("the guard skips at most 25 rejected kudos, answering skipped until the recompute has run", async () => {
    t = testBackend({ transactionLimits: true });
    await spotlightOn();
    for (let index = 0; index < 26; index += 1) await give(thanks(bob, `kudos number ${index} with a reason `), { user: alice.user, ts: tsOn(index) });

    await leaveTheBoards(bob);
    const answer = await spotlightSeenBy(dave, { seed: 0 });
    expect(answer).toEqual({ kind: "skipped", after: expect.any(String) });

    await settleInTimeOrder(t);
    expect(await spotlightSeenBy(dave, { seed: 0 })).toEqual({ kind: "empty" });
  });

  test("following skipped comes around once and answers empty while every kudos is turned away", async () => {
    await spotlightOn();
    for (let index = 0; index < 30; index += 1) await give(thanks(bob, `kudos number ${index} with a reason `), { user: alice.user, ts: tsOn(index) });
    await leaveTheBoards(bob);

    const kinds: string[] = [];
    let answer = await spotlightSeenBy(dave, { seed: 0.5 });
    for (let call = 0; call < 5 && answer.kind === "skipped"; call += 1) {
      kinds.push(answer.kind);
      answer = await spotlightSeenBy(dave, { after: answer.after });
    }
    kinds.push(answer.kind);

    expect(kinds).toEqual(["skipped", "empty"]);
  });
});

describe("AT31 AT32: the spotlight stays within Convex's limits", () => {
  const recipientsPerKudos = 400;
  const kudosToHer = 30;

  test("turning away and recomputing kudos with hundreds of recipients each stays within Convex's limits", { timeout: 120_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await spotlightOn();
    const hidden = await manyRecipientKudosTo(kudosToHer, recipientsPerKudos);

    await leaveTheBoards(hidden);
    expect(await spotlightSeenBy(dave, { seed: 0 })).toEqual({ kind: "skipped", after: expect.any(String) });

    await settleInTimeOrder(t);
    expect(await spotlightSeenBy(dave, { seed: 0 })).toEqual({ kind: "empty" });
    expect(await failedJobs()).toEqual([]);
  });

  test("a kudos to hundreds of members still gives within Convex's limits, and joins the draw", { timeout: 120_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await spotlightOn();
    const recipients = await knownMembers(820);
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", baseAllowance: 1_000 }));

    await give([section(text(`thanks ${reason} `), ...recipients.flatMap((user) => [mention(user), text(" ")]), emoji("taco"))], { user: alice.user, ts: tsOn(0) });

    expect((await failedJobs()).filter((job) => !job.startsWith("welcome/"))).toEqual([]);
    expect(await spotlightSeenBy(dave, { seed: 0 })).toMatchObject({ kind: "kudos", recipients: expect.arrayContaining([{ name: "A teammate", face: expect.anything() }]) });
  });

  test("turning one kudos away and drawing one with hundreds of recipients and mentions stays within Convex's limits", { timeout: 120_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await spotlightOn();
    const members = await knownMemberIds(816);
    const hidden = members[0]!;
    const drawnTo = members.slice(1);
    await t.run(async (ctx) => {
      const giver = await ctx.db.insert("members", { workspace: "T1", user: "U_GIVER", kind: "member", name: "Gus Giver", asOf: 0 });
      await ctx.db.insert("leaderboardSettings", { member: hidden, visible: false });
      const mentions = [...drawnTo.map((_, index) => ({ kind: "person" as const, user: `U_R${index + 1}` })), ...Array.from({ length: 1_185 }, (_, index) => ({ kind: "group" as const, group: `S_G${index}` }))];
      const kudos = [
        { message: tsOn(0), to: [...drawnTo.slice(0, 497), hidden], position: 0.1 },
        { message: tsOn(1), to: drawnTo, position: 0.2 },
      ];
      for (const { message, to, position } of kudos) {
        for (const recipient of to) await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver, recipient, kudos: 1, day: "2026-10-14", at: firstTs * 1000 });
        await ctx.db.insert("kudosTexts", { workspace: "T1", conversation: "C1", message, kind: "words", revision: 1n, author: "U_GIVER", edited: false, segments: [{ kind: "text", text: "thanks for the long reason given " }, ...mentions], visibility: "public", gate: { version: 1, thoughtful: true } });
        await ctx.db.insert("spotlightDraws", { workspace: "T1", conversation: "C1", message, position });
      }
    });

    const answer = await spotlightSeenBy(dave, { seed: 0 });

    expect(answer.kind === "kudos" ? answer.recipients.length : answer).toBe(815);
  });
});

describe("AT37: the spotlight behind the activity flag", () => {
  test("answers not-found while activity is off for the member", async () => {
    await switchWebsite(t, postHog, true, "everyone-board");
    await joined(carol);
    await give(thanks(bob), { user: alice.user, ts: tsOn(0) });

    expect(await spotlightAnswerTo(carol)).toEqual({ kind: "not-found" });
  });
});

describe("website reads pass one guard", () => {
  test("the spotlight answers closed while the website is closed, whatever the activity flag says", async () => {
    await switchWebsite(t, postHog, false, "activity");
    await give(thanks(bob), { user: alice.user, ts: tsOn(0) });

    expect(await spotlightAnswerTo(bob)).toEqual({ kind: "closed" });
  });

  test("the spotlight answers signed-out without a session, and not-a-member to a member Slack deactivated", async () => {
    await spotlightOn();
    await give(thanks(bob), { user: alice.user, ts: tsOn(0) });
    const { asSignedIn } = await aSession(t, carol);

    expect(await t.query(api.website.activity.getSpotlight, { seed: 0 })).toEqual({ kind: "signed-out" });
    await memberChanged(t, "user_change", { id: carol.user, team_id: "T1", deleted: true });
    expect(await asSignedIn.query(api.website.activity.getSpotlight, { seed: 0 })).toEqual({ kind: "not-a-member" });
  });
});

async function spotlightAnswerTo(person: { user: string; name: string }) {
  const { asSignedIn } = await aSession(t, person);
  return asSignedIn.query(api.website.activity.getSpotlight, { seed: 0 });
}

async function manyRecipientKudosTo(count: number, recipients: number) {
  const hidden = { user: "U_HANA", name: "Hana Hale" };
  await t.run(async (ctx) => {
    const giver = await ctx.db.insert("members", { workspace: "T1", user: "U_GIVER", kind: "member", name: "Gus Giver", asOf: 0 });
    const others = [];
    for (let index = 0; index < recipients - 1; index += 1) others.push(await ctx.db.insert("members", { workspace: "T1", user: `U_R${index}`, kind: "member", asOf: 0 }));
    const her = await ctx.db.insert("members", { workspace: "T1", user: hidden.user, kind: "member", name: hidden.name, asOf: 0 });
    for (let index = 0; index < count; index += 1) {
      const message = tsOn(index);
      for (const recipient of [...others, her]) await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver, recipient, kudos: 1, day: "2026-10-14", at: (firstTs + index * day) * 1000 });
      await ctx.db.insert("kudosTexts", { workspace: "T1", conversation: "C1", message, kind: "words", revision: 1n, author: "U_GIVER", edited: false, segments: [{ kind: "text", text: `kudos ${index} with a long reason ` }], visibility: "public", gate: { version: 1, thoughtful: true } });
      await ctx.db.insert("spotlightDraws", { workspace: "T1", conversation: "C1", message, position: index / count });
    }
  });
  return hidden;
}

async function knownMembers(count: number) {
  const users = Array.from({ length: count }, (_, index) => `U_R${index}`);
  await t.run(async (ctx) => {
    for (const user of users) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", asOf: 0 });
  });
  return users;
}

async function knownMemberIds(count: number) {
  await knownMembers(count);
  return t.run(async (ctx) => (await ctx.db.query("members").collect()).filter((member) => member.user.startsWith("U_R")).map((member) => member._id));
}

async function failedJobs() {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter((job) => job.state.kind === "failed").map((job) => job.name);
}

async function shownUntil(person: { user: string; name: string }, words: string) {
  let answer = await spotlightSeenBy(person, { seed: 0 });
  for (let draw = 0; draw < 4 && firstWordsOf(answer) !== words; draw += 1) {
    if (answer.kind !== "kudos") break;
    answer = await spotlightSeenBy(person, { after: answer.after });
  }
  if (answer.kind !== "kudos" || firstWordsOf(answer) !== words) throw new Error(`never drew ${words}`);
  return answer.after;
}

async function wordsReceivedBy(person: { user: string; name: string }) {
  const { asSignedIn } = await aSession(t, person);
  const answer = await asSignedIn.query(api.website.activity.getActivity, { filter: "received", cursor: null });
  if (answer.kind !== "activity") throw new Error(`expected the activity, got ${answer.kind}`);
  return answer.entries.flatMap((entry) => ("message" in entry && entry.message.kind === "text" ? entry.message.segments.flatMap((segment) => (segment.kind === "text" ? [segment.text] : [])) : []));
}

async function givenBeforeCapture(blocks: RichElement[], options: { user: string; ts: string }) {
  capture.shipped = false;
  await give(blocks, options);
  capture.shipped = true;
  slack.withMessage("C1", channelMessage(blocks, options));
  await t.action(internal.slack.backfill.backfillWords, {});
  await settleInTimeOrder(t);
}
