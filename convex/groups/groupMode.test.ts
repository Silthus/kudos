import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { FakeSlack } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { type Block, type BlockAction, blockActions, buttonInHome, groupPickerInHome, optionsOf, publishedHome, publishedHomeBlocks } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MemberId } from "../workspace/directory";
import { availableIn, countingGroupsOf, primaryGroupOf } from "./groups";
import { primaryGroupAt } from "./history";
import { reconcileMember } from "./reconcile";

const now = new Date("2026-10-14T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE", { is_admin: true }).withMember("U_ANN").withMember("U_BOB");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const adminTabOnMain = [
  "actions: Profile | Settings | [Admin]",
  "header: Admin",
  "section: I celebrate level ups in a thread under each kudos message. Pick a channel to post them there instead. [channels_select: none]",
  "divider",
  "context: Only workspace admins and owners see this tab.",
];

describe("GB27: the group mode in the Admin tab", () => {
  test("an admin where `groups` applies sees Groups that count, with every group counting by default", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "groups");
    const t = await workspaceWithGroups();

    await adminTabOpen(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: Profile | Settings | [Admin]",
      "header: Admin",
      "section: I celebrate level ups in a thread under each kudos message. Pick a channel to post them there instead. [channels_select: none]",
      "divider",
      "section: *Groups that count*",
      "actions: [Every group] | Only these groups",
      "divider",
      "context: Only workspace admins and owners see this tab.",
    ]);
  });

  test("with `groups` off, the Admin tab is the one on main", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels");
    const t = await workspaceWithGroups();

    await adminTabOpen(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toEqual(adminTabOnMain);
  });
});

describe("GB1, GB8: in allowlist mode only the groups an admin picks count", () => {
  test("switching to Only these groups starts with every group picked, so the switch alone changes nobody's group", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "groups");
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");

    await click(t, "U_ALICE", "Only these groups");

    expect(groupModeLinesOf(publishedHome(slack, "U_ALICE"))).toEqual([
      "section: *Groups that count*",
      "actions: Every group | [Only these groups]",
      "actions: [multi_static_select: Gardeners, Owls, Zebras]",
    ]);
    expect(await primaryGroupNamesOf(t)).toEqual({ U_ALICE: "Gardeners", U_ANN: "Owls", U_BOB: "Zebras" });
  });

  test("picking two groups moves members whose primary group left to the smallest group left, and the other groups count for nothing", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "groups");
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Only these groups");

    await interact(t, "U_ALICE", groupPickerInHome(slack, "U_ALICE", "Gardeners", "Zebras"));

    expect(groupModeLinesOf(publishedHome(slack, "U_ALICE"))).toContain("actions: [multi_static_select: Gardeners, Zebras]");
    expect(await primaryGroupNamesOf(t)).toEqual({ U_ALICE: "Gardeners", U_ANN: "Zebras", U_BOB: "Zebras" });
    expect(await countingGroupNamesOf(t, "U_ANN")).toEqual(["Gardeners", "Zebras"]);
    expect(await historyOf(t, "U_ANN")).toEqual([
      { group: "Owls", cause: "default" },
      { group: "Zebras", cause: "fallback" },
    ]);
  });

  test("switching back to Every group counts every group again and keeps the history", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "groups");
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Only these groups");
    await interact(t, "U_ALICE", groupPickerInHome(slack, "U_ALICE", "Gardeners"));

    await click(t, "U_ALICE", "Every group");

    expect(groupModeLinesOf(publishedHome(slack, "U_ALICE"))).toEqual(["section: *Groups that count*", "actions: [Every group] | Only these groups"]);
    expect(await countingGroupNamesOf(t, "U_ANN")).toEqual(["Gardeners", "Owls", "Zebras"]);
    expect(await primaryGroupNamesOf(t)).toEqual({ U_ALICE: "Gardeners", U_ANN: "Gardeners", U_BOB: "Gardeners" });
    expect(await historyOf(t, "U_ANN")).toEqual([
      { group: "Owls", cause: "default" },
      { group: "Gardeners", cause: "fallback" },
    ]);
  });

  test("going back to Only these groups brings back the groups picked before", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "groups");
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Only these groups");
    await interact(t, "U_ALICE", groupPickerInHome(slack, "U_ALICE", "Gardeners", "Zebras"));
    await click(t, "U_ALICE", "Every group");

    await click(t, "U_ALICE", "Only these groups");

    expect(groupModeLinesOf(publishedHome(slack, "U_ALICE"))).toContain("actions: [multi_static_select: Gardeners, Zebras]");
    expect(await countingGroupNamesOf(t, "U_ANN")).toEqual(["Gardeners", "Zebras"]);
  });

  test("picking no group makes groups unavailable and leaves everyone without a primary group (GB3)", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "groups");
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Only these groups");

    await interact(t, "U_ALICE", groupPickerInHome(slack, "U_ALICE"));

    expect(await t.run((ctx) => availableIn(ctx, "T1"))).toBe(false);
    expect(await primaryGroupNamesOf(t)).toEqual({ U_ALICE: null, U_ANN: null, U_BOB: null });
    expect(groupModeLinesOf(publishedHome(slack, "U_ALICE"))).toContain("actions: [multi_static_select: none]");
  });
});

describe("GB26: only admins where `groups` applies set the group mode", () => {
  test("a member who isn't an admin sees no group mode", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "groups");
    const t = await workspaceWithGroups();
    await giveKudos(t, "U_BOB", "U_ANN", 1);

    await openHome(t, "U_BOB");

    expect(publishedHome(slack, "U_BOB")[0]).toBe("actions: [Profile] | Settings");
  });

  test("a forged setGroupMode from a member who isn't an admin changes nothing", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "groups");
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Only these groups");
    const picker = groupPickerInHome(slack, "U_ALICE", "Zebras");
    await click(t, "U_ALICE", "Every group");
    await openHome(t, "U_BOB");

    await interact(t, "U_BOB", picker);
    await interact(t, "U_BOB", forgedButton({ type: "setGroupMode", mode: "allowlist", allowlist: [] }));

    expect(groupModeLinesOf(publishedHome(slack, "U_ALICE"))).toEqual(["section: *Groups that count*", "actions: [Every group] | Only these groups"]);
    expect(await countingGroupNamesOf(t, "U_ANN")).toEqual(["Gardeners", "Owls", "Zebras"]);
    expect(await primaryGroupNamesOf(t)).toEqual({ U_ALICE: "Gardeners", U_ANN: "Owls", U_BOB: "Zebras" });
  });

  test("an admin to whom `groups` doesn't apply neither sees the group mode nor changes it", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels");
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");

    await interact(t, "U_ALICE", forgedButton({ type: "setGroupMode", mode: "allowlist", allowlist: [] }));

    expect(publishedHome(slack, "U_ALICE")).toEqual(adminTabOnMain);
    expect(await t.run((ctx) => availableIn(ctx, "T1"))).toBe(true);
    expect(await primaryGroupNamesOf(t)).toEqual({ U_ALICE: "Gardeners", U_ANN: "Owls", U_BOB: "Zebras" });
  });
});

describe("GB2, call 13: a write reconciles its member before their page does", () => {
  test("kudos spent after the switch but before Ann's page count for the group she falls back to, never for the one that left", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "groups");
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    const ann = await memberOf(t, "U_ANN");
    const allowlist = await groupIdsOf(t, "Gardeners", "Zebras");
    const switchedAt = Date.now();

    await t.mutation(internal.slack.receipts.receiveHomeClick, {
      workspace: "T1",
      eventId: "E_SWITCH",
      user: "U_ALICE",
      commands: [{ type: "setGroupMode", mode: "allowlist", allowlist }],
    });
    const spentAt = switchedAt + 1_000;
    vi.setSystemTime(switchedAt + 60_000);
    const attributedTo = await t.run(async (ctx) => {
      await reconcileMember(ctx, ann);
      const group = await primaryGroupAt(ctx, ann, spentAt);
      return group === null ? null : (await ctx.db.get(group))?.name;
    });

    expect(attributedTo).toBe("Zebras");
    expect(await primaryGroupNameAt(t, ann, switchedAt - 1)).toBe("Owls");
  });
});

describe("GB27, call 12: the group picker", () => {
  test("250 groups are all offered, in option groups of up to 100, within Slack's block limits", { timeout: 120_000 }, async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "groups");
    const names = Array.from({ length: 250 }, (_, index) => `Group ${String(index + 1).padStart(3, "0")} ${"of the very long names ".repeat(4)}`);
    names.forEach((name, index) => slack.withUserGroup(`S_${index}`, { name, users: ["U_ANN"] }));
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");

    await click(t, "U_ALICE", "Only these groups");
    await interact(t, "U_ALICE", groupPickerInHome(slack, "U_ALICE", "Gardeners", optionTextOf(names[249]!)));

    const blocks = publishedHomeBlocks(slack, "U_ALICE");
    const picker = pickerIn(blocks);
    expect(blocks.length).toBeLessThanOrEqual(100);
    expect(picker.options).toBeUndefined();
    expect(picker.option_groups!.map(({ label, options }) => [label.text, options.length])).toEqual([
      ["Groups 1–100", 100],
      ["Groups 101–200", 100],
      ["Groups 201–253", 53],
    ]);
    expect(optionsOf(picker).every(({ text, value }) => text.text.length <= 75 && value.length <= 150)).toBe(true);
    expect(picker.initial_options!.map(({ text }) => text.text)).toEqual(["Gardeners", optionTextOf(names[249]!)]);
    expect(await countingGroupNamesOf(t, "U_ANN")).toEqual(["Gardeners", names[249]]);
  });
});

describe("GB35: switching the group mode reconciles every member in pages within Convex's limits", () => {
  test("1,500 members in 60 groups switched to an allowlist of 30 each count for the allowed group they are in", { timeout: 300_000 }, async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "groups");
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
    await seedSixtyGroupsOf1500Members(t);
    await t.mutation(internal.groups.reconcile.reconcileWorkspace, { workspace: "T1" });
    await settle(t);
    await memberChanged(t, "team_join", { id: "U_ALICE" });
    await settle(t);
    await adminTabOpen(t, "U_ALICE");
    const evenGroups = await groupIdsOf(t, ...Array.from({ length: 30 }, (_, index) => groupName(index * 2)));

    await t.mutation(internal.slack.receipts.receiveHomeClick, {
      workspace: "T1",
      eventId: "E_SWITCH",
      user: "U_ALICE",
      commands: [{ type: "setGroupMode", mode: "allowlist", allowlist: evenGroups }],
    });

    expect(await settledWithMostJobsPending(t)).toBeLessThan(1_000);
    expect(await primaryGroupParitiesOf(t)).toEqual({ even: 1_500 });
  });
});

async function workspaceWithGroups() {
  slack
    .withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN"] })
    .withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN", "U_BOB"] })
    .withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_ANN", "U_BOB", "U_ALICE"] })
    .withUserGroup("S_OLD", { name: "Old timers", users: ["U_BOB"], disabled: true })
    .withUserGroup("S_ADMINS", { name: "Admins", users: ["U_ALICE"], autoType: "admin" });
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  for (const user of ["U_ALICE", "U_ANN", "U_BOB"]) await memberChanged(t, "team_join", { id: user });
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  return t;
}

async function adminTabOpen(t: Backend, user: string) {
  await giveKudos(t, user, "U_BOB", 1);
  await openHome(t, user);
  await click(t, user, "Admin");
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, label: string) {
  return interact(t, user, buttonInHome(slack, user, label));
}

async function interact(t: Backend, user: string, action: BlockAction) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settle(t);
  return response;
}

function groupModeLinesOf(home: string[]) {
  const start = home.indexOf("section: *Groups that count*");
  expect(start, "Groups that count in the Admin tab").toBeGreaterThan(-1);
  return home.slice(start, home.indexOf("divider", start));
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

async function primaryGroupNamesOf(t: Backend) {
  const names: Record<string, string | null> = {};
  for (const user of ["U_ALICE", "U_ANN", "U_BOB"]) {
    const member = await memberOf(t, user);
    names[user] = await t.run(async (ctx) => (await primaryGroupOf(ctx, member))?.name ?? null);
  }
  return names;
}

async function countingGroupNamesOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await countingGroupsOf(ctx, member)).map(({ name }) => name));
}

async function historyOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => {
    const entries = await ctx.db
      .query("primaryGroupHistory")
      .withIndex("by_member_at", (q) => q.eq("member", member))
      .collect();
    const nameOf = async (group: Id<"userGroups"> | null) => (group === null ? null : ((await ctx.db.get(group))?.name ?? null));
    return Promise.all(entries.map(async ({ group, cause }) => ({ group: await nameOf(group), cause })));
  });
}

function forgedButton(command: unknown): BlockAction {
  const encoded = JSON.stringify(command);
  return { type: "button", action_id: encoded, value: encoded };
}

function optionTextOf(name: string) {
  return `${name.slice(0, 74)}…`;
}

type Picker = { options?: unknown[]; option_groups?: Array<{ label: { text: string }; options: Array<{ text: { text: string }; value: string }> }>; initial_options?: Array<{ text: { text: string } }> };

function pickerIn(blocks: Block[]) {
  const picker = blocks.flatMap((block) => (block.type === "actions" ? (block.elements ?? []) : [])).find((element) => element.type === "multi_static_select");
  expect(picker).toBeDefined();
  return picker as unknown as Picker & Parameters<typeof optionsOf>[0];
}

async function groupIdsOf(t: Backend, ...names: string[]) {
  return t.run(async (ctx) => {
    const groups = await ctx.db.query("userGroups").collect();
    return names.map((name) => {
      const group = groups.find((row) => row.name === name);
      if (group === undefined) throw new Error(`no group named ${name} in the copy`);
      return group._id;
    });
  });
}

async function primaryGroupNameAt(t: Backend, member: MemberId, at: number) {
  return t.run(async (ctx) => {
    const group = await primaryGroupAt(ctx, member, at);
    return group === null ? null : ((await ctx.db.get(group))?.name ?? null);
  });
}

const seededMembers = 1_500;
const seededGroups = 60;

function groupName(index: number) {
  return `Group ${String(index).padStart(2, "0")}`;
}

async function seedSixtyGroupsOf1500Members(t: Backend) {
  await t.run(async (ctx) => {
    for (let index = 0; index < seededGroups; index += 1) {
      await ctx.db.insert("userGroups", { workspace: "T1", group: `S_${index}`, handle: `g${index}`, name: groupName(index), enabled: true, automatic: false, members: 50, asOf: 0, membersAsOf: 0 });
    }
    for (let index = 0; index < seededMembers; index += 1) {
      const user = `U_${String(index).padStart(4, "0")}`;
      await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: undefined, asOf: 0 });
      for (const group of [index % seededGroups, (index + 1) % seededGroups]) await ctx.db.insert("userGroupMembers", { workspace: "T1", group: `S_${group}`, user });
    }
  });
}

async function primaryGroupParitiesOf(t: Backend) {
  return t.run(async (ctx) => {
    const parities: Record<string, number> = {};
    for (const { primary } of await ctx.db.query("memberGroups").collect()) {
      const name = primary === null ? null : ((await ctx.db.get(primary))?.name ?? null);
      const parity = name === null ? "none" : Number(name.slice(-2)) % 2 === 0 ? "even" : "odd";
      parities[parity] = (parities[parity] ?? 0) + 1;
    }
    return parities;
  });
}

async function settledWithMostJobsPending(t: Backend) {
  let most = 0;
  while (vi.getTimerCount() > 0) {
    vi.runOnlyPendingTimers();
    await t.finishInProgressScheduledFunctions();
    const pending = await t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter(({ state }) => state.kind === "pending").length);
    most = Math.max(most, pending);
  }
  return most;
}
