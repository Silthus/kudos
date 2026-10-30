import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { memberChanged, react, settle, setWorkspaceSettings, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { HypeReactedEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";
import { nudgesFor } from "./hypeReactions";

const now = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const everyNudge = 10;

let slack: FakeSlack;
let t: Backend;

beforeEach(async () => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL").withMember("U_DANA");
  flagsOnForEveryone(slack.fetch, "hugs");
  t = testBackend();
  await setWorkspaceSettings(t, { kudosEmoji: "taco" });
  await flagsLoaded(t);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HH22 HH58: Album keeps the hype reactions and answers the nudges from them", () => {
  test("Bob's hype reactions on their owners' own messages name each owner with their emoji, most reactions first", async () => {
    const carol = await hypeEmojiOf("U_CAROL", "carol-hype");
    const dana = await hypeEmojiOf("U_DANA", "dana-hype");

    await hypeReaction({ user: "U_BOB", reaction: "dana-hype", itemUser: "U_DANA" });
    await hypeReaction({ user: "U_BOB", reaction: "carol-hype", itemUser: "U_CAROL" });
    await hypeReaction({ user: "U_BOB", reaction: "carol-hype::skin-tone-2", itemUser: "U_CAROL" });

    expect(await nudgesOf("U_BOB")).toEqual([
      { person: carol, emoji: "carol-hype", reactions: 2 },
      { person: dana, emoji: "dana-hype", reactions: 1 },
    ]);
  });

  test("between owners with as many reactions, the newest reacted comes first", async () => {
    const carol = await hypeEmojiOf("U_CAROL", "carol-hype");
    const dana = await hypeEmojiOf("U_DANA", "dana-hype");

    await hypeReaction({ user: "U_BOB", reaction: "carol-hype", itemUser: "U_CAROL" });
    await hypeReaction({ user: "U_BOB", reaction: "dana-hype", itemUser: "U_DANA" });

    expect(await nudgesOf("U_BOB")).toEqual([
      { person: dana, emoji: "dana-hype", reactions: 1 },
      { person: carol, emoji: "carol-hype", reactions: 1 },
    ]);
  });

  test("a hype reaction delivered twice, or removed and added again, is kept once", async () => {
    const carol = await hypeEmojiOf("U_CAROL", "carol-hype");
    const reacted = await hypeReaction({ user: "U_BOB", reaction: "carol-hype", itemUser: "U_CAROL" });

    await t.mutation(internal.album.hypeReactions.keepHypeReaction, { event: reacted });
    await settle(t);
    await react(t, { user: "U_BOB", reaction: "carol-hype", itemUser: "U_CAROL", ts: reacted.message.message, type: "reaction_removed" });
    await react(t, { user: "U_BOB", reaction: "carol-hype", itemUser: "U_CAROL", ts: reacted.message.message });
    await settle(t);

    expect(await nudgesOf("U_BOB")).toEqual([{ person: carol, emoji: "carol-hype", reactions: 1 }]);
  });

  test("a hype reaction on someone else's message is kept but names nobody", async () => {
    await hypeEmojiOf("U_CAROL", "carol-hype");

    await hypeReaction({ user: "U_BOB", reaction: "carol-hype", itemUser: "U_ALICE" });

    expect(await nudgesOf("U_BOB")).toEqual([]);
  });

  test("the nudges are the reacting member's own", async () => {
    const carol = await hypeEmojiOf("U_CAROL", "carol-hype");

    await hypeReaction({ user: "U_BOB", reaction: "carol-hype", itemUser: "U_CAROL" });

    expect(await nudgesOf("U_CAROL")).toEqual([]);
    expect(await nudgesOf("U_BOB")).toEqual([{ person: carol, emoji: "carol-hype", reactions: 1 }]);
  });

  test("an owner whose emoji the member came to hold is left out", async () => {
    const carol = await hypeEmojiOf("U_CAROL", "carol-hype");
    await hypeReaction({ user: "U_BOB", reaction: "carol-hype", itemUser: "U_CAROL" });

    await holdHypeEmoji("U_BOB", carol);

    expect(await nudgesOf("U_BOB")).toEqual([]);
  });

  test("an owner who left is left out", async () => {
    await hypeEmojiOf("U_CAROL", "carol-hype");
    await hypeReaction({ user: "U_BOB", reaction: "carol-hype", itemUser: "U_CAROL" });

    await memberChanged(t, "user_change", { id: "U_CAROL", deleted: true });
    await settle(t);

    expect(await nudgesOf("U_BOB")).toEqual([]);
  });

  test("an owner whose emoji left the registry is left out, and a renamed one is named as it is now", async () => {
    const carol = await hypeEmojiOf("U_CAROL", "carol-hype");
    const dana = await hypeEmojiOf("U_DANA", "dana-hype");
    await hypeReaction({ user: "U_BOB", reaction: "carol-hype", itemUser: "U_CAROL" });
    await hypeReaction({ user: "U_BOB", reaction: "dana-hype", itemUser: "U_DANA" });

    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("emojiNames").collect()) {
        if (row.person === carol) await ctx.db.delete(row._id);
        if (row.person === dana) await ctx.db.patch(row._id, { name: "dana-cheers" });
      }
    });

    expect(await nudgesOf("U_BOB")).toEqual([{ person: dana, emoji: "dana-cheers", reactions: 1 }]);
  });

  test("the answer names at most as many teammates as asked", async () => {
    const carol = await hypeEmojiOf("U_CAROL", "carol-hype");
    await hypeEmojiOf("U_DANA", "dana-hype");
    await hypeReaction({ user: "U_BOB", reaction: "carol-hype", itemUser: "U_CAROL" });
    await hypeReaction({ user: "U_BOB", reaction: "carol-hype", itemUser: "U_CAROL" });
    await hypeReaction({ user: "U_BOB", reaction: "dana-hype", itemUser: "U_DANA" });

    expect(await nudgesOf("U_BOB", 1)).toEqual([{ person: carol, emoji: "carol-hype", reactions: 2 }]);
  });
});

let messages = 0;

async function hypeReaction(options: { user: string; reaction: string; itemUser: string }): Promise<HypeReactedEvent> {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Math.floor(Date.now() / 1000) - 60}.${String(messages).padStart(6, "0")}`;
  const response = await react(t, { ...options, ts });
  expect(response.status, "Slack's acknowledgement").toBe(200);
  await settle(t);
  const giver = await memberOf(options.user);
  const author = await memberOf(options.itemUser);
  const owner = await ownerOf(options.reaction.split("::")[0]!);
  return { type: "hypeReacted", workspace: "T1", giver, owner, author, emoji: options.reaction.split("::")[0]!, message: { workspace: "T1", conversation: "C1", message: ts }, at: Date.now() };
}

async function nudgesOf(user: string, most = everyNudge) {
  const member = await memberOf(user);
  return t.run((ctx) => nudgesFor(ctx, member, most));
}

async function hypeEmojiOf(user: string, name: string): Promise<MemberId> {
  const person = await t.run(async (ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member" }));
  await t.run((ctx) => ctx.db.insert("emojiNames", { workspace: "T1", emoji: "hype", person, name }));
  return person;
}

async function holdHypeEmoji(user: string, owner: MemberId) {
  const holder = await memberOf(user);
  await t.run(async (ctx) => {
    await ctx.db.insert("thoughtfulPacks", { workspace: "T1", giver: holder, recipient: owner, week: "2026-10-12", message: { workspace: "T1", conversation: "C1", message: "1760349600.000100" }, holdsSticker: false, at: now.getTime() });
    await ctx.db.insert("seenEmojis", { member: holder, emoji: `hype:${owner}`, at: now.getTime() });
  });
}

async function ownerOf(name: string): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("emojiNames")
      .withIndex("by_workspace_name", (q) => q.eq("workspace", "T1").eq("name", name))
      .unique(),
  );
  return row!.person!;
}

async function memberOf(user: string): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique(),
  );
  return row!._id;
}
