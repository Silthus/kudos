import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, withoutPersonProperties, type CapturedEvent, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { everythingStored, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHomeBlocks, readBlocks, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import crons from "../crons";

const dayMs = 24 * 60 * 60 * 1000;
const tuesday = Date.parse("2026-10-13T10:00:00Z");
const saturday = Date.parse("2026-10-17T10:00:00Z");
const sunday = saturday + dayMs;
const nextMonday = Date.parse("2026-10-19T00:00:00Z");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const everyProgressionFlag = ["xp-levels", "unlocks", "quests"];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("E1 P80: quest drawn", () => {
  test("opening Quests sends one quest drawn per drawn quest on the member at the draw's time, naming the quest by its pool ID", async () => {
    const t = await workspace();

    await openQuests(t);

    const [draw] = await draws(t);
    const given = productEvents().find((event) => event.event === "kudos given")!;
    expect(draw!.slots).toHaveLength(3);
    expect(questsDrawn()).toEqual(
      draw!.slots.map(({ quest }) => ({
        event: "quest drawn",
        distinct_id: given.distinct_id,
        uuid: expect.stringMatching(uuid),
        timestamp: new Date(draw!.drawnAt).toISOString(),
        properties: { ...shared, quest },
      })),
    );
  });

  test("a draw with fewer feasible quests sends fewer quest drawn", async () => {
    vi.setSystemTime(sunday);
    const t = await workspace();

    await openQuests(t);

    const [draw] = await draws(t);
    expect(draw!.slots.length).toBeLessThan(3);
    expect(questsDrawn().map(({ properties }) => properties.quest)).toEqual(draw!.slots.map(({ quest }) => quest));
  });

  test("the Monday draw from the hourly sweep sends its quests once, at Monday 00:00; a second sweep, an App Home publish or a kudos that week sends nothing more", async () => {
    const t = await workspace();
    await openQuests(t);
    const tuesdays = questsDrawn().length;

    await sweepAt(t, nextMonday);
    await sweepAt(t, nextMonday + 60 * 60 * 1000);
    await openHome(t, "U_ALICE");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    const mondays = questsDrawn().slice(tuesdays);
    const [, draw] = await draws(t);
    expect(mondays.map(({ timestamp, properties }) => ({ timestamp, quest: properties.quest }))).toEqual(
      draw!.slots.map(({ quest }) => ({ timestamp: new Date(nextMonday).toISOString(), quest })),
    );
  });

  test("an on-demand draw when App Home opens in a new week sends its quests once", async () => {
    const t = await workspace();
    await openQuests(t);
    const tuesdays = questsDrawn().length;
    vi.setSystemTime(nextMonday + dayMs);

    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    const [, draw] = await draws(t);
    expect(questsDrawn().slice(tuesdays).map(({ properties }) => properties.quest)).toEqual(draw!.slots.map(({ quest }) => quest));
  });

  test.each<[string, FlagDefinition[]]>([
    ["off", [onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("quests")]],
    ["missing", [onForEveryone("xp-levels"), onForEveryone("unlocks")]],
  ])("E10: with quests %s, nothing is drawn and no quest drawn is sent", async (_, flags) => {
    const t = await workspace(flags);

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");
    await sweepAt(t, nextMonday);

    expect(await draws(t)).toEqual([]);
    expect(questsDrawn()).toEqual([]);
  });
});

describe("E1 P81: quest swapped", () => {
  test("Swap sends one quest swapped on the member at the swap's time, with the replaced and the swapped-in pool IDs", async () => {
    const t = await workspace();
    await openQuests(t);
    vi.setSystemTime(saturday);

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Swap")));

    const [swap] = await swaps(t);
    const given = productEvents().find((event) => event.event === "kudos given")!;
    expect(questsSwapped()).toEqual([
      {
        event: "quest swapped",
        distinct_id: given.distinct_id,
        uuid: expect.stringMatching(uuid),
        timestamp: new Date(saturday).toISOString(),
        properties: { ...shared, replaced: swap!.replaced, quest: swap!.swappedIn.quest },
      },
    ]);
    expect(swap!.replaced).not.toBe(swap!.swappedIn.quest);
  });

  test("E7: a second Swap that week, from an App Home published before the first, sends nothing", async () => {
    const t = await openedQuestsWithAFeasibleReplacement();
    const earlier = publishedHomeBlocks(slack, "U_ALICE");

    await send(t, blockActions("U_ALICE", swapButtons(earlier)[0]!));
    await send(t, blockActions("U_ALICE", swapButtons(earlier)[1]!));

    expect(await swaps(t)).toHaveLength(1);
    expect(questsSwapped()).toHaveLength(1);
  });

  test("a refused Swap, left on last week's App Home, sends nothing", async () => {
    const t = await openedQuestsWithAFeasibleReplacement();
    const lastWeek = publishedHomeBlocks(slack, "U_ALICE");
    vi.setSystemTime(nextMonday);

    await send(t, blockActions("U_ALICE", swapButtons(lastWeek)[0]!));

    expect(await swaps(t)).toEqual([]);
    expect(questsSwapped()).toEqual([]);
  });
});

describe("O10: a draw and a swap carry only pool IDs", () => {
  test("no PostHog request for opening Quests and a Swap carries a name, a time zone, a Slack or Convex ID or the week", async () => {
    const team = "T0QUOKKAWS";
    const people = { giver: "U0ZEPHYRINE", recipient: "U0BARNABY77" };
    slack = new FakeSlack()
      .withMember(people.giver, { team_id: team, tz: "Pacific/Chatham", ...({ real_name: "Zephyrine Quokkason", profile: { display_name: "zephy" } } as object) })
      .withMember(people.recipient, { team_id: team, tz: "America/St_Johns", ...({ real_name: "Barnaby Flintlock", profile: { display_name: "barns" } } as object) });
    vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
    const t = await unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(testBackend(), postHog, ...everyProgressionFlag.map(onForEveryone)), team);
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: team, kudosEmoji: "taco", baseAllowance: 10 }));

    await giveKudos(t, people.giver, people.recipient, saysWhy, team);
    await reachesLevelThree(t, people.giver, team);
    await openHome(t, people.giver, team);
    await send(t, blockActions(people.giver, questsOpenInHome(people.giver), { team }));
    await send(t, blockActions(people.giver, buttonInHome(slack, people.giver, "Swap"), { team }));

    expect(questsDrawn().length).toBeGreaterThan(0);
    expect(questsSwapped()).toHaveLength(1);
    const bodies = postHog.requests.map((request) => request.body).join("\n");
    const bodiesWithoutProfiles = postHog.requests.map((request) => withoutPersonProperties(request.body)).join("\n");
    const stored = await everythingStored(t);
    const neverSent = ["Pacific/Chatham", "America/St_Johns", "2026-10-12", ...stored.map((row) => row._id)];
    const onThePersonOnly = ["Zephyrine", "Quokkason", "zephy", "Barnaby", "Flintlock", "barns", team, people.giver, people.recipient];
    for (const value of neverSent) expect(bodies).not.toContain(value);
    for (const value of onThePersonOnly) expect(bodiesWithoutProfiles).not.toContain(value);
    expect(bodiesWithoutProfiles).not.toMatch(/\b[UTCWB][A-Z0-9]{8,}\b/);
  });
});

async function workspace(flags: FlagDefinition[] = everyProgressionFlag.map(onForEveryone)) {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(testBackend(), postHog, ...flags));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

async function openQuests(t: Backend) {
  await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
  await reachesLevelThree(t, "U_ALICE");
  await openHome(t, "U_ALICE");
  await send(t, blockActions("U_ALICE", questsOpenInHome("U_ALICE")));
}

async function reachesLevelThree(t: Backend, user: string, workspace = "T1") {
  const member = await t.run(async (ctx) => (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id);
  const event = { type: "levelReached" as const, workspace, member, level: 3, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200, at: Date.now() };
  await t.mutation(internal.unlocks.unlocks.makeReady, { event });
  await settled(t);
}

function questsOpenInHome(user: string) {
  const command = JSON.stringify({ type: "openUnlock", feature: "quests" });
  const block = publishedHomeBlocks(slack, user).find((candidate) => candidate.accessory?.value === command);
  return buttonIn([block!], "Open");
}

async function openedQuestsWithAFeasibleReplacement() {
  const t = await workspace();
  await openQuests(t);
  vi.setSystemTime(saturday);
  await openHome(t, "U_ALICE");
  expect(swapButtons(publishedHomeBlocks(slack, "U_ALICE")).length).toBeGreaterThan(1);
  return t;
}

function swapButtons(blocks: Block[]) {
  return blocks.filter((block) => readBlocks([block]).some((line) => line.includes("[button: Swap]"))).map((block) => buttonIn([block], "Swap"));
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string, team?: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, team, ts: `${Date.now() / 1000 + sentMessages}.000100` })));
  await settled(t);
}

async function openHome(t: Backend, user: string, team?: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user, { team })));
  await settled(t);
}

async function send(t: Backend, interaction: string) {
  await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settled(t);
}

async function sweepAt(t: Backend, at: number) {
  vi.setSystemTime(at);
  const job = crons.crons["draw each member's new week of quests"]!;
  await t.mutation(makeFunctionReference<"mutation">(job.name), {});
  await settled(t);
}

async function settled(t: Backend) {
  do {
    await settleInTimeOrder(t);
    await t.finishInProgressScheduledFunctions();
  } while (vi.getTimerCount() > 0);
}

function draws(t: Backend) {
  return t.run((ctx) => ctx.db.query("questDraws").collect());
}

function swaps(t: Backend) {
  return t.run((ctx) => ctx.db.query("questSwaps").collect());
}

function productEvents(): CapturedEvent[] {
  return postHog.productEvents().filter((event) => event.event !== "$feature_flag_called");
}

function questsDrawn() {
  return productEvents().filter((event) => event.event === "quest drawn");
}

function questsSwapped() {
  return productEvents().filter((event) => event.event === "quest swapped");
}
