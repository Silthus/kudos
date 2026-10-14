import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, answersWith, postHogHost, projectToken, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { everythingStored, post, settle, settleUntil, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section, slashCommand, text } from "../../testing/slackMessages";

const now = new Date("2026-10-13T10:00:00Z");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("KUDOS_ENVIRONMENT", "sandbox");
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const thanksBobAndCarol = [section(text("thanks "), mention("U_BOB"), text(" and "), mention("U_CAROL"), text(" "), emoji("taco"))];

describe("O1 O2 O3: a kudos message that gives", () => {
  test("sends kudos given on the giver and kudos received on each recipient to the batch endpoint, with exactly their properties", async () => {
    const t = testBackend();

    await post(t, thanksBobAndCarol);
    await settle(t);

    expect(new Set(postHog.requests.map((request) => `${request.apiKey} ${request.url}`))).toEqual(new Set([`${projectToken} ${postHogHost}/batch/`]));
    const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
    expect(kudosEvents().map(({ event, properties }) => ({ event, properties }))).toEqual([
      {
        event: "kudos given",
        properties: {
          ...shared,
          recipients: 2,
          kudos_per_recipient: 1,
          kudos_total: 2,
          skipped_mentions: 0,
          retry: false,
          in_thread: false,
          daily_allowance_opening: 3,
          daily_allowance_left: 1,
          default_kudos_emoji: true,
        },
      },
      { event: "kudos received", properties: { ...shared, kudos: 1, retry: false } },
      { event: "kudos received", properties: { ...shared, kudos: 1, retry: false } },
    ]);
  });

  test("O3: skipped mentions, a thread and a workspace's own kudos emoji show in kudos given", async () => {
    const t = testBackend();
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "pizza" }));

    await post(t, [section(mention("U_BOB"), mention("U_ALICE"), emoji("pizza"), emoji("pizza"))], { threadTs: "1760349000.000100" });
    await settle(t);

    expect(kudosEvents().find((event) => event.event === "kudos given")?.properties).toMatchObject({
      recipients: 1,
      kudos_per_recipient: 2,
      kudos_total: 2,
      skipped_mentions: 1,
      in_thread: true,
      default_kudos_emoji: false,
    });
  });

  test("O3: the deployment's own default kudos emoji counts as the default in kudos given", async () => {
    vi.stubEnv("KUDOS_EMOJI", "hedgehog");
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("hedgehog"))]);
    await settle(t);

    expect(kudosEvents().find((event) => event.event === "kudos given")?.properties).toMatchObject({ default_kudos_emoji: true });
  });

  test("O5: every event's timestamp is the spend instant", async () => {
    const t = testBackend();

    await post(t, thanksBobAndCarol);
    await settle(t);

    const [award] = await t.run((ctx) => ctx.db.query("awards").collect());
    expect(new Set(kudosEvents().map((event) => event.timestamp))).toEqual(new Set([new Date(award!.at).toISOString()]));
  });
});

describe("O7 O8: identity", () => {
  test("distinct_id is one analytics ID per member, never a Slack or Convex ID, and workspace_key is the same on every event", async () => {
    const t = testBackend();

    await post(t, thanksBobAndCarol, { ts: "1760349600.000100" });
    await settle(t);
    await post(t, [section(mention("U_BOB"), emoji("taco"))], { ts: "1760349601.000100" });
    await settle(t);

    const events = kudosEvents();
    const [aliceFirst, bobFirst, carol, aliceAgain, bobAgain] = events.map((event) => event.distinct_id);
    expect(events.map((event) => event.event)).toEqual(["kudos given", "kudos received", "kudos received", "kudos given", "kudos received"]);
    expect(aliceAgain).toBe(aliceFirst);
    expect(bobAgain).toBe(bobFirst);
    expect(new Set([aliceFirst, bobFirst, carol]).size).toBe(3);
    for (const id of [aliceFirst, bobFirst, carol]) expect(id).toMatch(uuid);
    const memberIds = (await t.run((ctx) => ctx.db.query("members").collect())).map((member) => member._id);
    expect(events.map((event) => event.distinct_id)).not.toEqual(expect.arrayContaining(memberIds));
    expect(new Set(events.map((event) => event.properties.workspace_key)).size).toBe(1);
    expect(new Set(events.map((event) => event.uuid)).size).toBe(events.length);
  });
});

describe("O10 F7: never sent, and the profile only on the person", () => {
  test("no PostHog request carries the message, a Slack or Convex ID, an emoji name or a time zone, and the profile rides only in $set of person events", async () => {
    const t = testBackend();
    const team = "T0QUOKKAWS";
    const channel = "C0MARMALADE";
    const people = { giver: "U0ZEPHYRINE", recipient: "U0BARNABY77" };
    slack = new FakeSlack()
      .withMember(people.giver, {
        team_id: team,
        tz: "Pacific/Chatham",
        ...({ real_name: "Zephyrine Quokkason", profile: { display_name: "zephy", email: "zephyrine@example.com", title: "Quokka Wrangler" } } as object),
      })
      .withMember(people.recipient, {
        team_id: team,
        tz: "America/St_Johns",
        ...({ real_name: "Barnaby Flintlock", profile: { display_name: "barns", email: "barnaby@example.com" } } as object),
      });
    vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: team, kudosEmoji: "artichokeparty" }));

    const fromZephyrine = { team, channel, user: people.giver, threadTs: "1760349000.737373" };
    slack.answering("conversations.join", () => Response.json({ ok: true, channel: { id: channel } }));

    await post(
      t,
      [section(text("Marmalade gratitude, Zephyrine says thanks Barnaby Flintlock for the quokka migration "), mention(people.recipient), emoji("artichokeparty"))],
      { ...fromZephyrine, ts: "1760349600.424242" },
    );
    await post(
      t,
      [section(text("Marmalade overflow for Barnaby "), mention(people.recipient), emoji("artichokeparty"), emoji("artichokeparty"), emoji("artichokeparty"))],
      { ...fromZephyrine, ts: "1760349601.515151" },
    );
    await post(t, [section(text("Marmalade note to Zephyrine herself "), mention(people.giver), emoji("artichokeparty"))], { ...fromZephyrine, ts: "1760349602.626262" });
    await settle(t);
    await t.fetch("/slack/events", await signedRequest(appHomeOpened(people.giver, { team })));
    await t.fetch(
      "/slack/commands",
      await signedRequest(slashCommand({ channel_id: channel, channel_name: "marmalade-quokkas" }, { team, user: people.giver, responseUrl: `https://hooks.slack.com/commands/${team}/1/quokka` }), {
        contentType: "application/x-www-form-urlencoded",
      }),
    );
    await settle(t);

    expect(new Set(postHog.productEvents().map((event) => event.event))).toEqual(
      new Set(["kudos given", "kudos received", "member welcomed", "attempt failed", "app home opened", "command used"]),
    );
    const profiles = postHog.personEvents().map((event) => event.properties.$set);
    expect(profiles).toEqual([
      {
        email: "zephyrine@example.com",
        name: "Zephyrine Quokkason",
        display_name: "zephy",
        title: "Quokka Wrangler",
        slack_user_id: people.giver,
        slack_team_id: team,
        is_admin: false,
        environment: "sandbox",
      },
      { email: "barnaby@example.com", name: "Barnaby Flintlock", display_name: "barns", slack_user_id: people.recipient, slack_team_id: team, is_admin: false, environment: "sandbox" },
    ]);
    const stored = await everythingStored(t);
    const neverSent = [
      "Marmalade", "artichokeparty", "Pacific/Chatham", "America/St_Johns", "Chatham", "St_Johns",
      channel, "1760349600", "424242", "515151", "626262", "737373", "Ev",
      "overflow", "herself", "hooks.slack.com", "ann", "acme", "1.2.3", "migration",
      ...stored.map((row) => row._id),
    ];
    const onThePersonOnly = ["Zephyrine", "Barnaby", "Flintlock", "quokka", "Quokka", "zephy", "barns", "Quokkason", "example.com", team, people.giver, people.recipient];
    const bodies = postHog.requests.map((request) => request.body).join("\n");
    const bodiesWithoutProfiles = postHog.requests.map((request) => withoutPersonProperties(request.body)).join("\n");
    for (const value of neverSent) expect(bodies).not.toContain(value);
    for (const value of onThePersonOnly) expect(bodiesWithoutProfiles).not.toContain(value);
    expect(bodiesWithoutProfiles).not.toMatch(/\b[UTCWB][A-Z0-9]{8,}\b/);
  });
});

describe("O4 O14: one fact, one event", () => {
  test("redelivering the Slack event sends each event once", async () => {
    const t = testBackend();
    const body = messageEvent(thanksBobAndCarol);

    await t.fetch("/slack/events", await signedRequest(body));
    await t.fetch("/slack/events", await signedRequest(body));
    await settle(t);

    expect(kudosEvents().map((event) => event.event)).toEqual(["kudos given", "kudos received", "kudos received"]);
  });
});

describe("O15: analytics never blocks the domain", () => {
  test("PostHog answering 503 changes nothing Slack sees: the same awards, indicator and reply", async () => {
    const seenWhenPostHogAnswers = async (status: number) => {
      slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
      postHog = new FakePostHog().answering(answersWith(status));
      vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
      const t = testBackend();
      const response = await post(t, thanksBobAndCarol);
      await settle(t);
      const awards = (await t.run((ctx) => ctx.db.query("awards").collect())).map(({ kudos, day, at }) => ({ kudos, day, at }));
      return { status: response.status, awards, slackCalls: slack.calls, postHogAsked: postHog.requests.length > 0 };
    };

    const whenUp = await seenWhenPostHogAnswers(200);
    const whenDown = await seenWhenPostHogAnswers(503);

    expect(whenDown).toEqual(whenUp);
    expect(whenDown.postHogAsked).toBe(true);
    expect(whenDown.slackCalls.map((call) => call.method)).toEqual(expect.arrayContaining(["reactions.add", "chat.postEphemeral"]));
  });
});

describe("O16 O17: delivery", () => {
  test("with PostHog answering 2xx, the events arrive within a minute and leave the outbox", async () => {
    const t = testBackend();

    await post(t, thanksBobAndCarol);
    await settleUntil(t, new Date(now.getTime() + 60_000));

    expect(kudosEvents()).toHaveLength(3);
    expect(await outbox(t)).toEqual([]);
  });
});

describe("O26: capture is off", () => {
  test.each([
    ["without a project token", { POSTHOG_PROJECT_TOKEN: "" }],
    ["without an environment", { KUDOS_ENVIRONMENT: "" }],
    ["with an environment that isn't sandbox or production", { KUDOS_ENVIRONMENT: "staging" }],
  ])("%s, a kudos message that gives records nothing and sends nothing", async (_, env) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const t = testBackend();

    await post(t, thanksBobAndCarol);
    await settle(t);

    expect(postHog.requests).toEqual([]);
    expect(await outbox(t)).toEqual([]);
    expect((await t.run((ctx) => ctx.db.query("awards").collect())).length).toBe(2);
  });
});

function withoutPersonProperties(body: string) {
  const parsed = JSON.parse(body) as { batch: Array<{ event: string; properties: Record<string, unknown> }> };
  for (const { properties } of parsed.batch.filter(({ event }) => event === "$identify" || event === "$set")) {
    delete properties.$set;
    delete properties.$unset;
  }
  return JSON.stringify(parsed);
}

function kudosEvents() {
  return postHog.events().filter((event) => event.event === "kudos given" || event.event === "kudos received");
}

async function outbox(t: Backend) {
  return t.run((ctx) => ctx.db.query("analyticsOutbox").collect());
}
