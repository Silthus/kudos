import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, onForEveryone, postHogDeciding } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";

const mondayAtNine = new Date("2026-10-19T09:00:00Z");
const lastWeek = "week:2026-10-12";
const weekBefore = "week:2026-10-05";
const groups = 60;
const membersPerGroup = 25;

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: mondayAtNine });
  postHog = postHogDeciding().withFlags(onForEveryone("monday-post"));
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GB35: the Monday post at scale", () => {
  test("1,500 members in 60 groups who all gave last week and the week before: claiming the week reads last week's top groups and givers within Convex's transaction limits", async () => {
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    await sixtyGroupsWhoGaveForTwoWeeks(t);

    const claimed = await t.mutation(internal.leaderboard.mondayPost.claimWeek, { workspace: "T1", generation: 1 });

    expect(claimed?.post).toEqual({
      groups: [
        { rank: 1, name: "Group 04", perMember: 5 },
        { rank: 1, name: "Group 09", perMember: 5 },
        { rank: 1, name: "Group 14", perMember: 5 },
      ],
      mostImproved: "Group 04",
      givers: 1_500,
    });
  }, 300_000);
});

async function sixtyGroupsWhoGaveForTwoWeeks(t: Backend) {
  await t.run(async (ctx) => {
    await ctx.db.insert("workspaces", { workspace: "T1", announcementChannel: "C_ANNOUNCE" });
    await ctx.db.insert("mondayPostSettings", { workspace: "T1", on: true, timeZone: "UTC", generation: 1 });
  });
  for (let group = 0; group < groups; group += 1) {
    await t.run(async (ctx) => {
      const name = `Group ${String(group).padStart(2, "0")}`;
      const id = await ctx.db.insert("userGroups", { workspace: "T1", group: `S_${group}`, handle: `g${group}`, name, enabled: true, automatic: false, members: membersPerGroup, asOf: 0, membersAsOf: 0 });
      const [kudosLastWeek, kudosTheWeekBefore] = [1 + (group % 5), 1 + ((group + 1) % 5)];
      for (let index = 0; index < membersPerGroup; index += 1) {
        const member = await ctx.db.insert("members", { workspace: "T1", user: `U${String(group * membersPerGroup + index).padStart(4, "0")}`, kind: "member", asOf: 0 });
        await ctx.db.insert("memberGroups", { workspace: "T1", member, groups: [id], primary: id });
        await ctx.db.insert("attributedTotals", { workspace: "T1", group: id, member, period: lastWeek, kudos: kudosLastWeek, runningTotal: [kudosLastWeek] });
        await ctx.db.insert("attributedTotals", { workspace: "T1", group: id, member, period: weekBefore, kudos: kudosTheWeekBefore, runningTotal: [kudosTheWeekBefore] });
        await ctx.db.insert("givenTotals", { workspace: "T1", member, period: lastWeek, kudos: kudosLastWeek, runningTotal: [kudosLastWeek] });
      }
      await ctx.db.insert("attributedGroupTotals", { workspace: "T1", group: id, period: lastWeek, kudos: kudosLastWeek * membersPerGroup, runningTotal: [kudosLastWeek * membersPerGroup] });
      await ctx.db.insert("attributedGroupTotals", { workspace: "T1", group: id, period: weekBefore, kudos: kudosTheWeekBefore * membersPerGroup, runningTotal: [kudosTheWeekBefore * membersPerGroup] });
    });
  }
}
