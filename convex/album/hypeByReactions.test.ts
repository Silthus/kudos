import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { HypeReactedEvent } from "../bus/events";
import { progressionHomeOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";
import { hypeEmojiFor } from "./hypes";
import { inTheAlbumOf } from "./stickers";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const websiteOn = ["album", "collection", "packs", "hugs"];
const hypeByReactionsOn = [...websiteOn, "hype-by-reactions"];

type Person = { user: string; name: string; hype: string };

const alice = person("Alice", "Marchetti");
const bruno = person("Bruno", "Castellane");
const carol = person("Carol", "Okafor");
const everyone = [alice, bruno, carol];

let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack();
  for (const { user, name } of everyone) slack.withMember(user, { profile: { display_name: name, real_name: name } });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...hypeByReactionsOn);
  for (const someone of everyone) await memberChanged(t, "team_join", slackUser(someone));
  await settle(t);
  for (const someone of everyone) await nameHypeEmoji(someone);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a teammate's hype emoji is collected by reactions on 10 of their messages", { timeout: 60_000 }, () => {
  test("the 10th of Carol's messages Bruno reacts on with her hype emoji puts her card in his album and gives him the emoji, which then gives hugs", async () => {
    await reactOnMessagesOf(carol, { by: bruno, messages: 9 });

    expect(await holdsHypeOf(bruno, carol), "the hype emoji held after 9 messages").toBe(false);
    expect(await inAlbum(bruno, carol), "Carol's card in Bruno's album after 9 messages").toBe(false);

    await reactOnMessagesOf(carol, { by: bruno, messages: 1 });

    expect(await holdsHypeOf(bruno, carol), "the hype emoji held after 10 messages").toBe(true);
    expect(await inAlbum(bruno, carol), "Carol's card in Bruno's album after 10 messages").toBe(true);
    expect(await hugsGivenBy(bruno), "hugs before the emoji was held").toBe(0);

    await reactOnMessagesOf(carol, { by: bruno, messages: 1 });

    expect(await hugsGivenBy(bruno), "hugs once the emoji is held").toBe(1);
  });

  test("collecting gives no pack and no XP", async () => {
    await reactOnMessagesOf(carol, { by: bruno, messages: 10 });

    expect(await holdsHypeOf(bruno, carol)).toBe(true);
    expect(await packsOf(bruno), "packs Bruno earned").toEqual([]);
    expect((await xpOf(bruno)).xp, "Bruno's XP").toBe(0);
  });

  test("only reactions on the owner's own messages count, and a reaction taken back keeps its count", async () => {
    await reactOnMessagesOf(alice, { by: bruno, messages: 5, emoji: carol.hype });
    const first = await reactOnMessagesOf(carol, { by: bruno, messages: 1 });
    await react(t, { user: bruno.user, reaction: carol.hype, itemUser: carol.user, ts: first, type: "reaction_removed" });
    await settle(t);
    await reactOnMessagesOf(carol, { by: bruno, messages: 8 });

    expect(await holdsHypeOf(bruno, carol), "after 9 of Carol's own messages and 5 of Alice's").toBe(false);

    await reactOnMessagesOf(carol, { by: bruno, messages: 1 });

    expect(await holdsHypeOf(bruno, carol), "after 10 of Carol's own messages, one reaction taken back").toBe(true);
  });

  test("a member's own hype emoji on their own messages collects nothing", async () => {
    await reactOnMessagesOf(carol, { by: carol, messages: 10 });

    expect(await collectionsOf(carol), "what Carol collected").toEqual([]);
    expect(await inAlbum(carol, carol)).toBe(false);
  });

  test("a hype reaction delivered twice collects once", async () => {
    await reactOnMessagesOf(carol, { by: bruno, messages: 9 });
    const tenth = await hypeReactedOn(carol, { by: bruno });

    await t.mutation(internal.album.hypeReactions.keepHypeReaction, { event: tenth });
    await t.mutation(internal.album.hypeReactions.keepHypeReaction, { event: tenth });

    expect(await collectionsOf(bruno), "what Bruno collected").toEqual([await memberOf(carol)]);
  });

  test("a card already in the album stays as it was", async () => {
    await t.run(async (ctx) => ctx.db.insert("albumStickers", { member: await memberIn(ctx, bruno), person: await memberIn(ctx, carol), from: "history", at: tuesday.getTime() }));

    await reactOnMessagesOf(carol, { by: bruno, messages: 10 });

    expect(await holdsHypeOf(bruno, carol)).toBe(true);
    expect(await stickerSourcesOf(bruno), "the sources of Bruno's cards").toEqual(["history"]);
  });

  test("the person page counts the reactions toward collecting, then names the reactions as the way it was unlocked", async () => {
    await reactOnMessagesOf(carol, { by: bruno, messages: 3 });

    expect((await personPageOf(bruno, carol)).hype).toMatchObject({ earned: false, reactions: { have: 3, need: 10 } });

    await reactOnMessagesOf(carol, { by: bruno, messages: 7 });

    expect((await personPageOf(bruno, carol)).hype).toMatchObject({ earned: true, reactions: { have: 10, need: 10 }, byReactions: true });
  });

  test("reactions kept while it was off count once it is on, at the next reaction", async () => {
    await switchWebsite(t, postHog, true, ...websiteOn);
    await reactOnMessagesOf(carol, { by: bruno, messages: 10 });
    await switchWebsite(t, postHog, true, ...hypeByReactionsOn);

    expect(await holdsHypeOf(bruno, carol), "before the next reaction").toBe(false);

    await reactOnMessagesOf(carol, { by: bruno, messages: 1 });

    expect(await holdsHypeOf(bruno, carol), "after the next reaction").toBe(true);
  });

  test("a kudos after collecting by reactions keeps the reactions as the way it was unlocked", async () => {
    await reactOnMessagesOf(carol, { by: bruno, messages: 10 });
    vi.setSystemTime(Date.now() + minuteMs);

    await thanks(bruno, carol);

    expect((await packsOf(bruno)).length, "the kudos's pack").toBe(1);
    expect((await personPageOf(bruno, carol)).hype).toMatchObject({ earned: true, byReactions: true });
  });

  test("the person page of the member themself shows no reactions", async () => {
    expect((await personPageOf(carol, carol)).hype).not.toHaveProperty("reactions");
  });
});

describe("collecting by reactions is dark where hype-by-reactions is off", { timeout: 60_000 }, () => {
  test("with the flag off, 10 reactions collect nothing and the person page reads as before", async () => {
    await switchWebsite(t, postHog, true, ...websiteOn);

    await reactOnMessagesOf(carol, { by: bruno, messages: 10 });

    expect(await holdsHypeOf(bruno, carol)).toBe(false);
    expect(await inAlbum(bruno, carol)).toBe(false);
    expect((await personPageOf(bruno, carol)).hype).toEqual({ earned: false, name: carol.hype, picture: expect.any(String), inSlack: false });
  });
});

async function reactOnMessagesOf(author: Person, { by, messages: count, emoji = author.hype }: { by: Person; messages: number; emoji?: string }): Promise<string> {
  let ts = "";
  for (let reacted = 0; reacted < count; reacted += 1) {
    ts = nextMessage();
    const response = await react(t, { user: by.user, reaction: emoji, itemUser: author.user, ts });
    expect(response.status, "Slack's acknowledgement").toBe(200);
    await settle(t);
  }
  return ts;
}

async function thanks(giver: Person, recipient: Person) {
  messages += 1;
  await post(t, [section(text("Thanks for the review "), mention(recipient.user), text(" "), emoji("taco"))], { user: giver.user, ts: `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}` });
  await settle(t);
}

async function hypeReactedOn(author: Person, { by }: { by: Person }): Promise<HypeReactedEvent> {
  const owner = await memberOf(author);
  return { type: "hypeReacted", workspace: "T1", giver: await memberOf(by), owner, author: owner, emoji: author.hype, message: { workspace: "T1", conversation: "C1", message: nextMessage() }, at: Date.now() };
}

function nextMessage(): string {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  return `${Math.floor(Date.now() / 1000) - 60}.${String(messages).padStart(6, "0")}`;
}

async function holdsHypeOf(giver: Person, owner: Person): Promise<boolean> {
  const member = await memberOf(giver);
  return (await t.run((ctx) => hypeEmojiFor(ctx, "T1", member, owner.hype)))?.held ?? false;
}

async function inAlbum(member: Person, someone: Person): Promise<boolean> {
  const [holder, person] = [await memberOf(member), await memberOf(someone)];
  return t.run((ctx) => inTheAlbumOf(ctx, holder, person));
}

async function hugsGivenBy(giver: Person): Promise<number> {
  const member = await memberOf(giver);
  return (await t.run((ctx) => ctx.db.query("hugs").collect())).filter((hug) => hug.giver === member).length;
}

async function packsOf(giver: Person) {
  const member = await memberOf(giver);
  return (await t.run((ctx) => ctx.db.query("thoughtfulPacks").collect())).filter((pack) => pack.giver === member);
}

async function xpOf(someone: Person) {
  const member = await memberOf(someone);
  return t.run((ctx) => progressionHomeOf(ctx, member));
}

async function collectionsOf(someone: Person): Promise<MemberId[]> {
  const member = await memberOf(someone);
  return (await t.run((ctx) => ctx.db.query("hypesCollected").collect())).filter((collected) => collected.member === member).map(({ person }) => person);
}

async function stickerSourcesOf(someone: Person) {
  const member = await memberOf(someone);
  return (await t.run((ctx) => ctx.db.query("albumStickers").collect())).filter((sticker) => sticker.member === member).map(({ from }) => from);
}

async function personPageOf(reader: Person, someone: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: reader.user, name: reader.name });
  const page = await asSignedIn.query(api.website.album.getAlbumPerson, { person: await memberOf(someone) });
  if (page.kind !== "person") throw new Error(`expected a person page, got ${JSON.stringify(page)}`);
  return page;
}

async function nameHypeEmoji(someone: Person) {
  await t.run(async (ctx) => ctx.db.insert("emojiNames", { workspace: "T1", emoji: "hype", person: await memberIn(ctx, someone), name: someone.hype }));
}

async function memberOf(someone: Person): Promise<MemberId> {
  return t.run((ctx) => memberIn(ctx, someone));
}

async function memberIn(ctx: Parameters<Parameters<Backend["run"]>[0]>[0], { user }: Person): Promise<MemberId> {
  const row = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return row!._id;
}

function person(first: string, last: string): Person {
  return { user: `U_${first.toUpperCase()}`, name: `${first} ${last}`, hype: `${first.toLowerCase()}-hype` };
}

function slackUser({ user, name }: Person) {
  return { id: user, team_id: "T1", name, real_name: name, profile: { real_name: name, display_name: name } };
}
