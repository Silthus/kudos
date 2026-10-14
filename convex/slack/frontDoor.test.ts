import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsOnForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHome, publishedHomeBlocks, readBlocks, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { QuestId } from "../quests/pool";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const saturday = Date.parse("2026-10-17T10:00:00Z");
const siteUrl = "https://kudos-site.test";
const form = { contentType: "application/x-www-form-urlencoded" };
const saysWhy = "thanks for untangling the release notes today";
const sayWhy = "Thank someone and say why.";
const twice = "Thank someone and say why, 2 times.";
const threeTimes = "Thank someone and say why, 3 times.";
const twoDays = "Thank someone and say why on 2 different days.";
const sayingWhyThreeWays: QuestId[] = ["say-why", "say-why-twice", "say-why-three-times"];
const everyFlag = ["xp-levels", "unlocks", "quests", "everyone-board", "skill-tree"];
const sayingWhyCounts = "context: Saying why counts when your message has 5 or more words besides mentions and emoji.";
const hints = [
  "context: To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
  "context: To add me to a channel, type `/hedgehug` there.",
];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = flagsOnForEveryone(slack.fetch);
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("SW19 SW20 SW21 SW22: App Home is the website's front door while the website's link function answers a link", { timeout: 30_000 }, () => {
  test("a member who opened Quests and the Leaderboard sees the summary: allowance, one level line, the waiting crate, the week's quests with Swap, and buttons to Home, Quests and the Leaderboard", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: [Profile] | Settings",
      "header: Your kudos",
      "section: You have *8* kudos left today. You get *10* more at midnight.",
      "section: Level 3 · 120 XP to level 4",
      "divider",
      `section: ✅ ${sayWhy} [button: Open]`,
      "section: ✅ Give a kudos that says why. [button: Open]",
      "section: ✅ Finish a weekly quest. [button: Open]",
      "section: ✅ Thank someone you haven't thanked before. [button: Open]",
      "divider",
      "section: *Quests this week*",
      `section: ✅ ${sayWhy} You earned *20 XP*.`,
      `section: ${twice} *1/2* · *20 XP* [button: Swap]`,
      `section: ${threeTimes} *1/3* · *20 XP* [button: Swap]`,
      sayingWhyCounts,
      "divider",
      "actions: Open HedgeHug | Quests | Leaderboard",
      "divider",
      ...hints,
    ]);
    expect(publishedHomeBlocks(slack, "U_ALICE").filter((block) => readBlocks([block])[0] === "actions: Open HedgeHug | Quests | Leaderboard")).toEqual([
      {
        type: "actions",
        elements: [
          { type: "button", text: { type: "plain_text", text: "Open HedgeHug" }, url: `${siteUrl}/`, action_id: "website-link-0" },
          { type: "button", text: { type: "plain_text", text: "Quests" }, url: `${siteUrl}/quests`, action_id: "website-link-1" },
          { type: "button", text: { type: "plain_text", text: "Leaderboard" }, url: `${siteUrl}/leaderboard`, action_id: "website-link-2" },
        ],
      },
    ]);
  });

  test("a member who hasn't opened the Leaderboard sees it ready with Open, and a button to Home only", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);

    const home = publishedHome(slack, "U_ALICE");

    expect(home).toContain("section: *Leaderboard* is ready. [button: Open]");
    expect(home).not.toContain("actions: [Profile] | Leaderboard | Settings");
    expect(linkButtonsIn(publishedHomeBlocks(slack, "U_ALICE"))).toEqual([{ label: "Open HedgeHug", url: `${siteUrl}/` }]);
  });

  test("before unlocks apply, the Leaderboard counts as open while the Everyone board is shown, and the summary has no level line", async () => {
    const t = await workspace("everyone-board", "website");

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: [Profile] | Settings",
      "header: Your kudos",
      "section: You have *10* kudos left today. You get *10* more at midnight.",
      "divider",
      "actions: Open HedgeHug | Leaderboard",
      "divider",
      ...hints,
    ]);
    expect(linkButtonsIn(publishedHomeBlocks(slack, "U_ALICE")).map(({ url }) => url)).toEqual([`${siteUrl}/`, `${siteUrl}/leaderboard`]);
  });

  test("from level 5 the level line names the skill points to spend", async () => {
    const t = await workspace("xp-levels", "website");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await xpOf(t, "U_ALICE", 600);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain("section: Level 5 · 400 XP to level 6 · 1 skill point to spend");
  });

  test("a remembered Leaderboard tab opens as Profile once the front door shows", async () => {
    const t = await workspace("everyone-board");
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Leaderboard")));
    expect(publishedHome(slack, "U_ALICE")[1]).toBe("header: Leaderboard");
    await flagsFromPostHog(t, postHog, onForEveryone("everyone-board"), onForEveryone("website"));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").slice(0, 2)).toEqual(["actions: [Profile] | Settings", "header: Your kudos"]);
  });

  test("Settings and Admin are today's tabs, each ending with the link to the website", async () => {
    slack.withMember("U_ALICE", { is_admin: true });
    const t = await workspace("xp-levels", "everyone-board", "website");
    await openHome(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Settings")));
    const settings = publishedHome(slack, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Admin")));
    const admin = publishedHome(slack, "U_ALICE");

    const websiteLink = `section: <${siteUrl}/|Open HedgeHug on the web>`;
    expect(settings).toEqual([
      "actions: Profile | [Settings] | Admin",
      "header: Settings",
      "section: *Show me on the leaderboards*",
      "actions: [On] | Off",
      "context: When it's off, nobody sees you on the leaderboards, you included.",
      "divider",
      "section: I celebrate your level ups in public. [button: Mute notices]",
      "section: I send you a DM when you reach a level. [button: Turn off DMs]",
      "divider",
      websiteLink,
    ]);
    expect(admin.slice(0, 2)).toEqual(["actions: Profile | Settings | [Admin]", "header: Admin"]);
    expect(admin.slice(-2)).toEqual(["divider", websiteLink]);
  });

  test("Open on a waiting crate and Swap on a quest work through the same interactivity path", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    expect(linkButtonsIn(publishedHomeBlocks(slack, "U_ALICE")).map(({ label }) => label)).toEqual(["Open HedgeHug"]);

    await openReadyFeatures(t);

    expect(publishedHome(slack, "U_ALICE").filter((line) => line.includes("is ready."))).toEqual([]);
    expect(linkButtonsIn(publishedHomeBlocks(slack, "U_ALICE")).map(({ label }) => label)).toEqual(["Open HedgeHug", "Quests", "Leaderboard"]);
    vi.setSystemTime(saturday);

    await send(t, buttonBeside(twice, "Swap"));

    expect(questsIn(publishedHome(slack, "U_ALICE"))).toEqual([
      "section: *Quests this week*",
      `section: ${sayWhy} *0/1* · *20 XP*`,
      `section: ${twoDays} *0/2* · *20 XP*`,
      `section: ${threeTimes} *0/3* · *20 XP*`,
      sayingWhyCounts,
    ]);

    await send(t, buttonBeside("✅ Give a kudos that says why.", "Open"));

    expect(publishedHome(slack, "U_ALICE").filter((line) => line.includes("Give a kudos that says why."))).toEqual([]);
  });

  const todaysHome = [
    "actions: [Profile] | Leaderboard | Settings",
    "header: Your kudos",
    "section: You have *8* kudos left today. You get *10* more at midnight.",
    "divider",
    "section fields: *Level*\n*3* | *XP to level 4*\n*120*",
    "section: Next: Skill tree at level 5.",
    "divider",
    "section: *Quests this week*",
    `section: ✅ ${sayWhy} You earned *20 XP*. [button: Open]`,
    `section: ${twice} *1/2* · *20 XP* [button: Swap]`,
    `section: ${threeTimes} *1/3* · *20 XP* [button: Swap]`,
    sayingWhyCounts,
    "divider",
    "section: *Journey:* ✅ Give a kudos that says why. You earned *10 XP*. [button: Open]",
    "section: *Journey:* ✅ Finish a weekly quest. You earned *20 XP*. [button: Open]",
    "section: *Journey:* ✅ Thank someone you haven't thanked before. You earned *30 XP*. [button: Open]",
    "divider",
    "section fields: *Given this week*\n*2* | *Received this week*\n*0* | *Given in total*\n*2* | *Received in total*\n*0*",
    "divider",
    ...hints,
  ];

  const closed: Array<{ condition: string; website: string[]; env?: Record<string, string> }> = [
    { condition: "while the website flag is off", website: [] },
    { condition: "while SITE_URL is unset", website: ["website"], env: { SITE_URL: "" } },
    { condition: "while the website is open for another workspace only", website: ["website"], env: { SLACK_WORKSPACE_ID: "T_OTHER" } },
  ];

  test.each(closed)("$condition, a member with every other flag on sees today's App Home", async ({ website, env = {} }) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const t = await workspace(...everyFlag, ...website);
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(publishedHome(slack, "U_ALICE")).toEqual(todaysHome);
  });
});

type LinkButton = { label: string; url: string };

function linkButtonsIn(blocks: Block[]): LinkButton[] {
  return blocks.flatMap((block) =>
    block.type === "actions" ? (block.elements as Array<{ text: { text: string }; url?: string }>).flatMap(({ text, url }) => (url === undefined ? [] : [{ label: text.text, url }])) : [],
  );
}

async function workspace(...flags: string[]) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flags.map(onForEveryone));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return unlocksShippedBeforeAnyoneJoined(t);
}

async function levelThreeWithQuestsDrawn(t: Backend) {
  await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
  await drawFor(t, "U_ALICE", sayingWhyThreeWays);
  await xpOf(t, "U_ALICE", 100);
  await t.mutation(internal.unlocks.unlocks.makeReady, { event: await levelReached(t, "U_ALICE", 3) });
  await openHome(t, "U_ALICE");
}

async function openReadyFeatures(t: Backend) {
  for (const feature of ["Quests", "Leaderboard"]) {
    await send(t, buttonBeside(`*${feature}*`, "Open"));
  }
}

async function drawFor(t: Backend, user: string, quests: QuestId[]) {
  const promised = { reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1" };
  const slots = quests.map((quest, slot) => ({ slot, quest, ...promised, feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("questDraws", { member, week: "2026-10-12", drawnAt: Date.now(), slots }));
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

function buttonBeside(text: string, label: string) {
  const blocks = publishedHomeBlocks(slack, "U_ALICE").filter((block) => readBlocks([block]).some((line) => line.includes(text)));
  return blockActions("U_ALICE", buttonIn(blocks, label));
}

function questsIn(home: string[]) {
  const start = home.findIndex((line) => line.includes("*Quests this week*"));
  return start === -1 ? [] : home.slice(start, home.indexOf("divider", start));
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Date.now() / 1000 + sentMessages}.000100` })));
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
