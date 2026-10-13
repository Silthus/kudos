import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import schema from "../schema";
import { modules } from "../test.setup";

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
    expect(publishedHome("U_BOB")).toEqual([
      "header: Your kudos",
      "section: You have *3* kudos left today. You get *3* more at midnight.",
      "divider",
      "fields: *Given this week*\n*0* | *Received this week*\n*0* | *Given in total*\n*0* | *Received in total*\n*0*",
      "divider",
      "context: To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
      "context: To add me to a channel, type `/kudos` there.",
    ]);
  });

  test("after awards it shows what is left and the kudos given and received this week and in total", async () => {
    const t = testBackend();
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(now), ["taco", "taco"]);
    await giveKudos(t, "U_BOB", "U_CAROL", slackTs(now, 1));

    await openHome(t, "U_BOB");

    expect(allowanceIn(publishedHome("U_BOB"))).toBe("section: You have *2* kudos left today. You get *3* more at midnight.");
    expect(totalsIn(publishedHome("U_BOB"))).toBe(
      "fields: *Given this week*\n*1* | *Received this week*\n*2* | *Given in total*\n*1* | *Received in total*\n*2*",
    );
  });

  test("with nothing left it says the member has used all their kudos for today", async () => {
    const t = testBackend();
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(now), ["taco", "taco", "taco"]);

    await openHome(t, "U_ALICE");

    expect(allowanceIn(publishedHome("U_ALICE"))).toBe("section: You've used all your kudos for today. You get *3* more at midnight.");
  });

  test("{left} turns at the member's local midnight, just as the next kudos message sees it", async () => {
    const t = testBackend();
    slack.withMember("U_ALICE", { tz: "America/Los_Angeles" });
    const beforeMidnight = new Date("2026-10-13T06:58:00Z");
    const afterMidnight = new Date("2026-10-13T07:01:00Z");
    vi.setSystemTime(beforeMidnight);
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(beforeMidnight), ["taco", "taco", "taco"]);

    await openHome(t, "U_ALICE");
    const beforeMidnightHome = allowanceIn(publishedHome("U_ALICE"));
    vi.setSystemTime(afterMidnight);
    await openHome(t, "U_ALICE");
    const afterMidnightHome = allowanceIn(publishedHome("U_ALICE"));
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

    expect(totalsIn(publishedHome("U_ALICE"))).toBe(
      "fields: *Given this week*\n*2* | *Received this week*\n*0* | *Given in total*\n*3* | *Received in total*\n*0*",
    );
    expect(totalsIn(publishedHome("U_BOB"))).toBe(
      "fields: *Given this week*\n*0* | *Received this week*\n*0* | *Given in total*\n*0* | *Received in total*\n*3*",
    );
  });

  test("it names the workspace emoji and base in force", async () => {
    const t = testBackend();
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "pizza", baseAllowance: 5 }));

    await openHome(t, "U_BOB");

    expect(allowanceIn(publishedHome("U_BOB"))).toBe("section: You have *5* kudos left today. You get *5* more at midnight.");
    expect(publishedHome("U_BOB")).toContain(
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

    expect(publishedHome(user)).toEqual(["header: Kudos", "section: Kudos is for active members of this workspace."]);
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

test("opening the app's Messages tab publishes nothing", async () => {
  const t = testBackend();

  const response = await openHome(t, "U_BOB", { tab: "messages" });

  expect(response.status).toBe(200);
  expect(slack.calls).toEqual([]);
});

type Backend = ReturnType<typeof testBackend>;

function testBackend() {
  return convexTest(schema, modules);
}

async function openHome(t: Backend, user: string, options: Parameters<typeof appHomeOpened>[1] = {}) {
  const response = await t.fetch("/slack/events", await signedRequest(appHomeOpened(user, options)));
  await settle(t);
  return response;
}

async function giveKudos(t: Backend, giver: string, recipient: string, ts: string, kudosEmoji = ["taco"]) {
  const blocks = [section(mention(recipient), ...kudosEmoji.map((name) => emoji(name)))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts })));
  await settle(t);
}

async function settle(t: Backend) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

type TextObject = { type: string; text: string };
type Block = { type: string; text?: TextObject; fields?: TextObject[]; elements?: TextObject[] };
type HomeView = { type: string; blocks: Block[] };

function publishedHome(user: string) {
  const published = slack.callsTo("views.publish").filter((args) => args.user_id === user);
  const view = published.at(-1)?.view as unknown as HomeView | undefined;
  expect(view?.type).toBe("home");
  return (view?.blocks ?? []).map(readBlock);
}

function readBlock(block: Block) {
  if (block.type === "divider") return "divider";
  if (block.type === "header") return `header: ${plainText(block.text)}`;
  if (block.type === "context") return `context: ${block.elements?.map(mrkdwn).join(" ")}`;
  if (block.fields) return `fields: ${block.fields.map(mrkdwn).join(" | ")}`;
  return `${block.type}: ${mrkdwn(block.text)}`;
}

function plainText(text: TextObject | undefined) {
  expect(text?.type).toBe("plain_text");
  return text?.text;
}

function mrkdwn(text: TextObject | undefined) {
  expect(text?.type).toBe("mrkdwn");
  return text?.text;
}

function allowanceIn(home: string[]) {
  return home[1];
}

function totalsIn(home: string[]) {
  return home.find((line) => line.startsWith("fields: "));
}

function slackTs(at: Date, secondsLater = 0) {
  return `${Math.floor(at.getTime() / 1000) + secondsLater}.000100`;
}
