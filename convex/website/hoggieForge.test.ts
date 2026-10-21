import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, onForEveryone } from "../../testing/flags";
import { holds } from "../../testing/hoggies";
import { memberChanged, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { hoggiesOfRarity } from "../hoggies/catalogue";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-21T10:00:00Z");
const ann = { user: "U_ANN", name: "Ann Quill", email: "ann@example.com" };
const albumFlags = ["album", "collection"];
const everyUncommon = hoggiesOfRarity("uncommon").map(({ hoggie }) => hoggie);
const everyUncommonBut = (left: string) => everyUncommon.filter((hoggie) => hoggie !== left);

type Person = typeof ann;

type Signed = Awaited<ReturnType<typeof aSignedInSession>>["asSignedIn"];

let postHog: FakePostHog;
let t: Backend;
let sessions: Map<Person, Promise<Signed>>;

beforeEach(async () => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().withMember(ann.user, slackProfileOf(ann)).fetch));
  t = testBackend({ transactionLimits: true });
  sessions = new Map();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await serving(...[...albumFlags, "hoggie-forge"].map(onForEveryone));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HF2, HF3, HF4, HF6: a forge spends three spares of a hoggie and finds one a rarity up the member doesn't hold", { timeout: 60_000 }, () => {
  test("forging four Bananas keeps one and finds the one Uncommon left to find", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, "banana", "banana", "banana", "banana", ...everyUncommonBut("cake"));

    expect(await forges(ann, "banana")).toEqual({ kind: "forged", drop: expect.objectContaining({ hoggie: "cake", name: "Cake", rarity: "uncommon", isNew: true }) });

    expect(await held(ann, "banana")).toEqual({ count: 1, spares: 0 });
    expect(await held(ann, "cake")).toEqual({ count: 1, spares: 0 });
  });

  test("a forge from seven copies leaves four, and the forged hoggie is one the member didn't hold", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, ...Array<string>(7).fill("banana"), "cake");

    const forged = await forges(ann, "banana");

    expect(forged).toEqual({ kind: "forged", drop: expect.objectContaining({ rarity: "uncommon", isNew: true }) });
    expect(forged.kind === "forged" && forged.drop.hoggie).not.toBe("cake");
    expect(await held(ann, "banana")).toEqual({ count: 4, spares: 3 });
  });

  test("fewer than three spares, a legendary, a hoggie the member doesn't hold and no catalogue hoggie are refused and write nothing", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, "banana", "banana", "banana", "rocket", "rocket", "rocket", "rocket");
    await signedIn(ann);
    const before = await everyTable();

    expect(await forges(ann, "banana")).toEqual({ kind: "refused" });
    expect(await forges(ann, "rocket")).toEqual({ kind: "refused" });
    expect(await forges(ann, "cake")).toEqual({ kind: "refused" });
    expect(await forges(ann, "no-such-hoggie")).toEqual({ kind: "refused" });

    expect(await everyTable()).toEqual(before);
  });

  test("a forge sent again with the same request, as after a lost answer, answers the same hoggie and spends nothing more", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, ...Array<string>(7).fill("banana"));

    const first = await forges(ann, "banana", "lost-answer");
    const again = await forges(ann, "banana", "lost-answer");

    expect(again).toEqual(first);
    expect(await held(ann, "banana")).toEqual({ count: 4, spares: 3 });
    expect((await hoggiesOf(ann)).hoggies.filter(({ rarity, found }) => rarity === "uncommon" && found)).toHaveLength(1);
  });

  test("a request that isn't a short word of letters, digits, dashes and underscores is refused and writes nothing", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, "banana", "banana", "banana", "banana");
    await signedIn(ann);
    const before = await everyTable();

    expect(await forges(ann, "banana", "")).toEqual({ kind: "refused" });
    expect(await forges(ann, "banana", "a:b")).toEqual({ kind: "refused" });
    expect(await forges(ann, "banana", "x".repeat(65))).toEqual({ kind: "refused" });

    expect(await everyTable()).toEqual(before);
  });

  test("with every Uncommon held, four Bananas are refused and write nothing", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, "banana", "banana", "banana", "banana", ...everyUncommon);
    await signedIn(ann);
    const before = await everyTable();

    expect(await forges(ann, "banana")).toEqual({ kind: "refused" });

    expect(await everyTable()).toEqual(before);
  });
});

describe("HF5, HF12: a forged hoggie is a find with no pack, captured as hoggie dropped from a forge crate", { timeout: 60_000 }, () => {
  test("PostHog gets one hoggie dropped with crate_kind forge and no XP or coins, though packs pay", async () => {
    await serving(...[...albumFlags, "hoggie-forge", "packs"].map(onForEveryone));
    const member = await aTeammate(ann);
    await holds(t, member, "banana", "banana", "banana", "banana", ...everyUncommonBut("cake"));

    await forges(ann, "banana");
    await settleInTimeOrder(t);

    const dropped = postHog.productEvents().filter(({ event }) => event === "hoggie dropped");
    expect(dropped).toEqual([expect.objectContaining({ properties: expect.objectContaining({ rarity: "uncommon", is_new: true, crate_kind: "forge", surface: "website" }) })]);
    expect(dropped[0]!.properties).not.toHaveProperty("pack_xp");
    expect(dropped[0]!.properties).not.toHaveProperty("pack_coins");
  });

  test("Activity lists a forged hoggie once among the week's finds, though the forge is sent again", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, "banana", "banana", "banana", "banana", ...everyUncommonBut("cake"));
    const before = (await weekOf(ann))?.hoggies.hoggies ?? [];

    await forges(ann, "banana", "sent-twice");
    await forges(ann, "banana", "sent-twice");

    expect((await weekOf(ann))?.hoggies).toEqual({ hoggies: [...before, { hoggie: "cake", rarity: "uncommon" }], more: 0 });
  });
});

describe("HF11: hoggie-forge is read for the member without an exposure", { timeout: 60_000 }, () => {
  test("with hoggie-forge off the Hoggies page offers no forge, and a forge is refused and writes nothing", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, "banana", "banana", "banana", "banana");
    await serving(...albumFlags.map(onForEveryone));
    await signedIn(ann);
    const before = await everyTable();

    expect(await hoggiesOf(ann)).not.toHaveProperty("forge");
    expect(await forges(ann, "banana")).toEqual({ kind: "refused" });

    expect(await everyTable()).toEqual(before);
  });

  test("with hoggie-forge on the Hoggies page offers the forge, and reading it exposes nothing", async () => {
    await holds(t, await aTeammate(ann), "banana");
    await signedIn(ann);
    const before = await everyTable();

    expect(await hoggiesOf(ann)).toHaveProperty("forge", true);

    expect(await everyTable()).toEqual(before);
  });

  test("with collection off a forge is refused, as the Hoggies page is closed", async () => {
    await holds(t, await aTeammate(ann), "banana", "banana", "banana", "banana");
    await serving(onForEveryone("album"), onForEveryone("hoggie-forge"));

    expect(await forges(ann, "banana")).toEqual({ kind: "refused" });
  });
});

describe("website commands pass one guard", { timeout: 60_000 }, () => {
  test("WS61: with the website flag off, a forge answers closed and writes nothing at all", async () => {
    await holds(t, await aTeammate(ann), "banana", "banana", "banana", "banana");
    const asAnn = await signedIn(ann);
    await flagsFromPostHog(t, postHog, ...[...albumFlags, "hoggie-forge"].map(onForEveryone));
    const before = await everyTable();

    expect(await asAnn.mutation(api.website.album.forgeHoggie, { hoggie: "banana", request: "forge-1" })).toEqual({ kind: "closed" });
    expect(await everyTable()).toEqual(before);
  });

  test("WS61: the hoggie and the request are forgeHoggie's only arguments, so no call names a member", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, "banana", "banana", "banana", "banana");
    const asAnn = await signedIn(ann);
    const before = await everyTable();

    await expect(asAnn.mutation(api.website.album.forgeHoggie, { hoggie: "banana", request: "forge-1", member } as never)).rejects.toThrow(/member/);
    expect(await everyTable()).toEqual(before);
  });
});

function everyTable() {
  return t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
}

async function serving(...definitions: FlagDefinition[]) {
  await flagsFromPostHog(t, postHog, onForEveryone("website"), ...definitions);
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
}

function signedIn(person: Person): Promise<Signed> {
  if (!sessions.has(person)) sessions.set(person, aSignedInSession(t, person).then(({ asSignedIn }) => asSignedIn));
  return sessions.get(person)!;
}

let requests = 0;

async function forges(person: Person, hoggie: string, request = `forge-${(requests += 1)}`) {
  return (await signedIn(person)).mutation(api.website.album.forgeHoggie, { hoggie, request });
}

async function hoggiesOf(person: Person) {
  const hoggies = await (await signedIn(person)).query(api.website.album.getAlbumHoggies, {});
  if (hoggies.kind !== "hoggies") throw new Error(`getAlbumHoggies answered ${hoggies.kind}`);
  return hoggies;
}

async function weekOf(person: Person) {
  const week = await (await signedIn(person)).query(api.website.album.getAlbumWeek, {});
  if (week.kind !== "week") throw new Error(`getAlbumWeek answered ${week.kind}`);
  return week.issue;
}

async function held(person: Person, hoggie: string) {
  const entry = (await hoggiesOf(person)).hoggies.find((each) => each.hoggie === hoggie)!;
  return { count: entry.count, spares: entry.spares };
}

async function aTeammate(person: Person): Promise<MemberId> {
  await memberChanged(t, "team_join", { id: person.user, ...slackProfileOf(person) });
  await settleInTimeOrder(t);
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique();
    return row!._id;
  });
}

function slackProfileOf({ name, email }: Person) {
  return { profile: { display_name: name, email } };
}
