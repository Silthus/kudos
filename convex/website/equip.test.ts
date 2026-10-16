import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, journeyShippedBeforeAnyoneJoined, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { memberChanged, testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { publish } from "../bus/publish";
import schema from "../schema";
import { equip as equipInTheStore } from "../store/equipping";
import { grantItem, loadoutOf } from "../store/inventory";
import type { Slot } from "../store/rows";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const storeFlags = ["xp-levels", "unlocks", "coins", "store"];
const hedgehog = "kudos-emoji-hedgehog";
const rocket = "kudos-emoji-rocket";
const sunflower = "kudos-emoji-sunflower";
const levelSix = 1000;

type TableName = keyof typeof schema.tables;
type Row = Record<string, unknown>;
type Caller = Pick<Backend, "mutation">;

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function signedInAtLevelSix(backend: Backend, ...flags: string[]) {
  await switchWebsite(backend, postHog, true, ...flags);
  await unlocksShippedBeforeAnyoneJoined(backend);
  const member = await aMember(backend, juno.user);
  const { asSignedIn } = await aSignedInSession(backend, juno);
  await backend.run((ctx) => ctx.db.insert("memberProgress", { member, xp: levelSix, pointsSpent: 0 }));
  await reachesLevel(backend, member, 6);
  return { backend, member, asSignedIn };
}

async function anOpenInventoryIn(backend: Backend = t, ...alsoOn: string[]) {
  const team = await signedInAtLevelSix(backend, ...storeFlags);
  await opens(backend, team.member, "coins");
  await backend.run((ctx) => grantItem(ctx, { member: team.member, item: rocket, source: "store", arrivedAt: now.getTime() + 1 }));
  await backend.run((ctx) => grantItem(ctx, { member: team.member, item: sunflower, source: "store", arrivedAt: now.getTime() + 2 }));
  if (alsoOn.length > 0) await switchWebsite(backend, postHog, true, ...storeFlags, ...alsoOn);
  return team;
}

function equip(caller: Caller, item: string, slot: Slot) {
  return caller.mutation(api.website.commands.equip, { item, slot });
}

function takeOff(caller: Caller, slot: Slot) {
  return caller.mutation(api.website.commands.takeOff, { slot });
}

function loadout(member: MemberId, backend: Backend = t) {
  return backend.run((ctx) => loadoutOf(ctx, member));
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

async function everythingWritten(backend: Backend = t) {
  return { tables: await everyTable(backend), scheduled: await scheduledFunctions(backend) };
}

function publishedEvents() {
  return vi.mocked(publish).mock.calls.map(([, event]) => event);
}

async function homeRepublishesFor(user: string) {
  return (await scheduledFunctions()).filter(({ name, args: [args] }) => name === "slack/appHome:publishHome" && (args as { user?: string }).user === user);
}

describe("website commands pass one guard", { timeout: 30_000 }, () => {
  test("WS61: without a session, each answers signed-out and writes nothing", async () => {
    await anOpenInventoryIn();
    const before = await everythingWritten();

    expect(await equip(t, rocket, "emoji-2")).toEqual({ kind: "signed-out" });
    expect(await takeOff(t, "emoji-1")).toEqual({ kind: "signed-out" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS61: a member who left the workspace answers not-a-member to equip and writes nothing", async () => {
    const { asSignedIn } = await anOpenInventoryIn();
    await memberChanged(t, "user_change", { id: juno.user, team_id: "T1", deleted: true });
    const before = await everythingWritten();

    expect(await equip(asSignedIn, rocket, "emoji-2")).toEqual({ kind: "not-a-member" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS61: the item and the slot are the only arguments, so no equip or take-off names a member", async () => {
    const { member, asSignedIn } = await anOpenInventoryIn();
    const before = await everythingWritten();

    await expect(asSignedIn.mutation(api.website.commands.equip, { item: rocket, slot: "emoji-2", member } as never)).rejects.toThrow(/member/);
    await expect(asSignedIn.mutation(api.website.commands.takeOff, { slot: "emoji-1", member } as never)).rejects.toThrow(/member/);
    expect(await everythingWritten()).toEqual(before);
  });
});

describe("a website command never launches unlocks", { timeout: 30_000 }, () => {
  test("WS335 P77: with unlocks on and no unlocks launch, equip and take-off answer refused and launch nothing", async () => {
    await switchWebsite(t, postHog, true, ...storeFlags);
    await aMember(t, juno.user);
    const { asSignedIn } = await aSignedInSession(t, juno);
    const before = await everythingWritten();

    expect(await equip(asSignedIn, hedgehog, "emoji-2")).toEqual({ kind: "refused" });
    expect(await takeOff(asSignedIn, "emoji-1")).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.unlockLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS335 P91: with quests on and no Journey launch, an open inventory refuses equip and take-off and neither launches the Journey nor joins anyone", async () => {
    const { asSignedIn } = await anOpenInventoryIn(t, "quests");
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await equip(asSignedIn, rocket, "emoji-2")).toEqual({ kind: "refused" });
    expect(await takeOff(asSignedIn, "emoji-1")).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.journeyLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS335: with achievements on and no Book launch, an open inventory refuses equip and take-off and doesn't launch the Book", async () => {
    const { asSignedIn } = await anOpenInventoryIn(t, "achievements");
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await equip(asSignedIn, rocket, "emoji-2")).toEqual({ kind: "refused" });
    expect(await takeOff(asSignedIn, "emoji-1")).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.bookLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });
});

describe("a website command is a D17 command", { timeout: 60_000 }, () => {
  type Refusal = { condition: string; arrange: () => Promise<{ asSignedIn: Caller }> };

  const refusedByTheInventory: Refusal[] = [
    { condition: "Coins ready but not opened", arrange: () => signedInAtLevelSix(t, ...storeFlags) },
    {
      condition: "the store flag off with Coins open",
      arrange: async () => {
        const team = await signedInAtLevelSix(t, "xp-levels", "unlocks", "coins");
        await opens(t, team.member, "coins");
        return team;
      },
    },
  ];

  test.each(refusedByTheInventory)("WS341: $condition answers refused to equip and take-off before D17 and writes nothing at all", async ({ arrange }) => {
    const { asSignedIn } = await arrange();
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await equip(asSignedIn, hedgehog, "emoji-2")).toEqual({ kind: "refused" });
    expect(await takeOff(asSignedIn, "emoji-1")).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS341 ST26: with the Journey and the Book launched, equip puts an owned emoji into an empty slot and answers the loadout D17 left", async () => {
    const { member, asSignedIn } = await anOpenInventoryIn(t, "quests", "achievements");
    await journeyShippedBeforeAnyoneJoined(t);
    await bookShippedBeforeAnyoneJoined(t);

    expect(await equip(asSignedIn, rocket, "emoji-2")).toEqual({ kind: "equipped", slot: "emoji-2", item: rocket });
    expect(await loadout(member)).toEqual([
      { slot: "emoji-1", item: hedgehog },
      { slot: "emoji-2", item: rocket },
      { slot: "emoji-3", item: null },
    ]);
  });

  test("WS341 ST26: equip moves an emoji already in another slot, replacing what the chosen slot held", async () => {
    const { member, asSignedIn } = await anOpenInventoryIn();
    await equip(asSignedIn, rocket, "emoji-2");

    expect(await equip(asSignedIn, rocket, "emoji-1")).toEqual({ kind: "equipped", slot: "emoji-1", item: rocket });
    expect(await loadout(member)).toEqual([
      { slot: "emoji-1", item: rocket },
      { slot: "emoji-2", item: null },
      { slot: "emoji-3", item: null },
    ]);
  });

  test("WS341 ST26: equip of an emoji the member doesn't own answers refused and writes nothing", async () => {
    const { member, asSignedIn } = await anOpenInventoryIn();
    const before = await everyTable();

    expect(await equip(asSignedIn, "kudos-emoji-gem", "emoji-2")).toEqual({ kind: "refused" });
    expect(await loadout(member)).toEqual([
      { slot: "emoji-1", item: hedgehog },
      { slot: "emoji-2", item: null },
      { slot: "emoji-3", item: null },
    ]);
    expect(await everyTable()).toEqual(before);
  });

  test("WS341 ST26: take-off empties the slot, and the starter can come off too", async () => {
    const { member, asSignedIn } = await anOpenInventoryIn();
    await equip(asSignedIn, rocket, "emoji-2");

    expect(await takeOff(asSignedIn, "emoji-1")).toEqual({ kind: "takenOff", slot: "emoji-1" });
    expect(await loadout(member)).toEqual([
      { slot: "emoji-1", item: null },
      { slot: "emoji-2", item: rocket },
      { slot: "emoji-3", item: null },
    ]);
  });

  test("WS335 WS63: App Home's republish follows an equip that changes the loadout, and the same equip again changes nothing and republishes nothing", async () => {
    const { member, asSignedIn } = await anOpenInventoryIn();
    const republishedBefore = await homeRepublishesFor(juno.user);

    await equip(asSignedIn, rocket, "emoji-2");
    expect(await homeRepublishesFor(juno.user)).toHaveLength(republishedBefore.length + 1);
    const once = await everyTable();

    expect(await equip(asSignedIn, rocket, "emoji-2")).toEqual({ kind: "equipped", slot: "emoji-2", item: rocket });
    expect(await everyTable()).toEqual(once);
    expect(await homeRepublishesFor(juno.user)).toHaveLength(republishedBefore.length + 1);
    expect((await loadout(member))[1]).toEqual({ slot: "emoji-2", item: rocket });
  });

  test("WS335 WS63: take-off of an empty slot answers takenOff, writes nothing and republishes nothing", async () => {
    const { asSignedIn } = await anOpenInventoryIn();
    const before = await everythingWritten();

    expect(await takeOff(asSignedIn, "emoji-3")).toEqual({ kind: "takenOff", slot: "emoji-3" });
    expect(await everythingWritten()).toEqual(before);
  });

  async function fromSlackClick(command: { type: "equip"; item: string; slot: Slot } | { type: "takeOff"; slot: Slot }) {
    const slackSide = await anOpenInventoryIn(testBackend());
    await slackSide.backend.run((ctx) => equipInTheStore(ctx, slackSide.member, sunflower, "emoji-2"));
    vi.mocked(publish).mockClear();
    await slackSide.backend.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId: "Ev_LOADOUT", user: juno.user, commands: [command] });
    return { member: slackSide.member, tables: await everyTable(slackSide.backend), events: publishedEvents() };
  }

  async function fromWebsite(call: (caller: Caller) => Promise<unknown>) {
    const websiteSide = await anOpenInventoryIn(t);
    await t.run((ctx) => equipInTheStore(ctx, websiteSide.member, sunflower, "emoji-2"));
    vi.mocked(publish).mockClear();
    await call(websiteSide.asSignedIn);
    return { member: websiteSide.member, tables: await everyTable(t), events: publishedEvents() };
  }

  test("WS64 WS335: equip on the website leaves the domain tables and events Slack's App Home slot choice leaves, besides Slack's receipt", async () => {
    const slack = await fromSlackClick({ type: "equip", item: rocket, slot: "emoji-3" });
    const website = await fromWebsite((caller) => equip(caller, rocket, "emoji-3"));

    expect(comparable(website)).toEqual(comparable(slack));
    expect(website.tables.loadouts).toMatchObject([{ slot: "emoji-1", item: hedgehog }, { slot: "emoji-2", item: sunflower }, { slot: "emoji-3", item: rocket }]);
  });

  test("WS64 WS335: take-off on the website leaves the domain tables and events Slack's App Home Take off leaves, besides Slack's receipt", async () => {
    const slack = await fromSlackClick({ type: "takeOff", slot: "emoji-2" });
    const website = await fromWebsite((caller) => takeOff(caller, "emoji-2"));

    expect(comparable(website)).toEqual(comparable(slack));
    expect(website.tables.loadouts).toMatchObject([{ slot: "emoji-1", item: hedgehog }, { slot: "emoji-2", item: null }, { slot: "emoji-3", item: null }]);
  });
});

function comparable({ tables, events, member }: { tables: Record<TableName, Row[]>; events: unknown[]; member: MemberId }) {
  const domain = { ...tables, slackReceipts: [], analyticsOutbox: [], analyticsDrain: [] };
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
