import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import { FakeSlack } from "../../testing/fakeSlack";
import { signingSecret } from "../../testing/signedSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import type { QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import type { AwardsAttributedEvent, KudosGivenEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";
import type { GroupId } from "./groups";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const groupsSyncedAt = new Date("2026-10-14T09:00:00Z");
const nowTs = `${now.getTime() / 1000}.000100`;

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now: groupsSyncedAt });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  slack = new FakeSlack().withMember("U_ANN").withMember("U_BOB").withMember("U_CAROL");
  vi.stubGlobal("fetch", slack.fetch);
  vi.mocked(publish).mockClear();
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GB10: a kudos message counts for the giver's primary group at its spend instant", { timeout: 30_000 }, () => {
  test("a kudos message given in Slack counts for the giver's group, whatever groups its recipients count for, and its total grows", async () => {
    const t = await annInZebrasBobInGardeners();

    await post(t, [section(text("thanks "), mention("U_BOB"), text(" "), emoji("taco"))], { user: "U_ANN", ts: nowTs });
    await settle(t);

    expect(await attributedNamed(t)).toEqual([
      { giver: "U_ANN", group: "Zebras", kudos: 1, day: "2026-10-14", at: now.getTime(), awards: [{ recipient: "U_BOB", kudos: 1, saysWhy: false, recipientGroup: "Gardeners" }] },
    ]);
    expect(await groupTotalsOf(t, "Zebras")).toEqual([
      { member: "U_ANN", period: "all", kudos: 1 },
      { member: "U_ANN", period: "month:2026-10", kudos: 1, runningTotal: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] },
      { member: "U_ANN", period: "week:2026-10-12", kudos: 1, runningTotal: [0, 0, 1] },
    ]);
    expect(await groupTotalsOf(t, "Gardeners")).toEqual([]);
  });

  test("a giver without a primary group counts for no group, and no group's total grows", async () => {
    const t = await annInZebrasBobInGardeners();

    await post(t, [section(mention("U_ANN"), text(" "), emoji("taco"))], { user: "U_CAROL", ts: nowTs });
    await settle(t);

    expect(await attributedNamed(t)).toEqual([
      { giver: "U_CAROL", group: null, kudos: 1, day: "2026-10-14", at: now.getTime(), awards: [{ recipient: "U_ANN", kudos: 1, saysWhy: false, recipientGroup: "Zebras" }] },
    ]);
    expect(await groupTotalsOf(t, "Zebras")).toEqual([]);
    expect(await groupTotalsOf(t, "Gardeners")).toEqual([]);
  });

  test("awardsAttributed carries each award's stored gate decision and each recipient's primary group", async () => {
    const t = await annInZebrasBobInGardeners();

    await post(t, [section(text("thanks for fixing the deploy today "), mention("U_BOB"), text(" "), mention("U_CAROL"), text(" "), emoji("taco"))], { user: "U_ANN", ts: nowTs });
    await settle(t);

    const [attributed] = await attributedNamed(t);
    expect(attributed?.awards).toEqual([
      { recipient: "U_BOB", kudos: 1, saysWhy: true, recipientGroup: "Gardeners" },
      { recipient: "U_CAROL", kudos: 1, saysWhy: true, recipientGroup: null },
    ]);
    expect(attributed?.kudos).toBe(2);
  });
});

describe("GB9, GB10: the history at the spend instant wins over a later change", { timeout: 30_000 }, () => {
  test("a pick saved after the spend but before the subscriber runs doesn't move the kudos, and a replay gives the same group", async () => {
    const t = await annInZebrasBobInGardeners();
    await annAlsoInGardeners(t);
    const event = await kudosGiven(t, "U_ANN", "U_BOB", { at: now.getTime() - 60_000 });
    await picked(t, "U_ANN", "S_GARDEN", now.getTime() - 30_000);

    await attribute(t, event);
    await attribute(t, event);
    await settle(t);

    expect((await attributedNamed(t)).map(({ group }) => group)).toEqual(["Zebras"]);
    expect(await groupTotalsOf(t, "Gardeners")).toEqual([]);
  });

  test("a change recorded in the same millisecond as the spend applies to it", async () => {
    const t = await annInZebrasBobInGardeners();
    await annAlsoInGardeners(t);
    await picked(t, "U_ANN", "S_GARDEN", now.getTime() - 60_000);

    await attribute(t, await kudosGiven(t, "U_ANN", "U_BOB", { at: now.getTime() - 60_000 }));

    expect((await attributedNamed(t)).map(({ group }) => group)).toEqual(["Gardeners"]);
  });
});

describe("GB2, call 13: attribution reconciles the giver first", { timeout: 30_000 }, () => {
  test("a group disabled and recorded before the spend, its reconciliation page not yet run, never receives the kudos", async () => {
    const t = await annInZebrasBobInGardeners();
    const zebras = { workspace: "T1", group: "S_ZEBRA", handle: "zebras", name: "Zebras", enabled: false, automatic: false, members: 1 };
    await t.mutation(internal.workspace.userGroups.keepUserGroups, { listed: [zebras], scope: { kind: "one-group", workspace: "T1", group: "S_ZEBRA" }, asOf: Date.now() });
    vi.setSystemTime(Date.now() + 1_000);

    await attribute(t, await kudosGiven(t, "U_ANN", "U_BOB", { at: Date.now() }));

    expect((await attributedNamed(t)).map(({ group }) => group)).toEqual([null]);
  });

  test("a giver who left their group, the page not yet run, counts for the group they fell back to", async () => {
    const t = await annInZebrasBobInGardeners();
    await annAlsoInGardeners(t);
    slack.withUserGroup("S_ZEBRA", { name: "Zebras", users: [] });
    await t.action(internal.slack.userGroups.refreshMembers, { workspace: "T1", group: "S_ZEBRA" });
    vi.setSystemTime(Date.now() + 1_000);

    await attribute(t, await kudosGiven(t, "U_ANN", "U_BOB", { at: Date.now() }));

    expect((await attributedNamed(t)).map(({ group }) => group)).toEqual(["Gardeners"]);
  });
});

describe("GB9, call 13: reconciling a member replays the transition log", { timeout: 30_000 }, () => {
  test("a giver who left her group keeps that instant though someone else joins it before her page runs", async () => {
    const t = await annInZebrasBobInGardeners();
    await annAlsoInGardeners(t);
    const annLeft = await zebrasListed(t, []);
    vi.setSystemTime(annLeft + 2_000);
    await zebrasListed(t, ["U_CAROL"]);
    vi.setSystemTime(annLeft + 3_000);

    await attribute(t, await kudosGiven(t, "U_ANN", "U_BOB", { at: annLeft + 1_000 }));

    expect((await attributedNamed(t)).map(({ group }) => group)).toEqual(["Gardeners"]);
  });

  test("a giver removed from her group and added back before her page runs counts for the group she fell back to in between, and keeps it", async () => {
    const t = await annInZebrasBobInGardeners();
    await annAlsoInGardeners(t);
    const annLeft = await zebrasListed(t, []);
    vi.setSystemTime(annLeft + 2_000);
    await zebrasListed(t, ["U_ANN"]);
    vi.setSystemTime(annLeft + 3_000);

    await attribute(t, await kudosGiven(t, "U_ANN", "U_BOB", { at: annLeft + 1_000 }));

    expect((await attributedNamed(t)).map(({ group }) => group)).toEqual(["Gardeners"]);
    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Gardeners");
  });

  test("a giver whose group Slack disabled and enabled again before her page runs counts for the group she fell back to in between", async () => {
    const t = await annInZebrasBobInGardeners();
    await annAlsoInGardeners(t);
    const disabledAt = await zebrasKept(t, { enabled: false });
    vi.setSystemTime(disabledAt + 2_000);
    await zebrasKept(t, { enabled: true });
    vi.setSystemTime(disabledAt + 3_000);

    await attribute(t, await kudosGiven(t, "U_ANN", "U_BOB", { at: disabledAt + 1_000 }));

    expect((await attributedNamed(t)).map(({ group }) => group)).toEqual(["Gardeners"]);
  });
});

describe("GB30: attributions and group totals are written once per kudos message", { timeout: 30_000 }, () => {
  test("a redelivered kudosGiven and a redelivered awardsAttributed count once", async () => {
    const t = await annInZebrasBobInGardeners();
    const event = await kudosGiven(t, "U_ANN", "U_BOB", { message: { workspace: "T1", conversation: "C1", message: "1.0" } });

    await attribute(t, event);
    await attribute(t, event);
    const [attributed] = awardsAttributedPublished();
    await t.mutation(internal.leaderboard.groupTotals.countAwardsAttributed, { event: attributed! });
    await t.mutation(internal.leaderboard.groupTotals.countAwardsAttributed, { event: attributed! });

    expect(awardsAttributedPublished()).toHaveLength(1);
    expect((await groupTotalsOf(t, "Zebras")).map(({ period, kudos }) => `${period} ${kudos}`)).toEqual(["all 1", "month:2026-10 1", "week:2026-10-12 1"]);
  });

  test("the group totals subscriber counts the same whether it runs before or after the Everyone board's", async () => {
    const t = await annInZebrasBobInGardeners();
    const first = await kudosGiven(t, "U_ANN", "U_BOB", { message: { workspace: "T1", conversation: "C1", message: "1.0" } });
    const second = await kudosGiven(t, "U_ANN", "U_BOB", { message: { workspace: "T1", conversation: "C1", message: "2.0" } });

    await t.mutation(internal.leaderboard.totals.countKudosGiven, { event: first });
    await attribute(t, first);
    await attribute(t, second);
    await settle(t);
    await t.mutation(internal.leaderboard.totals.countKudosGiven, { event: second });

    expect((await groupTotalsOf(t, "Zebras")).map(({ period, kudos }) => `${period} ${kudos}`)).toEqual(["all 2", "month:2026-10 2", "week:2026-10-12 2"]);
  });

  test("a Slack retry of the same kudos message counts once", async () => {
    const t = await annInZebrasBobInGardeners();

    await post(t, [section(mention("U_BOB"), text(" "), emoji("taco"))], { user: "U_ANN", ts: nowTs });
    await post(t, [section(mention("U_BOB"), text(" "), emoji("taco"))], { user: "U_ANN", ts: nowTs });
    await settle(t);

    expect(await attributedNamed(t)).toHaveLength(1);
    expect((await groupTotalsOf(t, "Zebras")).map(({ period, kudos }) => `${period} ${kudos}`)).toEqual(["all 1", "month:2026-10 1", "week:2026-10-12 1"]);
  });
});

async function annInZebrasBobInGardeners() {
  const t = testBackend();
  for (const user of ["U_ANN", "U_BOB", "U_CAROL"]) {
    await memberChanged(t, "team_join", { id: user });
    await settle(t);
  }
  slack.withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN"] }).withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_BOB"] });
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  vi.setSystemTime(now);
  return t;
}

async function annAlsoInGardeners(t: Backend) {
  slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_ANN", "U_BOB"] });
  await t.action(internal.slack.userGroups.refreshMembers, { workspace: "T1", group: "S_GARDEN" });
  await settle(t);
}

async function zebrasListed(t: Backend, users: string[]) {
  slack.withUserGroup("S_ZEBRA", { name: "Zebras", users });
  await t.action(internal.slack.userGroups.refreshMembers, { workspace: "T1", group: "S_ZEBRA" });
  return Date.now();
}

async function zebrasKept(t: Backend, { enabled }: { enabled: boolean }) {
  const zebras = { workspace: "T1", group: "S_ZEBRA", handle: "zebras", name: "Zebras", enabled, automatic: false, members: 1 };
  await t.mutation(internal.workspace.userGroups.keepUserGroups, { listed: [zebras], scope: { kind: "one-group", workspace: "T1", group: "S_ZEBRA" }, asOf: Date.now() });
  return Date.now();
}

async function primaryGroupNameOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("memberGroups")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    return row?.primary == null ? null : ((await ctx.db.get(row.primary))?.name ?? null);
  });
}

async function picked(t: Backend, user: string, group: string, at: number) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const to = await groupIdOf(ctx, group);
    const row = await ctx.db
      .query("memberGroups")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(row!._id, { primary: to });
    await ctx.db.insert("primaryGroupHistory", { workspace: "T1", member, from: row!.primary, group: to, cause: "picked", at });
  });
}

async function kudosGiven(t: Backend, giver: string, recipient: string, overrides: Partial<KudosGivenEvent> = {}) {
  const [giverId, recipientId] = [await memberOf(t, giver), await memberOf(t, recipient)];
  return t.run((ctx) => kudosGivenEventWithAward(ctx, giverId, recipientId, { day: "2026-10-14", at: now.getTime(), ...overrides }));
}

function attribute(t: Backend, event: KudosGivenEvent) {
  return t.mutation(internal.groups.attribution.attributeKudosGiven, { event });
}

function awardsAttributedPublished() {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event): event is AwardsAttributedEvent => event.type === "awardsAttributed");
}

async function attributedNamed(t: Backend) {
  const published = awardsAttributedPublished();
  return t.run(async (ctx) => {
    const userOf = async (member: MemberId) => (await ctx.db.get(member))?.user ?? "missing";
    const nameOf = async (group: GroupId | null) => (group === null ? null : ((await ctx.db.get(group))?.name ?? "missing"));
    return Promise.all(
      published.map(async ({ giver, group, kudos, day, at, awards }) => ({
        giver: await userOf(giver),
        group: await nameOf(group),
        kudos,
        day,
        at,
        awards: await Promise.all(awards.map(async ({ recipient, kudos, saysWhy, recipientGroup }) => ({ recipient: await userOf(recipient), kudos, saysWhy, recipientGroup: await nameOf(recipientGroup) }))),
      })),
    );
  });
}

async function groupTotalsOf(t: Backend, name: string) {
  return t.run(async (ctx) => {
    const group = await groupIdOf(ctx, name === "Zebras" ? "S_ZEBRA" : "S_GARDEN");
    const totals = await ctx.db
      .query("attributedTotals")
      .withIndex("by_group_period", (q) => q.eq("group", group))
      .collect();
    return Promise.all(
      totals.map(async ({ member, period, kudos, runningTotal }) => ({ member: (await ctx.db.get(member))?.user, period, kudos, ...(runningTotal && { runningTotal }) })),
    );
  });
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    if (row === null) throw new Error(`the directory doesn't know ${user}`);
    return row._id;
  });
}

async function groupIdOf(ctx: QueryCtx, group: string): Promise<GroupId> {
  const row = await ctx.db
    .query("userGroups")
    .withIndex("by_group", (q) => q.eq("workspace", "T1").eq("group", group))
    .unique();
  if (row === null) throw new Error(`the copy doesn't know ${group}`);
  return row._id;
}
