import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import type { AwardsAttributedEvent, KudosGivenEvent } from "../bus/events";
import type { GroupId } from "../groups/groups";
import type { MemberId } from "../workspace/directory";

const thursday = new Date("2026-10-15T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now: thursday });
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GB12: group totals follow attribution", { timeout: 30_000 }, () => {
  test("after redeliveries, subscribers in either order, a group change and a giver without a group, every group total is the sum of its attributions", async () => {
    const t = testBackend();
    const { ann, bob, cy, zebras, gardeners } = await annAndBobInZebrasCyInNone(t);
    await attributedTwiceThenCountedTwice(t, await kudos(t, ann, bob, 2, "2026-09-30", "1"));
    await attributedTwiceThenCountedTwice(t, await kudos(t, ann, cy, 1, "2026-10-12", "2"));
    await movedTo(t, ann, gardeners, Date.parse("2026-10-13T00:00:00Z"));
    const bobThanksAnn = await kudos(t, bob, ann, 3, "2026-10-14", "3");
    await attribute(t, bobThanksAnn);
    await attribute(t, bobThanksAnn);
    await settle(t);
    await attributedTwiceThenCountedTwice(t, await kudos(t, ann, bob, 4, "2026-10-14", "4"));
    await attribute(t, await kudos(t, cy, ann, 1, "2026-10-14", "5"));
    await settle(t);

    expect(await groupTotals(t)).toEqual({
      [`${zebras}:${ann}:week:2026-09-28`]: { kudos: 2, runningTotal: [0, 0, 2] },
      [`${zebras}:${ann}:month:2026-09`]: { kudos: 2, runningTotal: [...quietDays(29), 2] },
      [`${zebras}:${ann}:week:2026-10-12`]: { kudos: 1, runningTotal: [1] },
      [`${zebras}:${ann}:month:2026-10`]: { kudos: 1, runningTotal: [...quietDays(11), 1] },
      [`${zebras}:${ann}:all`]: { kudos: 3 },
      [`${zebras}:${bob}:week:2026-10-12`]: { kudos: 3, runningTotal: [0, 0, 3] },
      [`${zebras}:${bob}:month:2026-10`]: { kudos: 3, runningTotal: [...quietDays(13), 3] },
      [`${zebras}:${bob}:all`]: { kudos: 3 },
      [`${gardeners}:${ann}:week:2026-10-12`]: { kudos: 4, runningTotal: [0, 0, 4] },
      [`${gardeners}:${ann}:month:2026-10`]: { kudos: 4, runningTotal: [...quietDays(13), 4] },
      [`${gardeners}:${ann}:all`]: { kudos: 4 },
    });
    expect(await groupPeriodTotals(t)).toEqual({
      [`${zebras}:week:2026-09-28`]: { kudos: 2, runningTotal: [0, 0, 2] },
      [`${zebras}:month:2026-09`]: { kudos: 2, runningTotal: [...quietDays(29), 2] },
      [`${zebras}:week:2026-10-12`]: { kudos: 4, runningTotal: [1, 1, 4] },
      [`${zebras}:month:2026-10`]: { kudos: 4, runningTotal: [...quietDays(11), 1, 1, 4] },
      [`${zebras}:all`]: { kudos: 6 },
      [`${gardeners}:week:2026-10-12`]: { kudos: 4, runningTotal: [0, 0, 4] },
      [`${gardeners}:month:2026-10`]: { kudos: 4, runningTotal: [...quietDays(13), 4] },
      [`${gardeners}:all`]: { kudos: 4 },
    });
  });
});

async function annAndBobInZebrasCyInNone(t: Backend) {
  return t.run(async (ctx) => {
    const group = (id: string, name: string) => ctx.db.insert("userGroups", { workspace: "T1", group: id, handle: id, name, enabled: true, automatic: false, members: 2, asOf: 0, membersAsOf: 0 });
    const [zebras, gardeners] = [await group("S_ZEBRA", "Zebras"), await group("S_GARDEN", "Gardeners")];
    const member = async (user: string, groups: Array<[string, GroupId]>) => {
      const id = await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: undefined, asOf: 0 });
      for (const [slackGroup] of groups) await ctx.db.insert("userGroupMembers", { workspace: "T1", group: slackGroup, user });
      const primary = groups[0]?.[1] ?? null;
      if (primary !== null) {
        await ctx.db.insert("memberGroups", { workspace: "T1", member: id, groups: groups.map(([, group]) => group), primary });
        await ctx.db.insert("primaryGroupHistory", { workspace: "T1", member: id, from: null, group: primary, cause: "default", at: 0 });
      }
      return id;
    };
    const ann = await member("U_ANN", [["S_ZEBRA", zebras], ["S_GARDEN", gardeners]]);
    const bob = await member("U_BOB", [["S_ZEBRA", zebras]]);
    const cy = await member("U_CY", []);
    return { ann, bob, cy, zebras, gardeners };
  });
}

async function kudos(t: Backend, giver: MemberId, recipient: MemberId, amount: number, day: string, message: string): Promise<KudosGivenEvent> {
  const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient, { day, at: Date.parse(`${day}T10:00:00Z`), message: { workspace: "T1", conversation: "C1", message } }));
  return { ...event, awards: event.awards.map((award) => ({ ...award, kudos: amount })) };
}

async function movedTo(t: Backend, member: MemberId, group: GroupId, at: number) {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("memberGroups")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(row!._id, { primary: group });
    await ctx.db.insert("primaryGroupHistory", { workspace: "T1", member, from: row!.primary, group, cause: "picked", at });
  });
}

async function attributedTwiceThenCountedTwice(t: Backend, event: KudosGivenEvent) {
  await attribute(t, event);
  await attribute(t, event);
  const attributed = await attributedEventOf(t, event);
  await t.mutation(internal.leaderboard.groupTotals.countAwardsAttributed, { event: attributed });
  await settle(t);
  await t.mutation(internal.leaderboard.groupTotals.countAwardsAttributed, { event: attributed });
}

function attribute(t: Backend, event: KudosGivenEvent) {
  return t.mutation(internal.groups.attribution.attributeKudosGiven, { event });
}

async function attributedEventOf(t: Backend, { message }: KudosGivenEvent): Promise<AwardsAttributedEvent> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("attributions")
      .withIndex("by_message", (q) => q.eq("workspace", message.workspace).eq("conversation", message.conversation).eq("message", message.message))
      .unique(),
  );
  const { _id, _creationTime, conversation, message: ts, ...facts } = row!;
  return { type: "awardsAttributed", message: { workspace: facts.workspace, conversation, message: ts }, ...facts };
}

type TotalsByKey = Record<string, { kudos: number; runningTotal?: number[] }>;

async function groupTotals(t: Backend): Promise<TotalsByKey> {
  const rows = await t.run((ctx) => ctx.db.query("attributedTotals").take(100));
  return Object.fromEntries(rows.map(({ group, member, period, kudos, runningTotal }: Doc<"attributedTotals">) => [`${group}:${member}:${period}`, { kudos, ...(runningTotal && { runningTotal }) }]));
}

async function groupPeriodTotals(t: Backend): Promise<TotalsByKey> {
  const rows = await t.run((ctx) => ctx.db.query("attributedGroupTotals").take(100));
  return Object.fromEntries(rows.map(({ group, period, kudos, runningTotal }) => [`${group}:${period}`, { kudos, ...(runningTotal && { runningTotal }) }]));
}

function quietDays(count: number): number[] {
  return Array.from({ length: count }, () => 0);
}
