import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, postHogDeciding, testBackendServing, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest } from "../../testing/signedSlack";
import { memberChanged, settle, settleInTimeOrder, type Backend } from "../../testing/slackBackend";
import { emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import crons from "../crons";
import { keepOpen } from "../unlocks/unlocks";
import type { GroupQuestCard, QuestsAnswer } from "./quests";

const groupsSyncedAt = Date.parse("2026-10-06T10:00:00Z");
const lastTuesday = Date.parse("2026-10-13T10:00:00Z");
const mondaySweep = Date.parse("2026-10-19T00:10:00Z");
const tuesday = Date.parse("2026-10-20T10:00:00Z");
const nextTuesday = tuesday + 7 * 24 * 60 * 60 * 1000;
const thisWeek = "2026-10-19";
const ants = ["U_ANN", "U_AL", "U_AMY", "U_ABE"];
const groupQuestFlags = ["xp-levels", "unlocks", "quests", "groups", "group-quest"];
const saysWhy = "thanks for untangling the release notes today";
const goal = "Thank someone and say why.";

let postHog: FakePostHog;
let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now: groupsSyncedAt });
  aDeploymentForWorkspace();
  slack = new FakeSlack();
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WS344 P82: getQuests carries the member's group quest as counts, never names", { timeout: 60_000 }, () => {
  test("after the Monday draw, each Ant reads the Ants quest with 0 of 3 who took part, their own part, the reward and no crate", async () => {
    const t = await antsWithTheGroupQuestDrawn(...groupQuestFlags);

    const quests = await questsOf(t, "U_ANN");

    expect(quests.group).toEqual({ group: "Ants", goal, progress: { done: 0, target: 3 }, you: false, reward: { xp: 0 }, state: "in-progress", waiting: false, crate: null, seen: null });
  });

  test("three Ants who said why read it finished with their own crate to claim; Abe, who gave none, reads it finished with no crate", async () => {
    const t = await antsWithTheGroupQuestDrawn(...groupQuestFlags);
    await threeAntsSayWhy(t);

    const ann = await questsOf(t, "U_ANN");
    const abe = await questsOf(t, "U_ABE");

    expect(ann.group).toEqual(expect.objectContaining<Partial<GroupQuestCard>>({ progress: { done: 3, target: 3 }, you: true, state: "finished", crate: { kind: "group", group: expect.any(String), week: thisWeek }, seen: expect.any(String) }));
    expect(abe.group).toEqual(expect.objectContaining<Partial<GroupQuestCard>>({ progress: { done: 3, target: 3 }, you: false, state: "finished", crate: null, seen: null }));
    expect(JSON.stringify(ann.group)).not.toMatch(/U_A|ANN|AMY|ABE/);
  });

  test("Claim on the group crate opens it once through openQuestCrate, and the card reads opened", async () => {
    const t = await antsWithTheGroupQuestDrawn(...groupQuestFlags);
    await threeAntsSayWhy(t);
    const crate = (await questsOf(t, "U_ANN")).group!.crate!;

    const { asSignedIn } = await aSession(t, { user: "U_ANN" });
    const answer = await asSignedIn.mutation(api.website.commands.openQuestCrate, { quest: crate });
    await settle(t);

    expect(answer).toEqual(expect.objectContaining({ kind: "opened" }));
    expect((await questsOf(t, "U_ANN")).group).toEqual(expect.objectContaining<Partial<GroupQuestCard>>({ state: "opened", crate: null, seen: expect.any(String) }));
  });

  test("a group crate left unopened waits under the earlier weeks' crates, labelled with its group", async () => {
    const t = await antsWithTheGroupQuestDrawn(...groupQuestFlags);
    await threeAntsSayWhy(t);
    vi.setSystemTime(nextTuesday);

    const { waiting } = await questsOf(t, "U_ANN");

    expect(waiting.filter(({ crate }) => crate.kind === "group")).toEqual([{ group: "Ants", goal, week: thisWeek, reward: { xp: 0 }, crate: { kind: "group", group: expect.any(String), week: thisWeek }, seen: expect.any(String), waiting: false }]);
  });

  test("with coins and crate-rewards on, a finished group quest shows its 15 coins, held until the crate opens", async () => {
    const t = await antsWithTheGroupQuestDrawn(...groupQuestFlags, "coins", "crate-rewards");
    await t.run(async (ctx) => keepOpen(ctx, { workspace: "T1", member: await memberOf(ctx, "U_ANN"), at: Date.now() }, "coins"));
    await threeAntsSayWhy(t);

    const { group } = await questsOf(t, "U_ANN");

    expect(group).toEqual(expect.objectContaining<Partial<GroupQuestCard>>({ reward: { xp: 0, coins: 15 }, state: "finished", waiting: true }));
  });

  test("with group-quest off, getQuests carries no group quest and no group crate", async () => {
    const t = await antsWithTheGroupQuestDrawn(...groupQuestFlags.filter((flag) => flag !== "group-quest"));

    const quests = await questsOf(t, "U_ANN");

    expect(quests.group).toBeNull();
    expect(quests.waiting).toEqual([]);
  });
});

describe("F26 F27 F28 F29: a member previews the website by their own decision", { timeout: 60_000 }, () => {
  test("with groups turned off after the group quest finished, a stale Claim on the group crate is refused and opens nothing", async () => {
    const t = await antsWithTheGroupQuestDrawn(...groupQuestFlags);
    await threeAntsSayWhy(t);
    const crate = (await questsOf(t, "U_ANN")).group!.crate!;
    await flagsFromPostHog(t, postHog, ...[...groupQuestFlags.filter((flag) => flag !== "groups"), "website"].map(onForEveryone), offForEveryone("groups"));

    const { asSignedIn } = await aSession(t, { user: "U_ANN" });
    const answer = await asSignedIn.mutation(api.website.commands.openQuestCrate, { quest: crate });
    await settle(t);

    expect(answer, "a group crate opened through the website with groups off").toEqual({ kind: "refused" });
    expect(await t.run((ctx) => ctx.db.query("crateOpenings").collect()), "a crate opening stored with groups off").toEqual([]);
  });
});

async function antsWithTheGroupQuestDrawn(...flags: string[]): Promise<Backend> {
  const t = await testBackendServing(postHog, ...[...flags, "website"].map(onForEveryone));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await unlocksShippedBeforeAnyoneJoined(t);
  for (const user of ants) slack.withMember(user, { profile: { display_name: user.slice(2) } });
  slack.withUserGroup("S_ANTS", { name: "Ants", users: ants });
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  for (const user of ants) {
    await memberChanged(t, "team_join", { id: user, profile: { display_name: user.slice(2) } });
    await settle(t);
  }
  vi.setSystemTime(lastTuesday);
  await t.run(async (ctx) => {
    for (const user of ants) await keepOpen(ctx, { workspace: "T1", member: await memberOf(ctx, user), at: lastTuesday }, "quests");
  });
  await settle(t);
  await sweepAt(t, lastTuesday);
  await sweepAt(t, mondaySweep);
  vi.setSystemTime(tuesday);
  return t;
}

async function questsOf(t: Backend, user: string): Promise<Extract<QuestsAnswer, { kind: "quests" }>> {
  const { asSignedIn } = await aSession(t, { user });
  const answer = await asSignedIn.query(api.website.quests.getQuests, {});
  if (answer.kind !== "quests") throw new Error(`expected quests, got ${answer.kind}`);
  return answer;
}

async function threeAntsSayWhy(t: Backend) {
  for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient);
}

async function memberOf(ctx: MutationCtx, user: string) {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}

async function sweepAt(t: Backend, at: number) {
  vi.setSystemTime(at);
  const job = crons.crons["draw each group's weekly group quest"];
  if (job === undefined) throw new Error("no cron job draws each group's weekly group quest");
  await t.mutation(makeFunctionReference<"mutation">(job.name), {});
  await settle(t);
}

let sentMessages = 0;

async function giveKudos(t: Backend, giver: string, recipient: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${saysWhy} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleInTimeOrder(t);
}
