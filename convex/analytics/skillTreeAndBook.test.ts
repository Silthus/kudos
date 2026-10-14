import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type CapturedEvent, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, offForEveryone, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHomeBlocks, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";

const now = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
const form = { contentType: "application/x-www-form-urlencoded" };

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
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

describe("E1 O6: a perk bought sends perk bought with the perk", () => {
  test("a Buy in the Skill tree tab sends perk bought once, on the buyer at the purchase, and a second click sends nothing", async () => {
    const t = await workspaceWith("xp-levels", "unlocks", "skill-tree");
    await levelFiveWithTheSkillTreeOpen(t, "U_ALICE");
    const buySpark = buyButtonFor("spark");

    vi.setSystemTime(now.getTime() + minuteMs);
    await click(t, "U_ALICE", buySpark);
    await click(t, "U_ALICE", buySpark);

    expect(eventsNamed("perk bought")).toEqual([
      { event: "perk bought", distinct_id: giverId(), uuid: expect.stringMatching(uuid), timestamp: new Date(now.getTime() + minuteMs).toISOString(), properties: { ...shared, perk: "spark" } },
    ]);
  });
});

describe("E1 O6: a tier earned sends achievement earned with its ladder and tier", () => {
  test("a kudos that earns tiers sends one achievement earned per tier, on each member who earned it, at the kudos", async () => {
    const t = await bookShippedBeforeAnyoneJoined(await workspaceWith("xp-levels", "unlocks", "achievements"));

    await giveKudos(t, "U_ALICE", "U_BOB");

    const [award] = await t.run((ctx) => ctx.db.query("awards").collect());
    const at = new Date(award!.at).toISOString();
    expect(eventsNamed("achievement earned").map(onWhomWhenWhat)).toEqual([
      { on: giverId(), timestamp: at, properties: { ...shared, ladder: "generosity", tier: "bronze" } },
      { on: recipientId(), timestamp: at, properties: { ...shared, ladder: "recognition", tier: "bronze" } },
      { on: giverId(), timestamp: at, properties: { ...shared, ladder: "seasons", tier: "bronze" } },
    ]);
  });

  test("the Book's launch replay sends each tier it earns once, dated by the award that earned it, not by the launch", async () => {
    const t = await unlocksShippedBeforeAnyoneJoined(await workspaceWith("xp-levels", "unlocks", "achievements-off"));
    await giveKudos(t, "U_ALICE", "U_BOB");
    const [award] = await t.run((ctx) => ctx.db.query("awards").collect());

    vi.setSystemTime(now.getTime() + 60 * minuteMs);
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"));
    await t.mutation(internal.unlocks.sweep.sweep, {});
    await settleInTimeOrder(t);
    await t.mutation(internal.unlocks.sweep.sweep, {});
    await settleInTimeOrder(t);

    const at = new Date(award!.at).toISOString();
    expect(eventsNamed("achievement earned").map(onWhomWhenWhat).sort(byLadder)).toEqual([
      { on: giverId(), timestamp: at, properties: { ...shared, ladder: "generosity", tier: "bronze" } },
      { on: recipientId(), timestamp: at, properties: { ...shared, ladder: "recognition", tier: "bronze" } },
      { on: giverId(), timestamp: at, properties: { ...shared, ladder: "seasons", tier: "bronze" } },
    ]);
  });
});

async function workspaceWith(...flags: string[]) {
  const definitions = flags.map((key) => (key.endsWith("-off") ? offForEveryone(key.slice(0, -"-off".length)) : onForEveryone(key)));
  const t = await flagsFromPostHog(testBackend(), postHog, ...definitions);
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

async function levelFiveWithTheSkillTreeOpen(t: Backend, user: string) {
  await unlocksShippedBeforeAnyoneJoined(t);
  await giveKudos(t, user, "U_BOB");
  await t.run(async (ctx) => {
    const member = (await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique())!._id;
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp: 600 });
    await ctx.db.insert("unlocks", { member, feature: "skillTree", readyAt: Date.now(), openedAt: Date.now() });
  });
  await openHome(t, user);
  await click(t, user, buttonInHome(slack, user, "Skill tree"));
}

function buyButtonFor(perk: string): BlockAction {
  const block = publishedHomeBlocks(slack, "U_ALICE").find((candidate) => candidate.accessory?.value === JSON.stringify({ type: "buyPerk", perk }));
  return buttonIn([block!], "Buy");
}

async function giveKudos(t: Backend, giver: string, recipient: string) {
  sentMessages += 1;
  const body = messageEvent([section(mention(recipient), emoji("taco"))], { user: giver, ts: `${Date.now() / 1000}.00010${sentMessages}` });
  await t.fetch("/slack/events", await signedRequest(body));
  await settleInTimeOrder(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleInTimeOrder(t);
}

async function click(t: Backend, user: string, action: BlockAction) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settleInTimeOrder(t);
}

function eventsNamed(name: string): CapturedEvent[] {
  return postHog.events().filter((event) => event.event === name);
}

function onWhomWhenWhat({ distinct_id, timestamp, properties }: CapturedEvent) {
  return { on: distinct_id, timestamp, properties };
}

function byLadder(one: { properties: Record<string, unknown> }, other: { properties: Record<string, unknown> }) {
  return String(one.properties.ladder).localeCompare(String(other.properties.ladder));
}

function giverId() {
  return eventsNamed("kudos given")[0]!.distinct_id;
}

function recipientId() {
  return eventsNamed("kudos received")[0]!.distinct_id;
}
