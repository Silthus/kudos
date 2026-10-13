import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { everyone, inTheSandboxOnly, serveFlags, stubSandboxWithFlags } from "../../testing/flags";
import { blockActions, buttonIn, publishedHome, publishedHomeBlocks } from "../../testing/slackInteractions";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { appHomeOpened, emoji, mention, messageEvent, section, slashCommandResponseUrl } from "../../testing/slackMessages";

const tuesday = new Date("2026-10-13T10:00:00Z");
const boardFlag = "everyone-board";

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  stubSandboxWithFlags();
  slack = new FakeSlack().withMember("U_ANN", { profile: { display_name: "Ann" } }).withMember("U_REC");
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const joinedReply = "I'm in now. Mention teammates with a kudos emoji here and I'll pass the kudos on.";

const plainHome = [
  "header: Your kudos",
  "section: You have *3* kudos left today. You get *3* more at midnight.",
  "divider",
  "section fields: *Given this week*\n*0* | *Received this week*\n*0* | *Given in total*\n*0* | *Received in total*\n*0*",
  "divider",
  "context: To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
  "context: To add me to a channel, type `/hedgehug` there.",
];

type BoardOff = { condition: string; turnOff: (t: Backend) => Promise<void> };

const boardOff: BoardOff[] = [
  {
    condition: "without the flags key, even when PostHog turned the flag on",
    turnOff: async (t) => {
      await serveFlags(t, postHog, everyone(boardFlag));
      vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
    },
  },
  { condition: "while PostHog has no everyone-board flag", turnOff: (t) => serveFlags(t, postHog, everyone("another-flag")) },
  {
    condition: "in production, while the flag is on in the sandbox only",
    turnOff: async (t) => {
      await serveFlags(t, postHog, inTheSandboxOnly(boardFlag));
      vi.stubEnv("KUDOS_ENVIRONMENT", "production");
    },
  },
];

describe("#83: the Everyone board is invisible while everyone-board is off", () => {
  test.each(boardOff)("$condition, /hedgehug leaderboard does what /hedgehug does", async ({ turnOff }) => {
    const t = testBackend();
    await turnOff(t);
    slack.answering("conversations.join", () => Response.json({ ok: true, channel: { id: "C1" } }));

    const response = await command(t, "U_ANN", "leaderboard month");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    await settle(t);
    expect(slack.callsTo("conversations.join")).toEqual([{ channel: "C1" }]);
    expect(slack.callsTo("abc")).toEqual([{ response_type: "ephemeral", text: joinedReply }]);
  });

  test.each(boardOff)("$condition, App Home shows the Profile without tabs", async ({ turnOff }) => {
    const t = testBackend();
    await turnOff(t);

    await openHome(t, "U_ANN");

    expect(publishedHome(slack, "U_ANN")).toEqual(plainHome);
  });

  test("a Leaderboard button left from while the flag was on stores nothing and republishes App Home without tabs", async () => {
    const t = testBackend();
    await serveFlags(t, postHog, everyone(boardFlag));
    await openHome(t, "U_ANN");
    const leaderboard = buttonIn(publishedHomeBlocks(slack, "U_ANN"), "Leaderboard");
    const settings = buttonIn(publishedHomeBlocks(slack, "U_ANN"), "Settings");
    await serveFlags(t, postHog, everyone("another-flag"));

    await interact(t, blockActions("U_ANN", leaderboard));
    await interact(t, blockActions("U_ANN", settings));

    expect(await storedSettings(t)).toEqual({ homeSelections: [], leaderboardSettings: [] });
    expect(publishedHome(slack, "U_ANN")).toEqual(plainHome);
  });
});

describe("#83: the Everyone board while everyone-board is on", () => {
  test("App Home opens on the Profile tab, with the tab bar above it", async () => {
    const t = testBackend();
    await serveFlags(t, postHog, inTheSandboxOnly(boardFlag));

    await openHome(t, "U_ANN");

    expect(publishedHome(slack, "U_ANN").slice(0, 2)).toEqual(["actions: [Profile] | Leaderboard | Settings", "header: Your kudos"]);
  });

  test("O35: kudos given while it was off count on the board once it is on, and turning it off and on again rewrites nothing", async () => {
    const t = testBackend();
    await serveFlags(t, postHog, everyone("another-flag"));
    await giveKudos(t, "U_ANN", 2);
    const countedWhileOff = await storedTotals(t);

    await serveFlags(t, postHog, everyone(boardFlag));
    const shown = await replyText(t, "U_ANN");
    await serveFlags(t, postHog, everyone("another-flag"));
    await openHome(t, "U_ANN");
    await serveFlags(t, postHog, everyone(boardFlag));

    expect(shown).toBe(["🥇 <@U_ANN> · 2 kudos", "▲ 2 more kudos than this time last week"].join("\n"));
    expect(await replyText(t, "U_ANN")).toBe(shown);
    expect(await storedTotals(t)).toEqual(countedWhileOff);
  });

  test("O36: an exposure is sent once per member and value, wherever the member meets the board", async () => {
    const t = testBackend();
    await serveFlags(t, postHog, everyone(boardFlag));
    await openHome(t, "U_ANN");
    await openHome(t, "U_ANN");
    await replyText(t, "U_ANN");
    await click(t, "U_ANN", "Leaderboard");

    await serveFlags(t, postHog, everyone("another-flag"));
    await openHome(t, "U_ANN");
    await command(t, "U_ANN", "leaderboard");
    await settle(t);

    const analyticsId = await analyticsIdOf(t, "U_ANN");
    expect(exposures()).toEqual([
      { distinct_id: analyticsId, $feature_flag: boardFlag, $feature_flag_response: true, locally_evaluated: true },
      { distinct_id: analyticsId, $feature_flag: boardFlag, $feature_flag_response: false, locally_evaluated: true },
    ]);
  });

  test("O36: a teammate the directory doesn't know yet is looked up after their first /hedgehug leaderboard, and exposed once", async () => {
    const t = testBackend();
    await serveFlags(t, postHog, everyone(boardFlag));

    await replyText(t, "U_ANN");
    await settle(t);
    await replyText(t, "U_ANN");
    await settle(t);

    expect(slack.callsTo("users.info")).toEqual([{ user: "U_ANN" }]);
    expect(exposures()).toEqual([{ distinct_id: await analyticsIdOf(t, "U_ANN"), $feature_flag: boardFlag, $feature_flag_response: true, locally_evaluated: true }]);
  });
});

function exposures() {
  return postHog
    .events()
    .filter(({ event }) => event === "$feature_flag_called")
    .map(({ distinct_id, properties }) => ({
      distinct_id,
      $feature_flag: properties.$feature_flag,
      $feature_flag_response: properties.$feature_flag_response,
      locally_evaluated: properties.locally_evaluated,
    }));
}

async function analyticsIdOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    const row = await ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member!._id))
      .unique();
    return row?.analyticsId;
  });
}

let messagesGiven = 0;

async function giveKudos(t: Backend, giver: string, kudos: number) {
  const blocks = [section(mention("U_REC"), ...Array.from({ length: kudos }, () => emoji("taco")))];
  const ts = `${Math.floor(Date.now() / 1000) + messagesGiven++}.000100`;
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, label: string) {
  await interact(t, blockActions(user, buttonIn(publishedHomeBlocks(slack, user), label)));
}

async function interact(t: Backend, body: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(body, { contentType: "application/x-www-form-urlencoded" }));
  expect(response.status).toBe(200);
  await settle(t);
}

async function replyText(t: Backend, user: string) {
  const response = await command(t, user, "leaderboard");
  expect(response.status).toBe(200);
  const reply = (await response.json()) as { response_type: string; text: string };
  expect(reply.response_type).toBe("ephemeral");
  return reply.text;
}

async function command(t: Backend, user: string, text: string) {
  const body = new URLSearchParams({
    team_id: "T1",
    channel_id: "C1",
    channel_name: "general",
    user_id: user,
    command: "/hedgehug",
    text,
    response_url: slashCommandResponseUrl,
    trigger_id: "1.2.3",
  }).toString();
  return t.fetch("/slack/commands", await signedRequest(body, { contentType: "application/x-www-form-urlencoded" }));
}

function storedSettings(t: Backend) {
  return t.run(async (ctx) => ({ homeSelections: await ctx.db.query("homeSelections").collect(), leaderboardSettings: await ctx.db.query("leaderboardSettings").collect() }));
}

function storedTotals(t: Backend) {
  return t.run(async (ctx) => ({
    counted: await ctx.db.query("countedKudosGiven").collect(),
    days: await ctx.db.query("givenByDay").collect(),
    totals: await ctx.db.query("givenTotals").collect(),
  }));
}
