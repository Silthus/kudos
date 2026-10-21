import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { AlbumAnswer, AlbumRead, TurnAnswer } from "../website/album";
import type { Denial } from "../website/memberQuery";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs"];
const itemsOn = [...albumOpen, "hidden-items"];
const firstThankYou = { milestone: "thoughtful", tier: "bronze" } as const;
const firstFace = { milestone: "people", tier: "bronze" } as const;

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;
type Turned = Extract<TurnAnswer, { kind: "turned" }>;
type Tier = { milestone: string; tier: string };

const alice = person("Alice", "Marchetti");
const bob = person("Bob", "Okonkwo");
const everyone = [alice, bob];

let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack();
  for (const { user, name } of everyone) slack.withMember(user, { profile: { display_name: name, real_name: name } });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => slack.fetch(input, init)));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...itemsOn);
  for (const { user, name } of everyone) await memberChanged(t, "team_join", { id: user, team_id: "T1", name, real_name: name, profile: { real_name: name, display_name: name } });
  await settle(t);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP14 LP19a: each milestone tier unlocks once, in the turn that brings it", { timeout: 60_000 }, () => {
  test("a turn that reaches a tier answers it, reads it earned from the turn with its emoji earned and seen, so no emoji moment shows it, and a replay answers none", async () => {
    await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    vi.setSystemTime(Date.now() + minuteMs);

    const turned = await turnTheItem(asAlice, "sticker");
    const again = await turn(asAlice, await itemOf(alice, "sticker"));

    expect(turned.unlocked.milestones).toContainEqual(firstFace);
    expect(again).toMatchObject({ kind: "turned", again: true, unlocked: { milestones: [] } });
    const album = await albumOf(asAlice);
    expect(tierOf(album, firstFace)).toMatchObject({ earnedAt: Date.now(), unlockedAt: Date.now() });
    expect(emojiOf(album, firstFace)).toMatchObject({ earned: true, seen: true });
  });

  test("a thoughtful tier reached in Slack reads unearned, its emoji too, until the giver's next turn, which answers it once and reads it unlocked at the turn", async () => {
    const thanked = await thanks(alice, bob);
    const asAlice = await signedIn(alice);
    const before = await albumOf(asAlice);
    vi.setSystemTime(Date.now() + minuteMs);

    const first = await turnTheItem(asAlice, "hoggie");
    const unlockedAt = Date.now();
    vi.setSystemTime(Date.now() + minuteMs);
    const second = await turnTheItem(asAlice, "sticker");

    expect(tierOf(before, firstThankYou)).toMatchObject({ earnedAt: null });
    expect(emojiOf(before, firstThankYou)).toMatchObject({ earned: false, seen: false });
    expect(first.unlocked.milestones).toEqual([firstThankYou]);
    expect(second.unlocked.milestones).not.toContainEqual(firstThankYou);
    const after = await albumOf(asAlice);
    expect(tierOf(after, firstThankYou)).toMatchObject({ earnedAt: thanked, unlockedAt });
    expect(emojiOf(after, firstThankYou)).toMatchObject({ earned: true, seen: true });
  });

  test("with hidden-items off a thoughtful tier reads earned at the thanks with its emoji unseen, as today", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen);
    const thanked = await thanks(alice, bob);

    const album = await albumOf(await signedIn(alice));

    expect(tierOf(album, firstThankYou)).toEqual(expect.objectContaining({ earnedAt: thanked }));
    expect(tierOf(album, firstThankYou)).not.toHaveProperty("unlockedAt");
    expect(emojiOf(album, firstThankYou)).toMatchObject({ earned: true, seen: false });
  });
});

function person(first: string, last: string): Person {
  return { user: `U_${first}_${last}`.toUpperCase(), name: `${first} ${last}` };
}

async function thanks(giver: Person, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const at = Date.now();
  const ts = `${at / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${why} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return at;
}

function turn(reader: Reader, item: Id<"items">): Promise<TurnAnswer | Denial> {
  return reader.mutation(api.website.album.turnItem, { item });
}

async function turnTheItem(reader: Reader, source: Doc<"items">["source"]): Promise<Turned> {
  const turned = await turn(reader, await itemOf(alice, source));
  if (turned.kind !== "turned") throw new Error(`expected the ${source} turned, got ${JSON.stringify(turned)}`);
  return turned;
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

function tierOf(album: AlbumAnswer, { milestone, tier }: Tier) {
  return album.milestones.find(({ id }) => id === milestone)?.tiers.find((listed) => listed.tier === tier);
}

function emojiOf(album: AlbumAnswer, { milestone, tier }: Tier) {
  return album.emojis.find(({ id }) => id === `milestone:${milestone}:${tier}`);
}

async function signedIn(someone: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: someone.user, name: someone.name });
  return asSignedIn;
}

async function memberOf(someone: Person): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", someone.user))
      .unique(),
  );
  return row!._id;
}

async function itemOf(giver: Person, source: Doc<"items">["source"]): Promise<Id<"items">> {
  const member = await memberOf(giver);
  const items = await t.run((ctx) =>
    ctx.db
      .query("items")
      .withIndex("by_member_turned", (q) => q.eq("member", member))
      .collect(),
  );
  const item = items.find((row) => row.source === source);
  if (item === undefined) throw new Error(`no ${source} item for ${giver.name}`);
  return item._id;
}
