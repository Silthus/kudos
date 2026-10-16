import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, httpStatus } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, onForEmails, onForEveryone } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { blockActions, optionPickedInHome, publishedHome, publishedHomeBlocks, type BlockAction } from "../../testing/slackInteractions";
import { convexStops, memberChanged, pendingJobs, react, settleUpTo, setWorkspaceSettings, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import crons from "../crons";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const mondayNineInUtc = Date.parse("2026-10-19T09:00:00Z");
const mondayNineInKolkata = Date.parse("2026-10-19T03:30:00Z");
const mondayNineInNewYork = Date.parse("2026-10-19T13:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const footer = "<slack://app?team=T1&id=A_KUDOS&tab=home|Change what I send you> in App Home's Settings tab.";
const nudge = "Hugs are a quick thanks. A kudos that names a teammate and says why earns much more XP.";
const recapRow = "section: *Weekly hugs recap* — Last week's hugs, the :taco: you and your teammates reacted, with their XP, on Monday morning. [select: As a DM]";
const sendHugsRecap = "slack/hugsRecap:sendHugsRecap";

const everyone = ["U_ALICE", "U_BOB", "U_CAROL", "U_DANA", "U_ERIN"];

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack();
  for (const user of everyone) slack.withMember(user, { profile: { email: emailOf(user) } });
  postHog = flagsOnForEveryone(slack.fetch, "hugs", "xp-levels", "message-settings");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("SR12: at Monday 09:00 in their time zone, a member who gave or received hugs last week gets one recap DM", () => {
  test("each member with hugs gets exactly their week in hugs at 09:00, and nobody else gets a recap", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await hug(t, "U_CAROL", "U_ALICE", messageOf(1));
    await hug(t, "U_DANA", "U_ALICE", messageOf(2));
    await hug(t, "U_ALICE", "U_BOB", messageOf(3));
    await hug(t, "U_BOB", "U_ERIN", messageOf(4));
    await hug(t, "U_CAROL", "U_ERIN", messageOf(4));
    await hug(t, "U_DANA", "U_ERIN", messageOf(5));

    await sweepAt(t, tuesday + hourMs);
    await settleUpTo(t, mondayNineInUtc - 1);
    expect(recaps()).toEqual([]);

    await settleUpTo(t, mondayNineInUtc);
    expect(recaps()).toEqual([
      {
        channel: "U_ALICE",
        text: [":taco: Your week in hugs", "You reacted :taco: and gave 1 hug (+1 XP).", "Teammates reacted :taco: on your messages and gave you 3 hugs (+3 XP).", `2 teammates reacted :taco: on your most-hugged message: <${permalinkOf(messageOf(1))}|open it in Slack>`, nudge, footer].join("\n"),
      },
      { channel: "U_BOB", text: [":taco: Your week in hugs", "You reacted :taco: and gave 2 hugs (+2 XP).", "Teammates reacted :taco: on your messages and gave you 1 hug (+1 XP).", `1 teammate reacted :taco: on your most-hugged message: <${permalinkOf(messageOf(3))}|open it in Slack>`, nudge, footer].join("\n") },
      { channel: "U_CAROL", text: [":taco: Your week in hugs", "You reacted :taco: and gave 2 hugs (+2 XP).", nudge, footer].join("\n") },
      { channel: "U_DANA", text: [":taco: Your week in hugs", "You reacted :taco: and gave 2 hugs (+2 XP).", nudge, footer].join("\n") },
      { channel: "U_ERIN", text: [":taco: Your week in hugs", "Teammates reacted :taco: on your messages and gave you 3 hugs (+3 XP).", `2 teammates reacted :taco: on your most-hugged message: <${permalinkOf(messageOf(4))}|open it in Slack>`, nudge, footer].join("\n") },
    ]);
    expect(new Set(recapTimes())).toEqual(new Set([mondayNineInUtc]));
  });

  test("a member who gave and got no hug last week gets no recap, and a week without hugs sends nothing the next Monday", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));

    await sweepAt(t, tuesday + hourMs);
    await sweepAt(t, mondayNineInUtc + hourMs);
    await sweepAt(t, mondayNineInUtc + 7 * dayMs + hourMs);

    expect(recaps().map(({ channel }) => channel)).toEqual(["U_ALICE", "U_BOB"]);
  });

  test("the most-hugged line is left out while the workspace URL isn't known", async () => {
    const t = await workspace({ urlKnown: false });
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));

    await recapsSentOnMonday(t);

    expect(recapTo("U_ALICE")).toEqual([":taco: Your week in hugs", "Teammates reacted :taco: on your messages and gave you 1 hug (+1 XP).", nudge, footer].join("\n"));
  });

  test("without message-settings the recap carries no settings footer", async () => {
    const t = await workspace();
    await flagsFromPostHog(t, postHog, onForEveryone("hugs"), onForEveryone("xp-levels"));
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));

    await recapsSentOnMonday(t);

    expect(recapTo("U_ALICE")).toEqual([":taco: Your week in hugs", "Teammates reacted :taco: on your messages and gave you 1 hug (+1 XP).", `1 teammate reacted :taco: on your most-hugged message: <${permalinkOf(messageOf(1))}|open it in Slack>`, nudge].join("\n"));
  });

  test("in a half-hour time zone the recap arrives at Monday 09:00 there", async () => {
    slack.withMember("U_ALICE", { tz: "Asia/Kolkata", profile: { email: emailOf("U_ALICE") } });
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));

    await recapsSentOnMonday(t);

    expect(recapTimesTo("U_ALICE")).toEqual([mondayNineInKolkata]);
    expect(recapTimesTo("U_BOB")).toEqual([mondayNineInUtc]);
  });
  test("a member whose time zone moves west after the sweep gets the recap at 09:00 in their new zone", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await sweepAt(t, tuesday + hourMs);

    await memberChanged(t, "user_change", { id: "U_ALICE", tz: "America/New_York", profile: { email: emailOf("U_ALICE") } });
    await settleUpTo(t, mondayNineInNewYork + hourMs);

    expect(recapTimesTo("U_ALICE")).toEqual([mondayNineInNewYork]);
    expect(recapTimesTo("U_BOB")).toEqual([mondayNineInUtc]);
  });
});

describe("SR12 SR14: the most-hugged message is the one that got the member the most hugs in their week", () => {
  test("a message hugged 9 times on Sunday and once on Monday loses Monday's week to one hugged twice on Monday", async () => {
    const sunday = Date.parse("2026-10-11T20:00:00Z");
    const monday = Date.parse("2026-10-12T10:00:00Z");
    const givers = Array.from({ length: 10 }, (_, index) => `U_GIVER${index}`);
    for (const giver of givers) slack.withMember(giver);
    vi.setSystemTime(sunday);
    const t = await workspace();
    const sundaysMessage = slackTs(sunday - hourMs);
    for (const giver of givers.slice(0, 9)) await hug(t, giver, "U_ALICE", sundaysMessage);

    await settleUpTo(t, monday);
    const mondaysMessage = slackTs(monday - hourMs);
    await hug(t, givers[9]!, "U_ALICE", sundaysMessage);
    await hug(t, "U_BOB", "U_ALICE", mondaysMessage);
    await hug(t, "U_CAROL", "U_ALICE", mondaysMessage);
    await sweepAt(t, monday + hourMs);
    await settleUpTo(t, mondayNineInUtc);

    expect(recapsTo("U_ALICE").map(({ text }) => text.split("\n").slice(1, 3))).toEqual([
      ["Teammates reacted :taco: on your messages and gave you 9 hugs (+9 XP).", `9 teammates reacted :taco: on your most-hugged message: <${permalinkOf(sundaysMessage)}|open it in Slack>`],
      ["Teammates reacted :taco: on your messages and gave you 3 hugs (+3 XP).", `2 teammates reacted :taco: on your most-hugged message: <${permalinkOf(mondaysMessage)}|open it in Slack>`],
    ]);
  });

  test("on a tie, the message whose last hug came latest", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await hug(t, "U_BOB", "U_ALICE", messageOf(2));
    await hug(t, "U_CAROL", "U_ALICE", messageOf(2));
    await hug(t, "U_CAROL", "U_ALICE", messageOf(1));

    await recapsSentOnMonday(t);

    expect(recapTo("U_ALICE")).toContain(`2 teammates reacted :taco: on your most-hugged message: <${permalinkOf(messageOf(1))}|open it in Slack>`);
  });

  test("a most-hugged kudos posted as a thread reply links to the reply inside its thread, as the timeline does", async () => {
    const t = await workspace();
    const threadRoot = messageOf(1);
    const reply = messageOf(2);
    await t.fetch("/slack/events", await signedRequest(messageEvent([section(mention("U_ALICE"), emoji("taco"))], { user: "U_BOB", ts: reply, threadTs: threadRoot })));
    await settleUpTo(t, Date.now() + minuteMs);
    await hug(t, "U_CAROL", "U_BOB", reply);

    await recapsSentOnMonday(t);

    expect(recapTo("U_ALICE")).toContain(`1 teammate reacted :taco: on your most-hugged message: <${permalinkOf(reply)}?thread_ts=${threadRoot}&cid=C1|open it in Slack>`);
  });
});

describe("SR12 SR14: one recap per member and week", () => {
  test("a week the sweep first sees after its Monday 09:00 schedules one recap job, and sends one recap", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await settleUpTo(t, mondayNineInUtc + hourMs);

    await t.mutation(recapSweep(), {});

    expect(await pendingJobs(t, sendHugsRecap)).toBe(2);
    await settleUpTo(t, Date.now() + minuteMs);
    expect(recapsTo("U_ALICE")).toHaveLength(1);
    expect(recapsTo("U_BOB")).toHaveLength(1);
  });

  test("a redelivered sweep and two sweeps in the same hour schedule one recap", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));

    await sweepAt(t, tuesday + hourMs);
    await sweepAt(t, tuesday + hourMs);
    await sweepAt(t, tuesday + hourMs + 20 * minuteMs);
    await sweepAt(t, tuesday + 2 * hourMs);
    await settleUpTo(t, mondayNineInUtc + hourMs);
    await sweepAt(t, mondayNineInUtc + 2 * hourMs);

    expect(recapsTo("U_ALICE")).toHaveLength(1);
    expect(recapsTo("U_BOB")).toHaveLength(1);
  });

  test("a recap Slack refused once is sent again, once", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await sweepAt(t, tuesday + hourMs);
    slack.answering("chat.postMessage", httpStatus(500));

    await settleUpTo(t, mondayNineInUtc + hourMs);
    await sweepAt(t, mondayNineInUtc + 2 * hourMs);

    expect([...recapsTo("U_ALICE"), ...recapsTo("U_BOB")]).toHaveLength(2);
    expect(recapsSent()).toHaveLength(2);
  });

  test("a recap is tried at most 3 times", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await sweepAt(t, tuesday + hourMs);
    slack.answering("chat.postMessage", ...Array.from({ length: 6 }, () => httpStatus(500)));

    await settleUpTo(t, mondayNineInUtc + hourMs);
    await sweepAt(t, mondayNineInUtc + 2 * hourMs);
    await sweepAt(t, mondayNineInUtc + 3 * hourMs);

    expect(slack.callsTo("chat.postMessage").map(({ channel }) => channel).toSorted()).toEqual(["U_ALICE", "U_ALICE", "U_ALICE", "U_BOB", "U_BOB", "U_BOB"]);
    expect(recapsSent()).toEqual([]);
  });

  test("a recap whose job Convex stopped is sent by the next sweep, once", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await sweepAt(t, tuesday + hourMs);
    await convexStops(t, sendHugsRecap);

    await settleUpTo(t, mondayNineInUtc + hourMs);
    expect(recaps()).toEqual([]);
    await sweepAt(t, mondayNineInUtc + hourMs);
    await sweepAt(t, mondayNineInUtc + 2 * hourMs);

    expect(recaps().map(({ channel }) => channel)).toEqual(["U_ALICE", "U_BOB"]);
    expect(await pendingJobs(t, sendHugsRecap)).toBe(0);
  });

  test("a recap job Convex runs late, after the sweep started it again, sends nothing more", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await sweepAt(t, tuesday + hourMs);
    await settleUpTo(t, mondayNineInUtc - 1);

    vi.setSystemTime(mondayNineInUtc + 15 * minuteMs);
    await t.mutation(recapSweep(), {});
    await settleUpTo(t, mondayNineInUtc + hourMs);

    expect(recaps().map(({ channel }) => channel)).toEqual(["U_ALICE", "U_BOB"]);
  });

  test("a recap whose try Convex stopped after it started is tried at most 3 times in all", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await sweepAt(t, tuesday + hourMs);
    await settleUpTo(t, mondayNineInUtc - 1);
    vi.setSystemTime(mondayNineInUtc);

    await convexStopsEachTryOnceStarted(t);
    for (const hour of [1, 2]) {
      await settleUpTo(t, mondayNineInUtc + hour * hourMs);
      await t.mutation(recapSweep(), {});
      await convexStopsEachTryOnceStarted(t);
    }
    await sweepAt(t, mondayNineInUtc + 3 * hourMs);
    await sweepAt(t, mondayNineInUtc + 4 * hourMs);

    expect(recaps()).toEqual([]);
    expect(await pendingJobs(t, sendHugsRecap)).toBe(0);
  });

  test("the sweep schedules more recaps than one mutation may schedule, within Convex's limits", { timeout: 120_000 }, async () => {
    const t = await workspace({ transactionLimits: true });
    await hugWeeksSeeded(t, 1_100);

    await sweepAt(t, tuesday + hourMs);

    expect(await pendingJobs(t, sendHugsRecap)).toBe(1_100);
  });
});

describe("SR12 SR13 SR21: the recap goes only while the member wants it", () => {
  test("a member whose hugs-recap place is none gets no recap, and the giver still gets theirs", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await openSettings(t, "U_ALICE");

    await pick(t, "U_ALICE", "Weekly hugs recap", "None");
    await recapsSentOnMonday(t);

    expect(recaps().map(({ channel }) => channel)).toEqual(["U_BOB"]);
  });

  test("a member paid by a flag-on giver while their own hugs is off gets no recap", async () => {
    const t = await workspace();
    await flagsFromPostHog(t, postHog, onForEmails("hugs", emailOf("U_BOB")), onForEveryone("xp-levels"), onForEveryone("message-settings"));
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));

    await recapsSentOnMonday(t);

    expect(recaps().map(({ channel }) => channel)).toEqual(["U_BOB"]);
    expect(recapsSent()).toHaveLength(1);
  });

  test("while xp-levels is off for the member nobody gets a recap", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await flagsFromPostHog(t, postHog, onForEveryone("hugs"), onForEveryone("message-settings"));

    await recapsSentOnMonday(t);

    expect(recaps()).toEqual([]);
  });

  test("SR13: the Weekly hugs recap row shows in the Settings tab only while hugs is on for the member, as a DM or none", async () => {
    const t = await workspace();
    await flagsFromPostHog(t, postHog, onForEmails("hugs", emailOf("U_BOB")), onForEveryone("xp-levels"), onForEveryone("message-settings"));
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));

    await openSettings(t, "U_ALICE");
    await openSettings(t, "U_BOB");

    expect(publishedHome(slack, "U_ALICE")).not.toContain(recapRow);
    expect(publishedHome(slack, "U_BOB")).toContain(recapRow);
    expect(placesOfferedTo("U_BOB", "Weekly hugs recap")).toEqual(["As a DM", "None"]);
  });

  test("SR13: the notification switches never write the hugs recap's place", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await flagsFromPostHog(t, postHog, onForEveryone("hugs"), onForEveryone("xp-levels"));
    await openSettings(t, "U_ALICE");

    await click(t, "U_ALICE", "Turn off DMs");
    await recapsSentOnMonday(t);

    expect(recaps().map(({ channel }) => channel)).toEqual(["U_ALICE", "U_BOB"]);
  });
});

describe("SR16: hugs recap sent reaches PostHog", () => {
  test("with the hugs given and received and their XP, and nothing else", async () => {
    const t = await workspace();
    await hug(t, "U_BOB", "U_ALICE", messageOf(1));
    await hug(t, "U_CAROL", "U_ALICE", messageOf(1));
    await hug(t, "U_ALICE", "U_BOB", messageOf(2));

    await recapsSentOnMonday(t);

    const shared = { environment: "sandbox", workspace_key: expect.any(String), taxonomy_version: expect.any(Number) };
    expect(recapsSent().map(({ properties }) => properties)).toEqual([
      { ...shared, hugs_given: 1, hugs_received: 2, xp: 3 },
      { ...shared, hugs_given: 1, hugs_received: 1, xp: 2 },
      { ...shared, hugs_given: 1, hugs_received: 0, xp: 1 },
    ]);
    expect(JSON.stringify(recapsSent())).not.toMatch(new RegExp(`U_ALICE|U_BOB|U_CAROL|C1|${messageOf(1).split(".")[0]}`));
  });
});

async function workspace({ transactionLimits = false, urlKnown = true } = {}) {
  const t = testBackend({ transactionLimits });
  await setWorkspaceSettings(t, { kudosEmoji: "taco" });
  if (urlKnown) await t.mutation(internal.workspace.url.rememberWorkspaceUrl, { workspace: "T1", url: "https://t1.slack.com/" });
  return flagsLoaded(t);
}

async function hug(t: Backend, giver: string, author: string, message: string) {
  await react(t, { user: giver, itemUser: author, ts: message });
  await settleUpTo(t, Date.now() + minuteMs);
}

async function hugWeeksSeeded(t: Backend, members: number) {
  await t.run(async (ctx) => {
    for (let index = 0; index < members; index += 1) {
      const member = await ctx.db.insert("members", { workspace: "T1", user: `U_SEEDED${index}`, kind: "member" });
      await ctx.db.insert("hugWeeks", { workspace: "T1", member, week: "2026-10-12", given: 1, givenXp: 1, received: 0, receivedXp: 0, recap: "waiting", tries: 0 });
    }
  });
}

async function convexStopsEachTryOnceStarted(t: Backend) {
  await t.run(async (ctx) => {
    for (const job of await ctx.db.system.query("_scheduled_functions").collect()) {
      if (job.name !== sendHugsRecap || job.state.kind !== "pending") continue;
      await ctx.scheduler.cancel(job._id);
      await ctx.runMutation(internal.hugs.recap.startRecap, job.args[0]);
    }
  });
}

function recapSweep() {
  const job = crons.crons["schedule each member's weekly hugs recap"];
  if (job === undefined) throw new Error("no cron job schedules each member's weekly hugs recap");
  expect(job.schedule).toEqual({ type: "interval", hours: 1 });
  return makeFunctionReference<"mutation">(job.name);
}

async function sweepAt(t: Backend, at: number) {
  await settleUpTo(t, at);
  await t.mutation(recapSweep(), {});
  await settleUpTo(t, at);
}

async function recapsSentOnMonday(t: Backend) {
  await sweepAt(t, Date.now() + hourMs);
  await settleUpTo(t, mondayNineInUtc + hourMs);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleUpTo(t, Date.now());
}

async function openSettings(t: Backend, user: string) {
  await openHome(t, user);
  await click(t, user, "Settings");
}

async function click(t: Backend, user: string, label: string) {
  const button = publishedHomeBlocks(slack, user)
    .flatMap((block) => [...(block.type === "actions" ? (block.elements as BlockAction[]) : []), ...(block.accessory ? [block.accessory as BlockAction] : [])])
    .find((element) => "text" in element && (element.text as { text: string }).text === label);
  expect(button, `${label} in ${user}'s App Home`).toBeDefined();
  await interact(t, user, button!);
}

async function pick(t: Backend, user: string, row: string, option: string) {
  await interact(t, user, optionPickedInHome(slack, user, row, option));
}

async function interact(t: Backend, user: string, action: BlockAction) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settleUpTo(t, Date.now());
}

function placesOfferedTo(user: string, row: string) {
  const picker = publishedHomeBlocks(slack, user).find((block) => block.text?.text.startsWith(`*${row}*`))?.accessory;
  return (picker?.options ?? []).map(({ text }) => text.text);
}

function isRecap({ text }: { text?: unknown }) {
  return String(text).startsWith(":taco: Your week in hugs");
}

function recaps() {
  return everyone.flatMap(recapsTo);
}

function recapsTo(user: string) {
  return slack
    .messagesIn(user)
    .filter(isRecap)
    .map(({ channel, text }) => ({ channel, text }));
}

function recapTo(user: string) {
  const [recap, ...more] = recapsTo(user);
  expect(more).toEqual([]);
  return recap?.text;
}

function recapTimes() {
  return slack.timesOf("chat.postMessage", isRecap);
}

function recapTimesTo(user: string) {
  return slack.timesOf("chat.postMessage", (args) => isRecap(args) && args.channel === user);
}

function recapsSent() {
  return postHog
    .productEvents()
    .filter(({ event }) => event === "hugs recap sent")
    .toSorted((first, second) => Number(second.properties.xp) - Number(first.properties.xp));
}

function messageOf(index: number) {
  return slackTs(tuesday - hourMs + index * minuteMs);
}

function permalinkOf(message: string) {
  return `https://t1.slack.com/archives/C1/p${message.replace(".", "")}`;
}

function emailOf(user: string) {
  return `${user.toLowerCase()}@example.com`;
}

function slackTs(at: number) {
  return `${Math.floor(at / 1000)}.000100`;
}
