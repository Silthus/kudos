import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog, FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsOnForEveryone, onForEmails, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHome, publishedHomeBlocks, publishedViews, readBlocks, staleButtonOf, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { isOnTheBoards } from "../leaderboard/visibility";
import { recordReward } from "../progression/progression";
import type { QuestId } from "../quests/pool";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const saturday = Date.parse("2026-10-17T10:00:00Z");
const nextMonday = Date.parse("2026-10-19T10:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const siteUrl = "https://kudos-site.test";
const alicesEmail = "alice@example.com";
const form = { contentType: "application/x-www-form-urlencoded" };
const saysWhy = "thanks for untangling the release notes today";
const sayWhy = "Thank someone and say why.";
const twice = "Thank someone and say why, 2 times.";
const threeTimes = "Thank someone and say why, 3 times.";
const twoDays = "Thank someone and say why on 2 different days.";
const sayingWhyThreeWays: QuestId[] = ["say-why", "say-why-twice", "say-why-three-times"];
const everyFlag = ["xp-levels", "unlocks", "quests", "everyone-board", "skill-tree"];
const openOnTheWeb = (path: string) => `[link: Open ${siteUrl}${path}]`;
const swapOnTheWeb = (slot: number) => `[link: Swap ${siteUrl}/]`;
const onTheWebLine = "You can change this on the web, too.";
const sectionOnTheWeb = (label: string, section: string, entry = "") => `section: ${onTheWebLine} [link: ${label} ${siteUrl}${entry}/settings?section=${section}]`;
const inventoryLine = "Your inventory is on the web, too.";
const inventoryOnTheWeb = `section: ${inventoryLine} [link: Inventory ${siteUrl}/]`;
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
  test("a member who opened Quests and the Leaderboard sees the summary: allowance, one level line, the waiting crate, the week's quests with Swap, and buttons to Home, the Leaderboard and Quests", async () => {
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
      `section: ✅ ${sayWhy} ${openOnTheWeb("/quests?quest=0")}`,
      `section: ✅ Give a kudos that says why. ${openOnTheWeb("/?crate=journey")}`,
      `section: ✅ Thank someone you haven't thanked before. ${openOnTheWeb("/?crate=journey")}`,
      `section: ✅ Finish a weekly quest. ${openOnTheWeb("/?crate=journey")}`,
      "divider",
      "section: *Quests this week*",
      `section: ✅ ${sayWhy} You earned *20 XP*.`,
      `section: ${twice} *1/2* · *20 XP* ${swapOnTheWeb(1)}`,
      `section: ${threeTimes} *1/3* · *20 XP* ${swapOnTheWeb(2)}`,
      sayingWhyCounts,
      "divider",
      "actions: Open HedgeHug | Leaderboard | Quests",
      "divider",
      ...hints,
    ]);
    expect(publishedHomeBlocks(slack, "U_ALICE").filter((block) => readBlocks([block])[0] === "actions: Open HedgeHug | Leaderboard | Quests")).toEqual([
      {
        type: "actions",
        elements: [
          { type: "button", text: { type: "plain_text", text: "Open HedgeHug" }, url: `${siteUrl}/`, action_id: "website-link-0" },
          { type: "button", text: { type: "plain_text", text: "Leaderboard" }, url: `${siteUrl}/leaderboard`, action_id: "website-link-1" },
          { type: "button", text: { type: "plain_text", text: "Quests" }, url: `${siteUrl}/`, action_id: "website-link-2" },
        ],
      },
    ]);
  });

  test("a member who hasn't opened the Leaderboard sees it ready with Open, and a button to Home only", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);

    const home = publishedHome(slack, "U_ALICE");

    expect(home).toContain(`section: *Leaderboard* is ready. ${openOnTheWeb("/leaderboard?crate=leaderboard")}`);
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

  test("from level 5 the level line names the skill points to spend while the skill tree ships", async () => {
    const t = await workspace("xp-levels", "website", "skill-tree");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await xpOf(t, "U_ALICE", 600);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain("section: Level 5 · 400 XP to level 6 · 1 skill point to spend");
  });

  test("AL35: while the skill tree doesn't ship, the level line names no skill points", async () => {
    const t = await workspace("xp-levels", "website");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await xpOf(t, "U_ALICE", 600);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain("section: Level 5 · 400 XP to level 6");
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

  test("a member who opened the Book and the Skill tree has no tab for either, and buttons to both pages instead", async () => {
    const t = await workspace(...everyFlag, "achievements", "website");
    await everyFeatureOpenedAtLevelFive(t);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")[0]).toBe("actions: [Profile] | Settings");
    expect(linkButtonsIn(publishedHomeBlocks(slack, "U_ALICE"))).toEqual([
      { label: "Open HedgeHug", url: `${siteUrl}/` },
      { label: "Book", url: `${siteUrl}/` },
      { label: "Leaderboard", url: `${siteUrl}/leaderboard` },
      { label: "Quests", url: `${siteUrl}/` },
      { label: "Skill tree", url: `${siteUrl}/` },
    ]);
  });

  test.each(["Book", "Skill tree"])("a remembered %s tab opens as Profile once the front door shows, and its tab switch from an earlier view shows Profile", async (tab) => {
    const t = await workspace(...everyFlag, "achievements");
    await everyFeatureOpenedAtLevelFive(t);
    await openHome(t, "U_ALICE");
    const switchToTab = buttonInHome(slack, "U_ALICE", tab);
    await send(t, blockActions("U_ALICE", switchToTab));
    expect(publishedHome(slack, "U_ALICE")[1]).toBe(`header: ${tab}`);
    await flagsFromPostHog(t, postHog, ...[...everyFlag, "achievements", "website"].map(onForEveryone));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});

    await openHome(t, "U_ALICE");
    const remembered = publishedHome(slack, "U_ALICE").slice(0, 2);
    await send(t, blockActions("U_ALICE", switchToTab));

    expect(remembered).toEqual(["actions: [Profile] | Settings", "header: Your kudos"]);
    expect(publishedHome(slack, "U_ALICE").slice(0, 2)).toEqual(["actions: [Profile] | Settings", "header: Your kudos"]);
  });

  test("Settings links each setting that has a section on the website's Settings page to that section, the notice switches having none, and Admin is today's tab, each ending with the link to the website", async () => {
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
      sectionOnTheWeb("Leaderboards", "visibility"),
      "divider",
      "section: I'll celebrate your level ups in public once your workspace picks a channel. [button: Mute notices]",
      "section: I send you a DM when you reach a level. [button: Turn off DMs]",
      "divider",
      websiteLink,
    ]);
    expect(admin.slice(0, 2)).toEqual(["actions: Profile | Settings | [Admin]", "header: Admin"]);
    expect(admin.slice(-2)).toEqual(["divider", websiteLink]);
  });

  test("each section link names what it changes on the Settings page to screen readers, and clicking it runs no command and publishes App Home no more", async () => {
    const t = await workspace("xp-levels", "everyone-board", "website");
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Settings")));
    const published = publishedViews(slack, "U_ALICE").length;

    const response = await send(t, buttonBeside(onTheWebLine, "Leaderboards"));

    expect(accessoryBeside(onTheWebLine)).toEqual({
      type: "button",
      text: { type: "plain_text", text: "Leaderboards" },
      url: `${siteUrl}/settings?section=visibility`,
      action_id: "website-link:settings:visibility",
      accessibility_label: "Change whether you show on the leaderboards on HedgeHug's Settings page",
    });
    expect(response.status).toBe(200);
    expect(publishedViews(slack, "U_ALICE")).toHaveLength(published);
  });

  test("Slack's settings still work beside the link: switching the leaderboards off hides the member and keeps the link", async () => {
    const t = await workspace("xp-levels", "everyone-board", "website");
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Settings")));

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Off")));

    expect(publishedHome(slack, "U_ALICE").slice(1, 6)).toEqual([
      "header: Settings",
      "section: *Show me on the leaderboards*",
      "actions: On | [Off]",
      "context: When it's off, nobody sees you on the leaderboards, you included.",
      sectionOnTheWeb("Leaderboards", "visibility"),
    ]);
    expect(await onTheBoards(t, "U_ALICE")).toBe(false);
  });

  test("what I send you ends with a link to the Settings page's messages section, and the leaderboards with theirs", async () => {
    const t = await workspace("xp-levels", "everyone-board", "message-settings", "website");
    await openHome(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Settings")));

    const home = publishedHome(slack, "U_ALICE");
    expect(areaOf(home, "section: *Show me on the leaderboards*").at(-1)).toBe(sectionOnTheWeb("Leaderboards", "visibility"));
    expect(areaOf(home, "section: *What I send you*").at(-1)).toBe(sectionOnTheWeb("Messages", "messages"));
    expect(accessoryOf(`${siteUrl}/settings?section=messages`)).toMatchObject({ action_id: "website-link:settings:messages", accessibility_label: "Change what I send you on HedgeHug's Settings page" });
  });

  test("while the primary-group picker shows, it ends with a link to the Settings page's group section", async () => {
    slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_ALICE", "U_BOB"] }).withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ALICE"] });
    const t = await workspaceWithUserGroups("xp-levels", "groups", "website");
    await openHome(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Settings")));

    const home = publishedHome(slack, "U_ALICE");
    const picker = home.findIndex((line) => line.startsWith("section: Which group do you count for on the leaderboard?"));
    expect(home.slice(picker + 1, picker + 3)).toEqual([sectionOnTheWeb("Your group", "group"), "divider"]);
    expect(accessoryOf(`${siteUrl}/settings?section=group`)).toMatchObject({ action_id: "website-link:settings:group", accessibility_label: "Change the group you count for on HedgeHug's Settings page" });
  });

  test("a setting whose section the website's Settings page hides gets no link: the group of a member in one group, and the leaderboards before the member opens the Leaderboard", async () => {
    slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_ALICE", "U_BOB"] });
    const t = await workspaceWithUserGroups("xp-levels", "unlocks", "everyone-board", "groups", "website");
    await openHome(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Settings")));

    const home = publishedHome(slack, "U_ALICE");
    expect(home).toContain("section: *Show me on the leaderboards*");
    expect(home).toContain("section: You count for Gardeners on the leaderboard.");
    expect(home.filter((line) => line.includes(onTheWebLine))).toEqual([]);
  });

  test("while the website's Settings page has no setting for the member, the Settings tab has no link to it", async () => {
    const t = await workspace("xp-levels", "website");
    await openHome(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Settings")));

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: Profile | [Settings]",
      "header: Settings",
      "section: I'll celebrate your level ups in public once your workspace picks a channel. [button: Mute notices]",
      "section: I send you a DM when you reach a level. [button: Turn off DMs]",
      "divider",
      `section: <${siteUrl}/|Open HedgeHug on the web>`,
    ]);
  });

  test("for a member previewing the website while it is closed for the workspace, a section link goes through the page's sign-in entry", async () => {
    slack.withMember("U_ALICE", { profile: { email: alicesEmail } });
    const t = await workspace("xp-levels", "everyone-board", onForEmails("website", alicesEmail));
    await openHome(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Settings")));

    expect(publishedHome(slack, "U_ALICE")[5]).toBe(sectionOnTheWeb("Leaderboards", "visibility", "/sign-in"));
  });

  test("the Inventory tab opens with a link to the home's inventory panel above Slack's inventory, which still works, and names it to screen readers", async () => {
    const t = await workspace("xp-levels", "unlocks", "coins", "store", "custom-kudos-emoji", "website");
    await coinsOpenedBy(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Inventory")));

    expect(publishedHome(slack, "U_ALICE").slice(0, 7)).toEqual([
      "actions: Profile | [Inventory] | Settings",
      "header: Inventory",
      inventoryOnTheWeb,
      "divider",
      "section: 4 🪙",
      "divider",
      "section: *Your kudos emoji*",
    ]);
    expect(accessoryBeside(inventoryLine)).toEqual({
      type: "button",
      text: { type: "plain_text", text: "Inventory" },
      url: `${siteUrl}/`,
      action_id: "website-link:inventory",
      accessibility_label: "Open your inventory on HedgeHug's home page",
    });

    const alice = await memberOf(t, "U_ALICE");
    await t.run(async (ctx) => {
      await ctx.db.insert("customKudosEmoji", { workspace: "T1", name: "shipit", url: "https://emoji.slack-edge.com/T1/shipit/0a1b2c.png", pickedAt: Date.now() });
      await recordReward(ctx, "T1", { member: alice, key: "test:savings", xp: 0, coins: 96, item: null, catalogueVersion: "2", at: 0 });
    });
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Inventory")));
    const published = publishedViews(slack, "U_ALICE").length;

    await send(t, buttonBeside(":shipit: · 100 🪙", "Buy"));

    expect(publishedViews(slack, "U_ALICE")).toHaveLength(published + 1);
    expect(publishedHome(slack, "U_ALICE").slice(2, 9)).toEqual([inventoryOnTheWeb, "divider", "section: 0 🪙", "divider", "section: *Your kudos emoji*", "section: 🦔 Hedgehog", "section: :shipit:"]);
  });

  test("clicking the Inventory link changes nothing and publishes App Home no more", async () => {
    const t = await workspace("xp-levels", "unlocks", "coins", "store", "website");
    await coinsOpenedBy(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Inventory")));
    const published = publishedViews(slack, "U_ALICE").length;

    const response = await send(t, buttonBeside(inventoryLine, "Inventory"));

    expect(response.status).toBe(200);
    expect(publishedViews(slack, "U_ALICE")).toHaveLength(published);
    expect(publishedHome(slack, "U_ALICE")).toContain("section: 🦔 Hedgehog");
  });

  test("opening the ready features swaps their Open for page buttons, and a stale Open from before the links still opens its crate", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    expect(linkButtonsIn(publishedHomeBlocks(slack, "U_ALICE")).map(({ label }) => label)).toEqual(["Open HedgeHug"]);

    await openReadyFeatures(t);

    expect(publishedHome(slack, "U_ALICE").filter((line) => line.includes("is ready."))).toEqual([]);
    expect(linkButtonsIn(publishedHomeBlocks(slack, "U_ALICE")).map(({ label }) => label)).toEqual(["Open HedgeHug", "Leaderboard", "Quests"]);

    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "openQuestCrate", quest: { kind: "journey", step: "first-thanks" } })));

    expect(publishedHome(slack, "U_ALICE").filter((line) => line.includes("Give a kudos that says why."))).toEqual([]);
  });

  test("P85: after the Monday turn, last week's unopened crate waits in the summary before the Journey's, and Open opens it", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    vi.setSystemTime(nextMonday);

    await openHome(t, "U_ALICE");

    expect(waitingIn(publishedHome(slack, "U_ALICE"))).toEqual([
      `section: *Week of Oct 12:* ✅ ${sayWhy} ${openOnTheWeb("/quests?crate=weekly%3A2026-10-12%3A0")}`,
      `section: ✅ Give a kudos that says why. ${openOnTheWeb("/?crate=journey")}`,
      `section: ✅ Thank someone you haven't thanked before. ${openOnTheWeb("/?crate=journey")}`,
      `section: ✅ Finish a weekly quest. ${openOnTheWeb("/?crate=journey")}`,
    ]);

    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "openQuestCrate", quest: { kind: "weekly", week: "2026-10-12", slot: 0 } })));

    expect(waitingIn(publishedHome(slack, "U_ALICE"))).toEqual([
      `section: ✅ Give a kudos that says why. ${openOnTheWeb("/?crate=journey")}`,
      `section: ✅ Thank someone you haven't thanked before. ${openOnTheWeb("/?crate=journey")}`,
      `section: ✅ Finish a weekly quest. ${openOnTheWeb("/?crate=journey")}`,
    ]);
  });

  test("P85: with 7 crates waiting from earlier weeks, the summary shows the oldest 5 and how many more", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);
    await waitingFromAnEarlierWeek(t, "U_ALICE", 7);

    await openHome(t, "U_ALICE");

    expect(waitingIn(publishedHome(slack, "U_ALICE"))).toEqual([
      ...[0, 1, 2, 3, 4].map((slot) => `section: *Week of Oct 5:* ✅ ${sayWhy} ${openOnTheWeb(`/quests?crate=weekly%3A2026-10-05%3A${slot}`)}`),
      `section: ✅ Give a kudos that says why. ${openOnTheWeb("/?crate=journey")}`,
      `section: ✅ Thank someone you haven't thanked before. ${openOnTheWeb("/?crate=journey")}`,
      "context: 2 more crates from earlier weeks wait to open.",
    ]);
  });

  test("P85: each crate waiting from an earlier week names its week by the Monday its member's week began, and this week's crates stay as they were", async () => {
    slack.withMember("U_ALICE", { tz: "America/Los_Angeles" });
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);
    await waitingFromAnEarlierWeek(t, "U_ALICE", 1, "2026-09-28");
    await waitingFromAnEarlierWeek(t, "U_ALICE", 1, "2026-10-05");

    await openHome(t, "U_ALICE");

    expect(waitingIn(publishedHome(slack, "U_ALICE"))).toEqual([
      `section: *Week of Sep 28:* ✅ ${sayWhy} ${openOnTheWeb("/quests?crate=weekly%3A2026-09-28%3A0")}`,
      `section: *Week of Oct 5:* ✅ ${sayWhy} ${openOnTheWeb("/quests?crate=weekly%3A2026-10-05%3A0")}`,
      `section: ✅ Give a kudos that says why. ${openOnTheWeb("/?crate=journey")}`,
      `section: ✅ Thank someone you haven't thanked before. ${openOnTheWeb("/?crate=journey")}`,
    ]);
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
    "section: *Journey:* ✅ Thank someone you haven't thanked before. You earned *30 XP*. [button: Open]",
    "section: *Journey:* ✅ Finish a weekly quest. You earned *20 XP*. [button: Open]",
    "divider",
    "section fields: *Given this week*\n*2* | *Received this week*\n*0* | *Given in total*\n*2* | *Received in total*\n*0*",
    "divider",
    ...hints,
  ];

  const todaysSettings = [
    "actions: Profile | Leaderboard | [Settings]",
    "header: Settings",
    "section: *Show me on the leaderboards*",
    "actions: [On] | Off",
    "context: When it's off, nobody sees you on the leaderboards, you included.",
    "divider",
    "section: I'll celebrate your level ups in public once your workspace picks a channel. [button: Mute notices]",
    "section: I send you a DM when you reach a level. [button: Turn off DMs]",
  ];

  const todaysInventory = [
    "actions: Profile | [Inventory] | Settings",
    "header: Inventory",
    "section: 4 🪙",
    "divider",
    "section: *Your kudos emoji*",
    "section: 🦔 Hedgehog",
    "context: Each of your kudos emoji counts as a kudos, like :taco:.",
    "divider",
    "section: *Store*",
    "context: Nothing for sale right now.",
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

  test.each(closed)("$condition, a member with every other flag on sees today's Settings tab", async ({ website, env = {} }) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const t = await workspace(...everyFlag, ...website);
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Settings")));

    expect(publishedHome(slack, "U_ALICE")).toEqual(todaysSettings);
  });

  test.each(closed)("$condition, a member who opened Coins and inventory sees today's Inventory tab", async ({ website, env = {} }) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const t = await workspace("xp-levels", "unlocks", "coins", "store", ...website);
    await coinsOpenedBy(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Inventory")));

    expect(publishedHome(slack, "U_ALICE")).toEqual(todaysInventory);
  });
});

describe("each crate's Open in Slack links to the page where it opens while the website is open", { timeout: 30_000 }, () => {
  test("a ready feature's Open links to its crate on its own listed page and names that page to screen readers", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);

    expect(publishedHome(slack, "U_ALICE").filter((line) => line.includes("is ready."))).toEqual([
      `section: *Leaderboard* is ready. ${openOnTheWeb("/leaderboard?crate=leaderboard")}`,
      `section: *Quests* is ready. ${openOnTheWeb("/quests?crate=quests")}`,
    ]);
    expect(accessoryBeside("*Quests* is ready.")).toEqual({
      type: "button",
      text: { type: "plain_text", text: "Open" },
      url: `${siteUrl}/`,
      action_id: "website-link:quests",
      accessibility_label: "Open on HedgeHug's Quests page",
    });
  });

  test("a ready Skill tree links to its crate on its page on the route list, /skills", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);
    await t.mutation(internal.unlocks.unlocks.makeReady, { event: await levelReached(t, "U_ALICE", 5) });

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain(`section: *Skill tree* is ready. ${openOnTheWeb("/skills?crate=skillTree")}`);
    expect(accessoryBeside("*Skill tree* is ready.")).toMatchObject({ url: `${siteUrl}/`, action_id: "website-link:skillTree", accessibility_label: "Open on HedgeHug's Skill tree page" });
  });

  test("a Journey step's crate links to the Journey's crate on the home, this week's quest crate to its quest's card on the Quests page, and an earlier week's to its own waiting crate there", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);
    await waitingFromAnEarlierWeek(t, "U_ALICE", 1);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(accessoryBeside("*Week of Oct 5:*")).toMatchObject({ url: `${siteUrl}/`, action_id: "website-link:weekly:2026-10-05:0", accessibility_label: "Open on HedgeHug's Quests page" });

    expect(accessoryBeside(`✅ ${sayWhy}`)).toMatchObject({ url: `${siteUrl}/`, action_id: "website-link:weekly:2026-10-12:0", accessibility_label: "Open on HedgeHug's Quests page" });
    expect(accessoryBeside("✅ Give a kudos that says why.")).toMatchObject({ url: `${siteUrl}/`, action_id: "website-link:journey:first-thanks", accessibility_label: "Open on HedgeHug's home page" });
  });

  test("each of this week's quest crates links to its own quest's card on the Quests page, by its slot", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);
    for (const day of [1, 2, 3]) {
      vi.setSystemTime(tuesday + day * dayMs);
      await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    }

    expect([sayWhy, twice, threeTimes].map((goal) => accessoryBeside(`✅ ${goal}`))).toMatchObject(
      [0, 1, 2].map((slot) => ({ url: `${siteUrl}/`, action_id: `website-link:weekly:2026-10-12:${slot}`, accessibility_label: "Open on HedgeHug's Quests page" })),
    );
  });

  test("each earlier week's quest crate links to its own waiting crate on the Quests page, by its week and slot", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);
    await waitingFromAnEarlierWeek(t, "U_ALICE", 2, "2026-09-28");
    await waitingFromAnEarlierWeek(t, "U_ALICE", 2, "2026-10-05");

    await openHome(t, "U_ALICE");

    expect(waitingIn(publishedHome(slack, "U_ALICE")).filter((line) => line.includes("*Week of"))).toEqual([
      `section: *Week of Sep 28:* ✅ ${sayWhy} ${openOnTheWeb("/quests?crate=weekly%3A2026-09-28%3A0")}`,
      `section: *Week of Sep 28:* ✅ ${sayWhy} ${openOnTheWeb("/quests?crate=weekly%3A2026-09-28%3A1")}`,
      `section: *Week of Oct 5:* ✅ ${sayWhy} ${openOnTheWeb("/quests?crate=weekly%3A2026-10-05%3A0")}`,
      `section: *Week of Oct 5:* ✅ ${sayWhy} ${openOnTheWeb("/quests?crate=weekly%3A2026-10-05%3A1")}`,
    ]);
  });

  test("a ready Book links to its crate on /book, and ready Coins, which has no crate on the home, links to the home", async () => {
    const t = await workspace(...everyFlag, "achievements", "coins", "website");
    await everyFeatureOpenedAtLevelFive(t, ["quests", "leaderboard", "skillTree"]);
    await xpOf(t, "U_ALICE", 1000);
    await t.mutation(internal.unlocks.unlocks.makeReady, { event: await levelReached(t, "U_ALICE", 6) });

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").filter((line) => line.includes("is ready."))).toEqual([
      `section: *Book* is ready. ${openOnTheWeb("/book?crate=book")}`,
      `section: *Coins* is ready. ${openOnTheWeb("/")}`,
    ]);
  });

  test("for a member previewing the website while it is closed for the workspace, Open links to the crate through the page's sign-in entry", async () => {
    slack.withMember("U_ALICE", { profile: { email: alicesEmail } });
    const t = await workspace(...everyFlag, onForEmails("website", alicesEmail));
    await levelThreeWithQuestsDrawn(t);

    expect(accessoryBeside("*Quests* is ready.")).toMatchObject({ url: `${siteUrl}/sign-in/`, action_id: "website-link:quests" });
  });

  test("clicking a link button runs no command and publishes App Home no more", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    const published = publishedViews(slack, "U_ALICE").length;

    const response = await send(t, buttonBeside("*Quests* is ready.", "Open"));
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Open HedgeHug")));

    expect(response.status).toBe(200);
    expect(publishedViews(slack, "U_ALICE")).toHaveLength(published);
    expect(publishedHome(slack, "U_ALICE")).toContain(`section: *Quests* is ready. ${openOnTheWeb("/quests?crate=quests")}`);
  });
});

describe("each quest's Swap in Slack links to its card on the Quests page while the website is open", { timeout: 30_000 }, () => {
  test("each quest still to finish has a Swap that links to its own card on /quests and names the page to screen readers", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);

    expect(questsIn(publishedHome(slack, "U_ALICE"))).toEqual([
      "section: *Quests this week*",
      `section: ${sayWhy} *0/1* · *20 XP* ${swapOnTheWeb(0)}`,
      `section: ${twice} *0/2* · *20 XP* ${swapOnTheWeb(1)}`,
      `section: ${threeTimes} *0/3* · *20 XP* ${swapOnTheWeb(2)}`,
      sayingWhyCounts,
    ]);
    expect(accessoryBeside(twice)).toEqual({
      type: "button",
      text: { type: "plain_text", text: "Swap" },
      url: `${siteUrl}/`,
      action_id: "website-link:swap:weekly:2026-10-12:1",
      accessibility_label: "Swap on HedgeHug's Quests page",
    });
  });

  test("clicking a Swap link swaps nothing and publishes App Home no more, while a Swap left from an earlier view still swaps its quest", async () => {
    const t = await workspace(...everyFlag, "website");
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);
    vi.setSystemTime(saturday);
    const published = publishedViews(slack, "U_ALICE").length;

    const response = await send(t, buttonBeside(twice, "Swap"));

    expect(response.status).toBe(200);
    expect(publishedViews(slack, "U_ALICE")).toHaveLength(published);
    expect(await swapsOf(t, "U_ALICE")).toEqual([]);

    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "rerollQuest", quest: { kind: "weekly", week: "2026-10-12", slot: 1 } })));

    expect(questsIn(publishedHome(slack, "U_ALICE"))).toEqual([
      "section: *Quests this week*",
      `section: ${sayWhy} *0/1* · *20 XP*`,
      `section: ${twoDays} *0/2* · *20 XP*`,
      `section: ${threeTimes} *0/3* · *20 XP*`,
      sayingWhyCounts,
    ]);
  });

  test("for a member previewing the website while it is closed for the workspace, Swap links through the page's sign-in entry", async () => {
    slack.withMember("U_ALICE", { profile: { email: alicesEmail } });
    const t = await workspace(...everyFlag, onForEmails("website", alicesEmail));
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);

    expect(accessoryBeside(twice)).toMatchObject({ url: `${siteUrl}/sign-in/`, action_id: "website-link:swap:weekly:2026-10-12:1" });
  });

  test("while the website flag is off, Swap is today's command and swaps its quest", async () => {
    const t = await workspace(...everyFlag);
    await levelThreeWithQuestsDrawn(t);
    await openReadyFeatures(t);
    vi.setSystemTime(saturday);
    expect(questsIn(publishedHome(slack, "U_ALICE"))[2]).toBe(`section: ${twice} *0/2* · *20 XP* [button: Swap]`);

    await send(t, buttonBeside(twice, "Swap"));

    expect(questsIn(publishedHome(slack, "U_ALICE"))[2]).toBe(`section: ${twoDays} *0/2* · *20 XP*`);
  });
});

function accessoryOf(url: string) {
  return publishedHomeBlocks(slack, "U_ALICE").find((block) => (block.accessory as { url?: string } | undefined)?.url === url)?.accessory;
}

function areaOf(home: string[], heading: string) {
  const start = home.indexOf(heading);
  const end = home.indexOf("divider", start);
  return home.slice(start, end === -1 ? undefined : end);
}

function accessoryBeside(text: string) {
  return publishedHomeBlocks(slack, "U_ALICE").find((block) => readBlocks([block])[0]?.startsWith(`section: ${text}`))?.accessory;
}

type LinkButton = { label: string; url: string };

function linkButtonsIn(blocks: Block[]): LinkButton[] {
  return blocks.flatMap((block) =>
    block.type === "actions" ? (block.elements as Array<{ text: { text: string }; url?: string }>).flatMap(({ text, url }) => (url === undefined ? [] : [{ label: text.text, url }])) : [],
  );
}

async function workspace(...flags: Array<string | FlagDefinition>) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flags.map((flag) => (typeof flag === "string" ? onForEveryone(flag) : flag)));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return unlocksShippedBeforeAnyoneJoined(t);
}

async function workspaceWithUserGroups(...flags: string[]) {
  const t = await workspace(...flags);
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  return t;
}

async function coinsOpenedBy(t: Backend, user: string) {
  await giveKudos(t, user, "U_BOB", saysWhy);
  await xpOf(t, user, 990);
  await giveKudos(t, user, "U_BOB", saysWhy);
  await send(t, blockActions(user, staleButtonOf({ type: "openUnlock", feature: "coins" })));
}

async function levelThreeWithQuestsDrawn(t: Backend) {
  await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
  await drawFor(t, "U_ALICE", sayingWhyThreeWays);
  await xpOf(t, "U_ALICE", 100);
  await t.mutation(internal.unlocks.unlocks.makeReady, { event: await levelReached(t, "U_ALICE", 3) });
  await openHome(t, "U_ALICE");
}

async function openReadyFeatures(t: Backend) {
  for (const feature of ["quests", "leaderboard"]) {
    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "openUnlock", feature })));
  }
}

async function everyFeatureOpenedAtLevelFive(t: Backend, features = ["quests", "leaderboard", "book", "skillTree"]) {
  await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
  await xpOf(t, "U_ALICE", 600);
  for (const level of [2, 3, 4, 5]) await t.mutation(internal.unlocks.unlocks.makeReady, { event: await levelReached(t, "U_ALICE", level) });
  for (const feature of features) {
    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "openUnlock", feature })));
  }
}

async function drawFor(t: Backend, user: string, quests: QuestId[]) {
  const promised = { reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1" };
  const slots = quests.map((quest, slot) => ({ slot, quest, ...promised, feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("questDraws", { member, week: "2026-10-12", drawnAt: Date.now(), slots }));
}

async function waitingFromAnEarlierWeek(t: Backend, user: string, crates: number, week = "2026-10-05") {
  const reward = { xp: 20, coins: 0, item: null };
  const slots = Array.from({ length: crates }, (_, slot) => ({ slot, quest: "say-why" as QuestId, reward, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    await ctx.db.insert("questDraws", { member, week, drawnAt: Date.parse(`${week}T00:00:00Z`), slots });
    for (const { slot } of slots) {
      const key = `weekly:${week}:${slot}`;
      await ctx.db.insert("rewardRecords", { member, key, ...reward, catalogueVersion: "1", at: Date.parse(`${week}T10:00:00Z`) + 2 * dayMs + slot });
      await ctx.db.insert("pendingCrates", { member, key });
    }
  });
}

async function swapsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) =>
    ctx.db
      .query("questSwaps")
      .withIndex("by_member_week", (q) => q.eq("member", member))
      .collect(),
  );
}

async function onTheBoards(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => isOnTheBoards(ctx, member));
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

function waitingIn(home: string[]) {
  const start = home.indexOf("divider") + 1;
  return home.slice(start, home.indexOf("divider", start));
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
