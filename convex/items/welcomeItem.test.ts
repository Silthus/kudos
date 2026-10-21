import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack, httpStatus } from "../../testing/fakeSlack";
import { memberChanged, post, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, allowedWorkspace, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { catalogue } from "../hoggies/catalogue";
import { drawOf } from "../hoggies/draw";
import { rememberSignedInMember } from "../website/signIn";
import type { AlbumAnswer, AlbumRead, TurnAnswer } from "../website/album";
import type { Denial } from "../website/memberQuery";
import { welcomeCrateKey } from "./welcome";

const tuesday = new Date("2026-10-13T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const albumOpen = ["album", "collection", "packs"];
const itemsOn = [...albumOpen, "hidden-items"];
const welcomeOn = [...itemsOn, "welcome-item"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack();
  for (const person of [juno, bob]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: allowedWorkspace, kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...welcomeOn);
  for (const person of [juno, bob]) await joins(person);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP44 LP50: a member's first sign-in earns one welcome item", () => {
  test("the first sign-in earns one welcome item, and a second sign-in earns nothing more", async () => {
    const first = await signsIn(juno);
    await signsIn(juno, first.user);

    const { board } = await albumOf(first.reader);

    expect(board?.items.map(({ reason }) => reason)).toEqual([{ kind: "welcome" }]);
    expect(await itemsOf(juno)).toEqual([{ source: "hoggie", key: welcomeCrateKey, floor: "rare", reason: { kind: "welcome" } }]);
  });

  test("a member who signed in before welcome-item shipped earns none at a later sign-in", async () => {
    await switchWebsite(t, postHog, true, ...itemsOn);
    const before = await signsIn(juno);
    await switchWebsite(t, postHog, true, ...welcomeOn);

    await signsIn(juno, before.user);

    expect((await albumOf(before.reader)).board?.items).toEqual([]);
  });

  test("a person the directory learns of only by verifying their first sign-in earns the welcome item once verified", async () => {
    const newcomer = { user: "U_NEW", name: "Nell Arden" };
    slack.withMember(newcomer.user, { real_name: newcomer.name });
    const first = await signsIn(newcomer);
    await settle(t);

    await signsIn(newcomer, first.user);
    await settle(t);

    expect((await albumOf(first.reader)).board?.items.map(({ reason }) => reason), "the verified newcomer's welcome item").toEqual([{ kind: "welcome" }]);
  });

  test("a newcomer whose first sign-in's checks all failed earns the welcome item once a later sign-in verifies them", async () => {
    const newcomer = { user: "U_NEW", name: "Nell Arden" };
    slack.withMember(newcomer.user, { real_name: newcomer.name }).answering("users.info", httpStatus(500), httpStatus(500), httpStatus(500));
    const first = await signsIn(newcomer);
    await settleInTimeOrder(t);

    await signsIn(newcomer, first.user);
    await settle(t);

    expect((await albumOf(first.reader)).board?.items.map(({ reason }) => reason), "the newcomer verified at a later sign-in").toEqual([{ kind: "welcome" }]);
  });

  test.each([
    ["welcome-item off", itemsOn],
    ["hidden-items off", [...albumOpen, "welcome-item"]],
  ])("with %s the first sign-in earns nothing", async (_, flags) => {
    await switchWebsite(t, postHog, true, ...flags);

    await signsIn(juno);

    expect(await itemsOf(juno)).toEqual([]);
  });
});

describe("LP11 LP44 LP49: the welcome item turns at least rare, pays no XP and teaches the loop once", () => {
  test("its turn draws the rare-floored hoggie, pays no XP and answers the workspace's kudos emoji for the line that teaches the loop", async () => {
    const { reader } = await signsIn(juno);
    const before = (await albumOf(reader)).level.xp;
    const [item] = (await albumOf(reader)).board!.items;

    const turned = await turn(reader, item!.item);
    await settle(t);

    const drawn = await drawOf({ secret: "", member: await memberOf(juno), crate: welcomeCrateKey, version: catalogue.version, floor: "rare" });
    expect(drawn.rarity, "the welcome hoggie is drawn at least rare").not.toBe("common");
    expect(turned).toMatchObject({ kind: "turned", again: false, face: { kind: "hoggie", drop: { hoggie: drawn.hoggie, rarity: drawn.rarity } }, applied: null, teaches: { kudosEmoji: "taco", kudosEmojiImage: null } });
    expect((await albumOf(reader)).level.xp, "the welcome item pays no XP").toBe(before);
  });

  test("a replayed turn of the welcome item teaches nothing again, and a thanks item's turn teaches nothing", async () => {
    const { reader } = await signsIn(juno);
    const [welcome] = (await albumOf(reader)).board!.items;
    await turn(reader, welcome!.item);

    const again = await turn(reader, welcome!.item);
    await thanks(juno, "Thanks for untangling the flaky migration", bob);
    const [thanked] = (await albumOf(reader)).board!.items;
    const thanksTurn = await turn(reader, thanked!.item);

    expect(again).toMatchObject({ kind: "turned", again: true });
    expect(again).not.toHaveProperty("teaches");
    expect(thanksTurn).toMatchObject({ kind: "turned", again: false });
    expect(thanksTurn).not.toHaveProperty("teaches");
  });

  test("with welcome-item off once earned, the welcome item still turns and teaches nothing", async () => {
    const { reader } = await signsIn(juno);
    const [item] = (await albumOf(reader)).board!.items;
    await switchWebsite(t, postHog, true, ...itemsOn);

    const turned = await turn(reader, item!.item);

    expect(turned).toMatchObject({ kind: "turned", again: false, applied: null });
    expect(turned).not.toHaveProperty("teaches");
  });
});

async function joins(person: Person) {
  await memberChanged(t, "team_join", { id: person.user, team_id: allowedWorkspace, real_name: person.name });
  await settle(t);
}

async function signsIn(person: Person, existingUserId: Id<"users"> | null = null) {
  const profile = { id: `${allowedWorkspace}/${person.user}`, chatWorkspace: allowedWorkspace, chatUser: person.user, name: person.name };
  const user = await t.run((ctx) => rememberSignedInMember(ctx, { existingUserId, profile }));
  const session = await t.run((ctx) => ctx.db.insert("authSessions", { userId: user, expirationTime: Date.now() + 3_600_000 }));
  return { user, reader: t.withIdentity({ subject: `${user}|${session}` }) };
}

let messages = 0;

async function thanks(giver: Person, words: string, recipient: Person) {
  messages += 1;
  vi.setSystemTime(Date.now() + 60_000);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), mention(recipient.user), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
}

function turn(reader: Reader, item: Id<"items">): Promise<TurnAnswer | Denial> {
  return reader.mutation(api.website.album.turnItem, { item });
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

async function memberOf(person: Person) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", allowedWorkspace).eq("user", person.user))
      .unique(),
  );
  return row!._id;
}

async function itemsOf(person: Person) {
  const member = await memberOf(person);
  const rows = await t.run((ctx) =>
    ctx.db
      .query("items")
      .withIndex("by_member_turned", (q) => q.eq("member", member))
      .collect(),
  );
  return rows.map(({ source, key, floor, reason }) => ({ source, key, floor, reason }));
}
