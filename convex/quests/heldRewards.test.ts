import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { everythingStored, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, publishedHome, publishedHomeBlocks, readBlocks, type Block, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, memberEvent, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { coinsPaidBy } from "../achievements/ladders";
import { payTierCoins } from "../achievements/tierCoins";
import type { QueryCtx } from "../_generated/server";
import { standingOf } from "../progression/progression";
import { setNotificationSwitches } from "../messageSettings/messageSettings";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";
import { finishQuest } from "./finish";
import type { QuestId } from "./pool";

const now = new Date("2026-10-13T10:00:00Z");
const thisWeek = "2026-10-12";
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const crateRewards = "crate-rewards";
const questsOn = [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("quests")];
const held = [...questsOn, onForEveryone(crateRewards)];
const notHeld = [...questsOn, offForEveryone(crateRewards)];
const sayWhyGoal = "Thank someone and say why.";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CR1 CR2: a quest's reward finished while crate-rewards is on waits in its crate", () => {
  test("a Journey step finished by a kudos leaves XP, level and balance at the kudos' own, sends no level-up DM, and App Home shows its crate", async () => {
    const t = await workspaceDeciding(...held);

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual({ xp: 10, level: 1, skillPoints: 0, balance: 4 });
    expect(levelUpDmsTo("U_ALICE")).toEqual([]);
    expect(publicNotices()).toEqual([]);
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual(["section: *Journey:* ✅ Give a kudos that says why. *10 XP* waits in your crate. [button: Open]"]);
  });

  test("a weekly quest and the first-quest step it finishes leave XP, level and balance at the kudos' own and send no level-up DM", async () => {
    const t = await workspaceDeciding(...held);
    await openedQuests(t, "U_ALICE", { xp: 300, coins: 10 });
    const before = await standingAndBalanceOf(t, "U_ALICE");
    const dmsBefore = levelUpDmsTo("U_ALICE").length;

    await giveKudos(t, "U_ALICE", "U_CAROL");

    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual({ ...before, xp: before.xp + 10, balance: before.balance + 4 });
    expect(levelUpDmsTo("U_ALICE").slice(dmsBefore)).toEqual([]);
    expect(await rewardKeysOf(t, "U_ALICE")).toEqual(["journey:first-quest", "journey:first-thanks", `weekly:${thisWeek}:0`]);
    expect(crateLinesIn(publishedHome(slack, "U_ALICE"))).toEqual([
      expect.stringContaining(`${sayWhyGoal}`),
      "section: *Journey:* ✅ Finish a weekly quest. *20 XP* waits in your crate. [button: Open]",
    ]);
  });

  test("with DMs off, the finish still republishes App Home with the crate", async () => {
    const t = await workspaceDeciding(...held);
    await openHome(t, "U_ALICE");
    await t.run(async (ctx) => setNotificationSwitches(ctx, await memberIn(ctx, "U_ALICE"), { dms: false }));
    const homesBefore = slack.callsTo("views.publish").length;

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(slack.callsTo("views.publish").length).toBeGreaterThan(homesBefore);
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual(["section: *Journey:* ✅ Give a kudos that says why. *10 XP* waits in your crate. [button: Open]"]);
  });

  test("someone-new finished by the last unthanked teammate leaving republishes App Home with its crate, with DMs off", async () => {
    const t = await workspaceDeciding(...held, onForEveryone("everyone-board"));
    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");
    await openHome(t, "U_CAROL");
    const alice = await t.run((ctx) => memberIn(ctx, "U_ALICE"));
    await t.run((ctx) => ctx.db.insert("unlocks", { member: alice, feature: "leaderboard", readyAt: Date.now() }));
    await t.run((ctx) => setNotificationSwitches(ctx, alice, { dms: false }));
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", buttonBeside(publishedHomeBlocks(slack, "U_ALICE"), "*Leaderboard* is ready", "Open"));
    const homesBefore = homesPublishedTo("U_ALICE");

    await t.fetch("/slack/events", await signedRequest(memberEvent("user_change", { id: "U_CAROL", deleted: true })));
    await settle(t);

    expect(await rewardKeysOf(t, "U_ALICE")).toContain("journey:someone-new");
    expect(homesPublishedTo("U_ALICE")).toBeGreaterThan(homesBefore);
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toContain("section: *Journey:* ✅ Thank someone you haven't thanked before. *30 XP* waits in your crate. [button: Open]");
    expect(await standingAndBalanceOf(t, "U_ALICE"), "the kudos' own XP and giving coins, with the quest's 30 XP still in its crate").toEqual({ xp: 10, level: 1, skillPoints: 0, balance: 4 });
  });

  test("a reward of a fraction of a coin or of negative coins is refused at the finish and stores nothing", async () => {
    const t = await workspaceDeciding(...held);
    await openHome(t, "U_ALICE");
    const alice = await t.run((ctx) => memberIn(ctx, "U_ALICE"));
    const before = await everythingStored(t);

    for (const coins of [0.5, -1]) {
      const finishing = t.run((ctx) => finishQuest(ctx, "T1", alice, { kind: "weekly", week: thisWeek, slot: 0 }, { reward: { xp: 20, coins, item: null }, catalogueVersion: "1" }, Date.now()));
      await expect(finishing).rejects.toThrow("not a whole number of coins");
    }

    expect(await everythingStored(t)).toEqual(before);
  });

  test("achievement tier coins pay at the tier", async () => {
    const t = await workspaceDeciding(...held);
    await openHome(t, "U_ALICE");
    const alice = await t.run((ctx) => memberIn(ctx, "U_ALICE"));

    const bronze = { member: alice, tier: "bronze" as const, rewards: [{ kind: "coins" as const, reward: "generosity-bronze-coins" }], catalogueVersion: "1" };

    await t.run((ctx) => payTierCoins(ctx, "T1", bronze, Date.now()));

    expect((await standingAndBalanceOf(t, "U_ALICE")).balance).toBe(coinsPaidBy("bronze"));
  });
});

describe("CR3: opening the crate applies the held reward once", () => {
  test("opening a Journey step's crate from App Home adds its XP, crosses the level with a level-up DM and a reward-level notice, and a second open adds nothing", async () => {
    const t = await workspaceDeciding(...held, onForEveryone("everyone-board"));
    await giveKudos(t, "U_ALICE", "U_BOB");
    await openHome(t, "U_ALICE");
    const open = journeyOpenButtonInHome("U_ALICE");

    await click(t, "U_ALICE", open);

    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual({ xp: 20, level: 2, skillPoints: 0, balance: 4 });
    expect(levelUpDmsTo("U_ALICE")).toEqual(["🎉 You reached level 2!\nLevel 3 is 80 XP away.\n*Leaderboard* is ready. It opens the boards."]);
    expect(publicNotices()).toEqual([{ channel: "C_NEWS", text: expect.stringContaining("reached level 2") }]);

    await click(t, "U_ALICE", open);

    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual({ xp: 20, level: 2, skillPoints: 0, balance: 4 });
    expect(levelUpDmsTo("U_ALICE")).toHaveLength(1);
    expect(publicNotices()).toHaveLength(1);
  });

  test("opening a weekly quest's crate adds its XP and coins, and two levels crossed send one level-up DM for the highest", async () => {
    const t = await workspaceDeciding(...held);
    await openedQuests(t, "U_ALICE", { xp: 300, coins: 10 });
    await giveKudos(t, "U_ALICE", "U_CAROL");
    const before = await standingAndBalanceOf(t, "U_ALICE");
    const dmsBefore = levelUpDmsTo("U_ALICE").length;
    const open = buttonBeside(publishedHomeBlocks(slack, "U_ALICE"), sayWhyGoal, "Open");

    await click(t, "U_ALICE", open);
    await click(t, "U_ALICE", open);

    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual({ xp: before.xp + 300, level: 4, skillPoints: 0, balance: before.balance + 10 });
    expect(levelUpDmsTo("U_ALICE").slice(dmsBefore)).toEqual([expect.stringMatching(/^🎉 You reached level 4!/)]);
    expect(publicNotices().map(({ text }) => text)).toEqual([expect.stringContaining("reached level 2"), expect.stringContaining("reached level 4")]);
  });

  test("the first-quest step a held weekly quest finished applies at its own crate's open", async () => {
    const t = await workspaceDeciding(...held);
    await openedQuests(t, "U_ALICE", { xp: 20, coins: 0 });
    await giveKudos(t, "U_ALICE", "U_CAROL");
    const before = await standingAndBalanceOf(t, "U_ALICE");

    await click(t, "U_ALICE", journeyOpenButtonInHome("U_ALICE"));

    expect((await standingAndBalanceOf(t, "U_ALICE")).xp).toBe(before.xp + 20);
  });
});

describe("CR4 CR5 CR6: the record decides, not the flag", () => {
  test("a reward finished with crate-rewards off counted at its finish, and its open with crate-rewards on applies nothing", async () => {
    const t = await workspaceDeciding(...notHeld);
    await giveKudos(t, "U_ALICE", "U_BOB");
    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual({ xp: 20, level: 2, skillPoints: 0, balance: 4 });
    await flagsFromPostHog(t, postHog, ...held);
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", journeyOpenButtonInHome("U_ALICE"));

    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual({ xp: 20, level: 2, skillPoints: 0, balance: 4 });
    expect(levelUpDmsTo("U_ALICE")).toHaveLength(1);
  });

  test("a reward finished with crate-rewards on applies at its open with crate-rewards off", async () => {
    const t = await workspaceDeciding(...held);
    await giveKudos(t, "U_ALICE", "U_BOB");
    await openHome(t, "U_ALICE");
    const open = journeyOpenButtonInHome("U_ALICE");
    await flagsFromPostHog(t, postHog, ...notHeld);

    await click(t, "U_ALICE", open);

    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual({ xp: 20, level: 2, skillPoints: 0, balance: 4 });
  });

  test("an open refused while quests is off applies nothing, and the reward applies at the open once quests is back", async () => {
    const t = await workspaceDeciding(...held);
    await giveKudos(t, "U_ALICE", "U_BOB");
    await openHome(t, "U_ALICE");
    const open = journeyOpenButtonInHome("U_ALICE");
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("quests"), onForEveryone(crateRewards));

    await click(t, "U_ALICE", open);
    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual({ xp: 10, level: 1, skillPoints: 0, balance: 4 });

    await flagsFromPostHog(t, postHog, ...held);
    await click(t, "U_ALICE", open);
    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual({ xp: 20, level: 2, skillPoints: 0, balance: 4 });
  });
});

describe("CR15: crate-rewards is read with exposure only where a quest's reward is written", () => {
  test("exposure goes once per member and value, for the member whose quests finished, and never where quests doesn't apply", async () => {
    const t = await workspaceDeciding(...held);
    await openedQuests(t, "U_ALICE", { xp: 20, coins: 0 });
    await giveKudos(t, "U_ALICE", "U_CAROL");
    await giveKudos(t, "U_BOB", "U_ALICE", "thanks");
    await flagsFromPostHog(t, postHog, ...notHeld);
    await giveKudos(t, "U_CAROL", "U_ALICE");
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("quests"), onForEveryone(crateRewards));
    await giveKudos(t, "U_BOB", "U_CAROL");
    await settle(t);

    expect(await exposuresOf(t)).toEqual([
      ["U_ALICE", true],
      ["U_CAROL", false],
    ]);
  });
});

describe("CR15: a finish where quests doesn't apply never reads crate-rewards", () => {
  test("a Journey join queued before quests turned off for the member pays the step at its finish and sends no crate-rewards exposure", async () => {
    const t = await workspaceDeciding(onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("quests"), onForEveryone(crateRewards));
    await openHome(t, "U_ALICE");
    const alice = await t.run((ctx) => memberIn(ctx, "U_ALICE"));

    await t.run((ctx) => finishQuest(ctx, "T1", alice, { kind: "journey", step: "first-thanks" }, { reward: { xp: 10, coins: 0, item: null }, catalogueVersion: "1" }, Date.now()));
    await settle(t);

    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual({ xp: 10, level: 1, skillPoints: 0, balance: 0 });
    expect(await exposuresOf(t)).toEqual([]);
  });
});

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, announcementChannel: "C_NEWS" }));
  return unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
}

async function openedQuests(t: Backend, user: string, reward: { xp: number; coins: number }) {
  await giveKudos(t, user, "U_BOB");
  await openHome(t, user);
  await click(t, user, journeyOpenButtonInHome(user));
  await reachesLevel(t, await t.run((ctx) => memberIn(ctx, user)), 3);
  await openHome(t, user);
  await t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    const slots = (["say-why", "say-why-twice", "say-why-three-times"] as QuestId[]).map((quest, slot) => ({
      slot,
      quest,
      reward: { ...reward, item: null },
      catalogueVersion: "1",
      feasibleBecause: { peopleLeft: 2, recognitionsLeft: 18 },
    }));
    await ctx.db.insert("questDraws", { member, week: thisWeek, drawnAt: Date.now(), slots });
  });
  await click(t, user, buttonBeside(publishedHomeBlocks(slack, user), "*Quests* is ready", "Open"));
}

async function giveKudos(t: Backend, giver: string, recipient: string, words = saysWhy) {
  sentMessages += 1;
  vi.setSystemTime(Date.now() + 60_000);
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000)}.00010${sentMessages}` })));
  await settleInTimeOrder(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, action: BlockAction) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settle(t);
}

function buttonBeside(blocks: Block[], beside: string, label: string) {
  return buttonIn(
    blocks.filter((block) => readBlocks([block])[0]!.includes(beside)),
    label,
  );
}

function journeyOpenButtonInHome(user: string) {
  return buttonBeside(publishedHomeBlocks(slack, user), "*Journey:* ✅", "Open");
}

function journeyIn(home: string[]) {
  const start = home.findIndex((line) => line.includes("*Journey:*"));
  return start === -1 ? [] : home.slice(start, home.indexOf("divider", start));
}

function crateLinesIn(home: string[]) {
  return home.filter((line) => line.includes("✅") && line.includes("[button: Open]"));
}

function homesPublishedTo(user: string) {
  return slack.callsTo("views.publish").filter(({ user_id }) => user_id === user).length;
}

function levelUpDmsTo(user: string) {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => channel === user && String(text).startsWith("🎉 You reached level"))
    .map(({ text }) => String(text));
}

function publicNotices() {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => !String(channel).startsWith("U") && String(text).includes("reached level"))
    .map(({ channel, text }) => ({ channel, text: String(text) }));
}

async function memberIn(ctx: QueryCtx, user: string): Promise<MemberId> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}

async function standingAndBalanceOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    return { ...(await standingOf(ctx, member)), balance: await balanceOf(ctx, member) };
  });
}

async function rewardKeysOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    return (await ctx.db.query("rewardRecords").collect()).filter((record) => record.member === member).map(({ key }) => key).sort();
  });
}

async function exposuresOf(t: Backend) {
  return t.run(async (ctx) => {
    const exposures = (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flag === crateRewards);
    return Promise.all(exposures.map(async ({ member, value }) => [(await ctx.db.get(member))!.user, value]));
  });
}
