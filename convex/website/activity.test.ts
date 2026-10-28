import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack, slackError } from "../../testing/fakeSlack";
import { deleteMessage, edit, memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text, tonedEmoji, userGroup } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import type { Activity, ActivityEntry } from "./activity";

const now = new Date("2026-10-14T10:00:00Z");
const postedTs = "1760435000.000100";
const postedAt = 1760435000000;
const alice = { user: "U_ALICE", name: "Alice Archer" };
const bob = { user: "U_BOB", name: "Bob Brandt" };
const carol = { user: "U_CAROL", name: "Carol Chen" };
const reason = "for the calm rollback of the billing service";

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack().withWorkspaceUrl("https://kudos-test.slack.com/");
  for (const person of [alice, bob, carol]) slack.withMember(person.user, { real_name: person.name, tz: "Europe/Berlin" });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function activityOn() {
  return switchWebsite(t, postHog, true, "activity");
}

async function signedIn(person: { user: string; name: string }) {
  const { asSignedIn } = await aSession(t, person, { endsIn: 30 * 24 * 60 * 60 * 1000 });
  return asSignedIn;
}

async function activityOf(asSignedIn: Pick<Backend, "query">, args: { filter: "all" | "received" | "given"; cursor?: string | null; limit?: number }): Promise<Activity> {
  const answer = await asSignedIn.query(api.website.activity.getActivity, { cursor: null, ...args });
  if (answer.kind !== "activity") throw new Error(`expected the activity, got ${answer.kind}`);
  return answer;
}

describe("AT14 AT15 AT21 AT22: a member's activity", () => {
  test("answers a kudos to its recipient as received and to its giver as one given entry with every recipient", async () => {
    await activityOn();

    await post(t, [section(text(`thanks ${reason} `), mention(bob.user), text(" "), mention(carol.user), text(" "), emoji("taco"))], { user: alice.user, ts: postedTs });
    await settle(t);

    const words = [
      { kind: "text", text: `thanks ${reason} ` },
      { kind: "person", name: "Bob Brandt" },
      { kind: "text", text: " " },
      { kind: "person", name: "Carol Chen" },
      { kind: "text", text: " " },
      { kind: "emoji", name: "taco" },
    ];
    const received = await activityOf(await signedIn(bob), { filter: "all" });
    expect(received).toEqual({
      kind: "activity",
      entries: [
        {
          kind: "kudosReceived",
          key: expect.any(String),
          at: postedAt,
          giver: { name: "Alice Archer", face: { kind: "initials", initials: "AA" } },
          channel: { visibility: "public" },
          saidWhy: true,
          permalink: "https://kudos-test.slack.com/archives/C1/p1760435000000100",
          message: { kind: "text", segments: words, edited: false },
        },
      ],
      cursor: null,
      timeZone: "Europe/Berlin",
    });

    const given = await activityOf(await signedIn(alice), { filter: "all" });
    expect(given.entries).toEqual([
      {
        kind: "kudosGiven",
        key: expect.any(String),
        at: postedAt,
        recipients: [
          { name: "Bob Brandt", face: { kind: "initials", initials: "BB" } },
          { name: "Carol Chen", face: { kind: "initials", initials: "CC" } },
        ],
        kudos: 1,
        channel: { visibility: "public" },
        saidWhy: true,
        permalink: "https://kudos-test.slack.com/archives/C1/p1760435000000100",
        message: { kind: "text", segments: words, edited: false },
        earned: null,
      },
    ]);
  });

  test("AT20 WS34: shows a teammate's Slack picture as their face, as the leaderboard does", async () => {
    await activityOn();
    slack.withMember(alice.user, { real_name: alice.name, tz: "Europe/Berlin", profile: { image_192: "https://avatars.slack-edge.com/alice_192.png" } });

    await post(t, [section(text(`thanks ${reason} `), mention(bob.user), text(" "), emoji("taco"))], { user: alice.user, ts: postedTs });
    await settle(t);

    const [entry] = (await activityOf(await signedIn(bob), { filter: "received" })).entries;
    expect(entry).toMatchObject({ giver: { name: "Alice Archer", face: { kind: "slack", image: "https://avatars.slack-edge.com/alice_192.png", initials: "AA" } } });
  });
});

describe("AT12 AT13: a kudos entry's permalink", () => {
  const thanksBob = [section(text(`thanks ${reason} `), mention(bob.user), text(" "), emoji("taco"))];

  async function permalinksSeenBy(person: { user: string; name: string }) {
    const { entries } = await activityOf(await signedIn(person), { filter: "all" });
    return entries.map((entry) => ("permalink" in entry ? entry.permalink : undefined));
  }

  test("links a top-level message and a thread reply exactly as Slack's own permalinks", async () => {
    await activityOn();

    await post(t, thanksBob, { user: alice.user, ts: postedTs });
    await settle(t);
    await post(t, thanksBob, { user: alice.user, ts: "1760435100.000200", threadTs: "1760434000.000300" });
    await settle(t);

    expect(await permalinksSeenBy(bob)).toEqual([
      "https://kudos-test.slack.com/archives/C1/p1760435100000200?thread_ts=1760434000.000300&cid=C1",
      "https://kudos-test.slack.com/archives/C1/p1760435000000100",
    ]);
    expect(slack.callsTo("auth.test")).toHaveLength(1);
  });

  test("asks Slack for the workspace's URL once, however many kudos land before the first answer", async () => {
    await activityOn();

    await post(t, thanksBob, { user: alice.user, ts: postedTs });
    await post(t, thanksBob, { user: alice.user, ts: "1760435100.000200" });
    await post(t, thanksBob, { user: alice.user, ts: "1760435200.000300" });
    await settle(t);

    expect(slack.callsTo("auth.test")).toHaveLength(1);
    expect(await permalinksSeenBy(bob)).toEqual([
      "https://kudos-test.slack.com/archives/C1/p1760435200000300",
      "https://kudos-test.slack.com/archives/C1/p1760435100000200",
      "https://kudos-test.slack.com/archives/C1/p1760435000000100",
    ]);
  });

  test("is null until the workspace's URL is known, and appears once a later kudos fetches it", async () => {
    await activityOn();
    slack.answering("auth.test", slackError("internal_error"));

    await post(t, thanksBob, { user: alice.user, ts: postedTs });
    await settle(t);
    expect(await permalinksSeenBy(bob)).toEqual([null]);

    await post(t, thanksBob, { user: alice.user, ts: "1760435100.000200" });
    await settle(t);
    expect(await permalinksSeenBy(bob)).toEqual(["https://kudos-test.slack.com/archives/C1/p1760435100000200", "https://kudos-test.slack.com/archives/C1/p1760435000000100"]);
  });
});

describe("AT16 AT17 AT18: order, filters and pages", () => {
  const instant = Date.parse("2026-10-14T09:00:00Z");
  const earlier = Date.parse("2026-10-13T09:00:00Z");

  function aNamedMember(name: string, user: string) {
    return t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member", name, asOf: 0 }));
  }

  async function thanks(giver: MemberId, recipients: MemberId[], message: string, at: number) {
    await t.run(async (ctx) => {
      for (const recipient of recipients) await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver, recipient, kudos: 1, day: "2026-10-14", at });
    });
  }

  function seen(entry: ActivityEntry) {
    if (entry.kind === "kudosGiven") return `gave ${entry.recipients.map(({ name }) => name).join(" and ")} at ${entry.at}`;
    if (entry.kind === "kudosReceived") return `got from ${entry.giver.name} at ${entry.at}`;
    return entry.kind === "levelUp" ? `level ${entry.level}` : entry.kind;
  }

  async function aBusyInstant() {
    await activityOn();
    const me = await aNamedMember("Bob Brandt", bob.user);
    const [ada, cy, dee, eve] = await Promise.all([aNamedMember("Ada", "U_ADA"), aNamedMember("Cy", "U_CY"), aNamedMember("Dee", "U_DEE"), aNamedMember("Eve", "U_EVE")]);
    await thanks(eve, [me], "0.1", earlier);
    await thanks(me, [eve], "0.2", earlier);
    await thanks(ada, [me], "1.1", instant);
    await thanks(cy, [me], "1.3", instant);
    await thanks(dee, [me], "1.6", instant);
    await thanks(me, [ada, cy], "1.2", instant);
    await thanks(eve, [cy], "1.4", instant);
    await thanks(me, [dee], "1.5", instant);
    return signedIn(bob);
  }

  const newestFirst = [
    `gave Dee at ${instant}`,
    `gave Ada and Cy at ${instant}`,
    `got from Dee at ${instant}`,
    `got from Cy at ${instant}`,
    `got from Ada at ${instant}`,
    `gave Eve at ${earlier}`,
    `got from Eve at ${earlier}`,
  ];

  async function everyPage(asSignedIn: Pick<Backend, "query">, filter: "all" | "received" | "given", limit: number) {
    const pages: Activity[] = [];
    let cursor: string | null = null;
    do {
      const page: Activity = await activityOf(asSignedIn, { filter, cursor, limit });
      pages.push(page);
      cursor = page.cursor;
    } while (cursor !== null && pages.length < 20);
    return pages;
  }

  test("answers every entry newest decided first, many inside one instant", async () => {
    const asBob = await aBusyInstant();

    const { entries, cursor } = await activityOf(asBob, { filter: "all" });

    expect(entries.map(seen)).toEqual(newestFirst);
    expect(cursor).toBeNull();
  });

  test("pages one entry at a time through one instant, repeating and skipping none, and ends with no cursor", async () => {
    const asBob = await aBusyInstant();

    const pages = await everyPage(asBob, "all", 1);

    expect(pages.flatMap(({ entries }) => entries).map(seen)).toEqual(newestFirst);
    expect(pages.map(({ entries }) => entries.length)).toEqual(newestFirst.map(() => 1));
    expect(pages.at(-1)?.cursor).toBeNull();
    expect(new Set(pages.flatMap(({ entries }) => entries.map((entry) => ("key" in entry ? entry.key : ""))))).toHaveProperty("size", newestFirst.length);
  });

  test("filters to the kudos received or the kudos given, paging each the same way", async () => {
    const asBob = await aBusyInstant();

    for (const limit of [1, 2, 20]) {
      expect((await everyPage(asBob, "received", limit)).flatMap(({ entries }) => entries).map(seen)).toEqual(newestFirst.filter((line) => line.startsWith("got")));
      expect((await everyPage(asBob, "given", limit)).flatMap(({ entries }) => entries).map(seen)).toEqual(newestFirst.filter((line) => line.startsWith("gave")));
    }
  });

  test("a page holds the limit's entries, at most 50 and at least 1", async () => {
    const asBob = await aBusyInstant();

    expect((await activityOf(asBob, { filter: "all", limit: 3 })).entries).toHaveLength(3);
    expect((await activityOf(asBob, { filter: "all", limit: 0 })).entries).toHaveLength(1);
    expect((await activityOf(asBob, { filter: "all", limit: 500 })).entries).toHaveLength(newestFirst.length);
  });
});

describe("AT16: a kudos decided after newer entries", () => {
  const minute = 60_000;
  const slackTsOf = (at: number) => `${at / 1000}.000100`;

  async function thanksBob(giver: { user: string }, at: number) {
    await post(t, [section(text(`thanks ${reason} `), mention(bob.user), text(" "), emoji("taco"))], { user: giver.user, ts: slackTsOf(at) });
    await settle(t);
    vi.advanceTimersByTime(minute);
  }

  function seen(entry: ActivityEntry) {
    return entry.kind === "kudosReceived" ? `${entry.giver.name} at ${entry.at}` : entry.kind;
  }

  test("answers first on the newest page, at its Slack time", async () => {
    await activityOn();
    await thanksBob(alice, postedAt);

    await thanksBob(carol, postedAt - 10 * minute);

    const newest = await activityOf(await signedIn(bob), { filter: "all", limit: 1 });
    expect(newest.entries.map(seen)).toEqual([`Carol Chen at ${postedAt - 10 * minute}`]);
  });

  test("pages read before it continue without repeating or skipping a row, and the newest page shows it", async () => {
    await activityOn();
    await thanksBob(alice, postedAt - 2 * minute);
    await thanksBob(carol, postedAt - minute);
    await thanksBob(alice, postedAt);
    const asBob = await signedIn(bob);
    const first = await activityOf(asBob, { filter: "received", limit: 1 });

    await thanksBob(carol, postedAt - 30 * minute);
    const rest = await activityOf(asBob, { filter: "received", cursor: first.cursor, limit: 10 });
    const newest = await activityOf(asBob, { filter: "received", limit: 10 });

    expect([...first.entries, ...rest.entries].map(seen)).toEqual([`Alice Archer at ${postedAt}`, `Carol Chen at ${postedAt - minute}`, `Alice Archer at ${postedAt - 2 * minute}`]);
    expect(rest.cursor).toBeNull();
    expect(newest.entries.map(seen)).toEqual([`Carol Chen at ${postedAt - 30 * minute}`, ...[...first.entries, ...rest.entries].map(seen)]);
  });
});

describe("AT23 AT24 AT27: what a kudos entry says", () => {
  const thanksBob = [section(text(`thanks ${reason} `), mention(bob.user), text(" "), emoji("taco"))];

  async function messageSeenBy(person: { user: string; name: string }) {
    const [entry] = (await activityOf(await signedIn(person), { filter: "all" })).entries;
    if (entry?.kind !== "kudosGiven" && entry?.kind !== "kudosReceived") throw new Error("expected a kudos entry");
    return { message: entry.message, channel: entry.channel, saidWhy: entry.saidWhy };
  }

  test("an edited kudos answers its newest words, marked edited", async () => {
    await activityOn();
    await post(t, thanksBob, { user: alice.user, ts: postedTs });
    await settle(t);

    await edit(t, [section(text("thanks for the patient late night migration "), mention(bob.user), text(" "), emoji("taco"))], { user: alice.user, ts: postedTs, editedTs: "1760435060.000100" });
    await settle(t);

    expect((await messageSeenBy(bob)).message).toEqual({
      kind: "text",
      segments: [
        { kind: "text", text: "thanks for the patient late night migration " },
        { kind: "person", name: "Bob Brandt" },
        { kind: "text", text: " " },
        { kind: "emoji", name: "taco" },
      ],
      edited: true,
    });
  });

  test("an emoji Slack sent with a skin tone answers it in the emoji's name, without Slack's untoned character, to the giver and the recipient", async () => {
    await activityOn();
    await post(t, [section(text(`thanks ${reason} `), mention(bob.user), text(" "), emoji("taco"), tonedEmoji("raised_hands", 4, "1f64c"))], { user: alice.user, ts: postedTs });
    await settle(t);

    for (const person of [alice, bob]) {
      const { message } = await messageSeenBy(person);
      if (message.kind !== "text") throw new Error(`expected the words, got ${message.kind}`);
      expect(message.segments.at(-1)).toEqual({ kind: "emoji", name: "raised_hands::skin-tone-4" });
    }
  });

  test("a kudos deleted in Slack, or edited so it no longer is one, leaves the activity of its giver and its recipient", async () => {
    await activityOn();
    const kept = "1760435200.000300";
    await post(t, thanksBob, { user: alice.user, ts: postedTs });
    await post(t, thanksBob, { user: alice.user, ts: "1760435100.000200" });
    await post(t, thanksBob, { user: alice.user, ts: kept });
    await settle(t);

    await deleteMessage(t, { user: alice.user, ts: postedTs, previous: thanksBob });
    await edit(t, [section(text(`thanks ${reason} `), mention(bob.user))], { user: alice.user, ts: "1760435100.000200", editedTs: "1760435160.000100" });
    await settle(t);

    for (const [person, filter] of [[bob, "received"], [alice, "given"], [bob, "all"], [alice, "all"]] as const) {
      const { entries, cursor } = await activityOf(await signedIn(person), { filter, limit: 1 });
      expect(entries.map((entry) => entry.at)).toEqual([1760435200000]);
      expect(cursor).toBeNull();
    }
  });

  test("a kudos edited away and back into one shows again", async () => {
    await activityOn();
    await post(t, thanksBob, { user: alice.user, ts: postedTs });
    await settle(t);

    await edit(t, [section(text(`thanks ${reason} `), mention(bob.user))], { user: alice.user, ts: postedTs, editedTs: "1760435060.000100" });
    await edit(t, thanksBob, { user: alice.user, ts: postedTs, editedTs: "1760435120.000100" });
    await settle(t);

    expect((await messageSeenBy(bob)).message).toMatchObject({ kind: "text", edited: true });
  });

  test("a kudos whose author left Slack answers removed at once, from an unknown channel", async () => {
    await activityOn();
    await post(t, thanksBob, { user: alice.user, ts: postedTs });
    await settle(t);

    await memberChanged(t, "user_change", { id: alice.user, team_id: "T1", deleted: true });
    await settle(t);

    expect(await messageSeenBy(bob)).toEqual({ message: { kind: "unavailable", reason: "removed" }, channel: { visibility: "unknown" }, saidWhy: true });
    const [entry] = (await activityOf(await signedIn(bob), { filter: "all" })).entries;
    expect(entry).toMatchObject({ giver: { name: "A teammate", face: { kind: "initials", initials: "?" } } });
  });

  async function aKudosGivenBeforeCapture() {
    const giver = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: alice.user, kind: "member", name: alice.name, asOf: 0 }));
    const recipient = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: bob.user, kind: "member", name: bob.name, asOf: 0 }));
    await t.run((ctx) => ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: "1700000000.000100", giver, recipient, kudos: 1, day: "2023-11-14", at: 1700000000000 }));
    return { workspace: "T1", conversation: "C1", message: "1700000000.000100" };
  }

  test("a kudos given before its words were kept answers not-captured from an unknown channel, without a said-why decision", async () => {
    await activityOn();
    await aKudosGivenBeforeCapture();

    expect(await messageSeenBy(bob)).toEqual({ message: { kind: "unavailable", reason: "not-captured" }, channel: { visibility: "unknown" }, saidWhy: null });
  });

  test("AT35: a kudos whose words the backfill filled reads its channel as unknown", async () => {
    await activityOn();
    await post(t, thanksBob, { user: alice.user, ts: postedTs });
    await settle(t);
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("kudosTexts").collect()) await ctx.db.delete(row._id);
    });
    const words = `thanks ${reason} `;

    const hydration = await t.mutation(internal.slack.backfill.hydrateWords, {
      fetched: {
        ref: { workspace: "T1", conversation: "C1", message: postedTs },
        author: alice.user,
        revision: 1760435000000100n,
        edited: false,
        content: { mentions: [{ kind: "person", user: bob.user }], emoji: ["taco"], text: words },
        segments: [{ kind: "text", text: words }],
      },
    });

    expect(hydration).toEqual({ kind: "hydrated" });
    expect(await messageSeenBy(bob)).toEqual({ message: { kind: "text", segments: [{ kind: "text", text: words }], edited: false }, channel: { visibility: "unknown" }, saidWhy: true });
  });

  test("a private channel's kudos reads private, a short one did not say why, and mentions read as names and handles", async () => {
    await activityOn();
    await t.run((ctx) => ctx.db.insert("userGroups", { workspace: "T1", group: "S_ONCALL", handle: "oncall", name: "On call", enabled: true, automatic: false, asOf: 0 }));
    slack.withMember("U_GONE", { deleted: true });

    await post(t, [section(text("ty "), mention(bob.user), text(" "), userGroup("S_ONCALL"), text(" "), mention("U_GONE"), text(" "), emoji("taco"))], { user: alice.user, ts: postedTs, channelType: "group" });
    await settle(t);

    expect(await messageSeenBy(bob)).toEqual({
      message: {
        kind: "text",
        segments: [
          { kind: "text", text: "ty " },
          { kind: "person", name: "Bob Brandt" },
          { kind: "text", text: " " },
          { kind: "group", handle: "oncall" },
          { kind: "text", text: " " },
          { kind: "person", name: "A teammate" },
          { kind: "text", text: " " },
          { kind: "emoji", name: "taco" },
        ],
        edited: false,
      },
      channel: { visibility: "private" },
      saidWhy: false,
    });
  });
});

describe("AT14 AT28: a member's activity holds only kudos they gave or received", () => {
  test("another member's kudos never appear, and no entry carries an ID", { timeout: 30_000 }, async () => {
    await activityOn();
    await post(t, [section(text(`thanks ${reason} `), mention(carol.user), text(" "), emoji("taco"))], { user: alice.user, ts: postedTs, channelType: "group" });
    await post(t, [section(text("thanks for pairing on the flaky test today "), mention(bob.user), text(" "), emoji("taco"))], { user: carol.user, ts: "1760435100.000200" });
    await settle(t);

    const asBob = await signedIn(bob);
    const { entries } = await activityOf(asBob, { filter: "all" });

    const recent = await Promise.all((["received", "given"] as const).map((direction) => asBob.query(api.website.activity.getRecentKudos, { direction })));
    expect(entries.map((entry) => entry.kind)).toEqual(["kudosReceived"]);
    expect(recent).toEqual([{ kind: "recent", entries }, { kind: "recent", entries: [] }]);
    expect(JSON.stringify(entries)).not.toContain(reason);
    const ids = await t.run(async (ctx) => [...(await ctx.db.query("members").collect()), ...(await ctx.db.query("awards").collect())].map(({ _id }) => _id));
    for (const id of [...ids, alice.user, bob.user, carol.user]) expect(JSON.stringify(entries)).not.toContain(id);
  });
});

describe("AT30: the last few kudos", () => {
  test("answers at most 10 entries of one direction, 5 unless asked", async () => {
    await activityOn();
    const me = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: bob.user, kind: "member", name: bob.name, asOf: 0 }));
    const teammate = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: alice.user, kind: "member", name: alice.name, asOf: 0 }));
    await t.run(async (ctx) => {
      for (let index = 0; index < 12; index++) {
        const at = postedAt + index * 1000;
        await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `received-${index}`, giver: teammate, recipient: me, kudos: 1, day: "2026-10-14", at });
        await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `given-${index}`, giver: me, recipient: teammate, kudos: 1, day: "2026-10-14", at });
      }
    });
    const asBob = await signedIn(bob);

    const recent = (args: { direction: "received" | "given"; limit?: number }) => asBob.query(api.website.activity.getRecentKudos, args);

    const lastFive = await recent({ direction: "received" });
    expect(lastFive).toMatchObject({ kind: "recent" });
    if (lastFive.kind !== "recent") return;
    expect(lastFive.entries.map(({ kind, at }) => ({ kind, at }))).toEqual([11, 10, 9, 8, 7].map((index) => ({ kind: "kudosReceived", at: postedAt + index * 1000 })));
    const atMostTen = await recent({ direction: "given", limit: 50 });
    if (atMostTen.kind !== "recent") throw new Error("expected the recent kudos");
    expect(atMostTen.entries).toHaveLength(10);
    expect(new Set(atMostTen.entries.map(({ kind }) => kind))).toEqual(new Set(["kudosGiven"]));
  });
});

function bothReads(asSomeone: Pick<Backend, "query">) {
  return Promise.all([asSomeone.query(api.website.activity.getActivity, { filter: "all", cursor: null }), asSomeone.query(api.website.activity.getRecentKudos, { direction: "received" })]);
}

async function aKudosToBob() {
  await post(t, [section(text(`thanks ${reason} `), mention(bob.user), text(" "), emoji("taco"))], { user: alice.user, ts: postedTs });
  await settle(t);
}

describe("AT37: behind the activity flag", () => {
  test("both reads answer not-found while activity is off for the member", async () => {
    await switchWebsite(t, postHog, true);
    await aKudosToBob();

    expect(await bothReads(await signedIn(bob))).toEqual([{ kind: "not-found" }, { kind: "not-found" }]);
  });
});

describe("website reads pass one guard", () => {
  test("the activity reads answer closed while the website is closed, whatever the activity flag says", async () => {
    await switchWebsite(t, postHog, false, "activity");
    await aKudosToBob();

    expect(await bothReads(await signedIn(bob))).toEqual([{ kind: "closed" }, { kind: "closed" }]);
  });

  test("the activity reads answer signed-out without a session, and not-a-member to a member Slack deactivated", async () => {
    await activityOn();
    await aKudosToBob();
    const asBob = await signedIn(bob);

    expect(await bothReads(t)).toEqual([{ kind: "signed-out" }, { kind: "signed-out" }]);
    await memberChanged(t, "user_change", { id: bob.user, team_id: "T1", deleted: true });
    expect(await bothReads(asBob)).toEqual([{ kind: "not-a-member" }, { kind: "not-a-member" }]);
  });
});

describe("AT18: a page's reads are bounded", () => {
  test("a page of kudos full of mentions stays within Convex's limits, repeated mentions resolved once", { timeout: 60_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await activityOn();
    const me = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: bob.user, kind: "member", name: bob.name, asOf: 0 }));
    const teammate = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: alice.user, kind: "member", name: alice.name, asOf: 0 }));
    await t.run(async (ctx) => {
      for (let index = 0; index < 50; index++) {
        const message = `1760435${String(index).padStart(3, "0")}.000100`;
        const mentions = Array.from({ length: 100 }, (_, mentioned) => ({ kind: "person" as const, user: mentioned % 2 === 0 ? bob.user : `U_${index}_${mentioned}` }));
        await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver: teammate, recipient: me, kudos: 1, day: "2026-10-14", at: postedAt + index });
        await ctx.db.insert("kudosTexts", { workspace: "T1", conversation: "C1", message, kind: "words", revision: 1n, author: alice.user, edited: false, segments: mentions, visibility: "public", gate: null });
      }
    });

    const { entries } = await activityOf(await signedIn(bob), { filter: "received", limit: 50 });

    expect(entries).toHaveLength(50);
    const [newest] = entries;
    if (newest?.kind !== "kudosReceived" || newest.message.kind !== "text") throw new Error("expected the newest kudos's words");
    expect(newest.message.segments.slice(0, 2)).toEqual([
      { kind: "person", name: "Bob Brandt" },
      { kind: "person", name: "A teammate" },
    ]);
  });

  test("a page and the next stay within Convex's limits for a member with a long history inside one instant", { timeout: 60_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await activityOn();
    const me = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: bob.user, kind: "member", name: bob.name, asOf: 0 }));
    const teammate = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: alice.user, kind: "member", name: alice.name, asOf: 0 }));
    for (let batch = 0; batch < 9; batch++) {
      await t.run(async (ctx) => {
        for (let index = batch * 4000; index < (batch + 1) * 4000; index++) {
          await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `received-${index}`, giver: teammate, recipient: me, kudos: 1, day: "2026-10-14", at: postedAt });
          await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `given-${index}`, giver: me, recipient: teammate, kudos: 1, day: "2026-10-14", at: postedAt });
        }
      });
    }
    const asBob = await signedIn(bob);

    const first = await activityOf(asBob, { filter: "all", limit: 50 });
    const next = await activityOf(asBob, { filter: "all", cursor: first.cursor, limit: 50 });

    expect([first.entries.length, next.entries.length]).toEqual([50, 50]);
    expect(next.entries[0]?.kind).toBe("kudosGiven");
    expect(new Set([...first.entries, ...next.entries].map((entry) => ("key" in entry ? entry.key : "")))).toHaveProperty("size", 100);
  });

  test("messages that each thanked hundreds of people page within Convex's limits, skipping and repeating none", { timeout: 120_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await activityOn();
    const messages = 40;
    const recipientsEach = 820;
    const me = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: bob.user, kind: "member", name: bob.name, asOf: 0 }));
    const thanked = await t.run(async (ctx) => {
      const ids = [];
      for (let index = 0; index < recipientsEach; index++) ids.push(await ctx.db.insert("members", { workspace: "T1", user: `U_${index}`, kind: "member", asOf: 0 }));
      return ids;
    });
    for (let index = 0; index < messages; index++) {
      await t.run(async (ctx) => {
        await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `received-${index}`, giver: thanked[0]!, recipient: me, kudos: 1, day: "2026-10-14", at: postedAt + index });
        for (const recipient of thanked) await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `given-${index}`, giver: me, recipient, kudos: 1, day: "2026-10-14", at: postedAt + index });
      });
    }
    const asBob = await signedIn(bob);

    async function everyPage(filter: "all" | "given") {
      const seen: string[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 2 * messages + 1; page++) {
        const answer: Activity = await activityOf(asBob, { filter, cursor, limit: 50 });
        for (const entry of answer.entries) seen.push(`${entry.kind} ${entry.at}${entry.kind === "kudosGiven" ? ` ${entry.recipients.length}` : ""}`);
        cursor = answer.cursor;
        if (cursor === null) return seen;
      }
      throw new Error("the pages never ended");
    }
    const recent = await asBob.query(api.website.activity.getRecentKudos, { direction: "given", limit: 10 });

    const newestFirst = Array.from({ length: messages }, (_, index) => postedAt + messages - 1 - index);
    expect(await everyPage("given")).toEqual(newestFirst.map((at) => `kudosGiven ${at} ${recipientsEach}`));
    expect(await everyPage("all")).toEqual(newestFirst.flatMap((at) => [`kudosGiven ${at} ${recipientsEach}`, `kudosReceived ${at}`]));
    expect(recent.kind === "recent" && recent.entries.length).toBeGreaterThan(0);
  });
});
