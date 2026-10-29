import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, flagsOnForEveryone, onForEveryone } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, publishedHome, publishedHomeBlocks, staleButtonOf } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { catalogue, hoggieNamed, type Rarity } from "../hoggies/catalogue";
import { drawOf } from "../hoggies/draw";
import type { Feature } from "../unlocks/feature";

const planned = vi.hoisted(() => new Map<string, string>());

vi.mock("../hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/draw")>();
  const { hoggieNamed } = await import("../hoggies/catalogue");
  return {
    ...actual,
    drawOf: vi.fn(async (input: Parameters<typeof actual.drawOf>[0]) => {
      const hoggie = planned.get(input.crate);
      return hoggie === undefined ? actual.drawOf(input) : { hoggie, rarity: hoggieNamed(hoggie)!.rarity };
    }),
  };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const siteUrl = "https://kudos-site.test";
const form = { contentType: "application/x-www-form-urlencoded" };
const bookFlags = ["xp-levels", "unlocks", "everyone-board", "achievements"];
const rarityShown: Record<Rarity, string> = { common: "⬜ Common", uncommon: "🟩 Uncommon", rare: "🟦 Rare", epic: "🟪 Epic", legendary: "🟧 Legendary" };
const noDropYet = "section: Hoggies: 0 of 151 · every crate you open drops one.";
const hints = [
  "context: To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
  "context: To add me to a channel, type `/hedgehug` there.",
];

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  planned.clear();
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = flagsOnForEveryone(slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CL16: App Home names the hoggies found while collection is on and the Book is open", { timeout: 30_000 }, () => {
  test("opening the Book from App Home republishes the profile with the hoggie it dropped, after the crates", async () => {
    const t = await workspace(...bookFlags, "collection");
    await levelFour(t);

    await openFromAppHome(t, "book");

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: [Profile] | Book | Settings",
      "header: Your kudos",
      "section: You have *9* kudos left today. You get *10* more at midnight.",
      "divider",
      "section fields: *Level*\n*4* | *XP to level 5*\n*300*",
      "section: *Leaderboard* is ready. It opens the boards. [button: Open]",
      "divider",
      await lastFoundLine(t, 1, "unlock:book"),
      "divider",
      "section fields: *Given this week*\n*1* | *Received this week*\n*0* | *Given in total*\n*1* | *Received in total*\n*0*",
      "divider",
      ...hints,
    ]);
  });

  test("a crate opened in Slack sends no message: the open's republish counts the distinct hoggies held and names the newest one found", async () => {
    const t = await workspace(...bookFlags, "collection");
    await levelFour(t);
    await openFromAppHome(t, "book");
    vi.setSystemTime(Date.now() + minuteMs);
    const messagesBefore = slack.callsTo("chat.postMessage").length;

    await openFromAppHome(t, "leaderboard");

    const held = new Set([await hoggieDrawn(t, "unlock:book"), await hoggieDrawn(t, "unlock:leaderboard")]).size;
    expect(hoggiesLineIn(publishedHome(slack, "U_ALICE"))).toEqual([await lastFoundLine(t, held, "unlock:leaderboard")]);
    expect(slack.callsTo("chat.postMessage")).toHaveLength(messagesBefore);
  });

  test("a member who opened the Book before collection was on sees that every crate they open drops one", async () => {
    const t = await workspace(...bookFlags);
    await levelFour(t);
    await openFromAppHome(t, "book");
    await flagsOn(t, ...bookFlags, "collection");

    await openHome(t, "U_ALICE");

    expect(hoggiesLineIn(publishedHome(slack, "U_ALICE"))).toEqual([noDropYet]);
  });

  test("the front door's summary carries the line after the waiting crates, linking to the Book's Collection page on the website", async () => {
    const t = await workspace(...bookFlags, "collection", "website");
    await levelFour(t);

    await openFromAppHome(t, "book");

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: [Profile] | Settings",
      "header: Your kudos",
      "section: You have *9* kudos left today. You get *10* more at midnight.",
      "section: Level 4 · 300 XP to level 5",
      "divider",
      `section: *Leaderboard* is ready. [link: Open ${siteUrl}/leaderboard?src=app-home]`,
      "divider",
      `${await lastFoundLine(t, 1, "unlock:book")} [link: View ${siteUrl}/book?src=app-home#hoggies]`,
      "divider",
      `actions: Open HedgeHug | Book`,
      "divider",
      ...hints,
    ]);
    expect(hoggiesAccessory()).toMatchObject({ url: `${siteUrl}/book?src=app-home#hoggies`, action_id: "website-link:hoggies", accessibility_label: "View your hoggies on HedgeHug's Collection page" });
  });

  test("the front door's summary with no drop yet links to the Collection page too", async () => {
    const t = await workspace(...bookFlags, "website");
    await levelFour(t);
    await openFromAppHome(t, "book");
    await flagsOn(t, ...bookFlags, "website", "collection");

    await openHome(t, "U_ALICE");

    expect(hoggiesLineIn(publishedHome(slack, "U_ALICE"))).toEqual([`${noDropYet} [link: View ${siteUrl}/book?src=app-home#hoggies]`]);
  });

  test("CL13: there's no line while the Book is closed, even with hoggies found", async () => {
    const t = await workspace(...bookFlags, "collection");
    await levelFour(t);

    await openFromAppHome(t, "leaderboard");

    expect(hoggiesLineIn(publishedHome(slack, "U_ALICE"))).toEqual([]);
  });

  test("CL18: with collection off there's no line, and the profile is the one it was before the collection", async () => {
    const t = await workspace(...bookFlags, "collection");
    await levelFour(t);
    await openFromAppHome(t, "book");
    await flagsOn(t, ...bookFlags);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: [Profile] | Book | Settings",
      "header: Your kudos",
      "section: You have *9* kudos left today. You get *10* more at midnight.",
      "divider",
      "section fields: *Level*\n*4* | *XP to level 5*\n*300*",
      "section: *Leaderboard* is ready. It opens the boards. [button: Open]",
      "divider",
      "section fields: *Given this week*\n*1* | *Received this week*\n*0* | *Given in total*\n*1* | *Received in total*\n*0*",
      "divider",
      ...hints,
    ]);
  });
});

describe("CL25: App Home's hoggies line counts the crests collected while crests is on", { timeout: 30_000 }, () => {
  test("the profile's line counts no crest until a roster's last hoggie drops, then one", async () => {
    const t = await workspace(...bookFlags, "collection", "crests");
    planned.set("unlock:book", "roller-coaster").set("unlock:leaderboard", "dynamite");
    await levelFour(t);

    await openFromAppHome(t, "book");
    const beforeTheTeam = hoggiesLineIn(publishedHome(slack, "U_ALICE"));
    await openFromAppHome(t, "leaderboard");

    expect([...beforeTheTeam, ...hoggiesLineIn(publishedHome(slack, "U_ALICE"))]).toEqual([
      "section: Hoggies: 1 of 151 · 0 crests · last found: Roller Coaster (🟦 Rare)",
      "section: Hoggies: 2 of 151 · 1 crest · last found: Dynamite (🟩 Uncommon)",
    ]);
  });

  test("the front door's summary carries the count too, linking to the Collection page on the website", async () => {
    const t = await workspace(...bookFlags, "collection", "crests", "website");
    planned.set("unlock:book", "roller-coaster");
    await levelFour(t);

    await openFromAppHome(t, "book");

    expect(hoggiesLineIn(publishedHome(slack, "U_ALICE"))).toEqual([`section: Hoggies: 1 of 151 · 0 crests · last found: Roller Coaster (🟦 Rare) [link: View ${siteUrl}/book?src=app-home#hoggies]`]);
  });

  test("a member with no drop yet sees no crest beside every crate dropping one", async () => {
    const t = await workspace(...bookFlags);
    await levelFour(t);
    await openFromAppHome(t, "book");
    await flagsOn(t, ...bookFlags, "collection", "crests");

    await openHome(t, "U_ALICE");

    expect(hoggiesLineIn(publishedHome(slack, "U_ALICE"))).toEqual(["section: Hoggies: 0 of 151 · 0 crests · every crate you open drops one."]);
  });

  test("CL26: with crests off the line is the one before crests, the collected crest included", async () => {
    const t = await workspace(...bookFlags, "collection", "crests");
    planned.set("unlock:book", "roller-coaster").set("unlock:leaderboard", "dynamite");
    await levelFour(t);
    await openFromAppHome(t, "book");
    await openFromAppHome(t, "leaderboard");
    await flagsOn(t, ...bookFlags, "collection");

    await openHome(t, "U_ALICE");

    expect(hoggiesLineIn(publishedHome(slack, "U_ALICE"))).toEqual(["section: Hoggies: 2 of 151 · last found: Dynamite (🟩 Uncommon)"]);
  });
});

async function workspace(...flags: string[]) {
  const t = await flagsOn(testBackend(), ...flags);
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return bookShippedBeforeAnyoneJoined(t);
}

function flagsOn(t: Backend, ...flags: string[]) {
  return flagsFromPostHog(t, postHog, ...flags.map(onForEveryone));
}

async function levelFour(t: Backend) {
  await giveKudos(t, "U_ALICE", "U_BOB");
  await xpOf(t, "U_ALICE", 300);
  for (const level of [2, 3, 4]) await t.mutation(internal.unlocks.unlocks.makeReady, { event: await levelReached(t, "U_ALICE", level) });
  await openHome(t, "U_ALICE");
}

async function openFromAppHome(t: Backend, feature: Feature) {
  await send(t, blockActions("U_ALICE", staleButtonOf({ type: "openUnlock", feature })));
}

async function hoggieDrawn(t: Backend, crate: string) {
  const member = await memberOf(t, "U_ALICE");
  return (await drawOf({ secret: "", member, crate, version: catalogue.version })).hoggie;
}

async function lastFoundLine(t: Backend, owned: number, crate: string) {
  const { name, rarity } = hoggieNamed(await hoggieDrawn(t, crate))!;
  return `section: Hoggies: ${owned} of 151 · last found: ${name} (${rarityShown[rarity]})`;
}

function hoggiesLineIn(home: string[]) {
  return home.filter((line) => line.startsWith("section: Hoggies:"));
}

async function memberOf(t: Backend, user: string) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique(),
  );
  return row!._id;
}

async function xpOf(t: Backend, user: string, xp: number) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function levelReached(t: Backend, user: string, level: number) {
  const member = await memberOf(t, user);
  const message = { workspace: "T1", conversation: "C1", message: "1760349600.000100" };
  return { type: "levelReached" as const, workspace: "T1", member, level, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200, message, at: Date.now() };
}

async function giveKudos(t: Backend, giver: string, recipient: string) {
  const blocks = [section(mention(recipient), text(" thanks for untangling the release notes today "), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Date.now() / 1000}.000100` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settle(t);
  return response;
}

function hoggiesAccessory() {
  return publishedHomeBlocks(slack, "U_ALICE").find((block) => block.text?.text.startsWith("Hoggies:"))?.accessory;
}
