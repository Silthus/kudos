import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import { type FakePostHog, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { onForEveryone, postHogDeciding, testBackendServing, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, buttonIn, publishedHome, publishedHomeBlocks } from "../../testing/slackInteractions";
import { memberChanged, settle, type Backend } from "../../testing/slackBackend";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";

const tuesday = new Date("2026-10-13T10:00:00Z");
const lastTuesday = "2026-10-06T10:00:00Z";
const groupsSyncedAt = new Date("2026-09-01T10:00:00Z");

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
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const boardsOn = [onForEveryone("everyone-board"), onForEveryone("groups")];

const antsAndBees = { Ants: ["U_ANN", "U_AL", "U_AMY"], Bees: ["U_BOB", "U_BEA", "U_BEN"], Pair: ["U_PIA", "U_POE"] };

const groupsThisWeek = ["*Groups*", "🥇 Ants · 1.0 per person · 33% gave · 3 kudos", "🥈 Bees · 0.3 per person · 33% gave · 1 kudos", "▲ 1.0 more per person than this time last week", "📈 Most improved: Ants"];
const groupsThisMonth = ["*Groups*", "🥇 Bees · 1.3 per person · 66% gave · 4 kudos", "🥈 Ants · 1.0 per person · 33% gave · 3 kudos", "▲ 1.0 more per person than this time last month", "📈 Most improved: Bees"];
const groupsAllTime = ["*Groups*", "🥇 Bees · 1.3 per person · 66% gave · 4 kudos", "🥈 Ants · 1.0 per person · 33% gave · 3 kudos"];
const everyoneThisWeek = ["🥇 <@U_PIA> · 5 kudos", "🥈 <@U_ANN> · 3 kudos", "🥉 <@U_BEA> · 1 kudos", "▲ 3 more kudos than this time last week"];
const everyoneThisMonth = ["🥇 <@U_PIA> · 5 kudos", "🥈 <@U_ANN> · 3 kudos", "🥈 <@U_BOB> · 3 kudos", "4. <@U_BEA> · 1 kudos", "▲ 3 more kudos than this time last month"];
const everyoneAllTime = ["🥇 <@U_PIA> · 5 kudos", "🥈 <@U_ANN> · 3 kudos", "🥈 <@U_BOB> · 3 kudos", "4. <@U_BEA> · 1 kudos"];

describe("GB13, GB14, GB17: the Groups board above the Everyone board", { timeout: 60_000 }, () => {
  test("/hedgehug leaderboard replies privately with the Groups board, then the Everyone board, for this week, this month and all time", async () => {
    const t = await twoGroupsGave(boardsOn);

    const replies = [await command(t, "U_ANN", "leaderboard"), await command(t, "U_ANN", "leaderboard month"), await command(t, "U_ANN", "leaderboard all")];

    expect(replies).toEqual([
      { response_type: "ephemeral", text: [...groupsThisWeek, "", "*Everyone*", ...everyoneThisWeek].join("\n") },
      { response_type: "ephemeral", text: [...groupsThisMonth, "", "*Everyone*", ...everyoneThisMonth].join("\n") },
      { response_type: "ephemeral", text: [...groupsAllTime, "", "*Everyone*", ...everyoneAllTime].join("\n") },
    ]);
  });

  test("the Leaderboard tab shows the Groups board above the Everyone board, for this week, this month and all time", async () => {
    const t = await twoGroupsGave(boardsOn);
    await openHome(t, "U_ANN");

    await click(t, "U_ANN", "Leaderboard");
    const thisWeek = publishedHome(slack, "U_ANN");
    await click(t, "U_ANN", "This month");
    const thisMonth = publishedHome(slack, "U_ANN");
    await click(t, "U_ANN", "All time");
    const allTime = publishedHome(slack, "U_ANN");

    expect([thisWeek, thisMonth, allTime]).toEqual([
      [...tabTop("This week"), `section: ${groupsThisWeek.join("\n")}`, "divider", `section: ${["*Everyone*", ...everyoneThisWeek].join("\n")}`],
      [...tabTop("This month"), `section: ${groupsThisMonth.join("\n")}`, "divider", `section: ${["*Everyone*", ...everyoneThisMonth].join("\n")}`],
      [...tabTop("All time"), `section: ${groupsAllTime.join("\n")}`, "divider", `section: ${["*Everyone*", ...everyoneAllTime].join("\n")}`],
    ]);
  });

  test("GB33: viewing the boards sends leaderboard viewed for the Groups board beside the Everyone board, from the tab and the command", async () => {
    const t = await twoGroupsGave(boardsOn);
    await openHome(t, "U_ANN");

    await click(t, "U_ANN", "Leaderboard");
    await command(t, "U_ANN", "leaderboard month");

    expect(viewed()).toEqual([
      ["everyone", "week", "app home"],
      ["groups", "week", "app home"],
      ["everyone", "month", "command"],
      ["groups", "month", "command"],
    ]);
  });

  test("GB33: with groups on but no group of 3 primary members, no Groups board shows and no view of it is sent", async () => {
    const t = await groupsGave(boardsOn, { Pair: ["U_PIA", "U_POE"], Duo: ["U_DOT", "U_DAN"] }, [["U_PIA", 2]]);
    await openHome(t, "U_PIA");

    const reply = await command(t, "U_PIA", "leaderboard");
    await click(t, "U_PIA", "Leaderboard");

    expect(reply.text).toBe(["🥇 <@U_PIA> · 2 kudos", "▲ 2 more kudos than this time last week"].join("\n"));
    expect(viewed()).toEqual([
      ["everyone", "week", "command"],
      ["everyone", "week", "app home"],
    ]);
  });

  test("GB33: the command's view records the boards its reply showed, never reading the flag again", async () => {
    const t = await twoGroupsGave(boardsOn);

    await t.mutation(internal.slack.commands.recordLeaderboardViewed, { workspace: "T1", user: "U_ANN", period: "week", arrivedAt: Date.now() });
    await settle(t);

    expect(viewed()).toEqual([["everyone", "week", "command"]]);
  });

  test("a group with 2 primary members isn't listed, and a viewer in it sees positions 1–3 and no line for their group", async () => {
    const t = await groupsGave(boardsOn, { Ants: ["U_A1", "U_A2", "U_A3"], Bees: ["U_B1", "U_B2", "U_B3"], Cats: ["U_C1", "U_C2", "U_C3"], Dogs: ["U_D1", "U_D2", "U_D3"], Pair: ["U_PIA", "U_POE"] }, [
      ["U_A1", 4],
      ["U_B1", 3],
      ["U_C1", 2],
      ["U_D1", 1],
      ["U_PIA", 5],
    ]);

    const reply = await command(t, "U_PIA", "leaderboard");

    expect(reply.text.split("\n\n")[0]).toBe(
      ["*Groups*", "🥇 Ants · 1.3 per person · 33% gave · 4 kudos", "🥈 Bees · 1.0 per person · 33% gave · 3 kudos", "🥉 Cats · 0.7 per person · 33% gave · 2 kudos", "📈 Most improved: Ants"].join("\n"),
    );
  });

  test("with 3 members whose kudos rose from 30 to 60, the line reads 10.0 more per person, with the places their group climbed", async () => {
    const t = await groupsOf(boardsOn, { Ants: ["U_ANN", "U_AL", "U_AMY"], Bees: ["U_BOB", "U_BEA", "U_BEN"] });
    for (const giver of ["U_ANN", "U_AL", "U_AMY"]) await giveKudosOn(t, lastTuesday, giver, 10);
    for (const giver of ["U_BOB", "U_BEA", "U_BEN"]) await giveKudosOn(t, lastTuesday, giver, 15);
    for (const giver of ["U_ANN", "U_AL", "U_AMY"]) await giveKudos(t, giver, 20);
    for (const giver of ["U_BOB", "U_BEA", "U_BEN"]) await giveKudos(t, giver, 15);

    const reply = await command(t, "U_ANN", "leaderboard");

    expect(reply.text.split("\n").slice(0, 5)).toEqual([
      "*Groups*",
      "🥇 Ants · 20.0 per person · 100% gave · 60 kudos",
      "🥈 Bees · 15.0 per person · 100% gave · 45 kudos",
      "▲ 10.0 more per person than this time last week · ▲ 1 places",
      "📈 Most improved: Ants",
    ]);
  });
});

describe("GB17: the group boards wait for the Leaderboard and for groups", { timeout: 60_000 }, () => {
  test("P76: before the member opens the Leaderboard, /hedgehug leaderboard answers as it does without groups", async () => {
    const t = await groupsOf([...boardsOn, onForEveryone("xp-levels"), onForEveryone("unlocks")], antsAndBees, { unlocksShipped: true });
    await giveKudos(t, "U_ANN", 1);

    const reply = await command(t, "U_ANN", "leaderboard");

    expect(reply).toEqual({ response_type: "ephemeral", text: "Leaderboard opens at level 3." });
  });

  test("with groups off, the reply and the tab are the Everyone board alone, as before groups", async () => {
    const t = await twoGroupsGave([onForEveryone("everyone-board")]);
    await openHome(t, "U_ANN");

    const reply = await command(t, "U_ANN", "leaderboard");
    await click(t, "U_ANN", "Leaderboard");

    expect(reply.text).toBe(everyoneThisWeek.join("\n"));
    expect(publishedHome(slack, "U_ANN")).toEqual([...tabTop("This week"), `section: ${everyoneThisWeek.join("\n")}`]);
    expect(viewed()).toEqual([
      ["everyone", "week", "command"],
      ["everyone", "week", "app home"],
    ]);
  });
});

async function twoGroupsGave(flags: FlagDefinition[]) {
  const t = await groupsOf(flags, antsAndBees);
  await giveKudosOn(t, lastTuesday, "U_BOB", 3);
  await giveKudos(t, "U_ANN", 2);
  await giveKudos(t, "U_ANN", 1);
  await giveKudos(t, "U_BEA", 1);
  await giveKudos(t, "U_PIA", 5);
  return t;
}

async function groupsGave(flags: FlagDefinition[], groups: Record<string, string[]>, gifts: Array<[string, number]>) {
  const t = await groupsOf(flags, groups);
  for (const [giver, kudos] of gifts) await giveKudos(t, giver, kudos);
  return t;
}

async function groupsOf(flags: FlagDefinition[], groups: Record<string, string[]>, { unlocksShipped = false } = {}) {
  vi.setSystemTime(groupsSyncedAt);
  const t = await testBackendServing(postHog, ...flags);
  if (unlocksShipped) await unlocksShippedBeforeAnyoneJoined(t);
  await allowanceOf(t, 20);
  for (const [name, users] of Object.entries(groups)) {
    for (const user of users) slack.withMember(user, { profile: { display_name: user.slice(2) } });
    slack.withUserGroup(`S_${name.toUpperCase()}`, { name, users });
  }
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  for (const user of Object.values(groups).flat()) {
    await memberChanged(t, "team_join", { id: user, profile: { display_name: user.slice(2) } });
    await settle(t);
  }
  vi.setSystemTime(tuesday);
  return t;
}

async function allowanceOf(t: Backend, baseAllowance: number) {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("workspaces")
      .withIndex("by_workspace", (q) => q.eq("workspace", "T1"))
      .unique();
    if (row === null) await ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance });
    else await ctx.db.patch(row._id, { baseAllowance });
  });
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

function tabTop(period: "This week" | "This month" | "All time") {
  const tabs = ["Profile", "Leaderboard", "Settings"].map((tab) => (tab === "Leaderboard" ? `[${tab}]` : tab)).join(" | ");
  const periods = ["This week", "This month", "All time"].map((choice) => (choice === period ? `[${choice}]` : choice)).join(" | ");
  return [`actions: ${tabs}`, "header: Leaderboard", `actions: ${periods}`];
}

function viewed() {
  return postHog
    .productEvents()
    .filter((event) => event.event === "leaderboard viewed")
    .map(({ properties }) => [properties.board, properties.period, properties.surface]);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, label: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, buttonIn(publishedHomeBlocks(slack, user), label)), { contentType: "application/x-www-form-urlencoded" }));
  expect(response.status).toBe(200);
  await settle(t);
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
  const reply = (await response.json()) as { response_type: string; text: string };
  await settle(t);
  return reply;
}
