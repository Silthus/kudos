import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { holds } from "../../testing/hoggies";
import { memberChanged, testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import schema from "../schema";

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const avatarFlags = ["xp-levels", "unlocks", "achievements", "collection", "hoggie-avatar"];

type TableName = keyof typeof schema.tables;
type Row = Record<string, unknown>;
type Caller = Pick<Backend, "mutation">;

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
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

function flagsOn(...keys: string[]) {
  return switchWebsite(t, postHog, true, ...keys);
}

async function aMemberHoldingRocket() {
  await flagsOn(...avatarFlags.filter((flag) => flag !== "collection"));
  await bookShippedBeforeAnyoneJoined(t);
  const member = await aMember(t, juno.user);
  const { asSignedIn } = await aSignedInSession(t, juno);
  await reachesLevel(t, member, 4);
  await opens(t, member, "book");
  await holds(t, member, "rocket");
  await flagsOn(...avatarFlags);
  return { member, asSignedIn };
}

function setAvatar(caller: Caller, hoggie: string | null) {
  return caller.mutation(api.website.commands.setAvatar, { hoggie });
}

async function everythingWritten() {
  const tables = await t.run(async (ctx) => {
    const rows = {} as Record<TableName, Row[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  return { tables, scheduled: await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()) };
}

describe("website commands pass one guard", () => {
  test("WS61: with the website flag off, setting an avatar answers closed and writes nothing at all", async () => {
    const { asSignedIn } = await aMemberHoldingRocket();
    await switchWebsite(t, postHog, false, ...avatarFlags);
    const before = await everythingWritten();

    expect(await setAvatar(asSignedIn, "rocket")).toEqual({ kind: "closed" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS61: without a session it answers signed-out, and for a member who left not-a-member, writing nothing at all", async () => {
    const { asSignedIn } = await aMemberHoldingRocket();
    const before = await everythingWritten();

    expect(await setAvatar(t, "rocket")).toEqual({ kind: "signed-out" });
    expect(await everythingWritten()).toEqual(before);
    await memberChanged(t, "user_change", { id: juno.user, team_id: "T1", deleted: true });
    const left = await everythingWritten();
    expect(await setAvatar(asSignedIn, "rocket")).toEqual({ kind: "not-a-member" });
    expect(await everythingWritten()).toEqual(left);
  });

  test("WS61: the hoggie is the only argument, so no call names a member", async () => {
    const { member, asSignedIn } = await aMemberHoldingRocket();
    const before = await everythingWritten();

    await expect(asSignedIn.mutation(api.website.commands.setAvatar, { hoggie: "rocket", member } as never)).rejects.toThrow(/member/);
    expect(await everythingWritten()).toEqual(before);
  });
});

describe("a website command never launches unlocks", () => {
  test("WS62 P77: with no unlocks launch recorded, setting an avatar answers refused and launches nothing", async () => {
    const { asSignedIn } = await aMemberHoldingRocket();
    await t.run(async (ctx) => {
      for (const launch of await ctx.db.query("unlockLaunches").collect()) await ctx.db.delete(launch._id);
    });
    const before = await everythingWritten();

    expect(await setAvatar(asSignedIn, "rocket")).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS62 P91: with quests on and no Journey launch, setting an avatar answers refused and doesn't launch the Journey", async () => {
    const { asSignedIn } = await aMemberHoldingRocket();
    await flagsOn(...avatarFlags, "quests");
    const before = await everythingWritten();

    expect(await setAvatar(asSignedIn, "rocket")).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.journeyLaunches).toEqual([]);
  });
});
