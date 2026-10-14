import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, answersWith, flagsKey, postHogHost, projectToken, routedFetch, withoutPersonProperties } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, buttonIn, buttonInHome, type Block } from "../../testing/slackInteractions";
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
          thoughtful: false,
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

describe("E3: kudos given says whether the giver said why", () => {
  test.each([
    ["five words besides mentions and emoji", true, [section(text("thanks for the great fix "), mention("U_BOB"), emoji("taco"))]],
    ["fewer than five words", false, [section(text("thanks for the fix "), mention("U_BOB"), emoji("taco"))]],
  ])("%s sends thoughtful %s", async (_, thoughtful, blocks) => {
    const t = testBackend();

    await post(t, blocks);
    await settle(t);

    expect(kudosGivenProperties()).toMatchObject({ thoughtful });
  });

  test("a message stored without a gate decision before the gate shipped, given after it, sends thoughtful false", async () => {
    slack = new FakeSlack().withMember("U_ALICE");
    vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
    const t = testBackend();
    await post(t, [section(text("thanks for covering my on-call shift "), mention("U_DANA"), emoji("taco"))]);
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("kudosMessages").collect()) await ctx.db.patch(row._id, { annotations: {} });
    });
    slack.withMember("U_DANA");

    await settle(t);

    expect(kudosGivenProperties()).toMatchObject({ thoughtful: false });
  });

  test("O10: only the boolean leaves the deployment, never the word count the gate read", async () => {
    const t = testBackend();

    await post(t, [section(text("thanks for untangling the thirteen flaky deploy checks before the Friday release "), mention("U_BOB"), emoji("taco"))]);
    await settle(t);

    const [decision] = await t.run(async (ctx) => (await ctx.db.query("kudosMessages").collect()).map((row) => row.annotations.gate));
    expect(decision).toEqual({ version: 1, thoughtful: true, words: 12 });
    expect(kudosGivenProperties()).toMatchObject({ thoughtful: true });
    expect(Object.values(kudosGivenProperties())).not.toContain(12);
    const bodies = postHog.requests.map((request) => request.body).join("\n");
    expect(bodies).not.toMatch(/"(words|gate|version)"/);
    for (const word of ["untangling", "thirteen", "flaky", "deploy", "Friday", "release"]) expect(bodies).not.toContain(word);
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
    const team = "T0QUOKKAWS";
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", flagsKey);
    const t = await unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(testBackend(), postHog, ...["xp-levels", "unlocks", "quests"].map(onForEveryone)), team);
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
      [section(text("Marmalade gratitude, Zephyrine says thanks Barnaby Flintlock for the quokka migration "), mention(people.recipient), emoji("artichokeparty"), emoji("artichokeparty"))],
      { ...fromZephyrine, ts: "1760349600.424242" },
    );
    await post(
      t,
      [section(text("Marmalade overflow for Barnaby "), mention(people.recipient), emoji("artichokeparty"), emoji("artichokeparty"), emoji("artichokeparty"))],
      { ...fromZephyrine, ts: "1760349601.515151" },
    );
    await post(t, [section(text("Marmalade note to Zephyrine herself "), mention(people.giver), emoji("artichokeparty"))], { ...fromZephyrine, ts: "1760349602.626262" });
    await settle(t);
    const levelUpDm = slack.callsTo("chat.postMessage").find(({ channel, blocks }) => channel === people.giver && JSON.stringify(blocks ?? []).includes("openUnlock"));
    const openQuests = blockActions(people.giver, buttonIn(levelUpDm!.blocks as Block[], "Open"), { team, inMessage: { channel: people.giver, ts: "1760349700.818181" } });
    await t.fetch("/slack/interactivity", await signedRequest(openQuests, { contentType: "application/x-www-form-urlencoded" }));
    await t.fetch("/slack/events", await signedRequest(appHomeOpened(people.giver, { team })));
    const commandInChannel = slashCommand({ channel_id: channel, channel_name: "marmalade-quokkas" }, { team, user: people.giver, responseUrl: `https://hooks.slack.com/commands/${team}/1/quokka` });
    const form = { contentType: "application/x-www-form-urlencoded" };
    await t.fetch("/slack/commands", await signedRequest(commandInChannel, form));
    await settle(t);
    const firstThanksDm = slack.callsTo("chat.postMessage").find(({ channel, text }) => channel === people.giver && String(text).startsWith("✅ You finished a Journey step"));
    const openFirstThanks = blockActions(people.giver, buttonIn(firstThanksDm!.blocks as Block[], "Open"), { team, inMessage: { channel: people.giver, ts: "1760349700.828282" } });
    await t.fetch("/slack/interactivity", await signedRequest(openFirstThanks, form));
    await settle(t);
    await flagsFromPostHog(t, postHog, ...["xp-levels", "quests", "everyone-board"].map(onForEveryone));
    await t.fetch("/slack/events", await signedRequest(appHomeOpened(people.giver, { team })));
    await settle(t);
    await t.fetch("/slack/interactivity", await signedRequest(blockActions(people.giver, buttonInHome(slack, people.giver, "Leaderboard"), { team }), form));
    const leaderboardCommand = new URLSearchParams(commandInChannel);
    leaderboardCommand.set("text", "leaderboard month");
    await t.fetch("/slack/commands", await signedRequest(leaderboardCommand.toString(), form));
    await settle(t);
    for (const label of ["Settings", "Off", "On"]) {
      await t.fetch("/slack/interactivity", await signedRequest(blockActions(people.giver, buttonInHome(slack, people.giver, label), { team }), form));
      await settle(t);
    }

    expect(new Set(postHog.productEvents().map((event) => event.event))).toEqual(
      new Set([
        "kudos given",
        "kudos received",
        "member welcomed",
        "level reached",
        "unlock made ready",
        "unlock opened",
        "journey step activated",
        "quest drawn",
        "quest finished",
        "crate opened",
        "attempt failed",
        "app home opened",
        "command used",
        "leaderboard viewed",
        "leaderboard left",
        "leaderboard joined",
        "$feature_flag_called",
      ]),
    );
    const profiles = new Set(postHog.personEvents().map((event) => JSON.stringify(event.properties.$set)));
    expect([...profiles].map((profile) => JSON.parse(profile))).toEqual(expect.arrayContaining([
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
    ]));
    expect(profiles.size).toBe(2);
    const stored = await everythingStored(t);
    const neverSent = [
      "Marmalade", "artichokeparty", "Pacific/Chatham", "America/St_Johns", "Chatham", "St_Johns",
      channel, "1760349600", "424242", "515151", "626262", "737373", "828282", "Ev",
      "overflow", "herself", "hooks.slack.com", "ann", "acme", "1.2.3", "migration",
      ...stored.map((row) => row._id),
    ];
    const onThePersonOnly = ["Zephyrine", "Barnaby", "Flintlock", "quokka", "Quokka", "zephy", "barns", "Quokkason", "example.com", team, people.giver, people.recipient];
    const bodies = postHog.requests.map((request) => request.body).join("\n");
    const bodiesWithoutProfiles = postHog.requests.map((request) => withoutPersonProperties(request.body)).join("\n");
    for (const value of neverSent) expect(bodies).not.toContain(value);
    for (const value of onThePersonOnly) expect(bodiesWithoutProfiles).not.toContain(value);
    expect(bodiesWithoutProfiles).not.toMatch(/\b[UTCWB][A-Z0-9]{8,}\b/);
    expect(bodies).not.toMatch(/"(words|gate)"/);
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

function kudosGivenProperties() {
  const given = postHog.events().filter((event) => event.event === "kudos given");
  expect(given).toHaveLength(1);
  return given[0]!.properties;
}

function kudosEvents() {
  return postHog.events().filter((event) => event.event === "kudos given" || event.event === "kudos received");
}

async function outbox(t: Backend) {
  return t.run((ctx) => ctx.db.query("analyticsOutbox").collect());
}
