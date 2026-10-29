import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog, FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsOnForEveryone, offForEveryone, onForEmails, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { setLeaderboardVisibility } from "../leaderboard/visibility";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const lastSaturday = Date.parse("2026-10-10T10:00:00Z");
const siteUrl = "https://kudos-site.test";
const words = "thanks for untangling the release notes today";
const normOn = ["website", "xp-levels", "teasers"];
const normLine = (givers: number) => `section: ${givers} teammates gave kudos this week`;

let slack: FakeSlack;
let postHog: FakePostHog;
let t: Backend;
let sent = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  sent = 0;
  slack = new FakeSlack();
  for (const [user, name] of [["U_ALICE", "Alice Marchetti"], ["U_BOB", "Bob Okonkwo"], ["U_CAROL", "Carol Lindqvist"], ["U_DANA", "Dana Ferreira"], ["U_ERIN", "Erin Vasquez"]] as const) {
    slack.withMember(user, { profile: { display_name: name, real_name: name, email: `${name.split(" ")[0]!.toLowerCase()}@example.com` } });
  }
  postHog = flagsOnForEveryone(slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP40 LP41: the norm line counts this week's givers on App Home's front door", { timeout: 60_000 }, () => {
  test("three teammates who gave kudos this week, one of them off the boards, read under the level line, naming nobody, and a second kudos from one of them counts them once", async () => {
    await aWorkspace(normOn.map(onForEveryone));
    await offTheBoards("U_BOB");

    await thanks("U_ALICE", "U_DANA");
    await thanks("U_BOB", "U_DANA");
    await thanks("U_ALICE", "U_ERIN");
    await thanks("U_CAROL", "U_ERIN");
    await opensHome("U_DANA");

    const home = publishedHome(slack, "U_DANA");
    expect(home.slice(home.findIndex((line) => line.startsWith("section: Level")), home.findIndex((line) => line.startsWith("section: Level")) + 2)).toEqual([expect.stringMatching(/^section: Level 1 · /), normLine(3)]);
    expect(home.join("\n")).not.toMatch(/Alice|Bob|Carol|U_ALICE|U_BOB|U_CAROL/);
  });

  test("HH11: two givers this week beside last week's givers leave the line hidden, and a short kudos from a third this week shows it", async () => {
    await aWorkspace(normOn.map(onForEveryone));
    weekStart = lastSaturday;
    await thanks("U_DANA", "U_ALICE");
    await thanks("U_ERIN", "U_ALICE");
    weekStart = tuesday;

    await thanks("U_ALICE", "U_DANA");
    await thanks("U_BOB", "U_DANA");
    await opensHome("U_DANA");
    expect(publishedHome(slack, "U_DANA").join("\n")).not.toContain("gave kudos");

    await thanks("U_CAROL", "U_ERIN", "thanks!");
    await opensHome("U_DANA");
    expect(publishedHome(slack, "U_DANA")).toContain(normLine(3));
  });

  test.each([
    { condition: "with teasers off", flags: [...normOn.filter((key) => key !== "teasers").map(onForEveryone), offForEveryone("teasers")] },
    { condition: "with teasers on for someone else's email only", flags: [...normOn.filter((key) => key !== "teasers").map(onForEveryone), onForEmails("teasers", "alice@example.com")] },
  ])("$condition, a walk of three givers and App Home opened makes every Slack call the same walk makes with no teasers flag", async ({ flags }) => {
    const withoutTheFlag = await walkWith(normOn.filter((key) => key !== "teasers").map(onForEveryone));

    const walk = await walkWith(flags);

    expect(walk).toEqual(withoutTheFlag);
  });
});

async function walkWith(flags: FlagDefinition[]) {
  await aWorkspace(flags);
  await thanks("U_ALICE", "U_DANA");
  await thanks("U_BOB", "U_DANA");
  await thanks("U_CAROL", "U_ERIN");
  await opensHome("U_DANA");
  return slack.calls.map((call: SlackCall) => JSON.stringify(call)).sort();
}

async function aWorkspace(flags: FlagDefinition[]) {
  vi.setSystemTime(tuesday);
  weekStart = tuesday;
  sent = 0;
  slack.calls.length = 0;
  t = await flagsFromPostHog(testBackend(), postHog, ...flags);
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await unlocksShippedBeforeAnyoneJoined(t);
}

let weekStart = tuesday;

async function thanks(giver: string, recipient: string, said = words) {
  sent += 1;
  vi.setSystemTime(weekStart + sent * 600_000);
  const ts = `${Math.floor(Date.now() / 1000)}.${String(sent).padStart(6, "0")}`;
  await t.fetch("/slack/events", await signedRequest(messageEvent([section(mention(recipient), text(` ${said} `), emoji("taco"))], { user: giver, ts })));
  await settle(t);
}

async function offTheBoards(user: string) {
  await thanks(user, "U_ERIN", "hi");
  await t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((row) => row.user === user)!;
    await setLeaderboardVisibility(ctx, member._id, false);
  });
}

async function opensHome(user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}
