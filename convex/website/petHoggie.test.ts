import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, onForEmails, onForEveryone } from "../../testing/flags";
import { holds } from "../../testing/hoggies";
import { memberChanged, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-21T10:00:00Z");
const ann = { user: "U_ANN", name: "Ann Quill", email: "ann@example.com" };
const bea = { user: "U_BEA", name: "Bea Marsh", email: "bea@example.com" };
const albumFlags = ["album", "collection"];

type Person = typeof ann;

let postHog: FakePostHog;
let t: Backend;

beforeEach(async () => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack().withMember(ann.user, slackProfileOf(ann)).withMember(bea.user, slackProfileOf(bea));
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await serving(...[...albumFlags, "pet-hoggie"].map(onForEveryone));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP57, LP59: Make my pet makes a hoggie the member owns their one pet, another pick replaces it, a hoggie they don't own is refused, and there is no default", { timeout: 60_000 }, () => {
  test("a member starts with no pet, and every viewer's album lists none", async () => {
    await holds(t, await aTeammate(ann), "rocket");
    await aTeammate(bea);

    expect(await petOnHoggiesOf(ann)).toBeNull();
    expect(await petsSeenBy(bea)).toEqual([]);
  });

  test("Make my pet makes the hoggie the member's pet for every viewer, a second pick replaces it, and a repeat answers the same", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, "banana", "rocket");
    await aTeammate(bea);

    expect(await makesPet(ann, "rocket")).toEqual({ kind: "picked", pet: "rocket" });
    expect(await petOnHoggiesOf(ann)).toBe("rocket");
    expect(await petsSeenBy(bea)).toEqual([{ person: member, hoggie: "rocket", name: "Rocket", rarity: "legendary" }]);

    expect(await makesPet(ann, "banana")).toEqual({ kind: "picked", pet: "banana" });
    expect(await makesPet(ann, "banana")).toEqual({ kind: "picked", pet: "banana" });
    expect(await petOnHoggiesOf(ann)).toBe("banana");
    expect(await petsSeenBy(bea)).toEqual([{ person: member, hoggie: "banana", name: "Banana", rarity: "common" }]);
    expect(await petsSeenBy(ann)).toEqual([{ person: member, hoggie: "banana", name: "Banana", rarity: "common" }]);
  });

  test("each member keeps their own pet", async () => {
    const annMember = await aTeammate(ann);
    const beaMember = await aTeammate(bea);
    await holds(t, annMember, "rocket");
    await holds(t, beaMember, "banana");

    await makesPet(ann, "rocket");
    await makesPet(bea, "banana");

    expect(await petsSeenBy(ann)).toEqual(
      expect.arrayContaining([
        { person: annMember, hoggie: "rocket", name: "Rocket", rarity: "legendary" },
        { person: beaMember, hoggie: "banana", name: "Banana", rarity: "common" },
      ]),
    );
    expect(await petsSeenBy(ann)).toHaveLength(2);
  });

  test("a hoggie the member doesn't hold, or no hoggie at all, is refused and keeps the pet they had", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, "banana");
    await makesPet(ann, "banana");

    expect(await makesPet(ann, "rocket")).toEqual({ kind: "refused" });
    expect(await makesPet(ann, "no-such-hoggie")).toEqual({ kind: "refused" });

    expect(await petOnHoggiesOf(ann)).toBe("banana");
  });
});

describe("LP60: pet-hoggie is read for the viewer for the pet's display and for the owner for Make my pet", { timeout: 60_000 }, () => {
  test("with pet-hoggie off the album and Hoggies read as before, and Make my pet is refused and picks nothing", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, "rocket");
    await serving(...albumFlags.map(onForEveryone));

    expect(await albumOf(ann)).not.toHaveProperty("pets");
    expect(await hoggiesOf(ann)).not.toHaveProperty("pet");
    expect(await makesPet(ann, "rocket")).toEqual({ kind: "refused" });

    await serving(...[...albumFlags, "pet-hoggie"].map(onForEveryone));
    expect(await petOnHoggiesOf(ann)).toBeNull();
  });

  test("a pet shows to a viewer pet-hoggie is on for even while it is off for its owner, who can't pick another", async () => {
    const annMember = await aTeammate(ann);
    await holds(t, annMember, "banana", "rocket");
    await aTeammate(bea);
    await makesPet(ann, "rocket");

    await serving(...albumFlags.map(onForEveryone), onForEmails("pet-hoggie", bea.email));

    expect(await petsSeenBy(bea)).toEqual([{ person: annMember, hoggie: "rocket", name: "Rocket", rarity: "legendary" }]);
    expect(await albumOf(ann)).not.toHaveProperty("pets");
    expect(await makesPet(ann, "banana")).toEqual({ kind: "refused" });
    expect(await petsSeenBy(bea)).toEqual([{ person: annMember, hoggie: "rocket", name: "Rocket", rarity: "legendary" }]);
  });

  test("with collection off Make my pet is refused, as the Hoggies page is closed", async () => {
    await holds(t, await aTeammate(ann), "rocket");
    await serving(onForEveryone("album"), onForEveryone("pet-hoggie"));

    expect(await makesPet(ann, "rocket")).toEqual({ kind: "refused" });
  });
});

describe("website commands pass one guard", { timeout: 60_000 }, () => {
  test("WS61: with the website flag off, Make my pet answers closed and writes nothing at all", async () => {
    await holds(t, await aTeammate(ann), "rocket");
    const asAnn = await signedIn(ann);
    await flagsFromPostHog(t, postHog, ...[...albumFlags, "pet-hoggie"].map(onForEveryone));
    const before = await everyTable();

    expect(await asAnn.mutation(api.website.album.makePet, { hoggie: "rocket" })).toEqual({ kind: "closed" });
    expect(await everyTable()).toEqual(before);
  });

  test("WS61: without a session Make my pet answers signed-out, and for a member who left not-a-member, writing nothing at all", async () => {
    await holds(t, await aTeammate(ann), "rocket");
    const asAnn = await signedIn(ann);
    const before = await everyTable();

    expect(await t.mutation(api.website.album.makePet, { hoggie: "rocket" })).toEqual({ kind: "signed-out" });
    expect(await everyTable()).toEqual(before);
    await memberChanged(t, "user_change", { id: ann.user, ...slackProfileOf(ann), deleted: true });
    await settleInTimeOrder(t);
    const left = await everyTable();
    expect(await asAnn.mutation(api.website.album.makePet, { hoggie: "rocket" })).toEqual({ kind: "not-a-member" });
    expect(await everyTable()).toEqual(left);
  });

  test("WS61: the hoggie is makePet's only argument, so no call names a member", async () => {
    const member = await aTeammate(ann);
    await holds(t, member, "rocket");
    const asAnn = await signedIn(ann);
    const before = await everyTable();

    await expect(asAnn.mutation(api.website.album.makePet, { hoggie: "rocket", member } as never)).rejects.toThrow(/member/);
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

async function signedIn(person: Person) {
  return (await aSignedInSession(t, person)).asSignedIn;
}

async function makesPet(person: Person, hoggie: string) {
  return (await signedIn(person)).mutation(api.website.album.makePet, { hoggie });
}

async function albumOf(person: Person) {
  const album = await (await signedIn(person)).query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`getAlbum answered ${album.kind}`);
  return album;
}

async function hoggiesOf(person: Person) {
  const hoggies = await (await signedIn(person)).query(api.website.album.getAlbumHoggies, {});
  if (hoggies.kind !== "hoggies") throw new Error(`getAlbumHoggies answered ${hoggies.kind}`);
  return hoggies;
}

async function petsSeenBy(person: Person) {
  return (await albumOf(person)).pets;
}

async function petOnHoggiesOf(person: Person) {
  return (await hoggiesOf(person)).pet;
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
