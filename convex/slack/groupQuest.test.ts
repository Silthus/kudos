import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { type FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { onForEveryone, postHogDeciding, testBackendServing, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, settle, type Backend } from "../../testing/slackBackend";
import { publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened } from "../../testing/slackMessages";
import crons from "../crons";
import { keepOpen } from "../unlocks/unlocks";

const lastTuesday = Date.parse("2026-10-13T10:00:00Z");
const sunday = Date.parse("2026-10-18T23:00:00Z");
const mondaySweep = Date.parse("2026-10-19T00:10:00Z");
const groupsSyncedAt = Date.parse("2026-10-06T10:00:00Z");
const ants = ["U_ANN", "U_AL", "U_AMY", "U_ABE"];
const everyFlag = ["xp-levels", "unlocks", "quests", "groups", "group-quest"];
const groupQuestLine = "section: Ants quest: Thank someone and say why. · 0 of 3 took part";

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

describe("GB21 GB24: across a Monday 00:00 UTC, a group of 4 participants gets one group quest with target 3, shown in App Home", () => {
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

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}
