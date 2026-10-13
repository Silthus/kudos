import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { blockActions, buttonIn, publishedHome, publishedHomeBlocks } from "../../testing/slackInteractions";
import { everythingStored, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";

const tuesday = new Date("2026-10-13T10:00:00Z");

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack()
    .withMember("U_REC")
    .withMember("U_ANN", { profile: { display_name: "Ann" } })
    .withMember("U_BOB", { profile: { display_name: "Bob" } })
    .withMember("U_CY", { profile: { display_name: "Cy" } });
  vi.stubGlobal("fetch", slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const tabBar = (selected: "Profile" | "Leaderboard" | "Settings") =>
  `actions: ${["Profile", "Leaderboard", "Settings"].map((tab) => (tab === selected ? `[${tab}]` : tab)).join(" | ")}`;

const periodButtons = (selected: "This week" | "This month" | "All time") =>
  `actions: ${["This week", "This month", "All time"].map((period) => (period === selected ? `[${period}]` : period)).join(" | ")}`;

describe("G23 G24: the Leaderboard tab", () => {
  test("App Home opens on the Profile tab, with the tab bar above it", async () => {
    const t = testBackend();

    await openHome(t, "U_CY");

    expect(publishedHome(slack, "U_CY").slice(0, 2)).toEqual([tabBar("Profile"), "header: Your kudos"]);
  });

  test("clicking Leaderboard shows this week's Everyone board, and each period button republishes the tab for that period", async () => {
    const t = testBackend();
    await everyoneGives(t);
    await openHome(t, "U_CY");

    await click(t, "U_CY", "Leaderboard");
    const thisWeek = publishedHome(slack, "U_CY");
    await click(t, "U_CY", "This month");
    const thisMonth = publishedHome(slack, "U_CY");
    await click(t, "U_CY", "All time");
    const allTime = publishedHome(slack, "U_CY");

    expect(thisWeek).toEqual([
      tabBar("Leaderboard"),
      "header: Leaderboard",
      periodButtons("This week"),
      `section: ${["🥇 <@U_ANN> · 3 kudos", "🥈 <@U_BOB> · 2 kudos", "🥉 <@U_CY> · 1 kudos", "▲ 1 more kudos than this time last week"].join("\n")}`,
    ]);
    expect(thisMonth).toEqual([
      tabBar("Leaderboard"),
      "header: Leaderboard",
      periodButtons("This month"),
      `section: ${["🥇 <@U_CY> · 4 kudos", "🥈 <@U_ANN> · 3 kudos", "🥉 <@U_BOB> · 2 kudos", "▲ 4 more kudos than this time last month"].join("\n")}`,
    ]);
    expect(allTime).toEqual([
      tabBar("Leaderboard"),
      "header: Leaderboard",
      periodButtons("All time"),
      `section: ${["🥇 <@U_CY> · 4 kudos", "🥈 <@U_ANN> · 3 kudos", "🥉 <@U_BOB> · 2 kudos"].join("\n")}`,
    ]);
  });

  test.each([
    { button: "This week", text: "leaderboard" },
    { button: "This month", text: "leaderboard month" },
    { button: "All time", text: "leaderboard all" },
  ])("$button in the tab shows the same rows as `/hedgehug $text`", async ({ button, text }) => {
    const t = testBackend();
    await everyoneGives(t);
    await openHome(t, "U_BOB");
    await click(t, "U_BOB", "Leaderboard");

    await click(t, "U_BOB", button);

    expect(publishedHome(slack, "U_BOB").at(-1)).toBe(`section: ${(await command(t, "U_BOB", text)).text}`);
  });

  test("App Home remembers the tab and period, so opening it again shows the same view from the current totals", async () => {
    const t = testBackend();
    await everyoneGives(t);
    await openHome(t, "U_BOB");
    await click(t, "U_BOB", "Leaderboard");
    await click(t, "U_BOB", "This month");

    await giveKudos(t, "U_BOB", 1);
    await openHome(t, "U_BOB");

    expect(publishedHome(slack, "U_BOB").slice(2)).toEqual([
      periodButtons("This month"),
      `section: ${["🥇 <@U_CY> · 4 kudos", "🥈 <@U_ANN> · 3 kudos", "🥈 <@U_BOB> · 3 kudos", "▲ 3 more kudos than this time last month"].join("\n")}`,
    ]);
  });

  test("giving kudos never publishes App Home: the board is read when it is viewed", async () => {
    const t = testBackend();
    await openHome(t, "U_ANN");
    await click(t, "U_ANN", "Leaderboard");
    const publishes = slack.callsTo("views.publish").length;

    await everyoneGives(t);

    expect(slack.callsTo("views.publish")).toHaveLength(publishes);
  });

  test("the Profile tab button brings the member's kudos back", async () => {
    const t = testBackend();
    await openHome(t, "U_ANN");
    await click(t, "U_ANN", "Leaderboard");

    await click(t, "U_ANN", "Profile");

    expect(publishedHome(slack, "U_ANN").slice(0, 3)).toEqual([
      tabBar("Profile"),
      "header: Your kudos",
      "section: You have *3* kudos left today. You get *3* more at midnight.",
    ]);
  });
});

describe("G22: the Settings tab's leaderboard switch", () => {
  test("the Settings tab shows `Show me on the leaderboards`, on by default", async () => {
    const t = testBackend();
    await openHome(t, "U_ANN");

    await click(t, "U_ANN", "Settings");

    expect(publishedHome(slack, "U_ANN")).toEqual([
      tabBar("Settings"),
      "header: Settings",
      "section: *Show me on the leaderboards*",
      "actions: [On] | Off",
      "context: When it's off, nobody sees you on the leaderboards, you included.",
    ]);
  });

});

describe("G22: a member who left the boards is on nobody's board, their own included", () => {
  test("turned off, the member leaves every viewer's board for every period, and sees why in place of their rows", async () => {
    const t = testBackend();
    await everyoneGives(t);
    await openHome(t, "U_ANN");
    await click(t, "U_ANN", "Settings");

    await click(t, "U_ANN", "Off");

    expect(publishedHome(slack, "U_ANN").slice(2, 4)).toEqual(["section: *Show me on the leaderboards*", "actions: On | [Off]"]);
    expect((await command(t, "U_BOB", "leaderboard")).text).toBe(
      ["🥇 <@U_BOB> · 2 kudos", "🥈 <@U_CY> · 1 kudos", "▲ 2 more kudos than this time last week"].join("\n"),
    );
    expect((await command(t, "U_BOB", "leaderboard month")).text).toBe(
      ["🥇 <@U_CY> · 4 kudos", "🥈 <@U_BOB> · 2 kudos", "▲ 2 more kudos than this time last month"].join("\n"),
    );
    expect((await command(t, "U_BOB", "leaderboard all")).text).toBe(["🥇 <@U_CY> · 4 kudos", "🥈 <@U_BOB> · 2 kudos"].join("\n"));
    expect((await command(t, "U_ANN", "leaderboard")).text).toBe(
      ["🥇 <@U_BOB> · 2 kudos", "🥈 <@U_CY> · 1 kudos", "You're not on the leaderboards. You can change that in Settings.", "▲ 3 more kudos than this time last week"].join("\n"),
    );
    expect((await command(t, "U_ANN", "leaderboard all")).text).toBe(
      ["🥇 <@U_CY> · 4 kudos", "🥈 <@U_BOB> · 2 kudos", "You're not on the leaderboards. You can change that in Settings."].join("\n"),
    );
    await click(t, "U_ANN", "Leaderboard");
    expect(publishedHome(slack, "U_ANN").at(-1)).toBe(`section: ${(await command(t, "U_ANN", "leaderboard")).text}`);
  });

  test("a member who left keeps their gain line, without the places they climbed", async () => {
    const t = testBackend();
    await giveKudosOn(t, "2026-10-06T10:00:00Z", "U_BOB", 2);
    await giveKudosOn(t, "2026-10-06T10:00:00Z", "U_ANN", 1);
    await giveKudos(t, "U_BOB", 1);
    await giveKudos(t, "U_ANN", 3);
    expect((await command(t, "U_ANN", "leaderboard")).text).toContain("▲ 2 more kudos than this time last week · ▲ 1 places");
    await openHome(t, "U_ANN");
    await click(t, "U_ANN", "Settings");

    await click(t, "U_ANN", "Off");

    expect((await command(t, "U_ANN", "leaderboard")).text).toBe(
      ["🥇 <@U_BOB> · 1 kudos", "You're not on the leaderboards. You can change that in Settings.", "▲ 2 more kudos than this time last week"].join("\n"),
    );
  });

});

describe("G22: rejoining the boards, and repeating a click", () => {
  test("turned on again, the member is back on the boards", async () => {
    const t = testBackend();
    await everyoneGives(t);
    const before = await command(t, "U_BOB", "leaderboard all");
    await openHome(t, "U_ANN");
    await click(t, "U_ANN", "Settings");
    await click(t, "U_ANN", "Off");

    await click(t, "U_ANN", "On");

    expect(publishedHome(slack, "U_ANN").slice(2, 4)).toEqual(["section: *Show me on the leaderboards*", "actions: [On] | Off"]);
    expect(await command(t, "U_BOB", "leaderboard all")).toEqual(before);
  });

  test("repeating a click changes nothing", async () => {
    const t = testBackend();
    await everyoneGives(t);
    await openHome(t, "U_ANN");
    await click(t, "U_ANN", "Settings");
    const offButton = buttonIn(publishedHomeBlocks(slack, "U_ANN"), "Off");
    await interact(t, blockActions("U_ANN", offButton));
    const once = { stored: await everythingStored(t), home: publishedHome(slack, "U_ANN"), board: await command(t, "U_BOB", "leaderboard") };

    await interact(t, blockActions("U_ANN", offButton));

    expect({ stored: await everythingStored(t), home: publishedHome(slack, "U_ANN"), board: await command(t, "U_BOB", "leaderboard") }).toEqual(once);
  });
});

describe("R48: a click Slack did not sign gets 401 and does nothing", () => {
  test.each([
    ["an unsigned click", async (body: string) => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body })],
    ["a click signed with another secret", (body: string) => signedRequest(body, { secret: "not-the-secret", contentType: "application/x-www-form-urlencoded" })],
    ["a click signed more than 5 minutes ago", (body: string) => signedRequest(body, { signedAt: new Date(tuesday.getTime() - 6 * 60_000), contentType: "application/x-www-form-urlencoded" })],
  ])("%s gets 401 and does nothing", async (_, request) => {
    const t = testBackend();
    await openHome(t, "U_ANN");
    const leaderboard = blockActions("U_ANN", buttonIn(publishedHomeBlocks(slack, "U_ANN"), "Leaderboard"));
    const stored = await everythingStored(t);
    const calls = slack.calls.length;

    const response = await t.fetch("/slack/interactivity", await request(leaderboard));
    await settle(t);

    expect(response.status).toBe(401);
    expect(await everythingStored(t)).toEqual(stored);
    expect(slack.calls).toHaveLength(calls);
  });

});

describe("handling a click", () => {
  test("a click is acknowledged before App Home is published again", async () => {
    const t = testBackend();
    await openHome(t, "U_ANN");
    const publishes = slack.callsTo("views.publish").length;

    const response = await t.fetch("/slack/interactivity", await signed(blockActions("U_ANN", buttonIn(publishedHomeBlocks(slack, "U_ANN"), "Leaderboard"))));

    expect(response.status).toBe(200);
    expect(slack.callsTo("views.publish")).toHaveLength(publishes);
    await settle(t);
    expect(slack.callsTo("views.publish")).toHaveLength(publishes + 1);
  });

  test("a click from someone who isn't a member changes nothing and publishes nothing", async () => {
    const t = testBackend();
    slack.withMember("U_GONE", { deleted: true });
    await openHome(t, "U_ANN");
    await openHome(t, "U_GONE");
    const leaderboard = buttonIn(publishedHomeBlocks(slack, "U_ANN"), "Leaderboard");
    const stored = await everythingStored(t);
    const publishes = slack.callsTo("views.publish").length;

    await interact(t, blockActions("U_GONE", leaderboard));

    expect(await everythingStored(t)).toEqual(stored);
    expect(slack.callsTo("views.publish")).toHaveLength(publishes);
  });
});

async function everyoneGives(t: Backend) {
  await giveKudosOn(t, "2026-10-02T10:00:00Z", "U_CY", 3);
  await giveKudos(t, "U_ANN", 3);
  await giveKudos(t, "U_BOB", 2);
  await giveKudos(t, "U_CY", 1);
}

let messagesGiven = 0;

async function giveKudos(t: Backend, giver: string, kudos: number) {
  const blocks = [section(mention("U_REC"), ...Array.from({ length: kudos }, () => emoji("taco")))];
  const ts = `${Math.floor(Date.now() / 1000) + messagesGiven++}.000100`;
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts })));
  await settle(t);
}

async function giveKudosOn(t: Backend, at: string, giver: string, kudos: number) {
  vi.setSystemTime(new Date(at));
  await giveKudos(t, giver, kudos);
  vi.setSystemTime(tuesday);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, label: string) {
  await interact(t, blockActions(user, buttonIn(publishedHomeBlocks(slack, user), label)));
}

async function interact(t: Backend, body: string) {
  const response = await t.fetch("/slack/interactivity", await signed(body));
  expect(response.status).toBe(200);
  await settle(t);
}

function signed(body: string) {
  return signedRequest(body, { contentType: "application/x-www-form-urlencoded" });
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
  const response = await t.fetch("/slack/commands", await signed(body));
  expect(response.status).toBe(200);
  return (await response.json()) as { response_type: string; text: string };
}
