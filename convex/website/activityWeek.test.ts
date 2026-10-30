import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import type { MyActivityWeek, NextStep } from "./activity";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const workspaceUrl = "https://kudos-test.slack.com/";
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const fen = { user: "U_FEN", name: "Fen Marlowe" };
const juno = { user: "U_JUNO", name: "Juno Park" };
const cast = [alice, fen, juno];
const albumFlags = ["album", "collection", "packs", "hugs"];
const activityNext = [...albumFlags, "activity-next"];

type Person = { user: string; name: string };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  messages = 0;
  postHog = new FakePostHog();
  slack = new FakeSlack().withWorkspaceUrl(workspaceUrl);
  for (const person of cast) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 1_000, hugBudget: 50 }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HH68: while activity-next is off, Activity is today's weekly edition", { timeout: 60_000 }, () => {
  test("getActivityWeek answers the edition", async () => {
    await switchWebsite(t, postHog, true, ...albumFlags);
    await thanks(fen, "thanks for the demo", alice);

    expect(await activityWeekOf(alice)).toEqual({ kind: "edition" });
  });

  test("while hugs is off it answers the edition, since every step asks for a hug", async () => {
    await switchWebsite(t, postHog, true, ...albumFlags.filter((flag) => flag !== "hugs"), "activity-next");
    await thanks(fen, "thanks for the demo", alice);

    expect(await activityWeekOf(alice)).toEqual({ kind: "edition" });
  });

  test("with the album off it answers off", async () => {
    await switchWebsite(t, postHog, true, "activity-next");
    await thanks(fen, "thanks for the demo", alice);

    expect(await activityWeekOf(alice)).toEqual({ kind: "off" });
  });
});

describe("HH61 HH63: getActivityWeek answers one next step", { timeout: 60_000 }, () => {
  test("a member who never gave a hug and wasn't thanked is asked for their first hug", async () => {
    await switchWebsite(t, postHog, true, ...activityNext);
    await thanks(alice, "thanks for the review", fen);

    expect(await nextStepOf(alice)).toEqual({ kind: "empty" });
  });

  test("a member who hugged before is asked to hug a message today, paying extra while hug-rewards is on", async () => {
    await switchWebsite(t, postHog, true, ...activityNext, "hug-rewards");
    await hugs(alice, fen, await aMessageBy());

    expect(await nextStepOf(alice)).toEqual({ kind: "quiet", firstHugPaysExtra: true });
  });

  test("while hug-rewards is off the quiet step promises no extra XP", async () => {
    await switchWebsite(t, postHog, true, ...activityNext);
    await hugs(alice, fen, await aMessageBy());

    expect(await nextStepOf(alice)).toEqual({ kind: "quiet", firstHugPaysExtra: false });
  });

  test("a member thanked with a kudos is asked to hug it back, opening that kudos in Slack", async () => {
    await switchWebsite(t, postHog, true, ...activityNext);
    const kudos = await thanks(fen, "the demo was brilliant", alice);

    expect(await nextStepOf(alice)).toEqual({ kind: "thanked", giver: expect.objectContaining({ person: await memberOf(fen), name: fen.name }), permalink: permalinkOf(kudos), at: atOf(kudos) });
  });

  test("the newest kudos received comes first", async () => {
    await switchWebsite(t, postHog, true, ...activityNext);
    await thanks(fen, "the demo was brilliant", alice);
    const newest = await thanks(juno, "thanks for the docs", alice);

    expect(await nextStepOf(alice)).toMatchObject({ kind: "thanked", giver: { name: juno.name }, permalink: permalinkOf(newest) });
  });

  test("a kudos the member already hugged back leaves the step to the next one", async () => {
    await switchWebsite(t, postHog, true, ...activityNext);
    const kudos = await thanks(fen, "the demo was brilliant", alice);
    await hugs(alice, fen, kudos);

    expect(await nextStepOf(alice)).toEqual({ kind: "quiet", firstHugPaysExtra: false });
  });

  test("a kudos posted 24 hours ago or more can't be hugged back any more", async () => {
    await switchWebsite(t, postHog, true, ...activityNext);
    await thanks(fen, "the demo was brilliant", alice);
    later(24 * hourMs);

    expect(await nextStepOf(alice)).toEqual({ kind: "empty" });
  });

  test("a kudos whose giver has left can't be hugged back, so the one before it is offered", async () => {
    await switchWebsite(t, postHog, true, ...activityNext);
    await thanks(juno, "thanks for the docs", alice);
    await thanks(fen, "the demo was brilliant", alice);
    await memberChanged(t, "user_change", { id: fen.user, deleted: true });

    expect(await nextStepOf(alice)).toMatchObject({ kind: "thanked", giver: { name: juno.name } });
  });

  test("the newest kudos of the member's own week comes first, whatever day it was where its giver sits", async () => {
    slack.withMember(juno.user, { real_name: juno.name, tz: "Pacific/Kiritimati" }).withMember(fen.user, { real_name: fen.name, tz: "America/Los_Angeles" });
    vi.setSystemTime(new Date("2026-10-18T23:00:00Z"));
    await switchWebsite(t, postHog, true, ...activityNext);
    await thanks(juno, "thanks for the docs", alice);
    vi.setSystemTime(new Date("2026-10-19T00:30:00Z"));
    const newest = await thanks(fen, "the demo was brilliant", alice);

    expect(await nextStepOf(alice)).toMatchObject({ kind: "thanked", giver: { name: fen.name }, permalink: permalinkOf(newest) });
  });

  test("a kudos from before the member's week began isn't offered, though it is still under 24 hours old", async () => {
    vi.setSystemTime(new Date("2026-10-18T23:00:00Z"));
    await switchWebsite(t, postHog, true, ...activityNext);
    await thanks(fen, "the demo was brilliant", alice);
    vi.setSystemTime(new Date("2026-10-19T00:30:00Z"));

    expect(await nextStepOf(alice)).toEqual({ kind: "empty" });
  });

  test("with no hug left today the member isn't asked to hug a kudos back", async () => {
    await t.run(async (ctx) => {
      const workspace = (await ctx.db.query("workspaces").first())!;
      await ctx.db.patch(workspace._id, { hugBudget: 1 });
    });
    await switchWebsite(t, postHog, true, ...activityNext);
    await hugs(alice, juno, await aMessageBy());
    await thanks(fen, "the demo was brilliant", alice);

    expect(await nextStepOf(alice)).toEqual({ kind: "quiet", firstHugPaysExtra: false });
  });

  test("the answer carries the workspace's kudos emoji and the Slack link the step opens", async () => {
    await switchWebsite(t, postHog, true, ...activityNext);
    await thanks(alice, "thanks for the review", fen);

    expect(await activityWeekOf(alice)).toMatchObject({ kind: "week", kudos: { kudosEmoji: "taco" }, slack: expect.stringContaining("T1") });
  });
});

describe("HH91: viewActivity records activity viewed with the page's state", { timeout: 60_000 }, () => {
  test.each(["thanked", "empty", "quiet"] as const)("a view in the %s state records one activity viewed and exposes the flag", async (state) => {
    await switchWebsite(t, postHog, true, ...activityNext);
    await thanks(alice, "thanks for the review", fen);
    const asAlice = await signedIn(alice);

    expect(await asAlice.mutation(api.website.activity.viewActivity, { state })).toEqual({ kind: "viewed" });
    await settle(t);

    expect(activityViewed()).toEqual([{ state }]);
    expect(await exposuresOf("activity-next")).toEqual([{ flag: "activity-next", member: await memberOf(alice), value: true }]);
  });

  test("while activity-next is off a view is refused and records nothing", async () => {
    await switchWebsite(t, postHog, true, ...albumFlags);
    await thanks(alice, "thanks for the review", fen);
    const asAlice = await signedIn(alice);

    expect(await asAlice.mutation(api.website.activity.viewActivity, { state: "empty" })).toEqual({ kind: "refused" });
    await settle(t);

    expect(activityViewed()).toEqual([]);
  });

  test("while hugs is off a view is refused, records nothing and exposes nothing", async () => {
    await switchWebsite(t, postHog, true, ...albumFlags.filter((flag) => flag !== "hugs"), "activity-next");
    await thanks(alice, "thanks for the review", fen);
    const asAlice = await signedIn(alice);

    expect(await asAlice.mutation(api.website.activity.viewActivity, { state: "empty" })).toEqual({ kind: "refused" });
    await settle(t);

    expect(activityViewed()).toEqual([]);
    expect(await exposuresOf("activity-next")).toEqual([]);
  });
});

async function activityWeekOf(person: Person): Promise<MyActivityWeek> {
  return (await signedIn(person)).query(api.website.activity.getActivityWeek, {});
}

async function nextStepOf(person: Person): Promise<NextStep> {
  const answer = await activityWeekOf(person);
  if (answer.kind !== "week") throw new Error(`expected the week, got ${JSON.stringify(answer)}`);
  return answer.next;
}

async function signedIn(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: person.user, name: person.name });
  return asSignedIn;
}

function later(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}

function nextTs() {
  messages += 1;
  later(minuteMs);
  return `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
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

async function aMessageBy() {
  return nextTs();
}

async function hugs(giver: Person, author: Person, ts: string) {
  await react(t, { user: giver.user, itemUser: author.user, ts, eventId: `EvHug${nextTs()}` });
  await settle(t);
}

function activityViewed() {
  return postHog
    .productEvents()
    .filter(({ event }) => event === "activity viewed")
    .map(({ properties }) => ({ state: properties.state }));
}

function exposuresOf(...flags: string[]) {
  return t.run(async (ctx) => (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flags.includes(flag)).map(({ flag, member, value }) => ({ flag, member, value })));
}

async function memberOf(person: Person): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  if (row === null) throw new Error(`${person.name} isn't a member`);
  return row._id;
}
