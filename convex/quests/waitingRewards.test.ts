import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, publishedHome, publishedHomeBlocks, readBlocks, staleButtonOf, type Block, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import type { NotificationLine } from "../feedback/notify";
import type { MemberId } from "../workspace/directory";
import type { QuestId } from "./pool";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const nextMonday = Date.parse("2026-10-19T10:00:00Z");
const thisWeek = "2026-10-12";
const siteUrl = "https://kudos-site.test";
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const crateRewards = "crate-rewards";
const questsOn = [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("quests")];
const held = [...questsOn, onForEveryone(crateRewards)];
const notHeld = [...questsOn, offForEveryone(crateRewards)];
const heldWithCoins = [...held, onForEveryone("coins")];
const sayWhyGoal = "Thank someone and say why.";
const firstThanksGoal = "Give a kudos that says why.";
const firstQuestGoal = "Finish a weekly quest.";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CR9 CR10 CR11: a reward waiting in its crate is told as waiting, and as earned once its crate opens", { timeout: 30_000 }, () => {
  test("CR9: a Journey step finished by the kudos reads +10 XP waiting in your crate", async () => {
    const t = await workspaceDeciding(...held);

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(gainsLinesTo("U_ALICE")).toEqual(["+10 XP · Quest done: Give a kudos that says why (+10 XP waiting in your crate)"]);
  });

  test("CR9: while coins are visible, a weekly quest and its first-quest read with their coins, waiting in the crate", async () => {
    const t = await workspaceDeciding(...heldWithCoins);
    await openedQuests(t, "U_ALICE", { xp: 300, coins: 10 });
    await coinsOpenedBy(t, "U_ALICE");

    await giveKudos(t, "U_ALICE", "U_CAROL");

    expect(gainsLinesTo("U_ALICE").at(-1)).toBe("+10 XP · +4 🪙 · Quest done: Thank someone and say why (+300 XP, +10 🪙 waiting in your crate) · Quest done: Finish a weekly quest (+20 XP waiting in your crate)");
  });

  test("CR9: while coins aren't visible, the same quests read without coins, waiting in the crate", async () => {
    const t = await workspaceDeciding(...held);
    await openedQuests(t, "U_ALICE", { xp: 300, coins: 10 });

    await giveKudos(t, "U_ALICE", "U_CAROL");

    expect(gainsLinesTo("U_ALICE").at(-1)).toBe("+10 XP · Quest done: Thank someone and say why (+300 XP waiting in your crate) · Quest done: Finish a weekly quest (+20 XP waiting in your crate)");
  });

  test("CR9: a reward that counted at its finish reads +10 XP, as today", async () => {
    const t = await workspaceDeciding(...notHeld);

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(gainsLinesTo("U_ALICE")).toEqual(["+10 XP · Quest done: Give a kudos that says why (+10 XP)"]);
  });
  test("CR10: quest-finished and weekly-quest-finished say the XP waits in the crate", async () => {
    const t = await workspaceDeciding(...held);
    await openedQuests(t, "U_ALICE", { xp: 300, coins: 10 });

    await giveKudos(t, "U_ALICE", "U_CAROL");

    expect(questDmsTo("U_ALICE")).toEqual([
      `✅ You finished a Journey step: ${firstThanksGoal} *10 XP* waits in your crate.`,
      `✅ You finished a quest: ${sayWhyGoal} *300 XP* waits in your crate.`,
      `✅ You finished a Journey step: ${firstQuestGoal} *20 XP* waits in your crate.`,
    ]);
  });

  test("CR10: journey-joined says each step's XP waits in its crate", async () => {
    const t = await workspaceDeciding(onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("quests"), onForEveryone(crateRewards));
    await giveKudos(t, "U_ALICE", "U_BOB");
    await flagsFromPostHog(t, postHog, ...held);

    await journeyShippedBeforeAnyoneJoined(t);
    await settleInTimeOrder(t);

    expect(questDmsTo("U_ALICE")).toEqual([`✅ You finished a Journey step: ${firstThanksGoal} *10 XP* waits in your crate.`]);
  });

  test("CR10: a quest DM delivered after its crate was opened reads You earned", async () => {
    const t = await workspaceDeciding(...held);
    await giveKudos(t, "U_ALICE", "U_BOB");
    await openHome(t, "U_ALICE");
    const member = await t.run((ctx) => memberIn(ctx, "U_ALICE"));
    const notification = { kind: "quest-finished" as const, quest: { kind: "journey" as const, step: "first-thanks" as const }, xp: 10 };
    const delivered = () => t.query(internal.feedback.notify.linesStillWanted, { member, notification });
    expect(textOfFirstLine(await delivered())).toBe(`✅ You finished a Journey step: ${firstThanksGoal} *10 XP* waits in your crate.`);

    await click(t, "U_ALICE", journeyOpenButtonInHome("U_ALICE"));

    expect(textOfFirstLine(await delivered())).toBe(`✅ You finished a Journey step: ${firstThanksGoal} You earned *10 XP*.`);
  });

  test("CR10: a reward that counted at its finish reads You earned in its DM, as today", async () => {
    const t = await workspaceDeciding(...notHeld);
    await openedQuests(t, "U_ALICE", { xp: 300, coins: 10 });

    await giveKudos(t, "U_ALICE", "U_CAROL");

    expect(questDmsTo("U_ALICE")).toEqual([
      `✅ You finished a Journey step: ${firstThanksGoal} You earned *10 XP*.`,
      `✅ You finished a quest: ${sayWhyGoal} You earned *300 XP*.`,
      `✅ You finished a Journey step: ${firstQuestGoal} You earned *20 XP*.`,
    ]);
  });
  test("CR11: the profile's finished quest and Journey steps say the XP waits in the crate, and read You earned once opened", async () => {
    const t = await workspaceDeciding(...held);
    await openedQuests(t, "U_ALICE", { xp: 300, coins: 0 });

    await giveKudos(t, "U_ALICE", "U_CAROL");

    expect(finishedRowsIn(publishedHome(slack, "U_ALICE"))).toEqual([
      `section: ✅ ${sayWhyGoal} *300 XP* waits in your crate. [button: Open]`,
      `section: *Journey:* ✅ ${firstThanksGoal} You earned *10 XP*.`,
      `section: *Journey:* ✅ ${firstQuestGoal} *20 XP* waits in your crate. [button: Open]`,
    ]);

    await click(t, "U_ALICE", buttonBeside(publishedHomeBlocks(slack, "U_ALICE"), sayWhyGoal, "Open"));
    await click(t, "U_ALICE", journeyOpenButtonInHome("U_ALICE"));

    expect(finishedRowsIn(publishedHome(slack, "U_ALICE"))).toEqual([
      `section: ✅ ${sayWhyGoal} You earned *300 XP*.`,
      `section: *Journey:* ✅ ${firstThanksGoal} You earned *10 XP*.`,
      `section: *Journey:* ✅ ${firstQuestGoal} You earned *20 XP*.`,
    ]);
  });

  test("CR11: Waiting to open's earlier crate says its XP waits in the crate", async () => {
    const t = await workspaceDeciding(...held);
    await openedQuests(t, "U_ALICE", { xp: 300, coins: 0 });
    await giveKudos(t, "U_ALICE", "U_CAROL");
    vi.setSystemTime(nextMonday);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain(`section: *Week of Oct 12:* ✅ ${sayWhyGoal} *300 XP* waits in your crate. [button: Open]`);
    expect(publishedHome(slack, "U_ALICE").filter((line) => line.includes("You earned *300 XP*"))).toEqual([]);
  });

  test("CR11: the front door's crate lines gain the XP waiting in the crate, and its quest rows swap the wording", async () => {
    const t = await frontDoorDeciding(...held);
    await openedQuests(t, "U_ALICE", { xp: 300, coins: 0 });
    await giveKudos(t, "U_ALICE", "U_CAROL");

    const home = publishedHome(slack, "U_ALICE");
    expect(home).toContain(`section: ✅ ${sayWhyGoal} · 300 XP waits in your crate ${openOnTheWeb("/quests")}`);
    expect(home).toContain(`section: ✅ ${firstQuestGoal} · 20 XP waits in your crate ${openOnTheWeb("/")}`);
    expect(home).toContain(`section: ✅ ${sayWhyGoal} *300 XP* waits in your crate.`);
    expect(home.filter((line) => line.includes("You earned"))).toEqual([]);

    vi.setSystemTime(nextMonday);
    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain(`section: *Week of Oct 12:* ✅ ${sayWhyGoal} · 300 XP waits in your crate ${openOnTheWeb("/quests")}`);
  });

  test("CR11: rewards that counted at their finish read as today in the front door", async () => {
    const t = await frontDoorDeciding(...notHeld);
    await openedQuests(t, "U_ALICE", { xp: 300, coins: 0 });
    await giveKudos(t, "U_ALICE", "U_CAROL");

    const home = publishedHome(slack, "U_ALICE");
    expect(home).toContain(`section: ✅ ${sayWhyGoal} ${openOnTheWeb("/quests")}`);
    expect(home).toContain(`section: ✅ ${sayWhyGoal} You earned *300 XP*.`);
    expect(home.filter((line) => line.includes("waits in your crate"))).toEqual([]);
  });
});

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
}

async function frontDoorDeciding(...definitions: FlagDefinition[]) {
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  const t = await workspaceDeciding(...definitions, onForEveryone("website"));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  return t;
}

async function openedQuests(t: Backend, user: string, reward: { xp: number; coins: number }) {
  await giveKudos(t, user, "U_BOB");
  await openHome(t, user);
  await click(t, user, staleButtonOf({ type: "openQuestCrate", quest: { kind: "journey", step: "first-thanks" } }));
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
  await click(t, user, staleButtonOf({ type: "openUnlock", feature: "quests" }));
}

async function coinsOpenedBy(t: Backend, user: string) {
  await t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    await ctx.db.insert("unlocks", { member, feature: "coins", readyAt: Date.now(), openedAt: Date.now() });
  });
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

function finishedRowsIn(home: string[]) {
  return home.filter((line) => line.includes("✅") && !line.includes("is ready"));
}

function openOnTheWeb(path: string) {
  return `[link: Open ${siteUrl}${path}]`;
}

function gainsLinesTo(user: string) {
  return slack
    .ephemeralsTo(user)
    .map(({ text }) => String(text).split("\n"))
    .filter(([first]) => first!.includes("kudos from you"))
    .map((lines) => lines.at(-1));
}

function questDmsTo(user: string) {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => channel === user && String(text).startsWith("✅ You finished"))
    .map(({ text }) => String(text));
}

function textOfFirstLine(lines: NotificationLine[] | null) {
  const [first] = lines ?? [];
  return first !== undefined && typeof first !== "string" && "text" in first ? first.text : first;
}

async function memberIn(ctx: QueryCtx, user: string): Promise<MemberId> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}
