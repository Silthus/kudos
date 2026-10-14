import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, httpStatus, rateLimitedFor } from "../../testing/fakeSlack";
import { anIdInHalfOf, bookShippedBeforeAnyoneJoined, flagsFromPostHog, offForEveryone, onForEveryone, onForHalf, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { slashCommandResponseUrl } from "../../testing/slackMessages";
import { opens, reachesLevel } from "../../testing/unlocks";
import type { LadderId, TierId } from "../achievements/ladders";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-14T10:00:00Z");
const cardFlag = "profile-card";
const everyFlag = ["xp-levels", "unlocks", "achievements", cardFlag];
const levelSevenXp = 1500;
const replyWindowMs = 25 * 60_000;
const joinedReply = "I'm in now. Mention teammates with a kudos emoji here and I'll pass the kudos on.";
const usageLine = "Type `/hedgehug @someone` to see their profile card.";

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack()
    .withMember("U_ANN", { profile: { display_name: "Ann" } })
    .withMember("U_BEA", { profile: { display_name: "Bea" } })
    .withMember("U_NEW", { profile: { display_name: "Newt" } })
    .withMember("U_BOT", { is_bot: true })
    .withMember("U_GONE", { deleted: true });
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("PC1 PC5 PC7 PC8: /hedgehug @member answers that member's profile card", { timeout: 30_000 }, () => {
  test("a member with a level and tiers on five ladders shows their name, level and best four medals, catalogue order breaking a tie", async () => {
    const t = await workspace();
    await withXp(t, "U_BEA", levelSevenXp);
    await earned(t, "U_BEA", "dependability", "bronze", "silver", "gold");
    await earned(t, "U_BEA", "applause", "bronze");
    await earned(t, "U_BEA", "connections", "bronze", "silver");
    await earned(t, "U_BEA", "generosity", "bronze", "silver", "gold");
    await earned(t, "U_BEA", "recognition", "bronze", "silver", "gold", "diamond");

    expect(await card(t, "U_ANN", "<@U_BEA>")).toBe(["*<@U_BEA>*", "Level 7", "💎 Hall of Fame · 🥇 Heart of the Team · 🥇 Pillar · 🥈 Connector"].join("\n"));
  });

  test("a mention with Slack's label shows the same card, and a teammate who earned nothing shows their name and level", async () => {
    const t = await workspace();

    expect(await card(t, "U_ANN", "<@U_BEA|bea>")).toBe(["*<@U_BEA>*", "Level 1"].join("\n"));
    expect(await card(t, "U_ANN", "  <@U_BEA>  ")).toBe(["*<@U_BEA>*", "Level 1"].join("\n"));
  });
});

describe("PC9: a card follows what has shipped, except an own card's medals wait for the Book", { timeout: 30_000 }, () => {
  test("an own card shows no medals before the member opened the Book, and its medals once they have", async () => {
    const t = await workspace();
    await earned(t, "U_ANN", "generosity", "bronze");

    const beforeOpening = await card(t, "U_ANN", "<@U_ANN>");
    await reachesLevel(t, await memberOf(t, "U_ANN"), 4);
    await opens(t, await memberOf(t, "U_ANN"), "book");

    expect(beforeOpening).toBe(["*<@U_ANN>*", "Level 1"].join("\n"));
    expect(await card(t, "U_ANN", "<@U_ANN>")).toBe(["*<@U_ANN>*", "Level 1", "🥉 First Thanks"].join("\n"));
  });

  test("an own card opened while the Book applied keeps its medals when the member's own achievements decision is off", async () => {
    const t = await workspace();
    await earned(t, "U_ANN", "generosity", "bronze");
    await reachesLevel(t, await memberOf(t, "U_ANN"), 4);
    await opens(t, await memberOf(t, "U_ANN"), "book");

    await achievementsOnInTheWorkspaceOnly(t, "U_ANN");

    expect(await card(t, "U_ANN", "<@U_ANN>")).toBe(["*<@U_ANN>*", "Level 1", "🥉 First Thanks"].join("\n"));
  });

  test("a teammate's card shows their medals though neither member opened the Book", async () => {
    const t = await workspace();
    await earned(t, "U_BEA", "generosity", "bronze");

    expect(await card(t, "U_ANN", "<@U_BEA>")).toBe(["*<@U_BEA>*", "Level 1", "🥉 First Thanks"].join("\n"));
  });

  test("tiers earned while notices were held back count", async () => {
    const t = await workspace();
    await earnedWhileHeldBack(t, "U_BEA", "seasons", "bronze");

    expect(await card(t, "U_ANN", "<@U_BEA>")).toBe(["*<@U_BEA>*", "Level 1", "🥉 First Chapter"].join("\n"));
  });

  test("with achievements off there is no medal line", async () => {
    const t = await workspace({ flags: [onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"), onForEveryone(cardFlag)], book: false });
    await earned(t, "U_BEA", "generosity", "bronze");

    expect(await card(t, "U_ANN", "<@U_BEA>")).toBe(["*<@U_BEA>*", "Level 1"].join("\n"));
  });

  test("while achievements just turned on and nothing launched the Book yet there is no medal line, and the card launches nothing", async () => {
    const t = await workspace({ flags: [onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"), onForEveryone(cardFlag)], book: false });
    await earned(t, "U_BEA", "generosity", "bronze");
    await flagsFromPostHog(t, postHog, ...everyFlag.map(onForEveryone));

    expect(await card(t, "U_ANN", "<@U_BEA>")).toBe(["*<@U_BEA>*", "Level 1"].join("\n"));
    expect(await t.run((ctx) => ctx.db.query("bookLaunches").collect())).toEqual([]);
  });

  test("with xp-levels off there is no level line, and the card is the name alone", async () => {
    const t = await workspace({ flags: [offForEveryone("xp-levels"), onForEveryone(cardFlag)], book: false });
    await withXp(t, "U_BEA", levelSevenXp);

    expect(await card(t, "U_ANN", "<@U_BEA>")).toBe("*<@U_BEA>*");
  });
});

describe("PC2: text led by a mention that isn't one person answers the usage line", { timeout: 30_000 }, () => {
  test.each(["<@U_BEA> <@U_ANN>", "<!subteam^S123|@team>", "<!here>", "<#C1|general>", "<@U_BEA> thanks"])("%s", async (text) => {
    const t = await workspace();

    expect(await card(t, "U_ANN", text)).toBe(usageLine);
  });

  test("/hedgehug and text not led by a mention keep today's behaviour while the flag is on", async () => {
    const t = await workspace();

    expect(await joinReplyTo(t, "U_ANN", "")).toEqual(joinedReplyFor);
    expect(await joinReplyTo(t, "U_ANN", "leaderboard")).toEqual(joinedReplyFor);
    expect(await joinReplyTo(t, "U_ANN", "hello <@U_BEA>")).toEqual(joinedReplyFor);
  });

  test("/hedgehug leaderboard shows the board while both flags are on", async () => {
    const t = await workspace({ flags: [...everyFlag, "everyone-board"].map(onForEveryone) });
    await reachesLevel(t, await memberOf(t, "U_ANN"), 3);
    await opens(t, await memberOf(t, "U_ANN"), "leaderboard");

    expect(await card(t, "U_ANN", "leaderboard")).toBe("Give kudos this week to join the board.");
  });
});

describe("PC3 PC4: who the card is for", { timeout: 30_000 }, () => {
  test.each(["U_BOT", "U_GONE"])("%s answers the not-a-member line", async (user) => {
    const t = await workspace();
    await lookedUp(t, user);

    expect(await card(t, "U_ANN", `<@${user}>`)).toBe(`<@${user}> isn't an active member of this workspace.`);
  });

  test("a person the directory doesn't know is looked up, then answered through response_url", async () => {
    const t = await workspace();

    const response = await command(t, "U_ANN", "<@U_NEW>");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    await settle(t);
    expect(slack.callsTo("users.info")).toEqual([{ user: "U_NEW" }]);
    expect(slack.callsTo("abc")).toEqual([{ response_type: "ephemeral", text: ["*<@U_NEW>*", "Level 1"].join("\n") }]);
    expect(slack.callsTo("conversations.join")).toEqual([]);
  });

  test("an unknown person who turns out to be a bot answers the not-a-member line through response_url", async () => {
    const t = await workspace();

    await command(t, "U_ANN", "<@U_BOT>");
    await settle(t);

    expect(slack.callsTo("abc")).toEqual([{ response_type: "ephemeral", text: "<@U_BOT> isn't an active member of this workspace." }]);
  });

  test("three failed lookups answer the lookup-failed line", async () => {
    const t = await workspace();
    slack.answering("users.info", httpStatus(500), httpStatus(500), httpStatus(500));

    await command(t, "U_ANN", "<@U_NEW>");
    await settleInTimeOrder(t);

    expect(slack.callsTo("users.info")).toHaveLength(3);
    expect(slack.callsTo("abc")).toEqual([{ response_type: "ephemeral", text: "I couldn't look up <@U_NEW> right now. Try again in a minute." }]);
  });

  test("a Retry-After that would land after the reply window answers the lookup-failed line without trying again", async () => {
    const t = await workspace();
    slack.answering("users.info", rateLimitedFor(replyWindowMs / 1000 + 1));

    await command(t, "U_ANN", "<@U_NEW>");
    await settleInTimeOrder(t);

    expect(slack.callsTo("users.info")).toHaveLength(1);
    expect(slack.callsTo("abc")).toEqual([{ response_type: "ephemeral", text: "I couldn't look up <@U_NEW> right now. Try again in a minute." }]);
  });

  test("a retry that runs after the reply window closed answers the lookup-failed line without looking up", async () => {
    const t = await workspace();
    slack.answering("users.info", httpStatus(500));
    await command(t, "U_ANN", "<@U_NEW>");
    vi.advanceTimersByTime(0);
    await t.finishInProgressScheduledFunctions();
    expect(slack.callsTo("users.info")).toHaveLength(1);

    vi.setSystemTime(now.getTime() + replyWindowMs + 60_000);
    await settleInTimeOrder(t);

    expect(slack.callsTo("users.info")).toHaveLength(1);
    expect(slack.callsTo("abc")).toEqual([{ response_type: "ephemeral", text: "I couldn't look up <@U_NEW> right now. Try again in a minute." }]);
  });

  test("a Retry-After inside the reply window is waited for, and the card follows", async () => {
    const t = await workspace();
    slack.answering("users.info", rateLimitedFor(60));

    await command(t, "U_ANN", "<@U_NEW>");
    await settleInTimeOrder(t);

    expect(slack.timesOf("users.info")).toEqual([now.getTime(), now.getTime() + 60_000]);
    expect(slack.callsTo("abc")).toEqual([{ response_type: "ephemeral", text: ["*<@U_NEW>*", "Level 1"].join("\n") }]);
  });
});

describe("PC11 PC17: the profile-card flag", { timeout: 30_000 }, () => {
  test.each(["<@U_BEA>", "<@U_BEA> <@U_ANN>", "<@U_NEW>", "<@U_BOT>"])("while it is off, /hedgehug %s is today's join path", async (text) => {
    const t = await workspace({ flags: [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"), offForEveryone(cardFlag)] });

    expect(await joinReplyTo(t, "U_ANN", text)).toEqual(joinedReplyFor);
    expect(slack.callsTo("users.info").filter(({ user }) => user !== "U_ANN")).toEqual([]);
  });

  test("while it is off, the answer is byte for byte the answer to /hedgehug", async () => {
    const t = await workspace({ flags: [offForEveryone(cardFlag)], book: false });
    const plain = await command(t, "U_ANN", "");
    await settle(t);
    const callsToPlain = slack.calls.length;

    const mentioned = await command(t, "U_ANN", "<@U_BEA>");
    await settle(t);

    expect([mentioned.status, mentioned.headers.get("content-type"), await mentioned.text()]).toEqual([plain.status, plain.headers.get("content-type"), await plain.text()]);
    expect(slack.calls.slice(callsToPlain)).toEqual(slack.calls.slice(0, callsToPlain));
  });

  test("the exposure is sent once per member and value", async () => {
    const t = await workspace();
    await card(t, "U_ANN", "<@U_BEA>");
    await card(t, "U_ANN", "<@U_BEA> <@U_ANN>");
    await flagsFromPostHog(t, postHog, offForEveryone(cardFlag));
    await command(t, "U_ANN", "<@U_BEA>");
    await command(t, "U_ANN", "<@U_BEA>");
    await settle(t);

    const analyticsId = await analyticsIdOf(t, "U_ANN");
    expect(exposures()).toEqual([
      { distinct_id: analyticsId, response: true },
      { distinct_id: analyticsId, response: false },
    ]);
  });

  test("a viewer the directory doesn't know gets the workspace's decision, and is exposed once they are looked up", async () => {
    const t = await workspace();

    expect(await card(t, "U_NEW", "<@U_BEA>")).toBe(["*<@U_BEA>*", "Level 1"].join("\n"));
    await settle(t);
    await card(t, "U_NEW", "<@U_BEA>");
    await settle(t);

    expect(slack.callsTo("users.info")).toEqual([{ user: "U_NEW" }]);
    expect(exposures()).toEqual([{ distinct_id: await analyticsIdOf(t, "U_NEW"), response: true }]);
  });
});

describe("PC13: profile card viewed", { timeout: 30_000 }, () => {
  test("a card shown to a member sends profile card viewed, own or a teammate's, at the command", async () => {
    const t = await workspace();
    const typedAt: string[] = [];

    typedAt.push(new Date().toISOString());
    await card(t, "U_ANN", "<@U_BEA>");
    typedAt.push(new Date().toISOString());
    await card(t, "U_ANN", "<@U_ANN>");
    typedAt.push(new Date().toISOString());
    await command(t, "U_ANN", "<@U_NEW>");
    await settle(t);

    const analyticsId = await analyticsIdOf(t, "U_ANN");
    expect(cardViews()).toEqual([
      { distinct_id: analyticsId, timestamp: typedAt[0], own: false, surface: "command" },
      { distinct_id: analyticsId, timestamp: typedAt[1], own: true, surface: "command" },
      { distinct_id: analyticsId, timestamp: typedAt[2], own: false, surface: "command" },
    ]);
  });

  test("a viewer the directory doesn't know is sent profile card viewed once they are looked up", async () => {
    const t = await workspace();

    await card(t, "U_NEW", "<@U_BEA>");
    await settle(t);

    expect(cardViews()).toEqual([{ distinct_id: await analyticsIdOf(t, "U_NEW"), timestamp: now.toISOString(), own: false, surface: "command" }]);
  });

  test("usage lines, not-a-member lines and failed lookups send nothing", async () => {
    const t = await workspace();
    await lookedUp(t, "U_BOT");
    slack.answering("users.info", httpStatus(500), httpStatus(500), httpStatus(500));

    await card(t, "U_ANN", "<@U_BEA> thanks");
    await card(t, "U_ANN", "<@U_BOT>");
    await command(t, "U_ANN", "<@U_NEW>");
    await settleInTimeOrder(t);

    expect(cardViews()).toEqual([]);
  });
});

const joinedReplyFor = { status: 200, body: "", joined: [{ channel: "C1" }], answered: [{ response_type: "ephemeral", text: joinedReply }] };

type WorkspaceSetup = { flags?: ReturnType<typeof onForEveryone>[]; book?: boolean };

async function workspace({ flags = everyFlag.map(onForEveryone), book = true }: WorkspaceSetup = {}) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flags);
  await (book ? bookShippedBeforeAnyoneJoined(t) : unlocksShippedBeforeAnyoneJoined(t));
  await lookedUp(t, "U_ANN");
  await lookedUp(t, "U_BEA");
  slack.calls.length = 0;
  return t;
}

async function lookedUp(t: Backend, user: string) {
  await memberChanged(t, "team_join", { id: user, ...memberOptions(user) });
  await settle(t);
}

function memberOptions(user: string) {
  if (user === "U_BOT") return { is_bot: true };
  if (user === "U_GONE") return { deleted: true };
  return { profile: { display_name: user.slice(2) } };
}

async function card(t: Backend, viewer: string, text: string) {
  const response = await command(t, viewer, text);
  expect(response.status).toBe(200);
  const reply = (await response.json()) as { response_type: string; text: string };
  expect(reply.response_type).toBe("ephemeral");
  await settle(t);
  return reply.text;
}

async function joinReplyTo(t: Backend, viewer: string, text: string) {
  const callsBefore = slack.calls.length;
  const response = await command(t, viewer, text);
  const body = await response.text();
  await settle(t);
  const after = slack.calls.slice(callsBefore);
  const argsOf = (method: string) => after.filter((call) => call.method === method).map((call) => call.args);
  return { status: response.status, body, joined: argsOf("conversations.join"), answered: argsOf("abc") };
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

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return row!._id;
  });
}

async function withXp(t: Backend, user: string, xp: number) {
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp, pointsSpent: 0 }));
}

function earned(t: Backend, user: string, ladder: LadderId, ...tiers: TierId[]) {
  return earnedTiers(t, user, ladder, tiers, {});
}

function earnedWhileHeldBack(t: Backend, user: string, ladder: LadderId, ...tiers: TierId[]) {
  return earnedTiers(t, user, ladder, tiers, { hidden: true });
}

async function earnedTiers(t: Backend, user: string, ladder: LadderId, tiers: TierId[], heldBack: { hidden?: true }) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    for (const tier of tiers) {
      const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C0", message: `${ladder}-${tier}`, giver: member, recipient: member, kudos: 1, day: "2026-10-13", at: Date.now() });
      await ctx.db.insert("earnedTiers", { member, ladder, tier, earnedAt: Date.now(), award, catalogueVersion: "1", rewards: [], ...heldBack });
    }
  });
}

async function achievementsOnInTheWorkspaceOnly(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const [workspaceKey, analyticsId] = [await anIdInHalfOf("achievements", true), await anIdInHalfOf("achievements", false)];
  await t.run(async (ctx) => {
    const key = await ctx.db
      .query("workspaceKeys")
      .withIndex("by_workspace", (q) => q.eq("workspace", "T1"))
      .unique();
    await ctx.db.patch(key!._id, { workspaceKey });
    const id = await ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(id!._id, { analyticsId });
  });
  await flagsFromPostHog(t, postHog, ...everyFlag.filter((flag) => flag !== "achievements").map(onForEveryone), onForHalf("achievements"));
}

async function analyticsIdOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    return row?.analyticsId;
  });
}

function exposures() {
  return postHog
    .events()
    .filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === cardFlag)
    .map(({ distinct_id, properties }) => ({ distinct_id, response: properties.$feature_flag_response }));
}

function cardViews() {
  return postHog
    .productEvents()
    .filter(({ event }) => event === "profile card viewed")
    .map(({ distinct_id, timestamp, properties }) => ({ distinct_id, timestamp, own: properties.own, surface: properties.surface }));
}
