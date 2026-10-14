import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import { record } from "../workspace/directory";
import { type FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { onForEveryone, postHogDeciding, testBackendServing } from "../../testing/flags";
import { settle, type Backend } from "../../testing/slackBackend";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { emoji, mention, messageEvent, section } from "../../testing/slackMessages";

const tuesday = new Date("2026-10-13T10:00:00Z");

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_REC");
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const nineGivers = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9"];

describe("G23: /hedgehug leaderboard", () => {
  test("G13 G16 G17: privately shows this week's Everyone board of kudos given, with medals, shared ranks and one gap above the viewer", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    for (const [index, giver] of nineGivers.entries()) {
      slack.withMember(giver, { profile: { display_name: `Person ${index + 1}` } });
      await giveKudos(t, giver, "U_REC", 3 - Math.floor(index / 3), index);
    }

    const reply = await leaderboardCommand(t, "U9");

    expect(reply).toEqual({
      response_type: "ephemeral",
      text: [
        "🥇 <@U1> · 3 kudos",
        "🥇 <@U2> · 3 kudos",
        "🥇 <@U3> · 3 kudos",
        "…",
        "4. <@U6> · 2 kudos",
        "7. <@U7> · 1 kudos",
        "7. <@U8> · 1 kudos",
        "7. <@U9> · 1 kudos",
        "▲ 1 more kudos than this time last week",
      ].join("\n"),
    });
    expect(slack.callsTo("conversations.join")).toEqual([]);
    expect(slack.callsTo("chat.postMessage").filter((args) => args.channel === "C1")).toEqual([]);
  });

  test("G13 G17: a member who only received kudos isn't on it, sees the top 3 and is told how to join", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    for (const [index, giver] of nineGivers.slice(0, 4).entries()) {
      slack.withMember(giver);
      await giveKudos(t, giver, "U_REC", 3 - index, index);
    }

    const reply = await leaderboardCommand(t, "U_REC");

    expect(reply.text).toBe(["🥇 <@U1> · 3 kudos", "🥈 <@U2> · 2 kudos", "🥉 <@U3> · 1 kudos", "Give kudos this week to join the board."].join("\n"));
  });

  test("G16: givers with equal totals list by their Slack display name, or their real name without one", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    slack.withMember("U_ANN", { profile: { display_name: "Zora" } }).withMember("U_BOB", { real_name: "Ava Stone", profile: { display_name: "" } });
    await giveKudos(t, "U_ANN", "U_REC", 1, 0);
    await giveKudos(t, "U_BOB", "U_REC", 1, 1);

    const reply = await leaderboardCommand(t, "U_ANN");

    expect(reply.text).toBe(["🥇 <@U_BOB> · 1 kudos", "🥇 <@U_ANN> · 1 kudos", "▲ 1 more kudos than this time last week"].join("\n"));
  });

  test("G16: members the directory knew before it kept names get them from users.list, and a name it has stays", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    await knownWithoutName(t, "U_ANN", "U_BOB", "U_CY");
    slack.withMember("U_ANN", { profile: { display_name: "Zora" } }).withMember("U_BOB", { profile: { display_name: "Ava" } }).withMember("U_CY", { profile: { display_name: "Abe" } });
    await t.run((ctx) => record(ctx, { workspace: "T1", user: "U_CY", entry: { kind: "member", name: "Zed" }, asOf: Date.now() }));
    for (const [index, giver] of ["U_ANN", "U_BOB", "U_CY"].entries()) await giveKudos(t, giver, "U_REC", 1, index);

    await t.action(internal.slack.directory.fillMissingNames, {});

    expect((await leaderboardCommand(t, "U_ANN")).text).toBe(["🥇 <@U_BOB> · 1 kudos", "🥇 <@U_CY> · 1 kudos", "🥇 <@U_ANN> · 1 kudos", "▲ 1 more kudos than this time last week"].join("\n"));
  });

  test("an award counts in the week of its giver's allowance day, in each giver's time zone", async () => {
    const mondayMorningInBerlin = new Date("2026-10-12T05:00:00Z");
    vi.setSystemTime(mondayMorningInBerlin);
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    slack.withMember("U_LA", { tz: "America/Los_Angeles" }).withMember("U_BERLIN", { tz: "Europe/Berlin" });
    await giveKudos(t, "U_LA", "U_REC", 2, 0);
    await giveKudos(t, "U_BERLIN", "U_REC", 1, 1);

    expect((await leaderboardCommand(t, "U_BERLIN")).text).toBe(["🥇 <@U_BERLIN> · 1 kudos", "▲ 1 more kudos than this time last week"].join("\n"));
    expect((await leaderboardCommand(t, "U_LA")).text).toBe(["🥇 <@U_LA> · 2 kudos", "▲ 2 more kudos than this time last week"].join("\n"));
  });

  test.each([
    { text: "leaderboard", period: "week", rows: ["🥇 <@U3> · 1 kudos", "Give kudos this week to join the board."] },
    { text: "leaderboard week", period: "week", rows: ["🥇 <@U3> · 1 kudos", "Give kudos this week to join the board."] },
    { text: "leaderboard month", period: "month", rows: ["🥇 <@U1> · 2 kudos", "🥈 <@U3> · 1 kudos", "Give kudos this month to join the board."] },
    { text: "leaderboard all", period: "all time", rows: ["🥇 <@U1> · 2 kudos", "🥈 <@U2> · 1 kudos", "🥈 <@U3> · 1 kudos", "Give kudos to join the board."] },
  ])("`$text` privately shows the Everyone board of $period", async ({ text, rows }) => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    slack.withMember("U1", { profile: { display_name: "Ann" } }).withMember("U2", { profile: { display_name: "Bob" } }).withMember("U3", { profile: { display_name: "Cy" } });
    await giveKudosOn(t, "2026-09-20T10:00:00Z", "U2", 1);
    await giveKudosOn(t, "2026-10-01T10:00:00Z", "U1", 2);
    await giveKudosOn(t, "2026-10-13T10:00:00Z", "U3", 1);

    expect(await command(t, "U_REC", text)).toEqual({ response_type: "ephemeral", text: rows.join("\n") });
  });

  test("G18: under this week's board the viewer sees how many more kudos they gave than this time last week, and the places they climbed", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    slack.withMember("U1", { profile: { display_name: "Ann" } }).withMember("U2", { profile: { display_name: "Bob" } });
    await giveKudosOn(t, "2026-10-05T10:00:00Z", "U1", 1);
    await giveKudosOn(t, "2026-10-06T10:00:00Z", "U2", 2);
    await giveKudosOn(t, "2026-10-07T10:00:00Z", "U1", 4);
    await giveKudosOn(t, "2026-10-12T10:00:00Z", "U1", 3);
    await giveKudosOn(t, "2026-10-13T09:00:00Z", "U2", 1);

    expect((await command(t, "U1", "leaderboard")).text).toBe(
      ["🥇 <@U1> · 3 kudos", "🥈 <@U2> · 1 kudos", "▲ 2 more kudos than this time last week · ▲ 1 places"].join("\n"),
    );
  });

  test("G18: without a gain the viewer sees their best completed month, and all time has no line", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    slack.withMember("U1", { profile: { display_name: "Ann" } });
    await giveKudosOn(t, "2026-08-03T10:00:00Z", "U1", 2);
    await giveKudosOn(t, "2026-08-04T10:00:00Z", "U1", 2);
    await giveKudosOn(t, "2026-09-02T10:00:00Z", "U1", 3);
    await giveKudosOn(t, "2026-10-02T10:00:00Z", "U1", 3);

    expect((await command(t, "U1", "leaderboard month")).text).toBe(["🥇 <@U1> · 3 kudos", "Your best month so far: 4 kudos."].join("\n"));
    expect((await command(t, "U1", "leaderboard all")).text).toBe("🥇 <@U1> · 10 kudos");
  });

  test.each(["leaderboard yesterday", "leaderboard of everyone", "leaderboard month all"])("an unknown argument after leaderboard, as in `%s`, gets the usage line", async (text) => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));

    const reply = await command(t, "U_REC", text);

    expect(reply).toEqual({
      response_type: "ephemeral",
      text: "Try `/hedgehug leaderboard`, `/hedgehug leaderboard month` or `/hedgehug leaderboard all`.",
    });
    expect(slack.calls.map(({ method }) => method)).toEqual(["users.info"]);
  });
});

describe("SW13 SW14: the leaderboard reply links to the same board on the web", () => {
  const siteUrl = "https://kudos-site.test";
  const board = ["🥇 <@U1> · 2 kudos", "🥈 <@U2> · 1 kudos"];

  beforeEach(() => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
    vi.stubEnv("SITE_URL", siteUrl);
  });

  async function boardOfTwoGivers(...flagKeys: string[]) {
    const t = await testBackendServing(postHog, ...["everyone-board", ...flagKeys].map(onForEveryone));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
    slack.withMember("U1").withMember("U2");
    await giveKudos(t, "U1", "U_REC", 2, 0);
    await giveKudos(t, "U2", "U_REC", 1, 1);
    return t;
  }

  test.each([
    { text: "leaderboard", below: ["▲ 2 more kudos than this time last week", `<${siteUrl}/leaderboard|See the full leaderboard on the web>`] },
    { text: "leaderboard month", below: ["▲ 2 more kudos than this time last month", `<${siteUrl}/leaderboard?period=month|See the full leaderboard on the web>`] },
    { text: "leaderboard all", below: [`<${siteUrl}/leaderboard?period=all|See the full leaderboard on the web>`] },
  ])("`/hedgehug $text` ends with a link to its period's board", async ({ text, below }) => {
    const t = await boardOfTwoGivers("website");

    const reply = await command(t, "U1", text);

    expect(reply).toEqual({ response_type: "ephemeral", text: [...board, ...below].join("\n") });
  });

  test("a SITE_URL ending in a slash keeps one slash before the route", async () => {
    vi.stubEnv("SITE_URL", `${siteUrl}/`);
    const t = await boardOfTwoGivers("website");

    const reply = await command(t, "U1", "leaderboard all");

    expect(reply.text.split("\n").at(-1)).toBe(`<${siteUrl}/leaderboard?period=all|See the full leaderboard on the web>`);
  });

  test("a period it doesn't know answers the usage, with no link", async () => {
    const t = await boardOfTwoGivers("website");

    const reply = await command(t, "U1", "leaderboard yesterday");

    expect(reply.text).toBe("Try `/hedgehug leaderboard`, `/hedgehug leaderboard month` or `/hedgehug leaderboard all`.");
  });

  const closed: Array<{ condition: string; flags: string[]; env?: Record<string, string> }> = [
    { condition: "while the website flag is off", flags: [] },
    { condition: "while SITE_URL is unset", flags: ["website"], env: { SITE_URL: "" } },
    { condition: "while the website is open for another workspace only", flags: ["website"], env: { SLACK_WORKSPACE_ID: "T_OTHER" } },
  ];

  test.each(closed)("$condition, the reply is today's, with no link", async ({ flags, env = {} }) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const t = await boardOfTwoGivers(...flags);

    const reply = await command(t, "U1", "leaderboard month");

    expect(reply).toEqual({ response_type: "ephemeral", text: [...board, "▲ 2 more kudos than this time last month"].join("\n") });
  });
});

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number, messageIndex: number) {
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  const ts = `${Math.floor(Date.now() / 1000) + messageIndex}.000100`;
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts })));
  await settle(t);
}

let messagesGiven = 0;

async function giveKudosOn(t: Backend, at: string, giver: string, kudos: number) {
  vi.setSystemTime(new Date(at));
  await giveKudos(t, giver, "U_REC", kudos, messagesGiven++);
  vi.setSystemTime(tuesday);
}

async function knownWithoutName(t: Backend, ...users: string[]) {
  for (const user of users) await t.run((ctx) => record(ctx, { workspace: "T1", user, entry: { kind: "member" }, asOf: 0 }));
}

function leaderboardCommand(t: Backend, user: string) {
  return command(t, user, "leaderboard");
}

async function command(t: Backend, user: string, text: string) {
  const body = new URLSearchParams({
    team_id: "T1",
    channel_id: "C1",
    channel_name: "general",
    user_id: user,
    command: "/hedgehug",
    text,
    response_url: "https://hooks.slack.com/commands/T1/1/abc",
    trigger_id: "1.2.3",
  }).toString();
  const response = await t.fetch("/slack/commands", await signedRequest(body, { contentType: "application/x-www-form-urlencoded" }));
  expect(response.status).toBe(200);
  const reply = await response.json();
  await settle(t);
  return reply as { response_type: string; text: string };
}
