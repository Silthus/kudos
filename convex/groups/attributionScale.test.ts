import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { kudosGivenEvent } from "../../testing/busEvents";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import type { KudosGivenEvent } from "../bus/events";
import { dayOfPeriod, keyOf, type Period } from "../leaderboard/periods";
import type { MemberId } from "../workspace/directory";
import type { GroupId } from "./groups";

const lastDayOfOctober = new Date("2026-10-31T10:00:00Z");
const daysOfOctober = Array.from({ length: 31 }, (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`);

beforeEach(() => {
  vi.useFakeTimers({ now: lastDayOfOctober });
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GB35: attribution and group totals stay within Convex's limits per write", () => {
  test("in a workspace of 1,500 members in 60 groups who gave every day of October, the last day's kudos attribute and count", { timeout: 300_000 }, async () => {
    const t = testBackend({ transactionLimits: true });
    const { members, groups } = await workspaceGivingEveryDayOfOctober(t, 1_500, 60);

    for (const [index, giver] of members.slice(0, 60).entries()) {
      await t.mutation(internal.groups.attribution.attributeKudosGiven, { event: await lastDayKudos(t, giver, members[index + 60]!, index) });
    }
    await settle(t);

    expect(await totalsOf(t, members[0]!, groups[0]!)).toEqual({ "all": 31, "month:2026-10": 31, "week:2026-10-26": 6 });
  });

  test("a message to 820 recipients in many groups, none reconciled yet, attributes within the limits: the giver and the first 99 recipients reconciled, the rest as their history stands", { timeout: 300_000 }, async () => {
    const t = testBackend({ transactionLimits: true });
    const { members, groups } = await copiedGroupsNotYetReconciled(t, 821, 60);
    const [giver, ...recipients] = members;

    await t.mutation(internal.groups.attribution.attributeKudosGiven, { event: await kudosTo(t, giver!, recipients) });
    await settle(t);

    const attribution = await t.run((ctx) => ctx.db.query("attributions").first());
    expect(attribution?.group).toBe(groups[0]);
    expect(attribution?.awards).toHaveLength(820);
    expect(attribution?.awards.map(({ recipientGroup }) => recipientGroup !== null)).toEqual([...Array<boolean>(99).fill(true), ...Array<boolean>(721).fill(false)]);
  });
});

async function workspaceGivingEveryDayOfOctober(t: Backend, memberCount: number, groupCount: number) {
  const { members, groups } = await copiedGroupsNotYetReconciled(t, memberCount, groupCount);
  await t.run(async (ctx) => {
    for (const [index, member] of members.entries()) {
      const group = groups[index % groupCount]!;
      await ctx.db.insert("memberGroups", { workspace: "T1", member, groups: [group], primary: group });
      await ctx.db.insert("primaryGroupHistory", { workspace: "T1", member, from: null, group, cause: "default", at: 0 });
      await insertOctoberTotals(ctx, member, group);
    }
  });
  return { members, groups };
}

async function insertOctoberTotals(ctx: MutationCtx, member: MemberId, group: GroupId) {
  const givenBefore = daysOfOctober.slice(0, -1);
  for (const period of ["week", "month", "all"] as const satisfies Period[]) {
    for (const key of new Set(givenBefore.map((day) => keyOf(period, day)))) {
      const days = givenBefore.filter((day) => keyOf(period, day) === key);
      const runningTotal = period === "all" ? {} : { runningTotal: days.map((day) => dayOfPeriod(period, day) + 1 - dayOfPeriod(period, days[0]!)) };
      await ctx.db.insert("attributedTotals", { workspace: "T1", group, member, period: key, kudos: days.length, ...runningTotal });
    }
  }
}

async function copiedGroupsNotYetReconciled(t: Backend, memberCount: number, groupCount: number) {
  return t.run(async (ctx) => {
    const groups: GroupId[] = [];
    for (let index = 0; index < groupCount; index += 1) {
      const group = `S_${String(index).padStart(3, "0")}`;
      groups.push(await ctx.db.insert("userGroups", { workspace: "T1", group, handle: group, name: group, enabled: true, automatic: false, members: index + 1, asOf: 0, membersAsOf: 0 }));
    }
    const members: MemberId[] = [];
    for (let index = 0; index < memberCount; index += 1) {
      const user = `U_${String(index).padStart(4, "0")}`;
      members.push(await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: undefined, asOf: 0 }));
      for (const group of [index % groupCount, (index + 1) % groupCount]) await ctx.db.insert("userGroupMembers", { workspace: "T1", group: `S_${String(group).padStart(3, "0")}`, user });
    }
    return { members, groups };
  });
}

function lastDayKudos(t: Backend, giver: MemberId, recipient: MemberId, index: number) {
  return kudosTo(t, giver, [recipient], { message: { workspace: "T1", conversation: "C1", message: `last-day-${index}` } });
}

async function kudosTo(t: Backend, giver: MemberId, recipients: MemberId[], overrides: Partial<KudosGivenEvent> = {}): Promise<KudosGivenEvent> {
  const event = kudosGivenEvent(giver, recipients[0]!, { day: daysOfOctober.at(-1)!, at: lastDayOfOctober.getTime(), ...overrides });
  const awards = await t.run(async (ctx) => {
    const { workspace, conversation, message } = event.message;
    return Promise.all(
      recipients.map(async (recipient) => ({ award: await ctx.db.insert("awards", { workspace, conversation, message, giver, recipient, kudos: 1, day: event.day, at: event.at }), giver, recipient, kudos: 1 })),
    );
  });
  return { ...event, awards };
}

async function totalsOf(t: Backend, member: MemberId, group: GroupId) {
  return t.run(async (ctx) => {
    const rows: Doc<"attributedTotals">[] = [];
    for (const period of ["all", "month:2026-10", "week:2026-10-26"]) {
      const row = await ctx.db
        .query("attributedTotals")
        .withIndex("by_member_group_period", (q) => q.eq("member", member).eq("group", group).eq("period", period))
        .unique();
      if (row !== null) rows.push(row);
    }
    return Object.fromEntries(rows.map(({ period, kudos }) => [period, kudos]));
  });
}
