import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog, FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsOnForEveryone, offForEveryone, onForEmails, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { react, setWorkspaceSettings, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened } from "../../testing/slackMessages";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import crons from "../crons";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const mondayNine = Date.parse("2026-10-19T09:00:00Z");
const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const siteUrl = "https://kudos-site.test";
const nudge = "Hugs are a quick thanks. A kudos that names a teammate and says why earns much more XP.";
const teaserOn = ["website", "xp-levels", "hugs", "message-settings", "hidden-items", "teasers"];
const everyone = ["U_ALICE", "U_BOB", "U_CAROL", "U_DANA", "U_ERIN"];

let slack: FakeSlack;
let postHog: FakePostHog;
let t: Backend;
let seeded = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  slack = new FakeSlack();
  for (const user of everyone) slack.withMember(user, { profile: { email: `${user.slice(2).toLowerCase()}@example.com` } });
  postHog = flagsOnForEveryone(slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP38 LP39 LP41: the teaser counts what waits on App Home's front door and in the hugs recap", { timeout: 60_000 }, () => {
  test("App Home's front door reads how many items wait under the level line, 1 item waits for one, 50+ items wait past fifty, and nothing while none waits", async () => {
    await aWorkspace(teaserOn.map(onForEveryone));
    await hugs("U_ALICE", ["U_BOB", "U_CAROL", "U_DANA", "U_ERIN"]);
    await itemsWaitFor("U_BOB", 3);
    await itemsWaitFor("U_CAROL", 1);
    await itemsWaitFor("U_DANA", 51);

    for (const user of ["U_BOB", "U_CAROL", "U_DANA", "U_ERIN"]) await opensHome(user);

    expect(lineAfterTheLevelLine("U_BOB")).toBe("section: 3 items wait");
    expect(lineAfterTheLevelLine("U_CAROL")).toBe("section: 1 item waits");
    expect(lineAfterTheLevelLine("U_DANA")).toBe("section: 50+ items wait");
    expect(publishedHome(slack, "U_ERIN").join("\n")).not.toMatch(/items? waits?/);
  });

  test("the Monday hugs recap closes its count lines with the teaser, a member with nothing waiting gets today's recap, and items alone send no recap", async () => {
    await aWorkspace(teaserOn.map(onForEveryone));
    const hugged = await hugs("U_ALICE", ["U_BOB", "U_CAROL"]);
    await hugs("U_ERIN", ["U_DANA"]);
    await itemsWaitFor("U_BOB", 2);
    await itemsWaitFor("U_ALICE", 4);

    await recapsSentOnMonday();

    expect(recapTo("U_BOB")).toEqual([":taco: Your week in hugs", "Teammates reacted :taco: on your messages and gave you 1 hug (+1 XP).", `1 teammate reacted :taco: on your most-hugged message: <https://t1.slack.com/archives/C1/p${hugged[0]!.replace(".", "")}|open it in Slack>`, "2 items wait", nudge]);
    expect(recapTo("U_CAROL")).not.toContain(expect.stringMatching(/wait/));
    expect(recapTo("U_ALICE")).toContain("4 items wait");
    expect(recapsTo("U_DANA")).toHaveLength(1);
  });

  test.each([
    { condition: "with teasers off", flags: [...teaserOn.filter((key) => key !== "teasers").map(onForEveryone), offForEveryone("teasers")] },
    { condition: "with teasers on but hidden-items off", flags: [...teaserOn.filter((key) => key !== "hidden-items").map(onForEveryone), offForEveryone("hidden-items")] },
    { condition: "with teasers on for someone else's email only", flags: [...teaserOn.filter((key) => key !== "teasers").map(onForEveryone), onForEmails("teasers", "alice@example.com")] },
  ])("$condition, a walk of hugs, waiting items, App Home and the Monday recaps makes every Slack call the same walk makes with no teasers flag", async ({ flags }) => {
    const withoutTheFlag = await walkWith(teaserOn.filter((key) => key !== "teasers").map(onForEveryone));

    const walk = await walkWith(flags);

    expect(walk).toEqual(withoutTheFlag);
  });
});

async function walkWith(flags: FlagDefinition[]) {
  await aWorkspace(flags);
  await hugs("U_ALICE", ["U_BOB", "U_CAROL"]);
  await itemsWaitFor("U_BOB", 2);
  await opensHome("U_BOB");
  await recapsSentOnMonday();
  return slack.calls.map((call: SlackCall) => JSON.stringify(call)).sort();
}

async function aWorkspace(flags: FlagDefinition[]) {
  vi.setSystemTime(tuesday);
  seeded = 0;
  slack.calls.length = 0;
  t = await flagsFromPostHog(testBackend(), postHog, ...flags);
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await setWorkspaceSettings(t, { kudosEmoji: "taco" });
  await t.mutation(internal.workspace.url.rememberWorkspaceUrl, { workspace: "T1", url: "https://t1.slack.com/" });
  await unlocksShippedBeforeAnyoneJoined(t);
}

async function hugs(hugger: string, authors: string[]) {
  const messages: string[] = [];
  for (const author of authors) {
    seeded += 1;
    const message = `${Math.floor((tuesday - hourMs) / 1000) + seeded}.000100`;
    await react(t, { user: hugger, itemUser: author, ts: message });
    await settleUpTo(t, Date.now() + minuteMs);
    messages.push(message);
  }
  return messages;
}

async function itemsWaitFor(user: string, count: number) {
  await t.run(async (ctx) => {
    const members = await ctx.db.query("members").take(20);
    const member = members.find((row) => row.user === user)!._id;
    const person = members.find((row) => row.user !== user)!._id as Id<"members">;
    for (let index = 0; index < count; index += 1) {
      await ctx.db.insert("items", { workspace: "T1", member, source: "hoggie", key: `thoughtful:seeded-${user}-${index}`, reason: { kind: "thanks", person, message: { workspace: "T1", conversation: "C1", message: `1.${index}` } }, earnedAt: Date.now() });
    }
  });
}

async function opensHome(user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleUpTo(t, Date.now() + minuteMs);
}

async function recapsSentOnMonday() {
  const sweep = makeFunctionReference<"mutation">(crons.crons["schedule each member's weekly hugs recap"]!.name);
  await settleUpTo(t, Date.now() + hourMs);
  await t.mutation(sweep, {});
  await settleUpTo(t, mondayNine + hourMs);
}

function lineAfterTheLevelLine(user: string) {
  const home = publishedHome(slack, user);
  return home[home.findIndex((line) => line.startsWith("section: Level")) + 1];
}

function recapsTo(user: string) {
  return slack.messagesIn(user).filter(({ text }) => String(text).startsWith(":taco: Your week in hugs"));
}

function recapTo(user: string) {
  const [recap, ...more] = recapsTo(user);
  expect(more).toEqual([]);
  return String(recap?.text).split("\n").filter((line) => !line.includes("Change what I send you"));
}
