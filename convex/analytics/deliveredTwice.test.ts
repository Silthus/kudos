import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakePostHog, postHogHost, projectToken } from "../../testing/fakePostHog";
import { deliverAgain, settle, testBackend, type Backend } from "../../testing/slackBackend";
import type { MutationCtx } from "../_generated/server";
import type { DomainEvent, ItemTurnedEvent } from "../bus/events";
import { publish, subscribers } from "../bus/publish";
import type { AwardId } from "../engine/awards";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const at = now.getTime();
const message = { workspace: "T1", conversation: "C1", message: "1760349600.000100" };

type Members = { alice: MemberId; bob: MemberId; award: AwardId };
type FactOf<T extends DomainEvent["type"]> = (members: Members) => Extract<DomainEvent, { type: T }>;

const facts: { [T in DomainEvent["type"]]?: FactOf<T> } = {
  attemptFailed: ({ alice }) => ({
    type: "attemptFailed",
    workspace: "T1",
    message,
    giver: alice,
    outcome: "over-allowance",
    recipients: 2,
    perRecipient: 1,
    cost: 2,
    skippedMentions: 0,
    retry: false,
    inThread: false,
    allowance: { dailyLeft: 1 },
    day: "2026-10-13",
    at,
  }),
  memberWelcomed: ({ alice }) => ({ type: "memberWelcomed", workspace: "T1", member: alice, as: "giver", at }),
  levelReached: ({ alice }) => ({ type: "levelReached", workspace: "T1", member: alice, level: 2, skillPointsGained: 1, skillPoints: 1, xpToNextLevel: 80, at }),
  unlockReady: ({ alice }) => ({ type: "unlockReady", workspace: "T1", member: alice, feature: "leaderboard", at }),
  unlockOpened: ({ alice }) => ({ type: "unlockOpened", workspace: "T1", member: alice, feature: "leaderboard", at }),
  unlocksLaunched: ({ alice, bob }) => ({ type: "unlocksLaunched", workspace: "T1", openings: [{ member: alice, feature: "quests" }, { member: bob, feature: "quests" }], at }),
  questFinished: ({ alice }) => ({ type: "questFinished", workspace: "T1", member: alice, quest: { kind: "journey", step: "first-thanks" }, at }),
  questOpened: ({ alice }) => ({ type: "questOpened", workspace: "T1", member: alice, quest: { kind: "journey", step: "first-thanks" }, at }),
  questsDrawn: ({ alice }) => ({ type: "questsDrawn", workspace: "T1", member: alice, week: "2026-10-12", quests: ["say-why", "say-why-twice"], at }),
  groupQuestDrawn: ({ alice, bob }) => ({ type: "groupQuestDrawn", workspace: "T1", week: "2026-10-12", quest: "together-reach-out", participants: [alice, bob], at }),
  questSwapped: ({ alice }) => ({ type: "questSwapped", workspace: "T1", member: alice, week: "2026-10-12", replaced: "say-why", swappedIn: "say-why-twice", at }),
  journeyStepActivated: ({ alice }) => ({ type: "journeyStepActivated", workspace: "T1", member: alice, step: "first-thanks", at }),
  achievementEarned: ({ alice }) => ({ type: "achievementEarned", workspace: "T1", member: alice, ladder: "generosity", tier: "bronze", at }),
  perkBought: ({ alice }) => ({ type: "perkBought", workspace: "T1", member: alice, perk: "spark", at }),
  hoggieDropped: ({ alice }) => ({ type: "hoggieDropped", workspace: "T1", member: alice, crate: "unlock:quests", hoggie: "builder", rarity: "common", copy: 1, at }),
  hugGiven: ({ alice, bob }) => ({ type: "hugGiven", workspace: "T1", giver: alice, message, onKudos: false, author: bob, at, day: "2026-10-13" }),
  teamPagesCompleted: ({ alice, award }) => ({
    type: "teamPagesCompleted",
    workspace: "T1",
    member: alice,
    message,
    award,
    teams: [{ team: "Design", people: 3 }, { team: "Sales", people: 2 }],
    at,
    told: true,
  }),
  stickersCollected: ({ alice, bob, award }) => ({
    type: "stickersCollected",
    workspace: "T1",
    stickers: [{ collector: alice, person: bob, firstAward: award, firstGiver: alice }, { collector: bob, person: alice, firstAward: award, firstGiver: alice }],
    at,
  }),
  thoughtfulPacksGranted: ({ alice, bob }) => ({ type: "thoughtfulPacksGranted", workspace: "T1", giver: alice, message, outcomes: [{ recipient: bob, outcome: "new" }], at }),
  stickerPutIn: ({ alice, bob }) => ({ type: "stickerPutIn", workspace: "T1", member: alice, person: bob, at }),
  itemTurned: ({ alice }) => itemTurned(alice),
};

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("KUDOS_ENVIRONMENT", "sandbox");
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", postHog.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a fact is recorded once however often the bus delivers it", () => {
  test.each(analyticsSubscriptions())("%s: %s sends its product events once, before and after the outbox drained", async (type, subscriber) => {
    const t = testBackend();
    await t.run(async (ctx) => publish(ctx, await factOf(ctx, type)));
    await onlyAnalyticsDelivered(t);
    const recorded = postHog.productEvents();

    await deliverAgain(t, subscriber);
    await deliverAgain(t, subscriber);

    expect(recorded, "the product events of the first delivery").not.toHaveLength(0);
    expect(postHog.productEvents(), "the product events after delivering it twice more").toEqual(recorded);
  });

  test("two facts with the same values are two product events", async () => {
    const t = testBackend();
    await t.run(async (ctx) => {
      const { alice } = await membersIn(ctx);
      await publish(ctx, itemTurned(alice));
      await publish(ctx, itemTurned(alice));
    });
    await settle(t);

    expect(postHog.productEvents().filter(({ event }) => event === "item turned")).toHaveLength(2);
  });
});

function analyticsSubscriptions() {
  return Object.entries(subscribers).flatMap(([type, subscriptions]) =>
    subscriptions
      .map((subscription) => getFunctionName("subscriber" in subscription ? subscription.subscriber : subscription))
      .filter((subscriber) => subscriber.startsWith("analytics/"))
      .map((subscriber) => [type as DomainEvent["type"], subscriber] as const),
  );
}

async function factOf(ctx: MutationCtx, type: DomainEvent["type"]): Promise<DomainEvent> {
  const members = await membersIn(ctx);
  if (type === "kudosGiven") return kudosGivenEventWithAward(ctx, members.alice, members.bob);
  const fact = facts[type] as FactOf<typeof type> | undefined;
  if (fact === undefined) throw new Error(`no ${type} fact to publish: add one for its analytics subscriber`);
  return fact(members);
}

async function membersIn(ctx: MutationCtx): Promise<Members> {
  const alice = await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member", timeZone: "UTC" });
  const bob = await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member", timeZone: "UTC" });
  const award = await ctx.db.insert("awards", { ...message, giver: alice, recipient: bob, kudos: 1, day: "2026-10-13", at });
  return { alice, bob, award };
}

function itemTurned(member: MemberId): ItemTurnedEvent {
  return { type: "itemTurned", workspace: "T1", member, source: "hoggie", rarity: "rare", isNew: true, at };
}

async function onlyAnalyticsDelivered(t: Backend) {
  await t.run(async (ctx) => {
    for (const job of await ctx.db.system.query("_scheduled_functions").collect()) {
      if (job.state.kind === "pending" && !job.name.startsWith("analytics/")) await ctx.scheduler.cancel(job._id);
    }
  });
  await settle(t);
}
