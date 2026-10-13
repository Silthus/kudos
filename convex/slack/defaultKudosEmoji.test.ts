import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { kudosReceived, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { appHomeOpened, emoji, mention, section } from "../../testing/slackMessages";

const now = new Date("2026-10-13T10:00:00Z");
const postedTs = "1760349600.000100";

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  vi.stubGlobal("fetch", slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the deployment's default kudos emoji", () => {
  test("without KUDOS_EMOJI, :taco: gives kudos and is the reaction", async () => {
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("taco"))]);
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(slack.reactionsOn("C1", postedTs)).toEqual(["taco"]);
  });

  test.each(["hedgehog", ":hedgehog:"])("with KUDOS_EMOJI=%s, :hedgehog: gives kudos and is the reaction", async (setting) => {
    vi.stubEnv("KUDOS_EMOJI", setting);
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("hedgehog"))]);
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(slack.reactionsOn("C1", postedTs)).toEqual(["hedgehog"]);
  });

  test("with KUDOS_EMOJI set, :taco: is ordinary chat", async () => {
    vi.stubEnv("KUDOS_EMOJI", "hedgehog");
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("taco"))]);
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(0);
    expect(slack.callsTo("reactions.add")).toEqual([]);
  });

  test("with KUDOS_EMOJI set, the welcome message names it", async () => {
    vi.stubEnv("KUDOS_EMOJI", "hedgehog");
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("hedgehog"))]);
    await settle(t);

    const welcomes = slack.callsTo("chat.postMessage").map((args) => String(args.text));
    expect(welcomes).toHaveLength(2);
    for (const welcome of welcomes) {
      expect(welcome).toContain("adding :hedgehog: to your message");
      expect(welcome).not.toContain(":taco:");
    }
  });

  test("with KUDOS_EMOJI set, App Home names it", async () => {
    vi.stubEnv("KUDOS_EMOJI", "hedgehog");
    const t = testBackend();

    await openHome(t, "U_BOB");

    const home = JSON.stringify(slack.callsTo("views.publish").at(-1)?.view);
    expect(home).toContain("add :hedgehog: to your message. Each :hedgehog: gives everyone you mention 1 kudos.");
    expect(home).not.toContain(":taco:");
  });

  test("a workspace's own emoji still wins over KUDOS_EMOJI", async () => {
    vi.stubEnv("KUDOS_EMOJI", "hedgehog");
    const t = testBackend();
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "pizza" }));

    await post(t, [section(mention("U_BOB"), emoji("pizza"))]);
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(slack.reactionsOn("C1", postedTs)).toEqual(["pizza"]);
  });
});

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}
