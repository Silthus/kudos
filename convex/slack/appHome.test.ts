import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack, httpStatus, rateLimitedFor } from "../../testing/fakeSlack";
import { flagsFromPostHog, onForEveryone, postHogDeciding } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome, publishedHomeBlocks } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";

const now = new Date("2026-10-13T10:00:00Z");

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  vi.stubGlobal("fetch", slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("R45 R46: a member opens App Home", () => {
  test("before any award it shows a full allowance, nothing given or received, and how to give", async () => {
    const t = testBackend();

    const response = await openHome(t, "U_BOB");

    expect(response.status).toBe(200);
    expect(publishedHome(slack, "U_BOB")).toEqual([
      "header: Your kudos",
      "section: You have *3* kudos left today. You get *3* more at midnight.",
      "divider",
      "section fields: *Given this week*\n*0* | *Received this week*\n*0* | *Given in total*\n*0* | *Received in total*\n*0*",
      "divider",
      "context: To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
      "context: To add me to a channel, type `/hedgehug` there.",
    ]);
  });

  test("after awards it shows what is left and the kudos given and received this week and in total", async () => {
    const t = testBackend();
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(now), ["taco", "taco"]);
    await giveKudos(t, "U_BOB", "U_CAROL", slackTs(now, 1));

    await openHome(t, "U_BOB");

    expect(allowanceIn(publishedHome(slack, "U_BOB"))).toBe("section: You have *2* kudos left today. You get *3* more at midnight.");
    expect(totalsIn(publishedHome(slack, "U_BOB"))).toBe(
      "section fields: *Given this week*\n*1* | *Received this week*\n*2* | *Given in total*\n*1* | *Received in total*\n*2*",
    );
  });

  test("with nothing left it says the member has used all their kudos for today", async () => {
    const t = testBackend();
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(now), ["taco", "taco", "taco"]);

    await openHome(t, "U_ALICE");

    expect(allowanceIn(publishedHome(slack, "U_ALICE"))).toBe("section: You've used all your kudos for today. You get *3* more at midnight.");
  });

  test("{left} turns at the member's local midnight, just as the next kudos message sees it", async () => {
    const t = testBackend();
    slack.withMember("U_ALICE", { tz: "America/Los_Angeles" });
    const beforeMidnight = new Date("2026-10-13T06:58:00Z");
    const afterMidnight = new Date("2026-10-13T07:01:00Z");
    vi.setSystemTime(beforeMidnight);
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(beforeMidnight), ["taco", "taco", "taco"]);

    await openHome(t, "U_ALICE");
    const beforeMidnightHome = allowanceIn(publishedHome(slack, "U_ALICE"));
    vi.setSystemTime(afterMidnight);
    await openHome(t, "U_ALICE");
    const afterMidnightHome = allowanceIn(publishedHome(slack, "U_ALICE"));
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(afterMidnight), ["taco", "taco", "taco"]);

    expect(beforeMidnightHome).toBe("section: You've used all your kudos for today. You get *3* more at midnight.");
    expect(afterMidnightHome).toBe("section: You have *3* kudos left today. You get *3* more at midnight.");
    expect(slack.reactionsOn("C1", slackTs(afterMidnight))).toEqual(["taco"]);
  });

  test("the week runs Monday to Sunday in the member's time zone", async () => {
    const t = testBackend();
    slack.withMember("U_BOB", { tz: "Asia/Tokyo" });
    const lastSunday = new Date("2026-10-11T12:00:00Z");
    const sundayEveningInUtc = new Date("2026-10-18T14:00:00Z");
    const mondayInTokyo = new Date("2026-10-18T16:00:00Z");
    vi.setSystemTime(lastSunday);
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(lastSunday));
    vi.setSystemTime(sundayEveningInUtc);
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(sundayEveningInUtc), ["taco", "taco"]);
    vi.setSystemTime(mondayInTokyo);

    await openHome(t, "U_ALICE");
    await openHome(t, "U_BOB");

    expect(totalsIn(publishedHome(slack, "U_ALICE"))).toBe(
      "section fields: *Given this week*\n*2* | *Received this week*\n*0* | *Given in total*\n*3* | *Received in total*\n*0*",
    );
    expect(totalsIn(publishedHome(slack, "U_BOB"))).toBe(
      "section fields: *Given this week*\n*0* | *Received this week*\n*0* | *Given in total*\n*0* | *Received in total*\n*3*",
    );
  });

  test("it names the workspace emoji and base in force", async () => {
    const t = testBackend();
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "pizza", baseAllowance: 5 }));

    await openHome(t, "U_BOB");

    expect(allowanceIn(publishedHome(slack, "U_BOB"))).toBe("section: You have *5* kudos left today. You get *5* more at midnight.");
    expect(publishedHome(slack, "U_BOB")).toContain(
      "context: To give kudos, mention a teammate and add :pizza: to your message. Each :pizza: gives everyone you mention 1 kudos.",
    );
  });
});

describe("R47: someone who isn't a member opens App Home", () => {
  test.each([
    ["a deactivated person", "U_GONE", { deleted: true }],
    ["a person from another workspace", "U_GUEST", { team_id: "T_OTHER" }],
    ["a bot", "U_HELPER", { is_bot: true }],
  ])("%s sees the members-only line", async (_, user, profile) => {
    const t = testBackend();
    slack.withMember(user, profile);

    await openHome(t, user);

    expect(publishedHome(slack, user)).toEqual(["header: HedgeHug", "section: HedgeHug is for active members of this workspace."]);
  });
});

describe("WS28: App Home links to the website while it is open", () => {
  const siteUrl = "https://kudos-site.test";
  const websiteLink = "section: <https://kudos-site.test/|Open HedgeHug on the web>";
  const homeWithoutLink = [
    "header: Your kudos",
    "section: You have *3* kudos left today. You get *3* more at midnight.",
    "divider",
    "section fields: *Given this week*\n*0* | *Received this week*\n*0* | *Given in total*\n*0* | *Received in total*\n*0*",
    "divider",
    "context: To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
    "context: To add me to a channel, type `/hedgehug` there.",
  ];
  let postHog: FakePostHog;

  beforeEach(() => {
    postHog = postHogDeciding();
    vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
    vi.stubEnv("SITE_URL", siteUrl);
    vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  });

  function websiteButtonsOf(user: string) {
    return publishedHomeBlocks(slack, user)
      .filter((block) => block.type === "actions")
      .flatMap((block) => block.elements as Array<{ text: { text: string }; url?: string }>)
      .flatMap(({ text, url }) => (url === undefined ? [] : [{ label: text.text, url }]));
  }

  async function backendWithWebsite(...flagKeys: string[]) {
    const t = testBackend();
    await flagsFromPostHog(t, postHog, ...flagKeys.map(onForEveryone));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
    return t;
  }

  test("while the website flag is on and SITE_URL is set, a member's Home is the front door, its button opening the site's root and carrying no identity", async () => {
    const t = await backendWithWebsite("website");

    await openHome(t, "U_BOB");

    expect(publishedHome(slack, "U_BOB")).toEqual([
      "header: Your kudos",
      "section: You have *3* kudos left today. You get *3* more at midnight.",
      "divider",
      "actions: Open HedgeHug",
      "divider",
      "context: To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
      "context: To add me to a channel, type `/hedgehug` there.",
    ]);
    expect(websiteButtonsOf("U_BOB")).toEqual([{ label: "Open HedgeHug", url: `${siteUrl}/` }]);
  });

  test("with the Everyone board, Profile's buttons and the Settings tab's closing link lead to the site, the tab App Home reopens on included", async () => {
    const t = await backendWithWebsite("website", "everyone-board");
    await openHome(t, "U_BOB");
    const profileTab = publishedHome(slack, "U_BOB");
    const profileButtons = websiteButtonsOf("U_BOB");

    await click(t, "U_BOB", "Settings");
    const settingsTab = publishedHome(slack, "U_BOB");
    await openHome(t, "U_BOB");
    const reopened = publishedHome(slack, "U_BOB");

    expect(profileTab.slice(0, 2)).toEqual(["actions: [Profile] | Settings", "header: Your kudos"]);
    expect(profileButtons).toEqual([
      { label: "Open HedgeHug", url: `${siteUrl}/` },
      { label: "Leaderboard", url: `${siteUrl}/leaderboard` },
    ]);
    expect([settingsTab, reopened].map((home) => [home[1], home.slice(-2)])).toEqual([
      ["header: Settings", ["divider", websiteLink]],
      ["header: Settings", ["divider", websiteLink]],
    ]);
    expect(reopened.filter((line) => line === websiteLink)).toHaveLength(1);
  });

  test("a SITE_URL ending in a slash still links to one root", async () => {
    vi.stubEnv("SITE_URL", `${siteUrl}/`);
    const t = await backendWithWebsite("website");

    await openHome(t, "U_BOB");

    expect(websiteButtonsOf("U_BOB")).toEqual([{ label: "Open HedgeHug", url: `${siteUrl}/` }]);
  });

  const closed: Array<{ condition: string; flags: string[]; env?: Record<string, string> }> = [
    { condition: "while PostHog has no website flag", flags: ["another-flag"] },
    { condition: "while SITE_URL is unset", flags: ["website"], env: { SITE_URL: "" } },
    { condition: "while the website is open for another workspace only", flags: ["website"], env: { SLACK_WORKSPACE_ID: "T_OTHER" } },
  ];

  test.each(closed)("$condition, a member's Home is unchanged", async ({ flags, env = {} }) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const t = await backendWithWebsite(...flags);

    await openHome(t, "U_BOB");

    expect(publishedHome(slack, "U_BOB")).toEqual(homeWithoutLink);
  });

  test("someone who isn't a member sees only the members-only line", async () => {
    slack.withMember("U_GONE", { deleted: true });
    const t = await backendWithWebsite("website");

    await openHome(t, "U_GONE");

    expect(publishedHome(slack, "U_GONE")).toEqual(["header: HedgeHug", "section: HedgeHug is for active members of this workspace."]);
  });
});

test("R49: a redelivered App Home event is acknowledged and publishes once", async () => {
  const t = testBackend();
  const opened = appHomeOpened("U_BOB");

  const first = await t.fetch("/slack/events", await signedRequest(opened));
  const redelivered = await t.fetch("/slack/events", await signedRequest(opened));
  await settle(t);

  expect([first.status, redelivered.status]).toEqual([200, 200]);
  expect(slack.callsTo("views.publish")).toHaveLength(1);
});

describe("R45: publishing App Home through Slack's failures", () => {
  test("a rate-limited publish is tried again after Slack's Retry-After", async () => {
    const t = testBackend();
    slack.answering("views.publish", rateLimitedFor(30));

    await openHome(t, "U_BOB");

    const [rateLimitedAt, publishedAt] = slack.timesOf("views.publish");
    expect(publishedAt! - rateLimitedAt!).toBeGreaterThanOrEqual(30_000);
    expect(publishedHome(slack, "U_BOB")[0]).toBe("header: Your kudos");
  });

  test("a person whose lookup fails is looked up again, then sees their Home", async () => {
    const t = testBackend();
    slack.answering("users.info", httpStatus(500));

    await openHome(t, "U_BOB");

    expect(slack.callsTo("users.info")).toHaveLength(2);
    expect(publishedHome(slack, "U_BOB")[0]).toBe("header: Your kudos");
  });

  test("a rate-limited lookup is tried again after Slack's Retry-After", async () => {
    const t = testBackend();
    slack.answering("users.info", rateLimitedFor(30));

    await openHome(t, "U_BOB");

    const [rateLimitedAt, lookedUpAt] = slack.timesOf("users.info");
    expect(lookedUpAt! - rateLimitedAt!).toBeGreaterThanOrEqual(30_000);
    expect(publishedHome(slack, "U_BOB")[0]).toBe("header: Your kudos");
  });

  test("a publish that keeps failing is tried 3 times and never again", async () => {
    const t = testBackend();
    slack.answering("views.publish", httpStatus(500), httpStatus(500), httpStatus(500), httpStatus(500));

    await openHome(t, "U_BOB");

    expect(slack.callsTo("views.publish")).toHaveLength(3);
  });
});

test("opening the app's Messages tab publishes nothing", async () => {
  const t = testBackend();

  const response = await openHome(t, "U_BOB", { tab: "messages" });

  expect(response.status).toBe(200);
  expect(slack.calls).toEqual([]);
});

async function openHome(t: Backend, user: string, options: Parameters<typeof appHomeOpened>[1] = {}) {
  const response = await t.fetch("/slack/events", await signedRequest(appHomeOpened(user, options)));
  await settle(t);
  return response;
}

async function click(t: Backend, user: string, label: string) {
  const body = blockActions(user, buttonInHome(slack, user, label));
  await t.fetch("/slack/interactivity", await signedRequest(body, { contentType: "application/x-www-form-urlencoded" }));
  await settle(t);
}

async function giveKudos(t: Backend, giver: string, recipient: string, ts: string, kudosEmoji = ["taco"]) {
  const blocks = [section(mention(recipient), ...kudosEmoji.map((name) => emoji(name)))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts })));
  await settle(t);
}

function allowanceIn(home: string[]) {
  return home.find((line) => line.startsWith("section: You"));
}

function totalsIn(home: string[]) {
  return home.find((line) => line.startsWith("section fields: *Given this week*"));
}

function slackTs(at: Date, secondsLater = 0) {
  return `${Math.floor(at.getTime() / 1000) + secondsLater}.000100`;
}
