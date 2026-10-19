import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, onForEveryone, postHogDeciding } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const mondayAtNine = new Date("2026-10-19T09:00:00Z");
const lastWeek = "week:2026-10-12";
const weekBefore = "week:2026-10-05";
const groups = 60;

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: mondayAtNine });
  postHog = postHogDeciding().withFlags(onForEveryone("monday-post"), onForEveryone("xp-levels"));
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GB35: the Monday post at scale", () => {
  test("1,500 members in 60 groups who all gave last week and the week before: claiming the week reads last week's top groups and givers within Convex's transaction limits", async () => {
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    await sixtyGroupsWhoGaveForTwoWeeks(t, 25);

    const claimed = await t.mutation(internal.leaderboard.mondayPost.claimWeek, { workspace: "T1", generation: 1 });

    expect(claimed?.post).toEqual(topGroupsPostedWith(1_500));
  }, 300_000);

  test("4,200 members in 60 groups: claiming the week reads one range per group's week, never one per member, within Convex's transaction limits", async () => {
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    await sixtyGroupsWhoGaveForTwoWeeks(t, 70);

    const claimed = await t.mutation(internal.leaderboard.mondayPost.claimWeek, { workspace: "T1", generation: 1 });

    expect(claimed?.post).toEqual(topGroupsPostedWith(4_200));
  }, 600_000);

  test("a week of 500 thoughtful kudos whose 197 most hugged are private, and 100 team stickers: claiming the week quotes the three public kudos after them within Convex's transaction limits", async () => {
    postHog.withFlags(onForEveryone("monday-post"), onForEveryone("xp-levels"), onForEveryone("album"), onForEveryone("album-slack"));
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    await sixtyGroupsWhoGaveForTwoWeeks(t, 1);
    await aWeekOfThoughtfulKudos(t, { kudos: 500, privateOnTop: 197, teamStickers: 100 });

    const claimed = await t.mutation(internal.leaderboard.mondayPost.claimWeek, { workspace: "T1", generation: 1 });

    const post = claimed?.post;
    expect(post?.kind === "topKudos" && post.kudos.map(({ words }) => words)).toEqual([[{ kind: "text", text: "public kudos 197" }], [{ kind: "text", text: "public kudos 198" }], [{ kind: "text", text: "public kudos 199" }]]);
    expect(post?.kind === "topKudos" && post.teams.map(({ name, count }) => `${name} ×${count}`)).toEqual(Array.from({ length: 20 }, (_, team) => `Team ${String(team).padStart(2, "0")} ×5`));
  }, 600_000);
});

async function aWeekOfThoughtfulKudos(t: Backend, { kudos, privateOnTop, teamStickers }: { kudos: number; privateOnTop: number; teamStickers: number }) {
  const tuesday = Date.parse("2026-10-13T10:00:00Z");
  for (let first = 0; first < kudos; first += 50) {
    await t.run(async (ctx) => {
      for (let index = first; index < Math.min(kudos, first + 50); index += 1) {
        const [giver, recipient] = [await aMember(ctx, `UG${index}`), await aMember(ctx, `UR${index}`)];
        const message = { workspace: "T1", conversation: "C_TEAM", message: `${tuesday / 1000 + index}.000100` };
        const at = tuesday + index * 1_000;
        await ctx.db.insert("awards", { ...message, giver, recipient, kudos: 1, day: "2026-10-13", at });
        const visibility = index < privateOnTop ? ("private" as const) : ("public" as const);
        const segments = [{ kind: "text" as const, text: `${visibility} kudos ${index}` }];
        await ctx.db.insert("kudosTexts", { ...message, kind: "words", revision: 1n, author: `UG${index}`, edited: false, segments, visibility, gate: { version: 1, thoughtful: true } });
        await ctx.db.insert("hugCounts", { ...message, hugs: kudos - index });
        await ctx.db.insert("grantsTold", { message, at, recipients: 1 });
      }
    });
  }
  await t.run(async (ctx) => {
    for (let index = 0; index < teamStickers; index += 1) {
      const member = await aMember(ctx, `UT${index}`);
      const name = `Team ${String(index % 20).padStart(2, "0")}`;
      await ctx.db.insert("teamStickers", { member, workspace: "T1", team: name.toLowerCase().replace(" ", "-"), at: tuesday + index, name, art: null, emoji: name.toLowerCase() });
    }
  });
}

function aMember(ctx: { db: { insert: (table: "members", row: { workspace: string; user: string; kind: "member"; asOf: number }) => Promise<Id<"members">> } }, user: string) {
  return ctx.db.insert("members", { workspace: "T1", user, kind: "member", asOf: 0 });
}

function topGroupsPostedWith(givers: number) {
  return {
    kind: "groups",
    groups: [
      { rank: 1, name: "Group 04", perMember: 5 },
      { rank: 1, name: "Group 09", perMember: 5 },
      { rank: 1, name: "Group 14", perMember: 5 },
    ],
    mostImproved: "Group 04",
    givers,
  };
}

async function sixtyGroupsWhoGaveForTwoWeeks(t: Backend, membersPerGroup: number) {
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
