import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { type FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { onForEveryone, postHogDeciding, testBackendServing, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, settle, settleInTimeOrder, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, publishedHome, publishedHomeBlocks, type Block, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import crons from "../crons";
import { keepOpen } from "../unlocks/unlocks";

const lastTuesday = Date.parse("2026-10-13T10:00:00Z");
const sunday = Date.parse("2026-10-18T23:00:00Z");
const mondaySweep = Date.parse("2026-10-19T00:10:00Z");
const groupsSyncedAt = Date.parse("2026-10-06T10:00:00Z");
const ants = ["U_ANN", "U_AL", "U_AMY", "U_ABE"];
const everyFlag = ["xp-levels", "unlocks", "quests", "groups", "group-quest"];
const tuesday = Date.parse("2026-10-20T10:00:00Z");
const groupQuestLine = "section: Ants quest: Thank someone and say why. · 0 of 3 took part";
const groupQuestDoneLine = "section: Ants quest: Thank someone and say why. · 3 of 3 took part · ✅";
const saysWhy = "thanks for untangling the release notes today";
const earlierGroupCrateLine = "section: *Week of Oct 19:* ✅ Ants quest: Thank someone and say why.";

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: groupsSyncedAt });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
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

describe("GB21 GB24: across a Monday 00:00 UTC, a group of 4 participants gets one group quest with target 3, shown in App Home", { timeout: 60_000 }, () => {
  test("App Home's Quests section shows each participant Ants quest: Thank someone and say why. · 0 of 3 took part from the Monday sweep, and nothing the week before", async () => {
    const t = await antsOpenedQuests();
    await sweepAt(t, lastTuesday);

    vi.setSystemTime(sunday);
    await openHome(t, "U_ANN");
    expect(publishedHome(slack, "U_ANN")).not.toContain(groupQuestLine);

    await sweepAt(t, mondaySweep);
    for (const user of ants) await openHome(t, user);

    for (const user of ants) {
      const home = publishedHome(slack, user);
      const quests = home.indexOf("section: *Quests this week*");
      expect(quests).toBeGreaterThanOrEqual(0);
      expect(home.indexOf(groupQuestLine)).toBeGreaterThan(quests);
    }
  });
});

describe("GB23 GB24: a week of kudos that say why finishes the group quest, and App Home shows it done with counts only", { timeout: 60_000 }, () => {
  test("three Ants who each give a kudos that says why see 3 of 3 took part · ✅ with their crate to open; Abe, who gave none, sees it done without one; no success reply speaks of the group quest", async () => {
    const t = await antsOpenedQuests();
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);

    vi.setSystemTime(tuesday);
    for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient, saysWhy);
    for (const user of ants) await openHome(t, user);

    for (const user of ["U_ANN", "U_AL", "U_AMY"]) expect(publishedHome(slack, user)).toContain(`${groupQuestDoneLine} [button: Open]`);
    expect(publishedHome(slack, "U_ABE")).toContain(groupQuestDoneLine);
    for (const user of ants) expect(slack.ephemeralsTo(user).map(({ text }) => String(text)).join("\n")).not.toContain("Ants");
  });

  test("Open on the group quest's crate opens it once and leaves the done line", async () => {
    const t = await antsOpenedQuests();
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);
    vi.setSystemTime(tuesday);
    for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient, saysWhy);
    await openHome(t, "U_ANN");

    await click(t, "U_ANN", groupQuestCrateIn(publishedHomeBlocks(slack, "U_ANN")));

    expect(publishedHome(slack, "U_ANN")).toContain(groupQuestDoneLine);
    expect(await t.run((ctx) => ctx.db.query("crateOpenings").collect())).toEqual([expect.objectContaining({ key: expect.stringMatching(/^group:/) })]);
  });
});

describe("GB23 P85: a group crate left unopened waits in App Home after its week", { timeout: 60_000 }, () => {
  test("next week, App Home lists Ann's unopened Ants crate under Waiting to open, and Open opens it", async () => {
    const t = await antsOpenedQuests();
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);
    vi.setSystemTime(tuesday);
    for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient, saysWhy);

    vi.setSystemTime(tuesday + 7 * 24 * 60 * 60 * 1000);
    await openHome(t, "U_ANN");
    expect(publishedHome(slack, "U_ANN")).toContain(`${earlierGroupCrateLine} [button: Open]`);

    await click(t, "U_ANN", buttonIn(publishedHomeBlocks(slack, "U_ANN").filter(({ text }) => text?.text === earlierGroupCrateLine.replace("section: ", "")), "Open"));

    expect(publishedHome(slack, "U_ANN").join("\n")).not.toContain("Ants quest:");
    expect(await t.run((ctx) => ctx.db.query("crateOpenings").collect())).toEqual([expect.objectContaining({ key: expect.stringMatching(/^group:.+:2026-10-19$/) })]);
  });
});

async function antsOpenedQuests(): Promise<Backend> {
  const t = await testBackendServing(postHog, ...everyFlag.map(onForEveryone));
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
  return t;
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

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleInTimeOrder(t);
}

function groupQuestCrateIn(blocks: Block[]) {
  return buttonIn(blocks.filter(({ text }) => text?.text.startsWith("Ants quest:")), "Open");
}

async function click(t: Backend, user: string, action: BlockAction) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), { contentType: "application/x-www-form-urlencoded" }));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}
