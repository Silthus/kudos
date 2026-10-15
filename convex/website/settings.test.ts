import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { publish } from "../bus/publish";
import { primaryGroupOf } from "../groups/groups";
import { placeOf } from "../messageSettings/messageSettings";
import type { MessageKind, MessagePlace } from "../messageSettings/kinds";
import schema from "../schema";
import type { Id } from "../_generated/dataModel";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const messageSettings = "message-settings";
const unlocksFlags = ["everyone-board", "xp-levels", "unlocks"];

type TableName = keyof typeof schema.tables;
type Row = Record<string, unknown>;
type Caller = Pick<Backend, "mutation" | "query">;

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack().withMember(juno.user);
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function signedInWith(...flags: string[]) {
  await switchWebsite(t, postHog, true, ...flags);
  const member = await aMember(t, juno.user);
  const { asSignedIn } = await aSignedInSession(t, juno);
  return { member, asSignedIn };
}

async function inGroups(...names: string[]) {
  for (const name of names) slack.withUserGroup(`S_${name.toUpperCase()}`, { name, users: [juno.user] });
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settleInTimeOrder(t);
  return t.run(async (ctx) => Object.fromEntries((await ctx.db.query("userGroups").collect()).map(({ name, _id }) => [name, _id])));
}

function settingsOf(caller: Caller) {
  return caller.query(api.website.settings.getSettings, {});
}

function setMessageSetting(caller: Caller, kind: MessageKind, place: MessagePlace) {
  return caller.mutation(api.website.commands.setMessageSetting, { kind, place });
}

function pickPrimaryGroup(caller: Caller, group: string) {
  return caller.mutation(api.website.commands.pickPrimaryGroup, { group });
}

function placeIn(member: MemberId, kind: MessageKind) {
  return t.run((ctx) => placeOf(ctx, member, kind));
}

async function everyTable(backend: Backend = t) {
  return backend.run(async (ctx) => {
    const tables = {} as Record<TableName, Row[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) tables[table] = await ctx.db.query(table).collect();
    return tables;
  });
}

function scheduledFunctions(backend: Backend = t) {
  return backend.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}

async function everythingWritten() {
  return { tables: await everyTable(), scheduled: await scheduledFunctions() };
}

async function scheduledNamed(name: string) {
  return (await scheduledFunctions()).filter((scheduled) => scheduled.name === name);
}

async function homeRepublishes() {
  return (await scheduledNamed("slack/appHome:publishHome")).filter(({ args: [args] }) => (args as { user?: string }).user === juno.user);
}

describe("website reads pass one guard", () => {
  test("WS11: with the website flag off, the settings read answers closed", async () => {
    await signedInWith(messageSettings);
    const { asSignedIn } = await aSignedInSession(t, { user: "U_OTHER" });
    await switchWebsite(t, postHog, false, messageSettings);

    expect(await settingsOf(asSignedIn)).toEqual({ kind: "closed" });
  });

  test("WS11: without a session, the settings read answers signed-out", async () => {
    await signedInWith(messageSettings);

    expect(await settingsOf(t)).toEqual({ kind: "signed-out" });
  });
});

describe("the settings read", () => {
  test("with nothing to set, it answers not-found", async () => {
    const { asSignedIn } = await signedInWith();

    expect(await settingsOf(asSignedIn)).toEqual({ kind: "not-found" });
  });

  test("with message settings on, it lists each kind that applies to the member in catalogue order, with its place and the places it offers", async () => {
    const { asSignedIn } = await signedInWith(messageSettings, "xp-levels");

    expect(await settingsOf(asSignedIn)).toEqual({
      kind: "settings",
      board: null,
      group: null,
      messages: [
        expect.objectContaining({ kind: "kudos-reply", label: "After-kudos reply", on: true, place: "channel", places: ["channel", "dm", "none"] }),
        expect.objectContaining({ kind: "level-ups", label: "Level ups", on: true, place: "dm", places: ["dm", "channel", "none"] }),
        expect.objectContaining({ kind: "celebrations", label: "Public celebrations", on: true, place: "channel", places: ["channel", "none"] }),
      ],
    });
  });

  test("WS321: with the board open while unlocks don't apply, it shows whether the member is on the boards", async () => {
    const { asSignedIn } = await signedInWith("everyone-board");
    await setBoardVisibility(asSignedIn, false);

    expect(await settingsOf(asSignedIn)).toEqual({ kind: "settings", board: { onTheBoards: false }, messages: null, group: null });
  });

  test("with groups on, a member in two groups picks between them, their primary group first chosen", async () => {
    const { asSignedIn } = await signedInWith("groups");
    const { Gardeners, Zebras } = await inGroups("Zebras", "Gardeners");

    const settings = await settingsOf(asSignedIn);

    expect(settings).toMatchObject({ kind: "settings", group: { groups: [{ group: Gardeners, name: "Gardeners" }, { group: Zebras, name: "Zebras" }] } });
    expect([Gardeners, Zebras]).toContain((settings as { group: { primary: { group: string } } }).group.primary.group);
  });

  test("with groups on, a member in one group has nothing to pick", async () => {
    const { asSignedIn } = await signedInWith("groups");
    await inGroups("Gardeners");

    expect(await settingsOf(asSignedIn)).toEqual({ kind: "not-found" });
  });

  test("getMyProfile says whether the settings page has something to show", async () => {
    const off = await signedInWith();
    expect(await off.asSignedIn.query(api.website.profile.getMyProfile, {})).toMatchObject({ kind: "member", settings: false });

    await switchWebsite(t, postHog, true, messageSettings);
    expect(await off.asSignedIn.query(api.website.profile.getMyProfile, {})).toMatchObject({ kind: "member", settings: true });
  });
});

function setBoardVisibility(caller: Caller, visible: boolean) {
  return caller.mutation(api.website.commands.setBoardVisibility, { visible });
}

describe("website commands pass one guard", () => {
  test("WS61: with the website flag off, the message setting answers closed and writes nothing", async () => {
    await signedInWith(messageSettings);
    const { asSignedIn } = await aSignedInSession(t, juno);
    await switchWebsite(t, postHog, false, messageSettings);
    const before = await everythingWritten();

    expect(await setMessageSetting(asSignedIn, "kudos-reply", "dm")).toEqual({ kind: "closed" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS61: without a session, the message setting and the group pick answer signed-out and write nothing", async () => {
    await signedInWith(messageSettings, "groups");
    const before = await everythingWritten();

    expect(await setMessageSetting(t, "kudos-reply", "dm")).toEqual({ kind: "signed-out" });
    expect(await pickPrimaryGroup(t, "anything")).toEqual({ kind: "signed-out" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS61: a member who left the workspace answers not-a-member", async () => {
    const { asSignedIn } = await signedInWith(messageSettings);
    await memberChanged(t, "user_change", { id: juno.user, team_id: "T1", deleted: true });
    const before = await everythingWritten();

    expect(await setMessageSetting(asSignedIn, "kudos-reply", "dm")).toEqual({ kind: "not-a-member" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS61: the kind and the place are the only arguments, so no call names a member", async () => {
    const { member, asSignedIn } = await signedInWith(messageSettings);

    await expect(asSignedIn.mutation(api.website.commands.setMessageSetting, { kind: "kudos-reply", place: "dm", member } as never)).rejects.toThrow(/member/);
    await expect(asSignedIn.mutation(api.website.commands.pickPrimaryGroup, { group: "anything", member } as never)).rejects.toThrow(/member/);
  });
});

describe("a website command is a D17 command", () => {
  describe("the message setting", () => {
    test("moves a kind to a place it offers, answering the place stored afterwards", async () => {
      const { member, asSignedIn } = await signedInWith(messageSettings);

      expect(await setMessageSetting(asSignedIn, "kudos-reply", "dm")).toEqual({ kind: "set", place: "dm" });
      expect(await placeIn(member, "kudos-reply")).toBe("dm");

      expect(await setMessageSetting(asSignedIn, "kudos-reply", "none")).toEqual({ kind: "set", place: "none" });
      expect(await placeIn(member, "kudos-reply")).toBe("none");
    });

    test("records the usage fact and republishes App Home once, and a repeated request changes nothing", async () => {
      const { asSignedIn } = await signedInWith(messageSettings);
      const republishedBefore = (await homeRepublishes()).length;

      await setMessageSetting(asSignedIn, "kudos-reply", "dm");
      expect(await setMessageSetting(asSignedIn, "kudos-reply", "dm")).toEqual({ kind: "set", place: "dm" });

      const recorded = await scheduledNamed("analytics/isolatedUsage:recordMessageSettingChanged");
      expect(recorded.map(({ args: [args] }) => args)).toEqual([expect.objectContaining({ setting: "kudos-reply", on: true, place: "dm" })]);
      expect(await homeRepublishes()).toHaveLength(republishedBefore + 1);
    });

    const refusals: Array<{ condition: string; flags: string[]; kind: MessageKind; place: MessagePlace }> = [
      { condition: "message settings off for the member", flags: [], kind: "kudos-reply", place: "dm" },
      { condition: "a kind that doesn't apply to the member", flags: [messageSettings], kind: "level-ups", place: "none" },
      { condition: "a place the kind doesn't offer", flags: [messageSettings, "xp-levels"], kind: "celebrations", place: "dm" },
    ];

    test.each(refusals)("$condition answers refused before D17 and writes nothing at all", async ({ flags, kind, place }) => {
      const { asSignedIn } = await signedInWith(...flags);
      const before = await everythingWritten();

      expect(await setMessageSetting(asSignedIn, kind, place)).toEqual({ kind: "refused" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("WS64 WS335: a change on the website leaves the domain tables and events Slack's Settings pick leaves, besides Slack's receipt and the website's own exposure", async () => {
      const slackSide = testBackend();
      await switchWebsite(slackSide, postHog, true, messageSettings);
      const slackMember = await aMember(slackSide, juno.user);
      vi.mocked(publish).mockClear();
      await slackSide.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId: "Ev_SETTINGS", user: juno.user, commands: [{ type: "setMessageSetting", kind: "kudos-reply", place: "dm" }] });
      const fromSlack = { tables: await everyTable(slackSide), events: vi.mocked(publish).mock.calls.map(([, event]) => event) };

      const { member, asSignedIn } = await signedInWith(messageSettings);
      vi.mocked(publish).mockClear();
      expect(await setMessageSetting(asSignedIn, "kudos-reply", "dm")).toEqual({ kind: "set", place: "dm" });
      const fromWebsite = { tables: await everyTable(), events: vi.mocked(publish).mock.calls.map(([, event]) => event) };

      expect(comparable(fromWebsite, member)).toEqual(comparable(fromSlack, slackMember));
      expect(fromWebsite.tables.messageSettings).toMatchObject([{ member, kind: "kudos-reply", on: true, place: "dm" }]);
    });
  });

  describe("the group pick", () => {
    test("picks one of the member's groups, records the pick once with the website as its surface, and a repeat changes nothing", async () => {
      const { member, asSignedIn } = await signedInWith("groups");
      const { Gardeners, Zebras } = await inGroups("Zebras", "Gardeners");
      const primary = await t.run((ctx) => primaryGroupOf(ctx, member));
      const other = primary?.group === Gardeners ? Zebras! : Gardeners!;

      expect(await pickPrimaryGroup(asSignedIn, other)).toEqual({ kind: "picked", group: other });
      expect(await pickPrimaryGroup(asSignedIn, other)).toEqual({ kind: "picked", group: other });

      expect((await t.run((ctx) => primaryGroupOf(ctx, member)))?.group).toBe(other);
      const recorded = await scheduledNamed("analytics/isolatedUsage:recordPrimaryGroupPicked");
      expect(recorded.map(({ args: [args] }) => args)).toEqual([expect.objectContaining({ surface: "website" })]);
    });

    test("a group the member isn't in, or no ID at all, answers refused and writes nothing", async () => {
      const { asSignedIn } = await signedInWith("groups");
      await inGroups("Zebras", "Gardeners");
      const elsewhere = await t.run((ctx) => ctx.db.insert("userGroups", { workspace: "T1", group: "S_ELSE", handle: "else", name: "Else", enabled: true, automatic: false, asOf: 0 }));
      const before = await everythingWritten();

      expect(await pickPrimaryGroup(asSignedIn, elsewhere)).toEqual({ kind: "refused" });
      expect(await pickPrimaryGroup(asSignedIn, "not-an-id")).toEqual({ kind: "refused" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("a group Slack has removed the member from, before reconciling caught up, answers refused and writes nothing", async () => {
      const { member, asSignedIn } = await signedInWith("groups");
      const { Gardeners, Zebras } = await inGroups("Zebras", "Gardeners");
      const primary = await t.run((ctx) => primaryGroupOf(ctx, member));
      const other = primary?.group === Gardeners ? Zebras! : Gardeners!;
      const slackGroup = await t.run(async (ctx) => (await ctx.db.get(other as never as Id<"userGroups">))!.group);
      await t.run(async (ctx) => {
        for (const row of await ctx.db.query("userGroupMembers").collect()) if (row.group === slackGroup) await ctx.db.delete(row._id);
      });
      const before = await everythingWritten();

      expect(await pickPrimaryGroup(asSignedIn, other)).toEqual({ kind: "refused" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("with groups off for the member, it answers refused and writes nothing", async () => {
      const { asSignedIn } = await signedInWith();
      const { Zebras } = await inGroups("Zebras", "Gardeners");
      const before = await everythingWritten();

      expect(await pickPrimaryGroup(asSignedIn, Zebras!)).toEqual({ kind: "refused" });
      expect(await everythingWritten()).toEqual(before);
    });

  });
});

describe("a website command never launches unlocks", () => {
  test("WS335 P77: with unlocks on and no unlocks launch, the message setting answers refused and launches nothing", async () => {
    const { asSignedIn } = await signedInWith(messageSettings, ...unlocksFlags);
    const before = await everythingWritten();

    expect(await setMessageSetting(asSignedIn, "kudos-reply", "dm")).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.unlockLaunches).toEqual([]);
    expect(vi.mocked(publish).mock.calls).toEqual([]);
  });

  test("WS335 P77: with unlocks on and no unlocks launch, the group pick answers refused and launches nothing", async () => {
    const { asSignedIn } = await signedInWith("groups", ...unlocksFlags);
    const { Zebras } = await inGroups("Zebras", "Gardeners");
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await pickPrimaryGroup(asSignedIn, Zebras!)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.unlockLaunches).toEqual([]);
    expect(vi.mocked(publish).mock.calls).toEqual([]);
  });
});

function comparable({ tables, events }: { tables: Record<TableName, Row[]>; events: unknown[] }, member: MemberId) {
  const domain = { ...tables, slackReceipts: [], analyticsOutbox: [], analyticsDrain: [], users: [], authSessions: [], flagExposures: tables.flagExposures.filter(({ flag }) => flag !== "website") };
  return normalised({ domain, events }, member);
}

const generatedKey = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function normalised(value: unknown, member: MemberId): unknown {
  if (value === member) return "<member>";
  if (typeof value === "string" && generatedKey.test(value)) return "<generated key>";
  if (Array.isArray(value)) return value.map((item) => normalised(item, member));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "_id" && key !== "_creationTime")
      .map(([key, field]) => [key, normalised(field, member)]),
  );
}
