import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { type FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { onForEveryone, postHogDeciding, testBackendServing, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, settle, settleInTimeOrder, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, publishedHome, publishedHomeBlocks, type Block, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import crons from "../crons";
import { finishQuest } from "../quests/finish";
import { groupQuestPool } from "../quests/groupPool";
import { achievementsLiveIn } from "../achievements/flag";
import { hoggieNamed, rarityLabel } from "../album/hoggies/catalogue";
import { keepOpen } from "../unlocks/unlocks";

const lastTuesday = Date.parse("2026-10-13T10:00:00Z");
const sunday = Date.parse("2026-10-18T23:00:00Z");
const mondaySweep = Date.parse("2026-10-19T00:10:00Z");
const groupsSyncedAt = Date.parse("2026-10-06T10:00:00Z");
const ants = ["U_ANN", "U_AL", "U_AMY", "U_ABE"];
const everyFlag = ["xp-levels", "unlocks", "quests", "groups", "group-quest"];
const tuesday = Date.parse("2026-10-20T10:00:00Z");
const groupQuestLine = "section: Ants quest: Thank someone and say why. · 0 of 3 took part";
const groupQuestDoneLine = "section: Ants quest: Thank someone and say why. · 3 of 3 took part · ✅";
const saysWhy = "thanks for untangling the release notes today";
const earlierGroupCrateLine = "section: *Week of Oct 19:* ✅ Ants quest: Thank someone and say why.";
const siteUrl = "https://kudos-site.test";
const websiteOpen = ["website"];

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: groupsSyncedAt });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  slack = new FakeSlack();
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GB21 GB24: across a Monday 00:00 UTC, a group of 4 participants gets one group quest with target 3, shown in App Home", { timeout: 60_000 }, () => {
  test("App Home's Quests section shows each participant Ants quest: Thank someone and say why. · 0 of 3 took part from the Monday sweep, and nothing the week before", async () => {
    const t = await antsOpenedQuests();
    await sweepAt(t, lastTuesday);

    vi.setSystemTime(sunday);
    await openHome(t, "U_ANN");
    expect(publishedHome(slack, "U_ANN")).not.toContain(groupQuestLine);

    await sweepAt(t, mondaySweep);
    for (const user of ants) await openHome(t, user);

    for (const user of ants) {
      const home = publishedHome(slack, user);
      const quests = home.indexOf("section: *Quests this week*");
      expect(quests).toBeGreaterThanOrEqual(0);
      expect(home.indexOf(groupQuestLine)).toBeGreaterThan(quests);
    }
  });
});

describe("GB23 GB24: a week of kudos that say why finishes the group quest, and App Home shows it done with counts only", { timeout: 60_000 }, () => {
  test("three Ants who each give a kudos that says why see 3 of 3 took part · ✅ with their crate to open; Abe, who gave none, sees it done without one; no success reply speaks of the group quest", async () => {
    const t = await antsOpenedQuests();
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);

    vi.setSystemTime(tuesday);
    for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient, saysWhy);
    for (const user of ants) await openHome(t, user);

    for (const user of ["U_ANN", "U_AL", "U_AMY"]) expect(publishedHome(slack, user)).toContain(`${groupQuestDoneLine} [button: Open]`);
    expect(publishedHome(slack, "U_ABE")).toContain(groupQuestDoneLine);
    for (const user of ants) expect(slack.ephemeralsTo(user).map(({ text }) => String(text)).join("\n")).not.toContain("Ants");
  });

  test("Open on the group quest's crate opens it once and leaves the done line", async () => {
    const t = await antsOpenedQuests();
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);
    vi.setSystemTime(tuesday);
    for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient, saysWhy);
    await openHome(t, "U_ANN");

    await click(t, "U_ANN", groupQuestCrateIn(publishedHomeBlocks(slack, "U_ANN")));

    expect(publishedHome(slack, "U_ANN")).toContain(groupQuestDoneLine);
    expect(await t.run((ctx) => ctx.db.query("crateOpenings").collect())).toEqual([expect.objectContaining({ key: expect.stringMatching(/^group:/) })]);
  });
});

describe("CL6: a group quest's crate drops one hoggie, and App Home names it", { timeout: 60_000 }, () => {
  test("Open on the group quest's crate, with collection on, drops one hoggie and App Home's hoggies line names it as the last found", async () => {
    const t = await antsOpenedQuests("collection", "achievements");
    await bookOpenedFor(t, "U_ANN");
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);
    vi.setSystemTime(tuesday);
    for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient, saysWhy);
    await openHome(t, "U_ANN");

    await click(t, "U_ANN", groupQuestCrateIn(publishedHomeBlocks(slack, "U_ANN")));

    const drops = await t.run((ctx) => ctx.db.query("drops").collect());
    expect(drops).toEqual([expect.objectContaining({ crate: expect.stringMatching(/^group:.+:2026-10-19$/) })]);
    const { name, rarity } = hoggieNamed(drops[0]!.hoggie)!;
    expect(publishedHome(slack, "U_ANN")).toContain(`section: Hoggies: 1 of 151 · last found: ${name} (${rarityLabel(rarity)})`);
  });
});

describe("GB23 P85: a group crate left unopened waits in App Home after its week", { timeout: 60_000 }, () => {
  test("next week, App Home lists Ann's unopened Ants crate under Waiting to open, and Open opens it", async () => {
    const t = await antsOpenedQuests();
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);
    vi.setSystemTime(tuesday);
    for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient, saysWhy);

    vi.setSystemTime(tuesday + 7 * 24 * 60 * 60 * 1000);
    await openHome(t, "U_ANN");
    expect(publishedHome(slack, "U_ANN")).toContain(`${earlierGroupCrateLine} [button: Open]`);

    await click(t, "U_ANN", buttonIn(publishedHomeBlocks(slack, "U_ANN").filter(({ text }) => text?.text === earlierGroupCrateLine.replace("section: ", "")), "Open"));

    expect(publishedHome(slack, "U_ANN").join("\n")).not.toContain("Ants quest:");
    expect(await t.run((ctx) => ctx.db.query("crateOpenings").collect())).toEqual([expect.objectContaining({ key: expect.stringMatching(/^group:.+:2026-10-19$/) })]);
  });
});

describe("GB23 P85: group crates waiting from earlier weeks share App Home's five earlier crates", { timeout: 120_000 }, () => {
  test("with 100 group crates waiting from earlier weeks, App Home shows the oldest 5 and how many more within Slack's 100 blocks", async () => {
    const t = await antsOpenedQuests();
    await groupCratesWaitingFromEarlierWeeks(t, "U_ANN", 100);
    vi.setSystemTime(tuesday);

    await openHome(t, "U_ANN");

    const crate = (monday: string) => `section: *Week of ${monday}:* ✅ Ants quest: Thank someone and say why. [button: Open]`;
    expect(publishedHomeBlocks(slack, "U_ANN").length).toBeLessThanOrEqual(100);
    expect(waitingIn(publishedHome(slack, "U_ANN"))).toEqual([
      "section: *Waiting to open*",
      ...["Nov 18", "Nov 25", "Dec 2", "Dec 9", "Dec 16"].map(crate),
      "context: 95 more crates from earlier weeks wait to open.",
    ]);
  });
});

describe("each crate's Open in Slack links to the page where it opens while the website is open", { timeout: 60_000 }, () => {
  test("this week's group crate links to the group crate's card on the Quests page and names that page to screen readers", async () => {
    const t = await antsOpenedQuests(...websiteOpen);
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);
    vi.setSystemTime(tuesday);
    for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient, saysWhy);

    await openHome(t, "U_ANN");

    expect(publishedHome(slack, "U_ANN")).toContain(`${groupQuestDoneLine} [link: Open ${siteUrl}/?src=app-home]`);
    expect(accessoryBeside("U_ANN", "Ants quest:")).toMatchObject({ url: `${siteUrl}/?src=app-home`, action_id: expect.stringMatching(/^website-link:group:.+:2026-10-19$/), accessibility_label: "Open on HedgeHug's Quests page" });
  });

  test("an earlier week's group crate waiting to open links to that week's waiting crate on the Quests page", async () => {
    const t = await antsOpenedQuests(...websiteOpen);
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);
    vi.setSystemTime(tuesday);
    for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient, saysWhy);

    vi.setSystemTime(tuesday + 7 * 24 * 60 * 60 * 1000);
    await openHome(t, "U_ANN");

    const ownWeek = `${siteUrl}/?src=app-home`;
    expect(publishedHome(slack, "U_ANN")).toContain(`${earlierGroupCrateLine} [link: Open ${ownWeek}]`);
    expect(accessoryBeside("U_ANN", "*Week of Oct 19:* ✅ Ants quest:")).toMatchObject({ url: ownWeek, action_id: expect.stringMatching(/^website-link:group:.+:2026-10-19$/), accessibility_label: "Open on HedgeHug's Quests page" });
  });
});

async function antsOpenedQuests(...alsoOn: string[]): Promise<Backend> {
  const t = await testBackendServing(postHog, ...[...everyFlag, ...alsoOn].map(onForEveryone));
  if (alsoOn.includes("website")) await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await unlocksShippedBeforeAnyoneJoined(t);
  for (const user of ants) slack.withMember(user, { profile: { display_name: user.slice(2) } });
  slack.withUserGroup("S_ANTS", { name: "Ants", users: ants });
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  for (const user of ants) {
    await memberChanged(t, "team_join", { id: user, profile: { display_name: user.slice(2) } });
    await settle(t);
  }
  vi.setSystemTime(lastTuesday);
  await t.run(async (ctx) => {
    for (const user of ants) await keepOpen(ctx, { workspace: "T1", member: await memberOf(ctx, user), at: lastTuesday }, "quests");
  });
  await settle(t);
  return t;
}

async function bookOpenedFor(t: Backend, user: string) {
  await t.run(async (ctx) => {
    await achievementsLiveIn(ctx, "T1");
    await keepOpen(ctx, { workspace: "T1", member: await memberOf(ctx, user), at: lastTuesday }, "book");
  });
  await settle(t);
}

async function memberOf(ctx: MutationCtx, user: string) {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}

async function sweepAt(t: Backend, at: number) {
  vi.setSystemTime(at);
  const job = crons.crons["draw each group's weekly group quest"];
  if (job === undefined) throw new Error("no cron job draws each group's weekly group quest");
  await t.mutation(makeFunctionReference<"mutation">(job.name), {});
  await settle(t);
}

let sentMessages = 0;

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleInTimeOrder(t);
}

function accessoryBeside(user: string, text: string) {
  return publishedHomeBlocks(slack, user).find((block) => block.text?.text.startsWith(text))?.accessory;
}

function groupQuestCrateIn(blocks: Block[]) {
  return buttonIn(blocks.filter(({ text }) => text?.text.startsWith("Ants quest:")), "Open");
}

async function click(t: Backend, user: string, action: BlockAction) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), { contentType: "application/x-www-form-urlencoded" }));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function groupCratesWaitingFromEarlierWeeks(t: Backend, user: string, weeks: number) {
  await t.run(async (ctx) => {
    const member = await memberOf(ctx, user);
    const group = (await ctx.db.query("userGroups").first())!._id;
    for (let week = 1; week <= weeks; week += 1) {
      const monday = new Date(Date.parse("2026-10-19") - week * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const quest = { quest: "together-say-why" as const, target: 3, reward: groupQuestPool.reward, catalogueVersion: groupQuestPool.version };
      await ctx.db.insert("groupQuests", { workspace: "T1", group, week: monday, participants: [member], ...quest, feasibleBecause: { participants: 4, membersOutside: 0 }, drawnAt: Date.parse(monday) });
      await finishQuest(ctx, "T1", member, { kind: "group", group, week: monday }, { reward: quest.reward, catalogueVersion: quest.catalogueVersion, poolQuest: quest.quest }, Date.parse(monday) + 60_000);
    }
  });
  await settle(t);
}

function waitingIn(home: string[]) {
  const start = home.indexOf("section: *Waiting to open*");
  return start === -1 ? [] : home.slice(start, home.indexOf("divider", start));
}
