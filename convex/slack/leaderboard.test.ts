import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import { record } from "../workspace/directory";
import { FakeSlack } from "../../testing/fakeSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { emoji, mention, messageEvent, section } from "../../testing/slackMessages";

const tuesday = new Date("2026-10-13T10:00:00Z");

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_REC");
  vi.stubGlobal("fetch", slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const nineGivers = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9"];

describe("G23: /hedgehug leaderboard", () => {
  test("G13 G16 G17: privately shows this week's Everyone board of kudos given, with medals, shared ranks and one gap above the viewer", async () => {
    const t = testBackend();
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
      ].join("\n"),
    });
    expect(slack.callsTo("conversations.join")).toEqual([]);
    expect(slack.callsTo("chat.postMessage").filter((args) => args.channel === "C1")).toEqual([]);
  });

  test("G13 G17: a member who only received kudos isn't on it, sees the top 3 and is told how to join", async () => {
    const t = testBackend();
    for (const [index, giver] of nineGivers.slice(0, 4).entries()) {
      slack.withMember(giver);
      await giveKudos(t, giver, "U_REC", 3 - index, index);
    }

    const reply = await leaderboardCommand(t, "U_REC");

    expect(reply.text).toBe(["🥇 <@U1> · 3 kudos", "🥈 <@U2> · 2 kudos", "🥉 <@U3> · 1 kudos", "Give kudos this week to join the board."].join("\n"));
  });

  test("G16: givers with equal totals list by their Slack display name, or their real name without one", async () => {
    const t = testBackend();
    slack.withMember("U_ANN", { profile: { display_name: "Zora" } }).withMember("U_BOB", { real_name: "Ava Stone", profile: { display_name: "" } });
    await giveKudos(t, "U_ANN", "U_REC", 1, 0);
    await giveKudos(t, "U_BOB", "U_REC", 1, 1);

    const reply = await leaderboardCommand(t, "U_ANN");

    expect(reply.text).toBe(["🥇 <@U_BOB> · 1 kudos", "🥇 <@U_ANN> · 1 kudos"].join("\n"));
  });

  test("G16: members the directory knew before it kept names get them from users.list, and a name it has stays", async () => {
    const t = testBackend();
    await knownWithoutName(t, "U_ANN", "U_BOB", "U_CY");
    slack.withMember("U_ANN", { profile: { display_name: "Zora" } }).withMember("U_BOB", { profile: { display_name: "Ava" } }).withMember("U_CY", { profile: { display_name: "Abe" } });
    await t.run((ctx) => record(ctx, { workspace: "T1", user: "U_CY", entry: { kind: "member", name: "Zed" }, asOf: Date.now() }));
    for (const [index, giver] of ["U_ANN", "U_BOB", "U_CY"].entries()) await giveKudos(t, giver, "U_REC", 1, index);

    await t.action(internal.slack.directory.fillMissingNames, {});

    expect((await leaderboardCommand(t, "U_ANN")).text).toBe(["🥇 <@U_BOB> · 1 kudos", "🥇 <@U_CY> · 1 kudos", "🥇 <@U_ANN> · 1 kudos"].join("\n"));
  });

  test("an award counts in the week of its giver's allowance day, in each giver's time zone", async () => {
    const mondayMorningInBerlin = new Date("2026-10-12T05:00:00Z");
    vi.setSystemTime(mondayMorningInBerlin);
    const t = testBackend();
    slack.withMember("U_LA", { tz: "America/Los_Angeles" }).withMember("U_BERLIN", { tz: "Europe/Berlin" });
    await giveKudos(t, "U_LA", "U_REC", 2, 0);
    await giveKudos(t, "U_BERLIN", "U_REC", 1, 1);

    expect((await leaderboardCommand(t, "U_BERLIN")).text).toBe("🥇 <@U_BERLIN> · 1 kudos");
    expect((await leaderboardCommand(t, "U_LA")).text).toBe("🥇 <@U_LA> · 2 kudos");
  });

  test.each(["leaderboard yesterday", "leaderboard of everyone"])("an unknown argument after leaderboard, as in `%s`, gets the usage line", async (text) => {
    const t = testBackend();

    const reply = await command(t, "U_REC", text);

    expect(reply).toEqual({
      response_type: "ephemeral",
      text: "Try `/hedgehug leaderboard`, `/hedgehug leaderboard month` or `/hedgehug leaderboard all`.",
    });
    expect(slack.calls).toEqual([]);
  });
});

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number, messageIndex: number) {
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  const ts = `${Math.floor(Date.now() / 1000) + messageIndex}.000100`;
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts })));
  await settle(t);
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
