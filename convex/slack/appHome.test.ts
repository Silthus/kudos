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
      "You have 3 kudos left today. You get 3 more at midnight.",
      "This week you've given 0 kudos and received 0. In total you've given 0 and received 0.",
      "To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
      "To add me to a channel, type `/kudos` there.",
    ]);
  });

  test("after awards it shows what is left and the kudos given and received this week and in total", async () => {
    const t = testBackend();
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(now), ["taco", "taco"]);
    await giveKudos(t, "U_BOB", "U_CAROL", slackTs(now, 1));

    await openHome(t, "U_BOB");

    expect(publishedHome("U_BOB")?.slice(0, 2)).toEqual([
      "You have 2 kudos left today. You get 3 more at midnight.",
      "This week you've given 1 kudos and received 2. In total you've given 1 and received 2.",
    ]);
  });

  test("with nothing left it says the member has used all their kudos for today", async () => {
    const t = testBackend();
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(now), ["taco", "taco", "taco"]);

    await openHome(t, "U_ALICE");

    expect(publishedHome("U_ALICE")?.[0]).toBe("You've used all your kudos for today. You get 3 more at midnight.");
  });

  test("{left} turns at the member's local midnight, just as the next kudos message sees it", async () => {
    const t = testBackend();
    slack.withMember("U_ALICE", { tz: "America/Los_Angeles" });
    const beforeMidnight = new Date("2026-10-13T06:58:00Z");
    const afterMidnight = new Date("2026-10-13T07:01:00Z");
    vi.setSystemTime(beforeMidnight);
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(beforeMidnight), ["taco", "taco", "taco"]);

    await openHome(t, "U_ALICE");
    const beforeMidnightHome = publishedHome("U_ALICE")?.[0];
    vi.setSystemTime(afterMidnight);
    await openHome(t, "U_ALICE");
    const afterMidnightHome = publishedHome("U_ALICE")?.[0];
    await giveKudos(t, "U_ALICE", "U_BOB", slackTs(afterMidnight), ["taco", "taco", "taco"]);

    expect(beforeMidnightHome).toBe("You've used all your kudos for today. You get 3 more at midnight.");
    expect(afterMidnightHome).toBe("You have 3 kudos left today. You get 3 more at midnight.");
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

    expect(publishedHome("U_ALICE")?.[1]).toBe("This week you've given 2 kudos and received 0. In total you've given 3 and received 0.");
    expect(publishedHome("U_BOB")?.[1]).toBe("This week you've given 0 kudos and received 0. In total you've given 0 and received 3.");
  });

  test("it names the workspace emoji and base in force", async () => {
    const t = testBackend();
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "pizza", baseAllowance: 5 }));

    await openHome(t, "U_BOB");

    expect(publishedHome("U_BOB")).toEqual([
      "You have 5 kudos left today. You get 5 more at midnight.",
      "This week you've given 0 kudos and received 0. In total you've given 0 and received 0.",
      "To give kudos, mention a teammate and add :pizza: to your message. Each :pizza: gives everyone you mention 1 kudos.",
      "To add me to a channel, type `/kudos` there.",
    ]);
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

    expect(publishedHome(user)).toEqual(["Kudos is for active members of this workspace."]);
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

type HomeView = { type: string; blocks: Array<{ type: string; text: { type: string; text: string } }> };

function publishedHome(user: string) {
  const published = slack.callsTo("views.publish").filter((args) => args.user_id === user);
  const view = published.at(-1)?.view as unknown as HomeView | undefined;
  expect(view?.type).toBe("home");
  return view?.blocks.map((block) => block.text.text);
}

function slackTs(at: Date, secondsLater = 0) {
  return `${Math.floor(at.getTime() / 1000) + secondsLater}.000100`;
}
