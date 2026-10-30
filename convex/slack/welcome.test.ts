import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, httpStatus, networkFailure, rateLimitedFor, slackError } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsOnForEveryone, onForEmails, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { post, settle, settleUntil, setWorkspaceSettings, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { readBlocks, type Block } from "../../testing/slackInteractions";
import { emoji, mention, messageEvent, section, type MessageOptions } from "../../testing/slackMessages";
import { internal } from "../_generated/api";

const now = new Date("2026-10-13T10:00:00Z");
const siteUrl = "https://kudos-site.test";
const appHome = "slack://app?team=T1&id=A_KUDOS&tab=home";
const alicesEmail = "alice@example.com";
const welcomeLine = "Welcome to HedgeHug, where we thank each other for the help that usually goes unnoticed.";
const earnsXp = "Every kudos you give or receive earns XP.";
const recipientsStep =
  "👉 *Your first step:* thank someone who helped you lately. Mention them and add :taco: to your message in any channel I'm in.";
const giversStep = "👉 *Next step:* thank two more teammates this week.";
const allowance = "You have 3 kudos a day, and they refill at midnight your time.";
const websiteLine = "The HedgeHug website shows your kudos and progress in one place.";
const everyFeature = ["xp-levels", "unlocks", "quests", "skill-tree", "achievements"];

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  slack = new FakeSlack().withMember("U_ALICE", { profile: { email: alicesEmail } }).withMember("U_BOB").withMember("U_CAROL").withMember("U_DAN").withMember("U_ERIN").withMember("U_FRAN");
  postHog = flagsOnForEveryone(slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("QM6 QM7: the welcome has a version for a first recipient and one for a first giver", { timeout: 30_000 }, () => {
  test("with every feature and the website open, the recipient is welcomed by the giver's name and the giver by the recipient's, byte for byte", async () => {
    const t = await workspace(...everyFeature, "website");

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    const unlocks = `${earnsXp} The Book of achievements is yours from the start. As you level up you unlock weekly quests at level 3 and a skill tree at level 5.`;
    expect(welcomeTo("U_BOB")).toEqual({
      channel: "U_BOB",
      text: [
        "🎉 *<@U_ALICE> just thanked you with a kudos!*",
        welcomeLine,
        unlocks,
        recipientsStep,
        allowance,
        websiteLine,
        `<${siteUrl}/?src=welcome|See your progress>`,
        `<${appHome}|Open App Home>`,
      ].join("\n"),
      blocks: [
        sectionOf("🎉 *<@U_ALICE> just thanked you with a kudos!*"),
        sectionOf(welcomeLine),
        sectionOf(unlocks),
        sectionOf(recipientsStep),
        sectionOf(allowance),
        sectionOf(websiteLine),
        {
          type: "actions",
          elements: [
            { type: "button", text: { type: "plain_text", text: "See your progress" }, url: `${siteUrl}/?src=welcome`, action_id: "welcome-website", style: "primary" },
            { type: "button", text: { type: "plain_text", text: "Open App Home" }, url: appHome, action_id: "welcome-app-home" },
          ],
        },
      ],
    });
    expect(readWelcomeTo("U_ALICE")).toEqual([
      "section: 🎉 *Your first kudos just landed with <@U_BOB>!*",
      `section: ${welcomeLine}`,
      `section: ${unlocks}`,
      `section: ${giversStep}`,
      `section: ${allowance}`,
      `section: ${websiteLine}`,
      "actions: [See your progress] | Open App Home",
    ]);
  });

  test("with only the core loop and no website, both versions keep the header, the welcome line, the step, the allowance and Open App Home, byte for byte", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    expect(welcomeTo("U_ALICE")).toEqual({
      channel: "U_ALICE",
      text: ["🎉 *Your first kudos just landed with <@U_BOB>!*", welcomeLine, giversStep, allowance, `<${appHome}|Open App Home>`].join("\n"),
      blocks: [
        sectionOf("🎉 *Your first kudos just landed with <@U_BOB>!*"),
        sectionOf(welcomeLine),
        sectionOf(giversStep),
        sectionOf(allowance),
        { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open App Home" }, url: appHome, action_id: "welcome-app-home" }] },
      ],
    });
    expect(readWelcomeTo("U_BOB")).toEqual([
      "section: 🎉 *<@U_ALICE> just thanked you with a kudos!*",
      `section: ${welcomeLine}`,
      `section: ${recipientsStep}`,
      `section: ${allowance}`,
      "actions: Open App Home",
    ]);
  });

  test.each([
    { flags: ["unlocks", "quests", "skill-tree", "achievements"], line: null },
    { flags: ["xp-levels"], line: earnsXp },
    { flags: ["xp-levels", "unlocks"], line: earnsXp },
    { flags: ["xp-levels", "quests", "skill-tree", "achievements"], line: earnsXp },
    { flags: ["xp-levels", "unlocks", "quests"], line: `${earnsXp} As you level up you unlock weekly quests at level 3.` },
    { flags: ["xp-levels", "unlocks", "skill-tree"], line: `${earnsXp} As you level up you unlock a skill tree at level 5.` },
    { flags: ["xp-levels", "unlocks", "achievements"], line: `${earnsXp} The Book of achievements is yours from the start.` },
    { flags: ["xp-levels", "unlocks", "quests", "skill-tree"], line: `${earnsXp} As you level up you unlock weekly quests at level 3 and a skill tree at level 5.` },
    { flags: ["xp-levels", "unlocks", "everyone-board", "quests"], line: `${earnsXp} As you level up you unlock the leaderboard at level 2 and weekly quests at level 3.` },
    { flags: ["xp-levels", "unlocks", "skill-tree", "achievements"], line: `${earnsXp} The Book of achievements is yours from the start. As you level up you unlock a skill tree at level 5.` },
    { flags: ["xp-levels", "unlocks", "quests", "achievements"], line: `${earnsXp} The Book of achievements is yours from the start. As you level up you unlock weekly quests at level 3.` },
  ])("with $flags on, the line after the welcome line is $line", async ({ flags, line }) => {
    const t = await workspace(...flags);

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    for (const user of ["U_ALICE", "U_BOB"]) {
      expect(readWelcomeTo(user).slice(2, -3)).toEqual(line === null ? [] : [`section: ${line}`]);
      expect(String(welcomeTo(user)?.text).split("\n").slice(2, -3)).toEqual(line === null ? [] : [line]);
    }
  });

  test.each([
    { count: 2, header: "🎉 *Your first kudos just landed with <@U_BOB> and <@U_CAROL>!*" },
    { count: 3, header: "🎉 *Your first kudos just landed with <@U_BOB>, <@U_CAROL> and <@U_DAN>!*" },
    { count: 5, header: "🎉 *Your first kudos just landed with <@U_BOB>, <@U_CAROL> and 3 more!*" },
  ])("a first giver who thanked $count people sees up to three of them by name", async ({ count, header }) => {
    const t = await workspace();
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 5 }));
    const recipients = ["U_BOB", "U_CAROL", "U_DAN", "U_ERIN", "U_FRAN"].slice(0, count);

    await giveKudos(t, "U_ALICE", recipients);

    expect(readWelcomeTo("U_ALICE")[0]).toBe(`section: ${header}`);
    for (const recipient of recipients) expect(readWelcomeTo(recipient)[0]).toBe("section: 🎉 *<@U_ALICE> just thanked you with a kudos!*");
  });

  test("R46: the step and the allowance name the workspace emoji and base in force", async () => {
    const t = await workspace();
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "pizza", baseAllowance: 5 }));

    await giveKudos(t, "U_ALICE", ["U_BOB"], ["pizza"]);

    expect(readWelcomeTo("U_BOB").slice(2, 4)).toEqual([
      "section: 👉 *Your first step:* thank someone who helped you lately. Mention them and add :pizza: to your message in any channel I'm in.",
      "section: You have 5 kudos a day, and they refill at midnight your time.",
    ]);
  });
});

describe("QM8: the welcome's website line and See your progress follow the member's door to the website", { timeout: 30_000 }, () => {
  test("while the website is open, See your progress opens it", async () => {
    const t = await workspace("website");

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    expect(websiteButtonOf("U_ALICE")).toBe(`${siteUrl}/?src=welcome`);
    expect(readWelcomeTo("U_ALICE")).toContain(`section: ${websiteLine}`);
  });

  test("for a member previewing the website while it is closed for the workspace, See your progress goes through the sign-in entry, and the others get no website", async () => {
    const t = await workspace();
    await flagsFromPostHog(t, postHog, onForEmails("website", alicesEmail));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    expect(websiteButtonOf("U_ALICE")).toBe(`${siteUrl}/sign-in/?src=welcome`);
    expect(readWelcomeTo("U_ALICE")).toContain(`section: ${websiteLine}`);
    expect(websiteButtonOf("U_BOB")).toBeUndefined();
    expect(readWelcomeTo("U_BOB")).not.toContain(`section: ${websiteLine}`);
  });

  test("a previewing recipient's welcome delivered before every other subscriber of that kudos still goes through the sign-in entry", async () => {
    const t = await workspace();
    await flagsFromPostHog(t, postHog, onForEmails("website", alicesEmail));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});

    await post(t, [section(mention("U_ALICE"), emoji("taco"))], { user: "U_BOB" });
    await settleWithOtherSubscribersBehind(t);

    expect(websiteButtonOf("U_ALICE")).toBe(`${siteUrl}/sign-in/?src=welcome`);
  });

  test.each([
    { condition: "while the website flag is off", flags: [] },
    { condition: "while SITE_URL is unset", flags: ["website"], env: { SITE_URL: "" } },
    { condition: "while the website is open for another workspace only", flags: ["website"], env: { SLACK_WORKSPACE_ID: "T_OTHER" } },
  ])("$condition, the welcome has no website line and only Open App Home", async ({ flags, env = {} }) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const t = await workspace(...flags);

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    for (const user of ["U_ALICE", "U_BOB"]) {
      expect(readWelcomeTo(user)).not.toContain(`section: ${websiteLine}`);
      expect(readWelcomeTo(user).at(-1)).toBe("actions: Open App Home");
    }
  });
});

describe("QM9: the welcome is rendered at delivery", { timeout: 30_000 }, () => {
  test("a welcome queued before the deploy, with only the workspace and the user, delivers the neutral header and the recipient's step", async () => {
    const t = await workspace("xp-levels", "website");
    await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }));

    await t.run((ctx) => ctx.scheduler.runAfter(0, internal.slack.welcome.deliverWelcome, { workspace: "T1", user: "U_BOB", attempt: 1 }));
    await settle(t);

    expect(readWelcomeTo("U_BOB")).toEqual([
      "section: 👋 *Welcome to HedgeHug!*",
      `section: ${welcomeLine}`,
      `section: ${earnsXp}`,
      `section: ${recipientsStep}`,
      `section: ${allowance}`,
      `section: ${websiteLine}`,
      "actions: [See your progress] | Open App Home",
    ]);
  });

  test("a retry renders the kudos emoji in force at its attempt and keeps who thanked the member", async () => {
    const t = await workspace();
    slack.answering("chat.postMessage", rateLimitedFor(30), rateLimitedFor(30));
    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_ALICE" });
    await settleUntil(t, new Date(now.getTime() + 10_000));

    await setWorkspaceSettings(t, { kudosEmoji: "pizza" });
    await settle(t);

    const [, retry] = slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "U_BOB");
    expect(readBlocks(retry!.blocks as Block[]).slice(0, 3)).toEqual([
      "section: 🎉 *<@U_ALICE> just thanked you with a kudos!*",
      `section: ${welcomeLine}`,
      `section: ${recipientsStep.replace(":taco:", ":pizza:")}`,
    ]);
  });
});

describe("R42 R43 QM10: a member is welcomed once, ever, in pages", { timeout: 30_000 }, () => {
  test("a member is welcomed at most once, whatever Slack redelivers and whichever awards follow", async () => {
    const t = testBackend();
    const firstKudos = messageEvent([section(mention("U_BOB"), emoji("taco"))], { user: "U_ALICE", ts: "1760349600.000100" });

    await t.fetch("/slack/events", await signedRequest(firstKudos));
    await t.fetch("/slack/events", await signedRequest(firstKudos));
    await settle(t);
    await giveKudos(t, "U_BOB", ["U_ALICE"], ["taco"], { ts: "1760349601.000100" });
    await giveKudos(t, "U_ALICE", ["U_CAROL"], ["taco"], { ts: "1760349602.000100" });
    await giveKudos(t, "U_CAROL", ["U_BOB"], ["taco"], { ts: "1760349603.000100" });

    expect(attemptsPerUser()).toEqual({ U_ALICE: 1, U_BOB: 1, U_CAROL: 1 });
  });

  test("a welcome never schedules past Convex's limit: one kudos naming 700 new members welcomes each of them once, and no welcome mutation schedules 1,000 functions or more", { timeout: 300_000 }, async () => {
    const t = testBackend({ transactionLimits: true });
    const recipients = Array.from({ length: 700 }, (_, index) => `U_NEW${String(index).padStart(3, "0")}`);
    for (const user of recipients) slack.withMember(user);
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 700 }));

    await post(t, [section(...recipients.map((user) => mention(user)), emoji("taco"))], { user: "U_ALICE" });
    const scheduledPerPage = await settleCountingWelcomePages(t);

    expect(attemptsPerUser()).toEqual(Object.fromEntries(["U_ALICE", ...recipients].map((user) => [user, 1])));
    const memberWelcomed = await memberWelcomedPerMember(t);
    expect(memberWelcomed.size).toBe(701);
    expect(new Set(memberWelcomed.values())).toEqual(new Set([1]));
    expect(scheduledPerPage.length).toBeGreaterThan(1);
    for (const scheduled of scheduledPerPage) expect(scheduled).toBeLessThan(1000);
  });
});

describe("R44 R34: delivering the welcome message", { timeout: 30_000 }, () => {
  test("a welcome that keeps failing is tried 3 times and never again, and the award and the allowance stand", async () => {
    const t = testBackend();
    const failures = [networkFailure, httpStatus(500), slackError("internal_error"), networkFailure, httpStatus(500), slackError("internal_error")];
    slack.answering("chat.postMessage", ...failures);

    await giveKudos(t, "U_ALICE", ["U_BOB"], ["taco"], { ts: slackTs(now) });
    await giveKudos(t, "U_ALICE", ["U_CAROL"], ["taco", "taco"], { ts: slackTs(now, 1) });

    expect(attemptsPerUser()).toEqual({ U_ALICE: 3, U_BOB: 3, U_CAROL: 1 });
    expect(await homeFacts(t, "U_ALICE")).toMatchObject({ left: 0, given: 3, received: 0 });
    expect(await homeFacts(t, "U_BOB")).toMatchObject({ given: 0, received: 1 });
    expect(await homeFacts(t, "U_CAROL")).toMatchObject({ given: 0, received: 2 });
  });

  test("a rate-limited welcome is tried again after Slack's Retry-After, and then not again once it arrived", async () => {
    const t = testBackend();
    slack.answering("chat.postMessage", rateLimitedFor(30), rateLimitedFor(30));

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    expect(attemptsPerUser()).toEqual({ U_ALICE: 2, U_BOB: 2 });
    for (const user of ["U_ALICE", "U_BOB"]) {
      const [first, retry] = slack.timesOf("chat.postMessage", (args) => args.channel === user);
      expect(retry! - first!).toBeGreaterThanOrEqual(30_000);
    }
  });

  test("R35: a rate limit on one welcome holds the next welcome until Slack's Retry-After", async () => {
    const t = testBackend();
    slack.answering("chat.postMessage", rateLimitedFor(30));
    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_ALICE", ts: slackTs(now) });
    await settleUntil(t, new Date(now.getTime() + 10_000));

    await post(t, [section(mention("U_ALICE"), emoji("taco"))], { user: "U_CAROL", ts: slackTs(now, 10) });
    await settleUntil(t, new Date(now.getTime() + 60_000));

    const [rateLimitedAt] = slack.timesOf("chat.postMessage");
    const [carolWelcomedAt] = slack.timesOf("chat.postMessage", (args) => args.channel === "U_CAROL");
    expect(carolWelcomedAt! - rateLimitedAt!).toBeGreaterThanOrEqual(30_000);
  });

  test("R35: a welcome Slack can't deliver to that person stops for good", async () => {
    const t = testBackend();
    slack.answering("chat.postMessage", slackError("channel_not_found"));

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    expect(attemptsPerUser()).toEqual({ U_ALICE: 1, U_BOB: 1 });
  });
});

async function workspace(...flags: string[]) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flags.map(onForEveryone));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  return unlocksShippedBeforeAnyoneJoined(t);
}

async function giveKudos(t: Backend, giver: string, recipients: string[], kudosEmoji = ["taco"], options: MessageOptions = {}) {
  const blocks = [section(...recipients.map((recipient) => mention(recipient)), ...kudosEmoji.map((name) => emoji(name)))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ...options })));
  await settle(t);
}

async function settleCountingWelcomePages(t: Backend) {
  const scheduledPerPage: number[] = [];
  for (let fired = 0; fired < 10_000; fired += 1) {
    await t.finishInProgressScheduledFunctions();
    for (const page of await pendingJobs(t, "welcome/welcome:welcomeNewMembers")) scheduledPerPage.push(await scheduledBy(t, page));
    if (vi.getTimerCount() === 0) return scheduledPerPage;
    vi.advanceTimersToNextTimer();
  }
  throw new Error("the welcome pages never settled");
}

async function settleWithOtherSubscribersBehind(t: Backend) {
  const behind: ScheduledJob[] = [];
  for (let fired = 0; fired < 1000; fired += 1) {
    await t.finishInProgressScheduledFunctions();
    for (const job of (await scheduledJobs(t)).filter((job) => job.state.kind === "pending" && isOtherSubscriber(job))) {
      await t.run((ctx) => ctx.scheduler.cancel(job._id));
      behind.push(job);
    }
    if (vi.getTimerCount() === 0) break;
    vi.advanceTimersToNextTimer();
  }
  for (const job of behind) await t.run((ctx) => ctx.scheduler.runAfter(0, job.name as never, job.args[0] as never));
  await settle(t);
}

function isOtherSubscriber({ name, args }: ScheduledJob) {
  const type = (args[0] as { event?: { type?: string } } | undefined)?.event?.type;
  return (type === "kudosGiven" || type === "memberWelcomed") && name !== "welcome/welcome:welcomeNewMembers";
}

async function scheduledBy(t: Backend, page: ScheduledJob) {
  await t.run((ctx) => ctx.scheduler.cancel(page._id));
  const before = await scheduledJobs(t);
  await t.mutation(internal.welcome.welcome.welcomeNewMembers, page.args[0] as never);
  return (await scheduledJobs(t)).length - before.length;
}

async function pendingJobs(t: Backend, name: string) {
  return (await scheduledJobs(t)).filter((job) => job.name === name && job.state.kind === "pending");
}

type ScheduledJob = Awaited<ReturnType<typeof scheduledJobs>>[number];

function scheduledJobs(t: Backend) {
  return t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}

async function memberWelcomedPerMember(t: Backend) {
  const perMember = new Map<string, number>();
  for (const job of (await scheduledJobs(t)).filter(({ name }) => name === "analytics/subscribers:recordMemberWelcomed")) {
    const { member } = (job.args[0] as { event: { member: string } }).event;
    perMember.set(member, (perMember.get(member) ?? 0) + 1);
  }
  return perMember;
}

function welcomeTo(user: string) {
  return slack.callsTo("chat.postMessage").find((args) => args.channel === user);
}

function readWelcomeTo(user: string) {
  return readBlocks((welcomeTo(user)?.blocks ?? []) as Block[]);
}

function websiteButtonOf(user: string) {
  const actions = ((welcomeTo(user)?.blocks ?? []) as Block[]).find((block) => block.type === "actions");
  return (actions?.elements as Array<{ text: { text: string }; url?: string }> | undefined)?.find(({ text }) => text.text === "See your progress")?.url;
}

function sectionOf(text: string) {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function homeFacts(t: Backend, user: string) {
  return t.query(internal.engine.home.homeOf, { workspace: "T1", user });
}

function attemptsPerUser() {
  const attempts: Record<string, number> = {};
  for (const { channel } of slack.callsTo("chat.postMessage")) attempts[String(channel)] = (attempts[String(channel)] ?? 0) + 1;
  return attempts;
}

function slackTs(at: Date, secondsLater = 0) {
  return `${Math.floor(at.getTime() / 1000) + secondsLater}.000100`;
}
