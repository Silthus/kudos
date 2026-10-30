import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { react, settle, setWorkspaceSettings, testBackend, type Backend } from "../../testing/slackBackend";
import { standingOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T09:00:00Z");
const hourMs = 60 * 60 * 1000;

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL", { tz: "Pacific/Kiritimati" }).withMember("U_DANA");
  postHog = flagsOnForEveryone(slack.fetch, "hugs", "hug-rewards");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HH32: the first hug given each day pays 10 XP in all", () => {
  test("Bob's first hug today pays him 10 XP, and his second that day 1 XP more", async () => {
    const t = await workspace();

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", ts: messageAgo(1) });
    await hug(t, { user: "U_BOB", itemUser: "U_DANA", ts: messageAgo(2) });

    expect(await xpOf(t, "U_BOB")).toBe(11);
  });

  test("the day is the giver's own: Carol's hugs either side of midnight in Kiritimati each pay the day bonus", async () => {
    const t = await workspace();

    await hug(t, { user: "U_CAROL", itemUser: "U_ALICE", ts: messageAgo(1) });
    vi.setSystemTime(now.getTime() + 2 * hourMs);
    await hug(t, { user: "U_CAROL", itemUser: "U_DANA", ts: messageAgo(1) });

    expect(await xpOf(t, "U_CAROL")).toBe(20);
  });
});

describe("HH33: the first hug received each week pays 5 XP in all", () => {
  test("Alice's first hug this week pays her 5 XP, and a second from someone else 1 XP more", async () => {
    const t = await workspace();
    const ts = messageAgo(1);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", ts });
    await hug(t, { user: "U_DANA", itemUser: "U_ALICE", ts });

    expect(await xpOf(t, "U_ALICE")).toBe(6);
  });
});

describe("HH34: the bonuses follow hug-rewards at the hug", () => {
  test("while hug-rewards is off, every hug pays 1 XP to the giver and to the hugged, as before", async () => {
    const t = await workspace();
    await flagsFromPostHog(t, postHog, onForEveryone("hugs"), offForEveryone("hug-rewards"));
    const ts = messageAgo(1);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", ts });
    await hug(t, { user: "U_BOB", itemUser: "U_DANA", ts: messageAgo(2) });
    await hug(t, { user: "U_DANA", itemUser: "U_ALICE", ts });

    expect({ bob: await xpOf(t, "U_BOB"), alice: await xpOf(t, "U_ALICE") }).toEqual({ bob: 2, alice: 2 });
  });

  test("the giver and each hugged person are exposed to hug-rewards at the hug", async () => {
    const t = await workspace();

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", ts: messageAgo(1) });

    expect({ bob: await hugRewardsExposuresOf(t, "U_BOB"), alice: await hugRewardsExposuresOf(t, "U_ALICE") }).toEqual({ bob: [true], alice: [true] });
  });
});

async function workspace() {
  const t = testBackend();
  await setWorkspaceSettings(t, { kudosEmoji: "taco" });
  return flagsLoaded(t);
}

async function hug(t: Backend, options: { user: string; itemUser: string; ts: string }) {
  await react(t, options);
  await settle(t);
}

function messageAgo(hours: number) {
  return `${Math.floor((Date.now() - hours * hourMs) / 1000)}.000100`;
}

async function xpOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return (await t.run((ctx) => standingOf(ctx, member))).xp;
}

async function hugRewardsExposuresOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const rows = await t.run((ctx) =>
    ctx.db
      .query("flagExposures")
      .withIndex("by_member_flag_value", (q) => q.eq("member", member).eq("flag", "hug-rewards"))
      .take(2),
  );
  return rows.map(({ value }) => value);
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
