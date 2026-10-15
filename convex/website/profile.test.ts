import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite } from "../../testing/website";
import { api, components, internal } from "../_generated/api";
import { observe } from "../engine/engine";
import { homeFacts } from "../engine/home";
import { groupsShownTo } from "../groups/groups";
import { progressionHomeOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const week = 7 * 24 * 60 * 60 * 1000;
const juno = { user: "U_JUNO", name: "Juno Whitlock", image: "https://avatars.slack-edge.com/juno.png" };

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function myProfile(asSignedIn: Pick<Backend, "query"> = t) {
  return asSignedIn.query(api.website.profile.getMyProfile, {});
}

describe("website reads pass one guard", () => {
  describe("WS2 WS3 WS4: the website flag closes every read", () => {
    test("a member with a live session reads closed while the flag is off", async () => {
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, juno);
      await switchWebsite(t, postHog, false);

      expect(await myProfile(asSignedIn)).toEqual({ kind: "closed" });
    });

    test("a visitor with no session reads closed, not signed out, while the flag is off", async () => {
      await switchWebsite(t, postHog, false);

      expect(await myProfile()).toEqual({ kind: "closed" });
    });

    test("a flag nobody created in PostHog answers off", async () => {
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, juno);
      await t.action(components.posthog.lib.refreshFlagDefinitions, {});
      await t.mutation(internal.website.flag.prepareWebsiteFlag, {});

      expect(await myProfile(asSignedIn)).toEqual({ kind: "closed" });
    });

    test("the flag on for the workspace still reads closed until prepareWebsiteFlag made its workspace key", async () => {
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, juno);
      postHog.withFlags({ key: "website", filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });
      await t.action(components.posthog.lib.refreshFlagDefinitions, {});

      expect(await myProfile(asSignedIn)).toEqual({ kind: "closed" });
    });

    test("an unset SLACK_WORKSPACE_ID reads closed, whatever the flag says", async () => {
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, juno);
      await switchWebsite(t, postHog, true);
      vi.stubEnv("SLACK_WORKSPACE_ID", "");

      expect(await myProfile(asSignedIn)).toEqual({ kind: "closed" });
    });

    test("switching the flag off closes a session that was reading the member's profile", async () => {
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, juno);
      await switchWebsite(t, postHog, true);
      expect((await myProfile(asSignedIn)).kind).toBe("member");

      await switchWebsite(t, postHog, false);

      expect(await myProfile(asSignedIn)).toEqual({ kind: "closed" });
    });
  });

  describe("WS9 WS11 WS14: every read checks the live session, the workspace and the directory, in that order", () => {
    beforeEach(() => switchWebsite(t, postHog, true));

    test("a visitor with no session is signed out, never an empty profile", async () => {
      expect(await myProfile()).toEqual({ kind: "signed-out" });
    });

    test("a still-valid token whose session was signed out reads signed out", async () => {
      await aMember(t, juno.user);
      const { asSignedIn, sessionId } = await aSession(t, juno);
      await t.run((ctx) => ctx.db.delete(sessionId));

      expect(await myProfile(asSignedIn)).toEqual({ kind: "signed-out" });
    });

    test("an expired session reads signed out", async () => {
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, juno, { endsIn: 60_000 });
      vi.advanceTimersByTime(60_000);

      expect(await myProfile(asSignedIn)).toEqual({ kind: "signed-out" });
    });

    test("a session left over after SLACK_WORKSPACE_ID changes reads signed out, even for a member of its old workspace", async () => {
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, juno);
      vi.stubEnv("SLACK_WORKSPACE_ID", "T_NEW");
      await switchWebsite(t, postHog, true);

      expect(await myProfile(asSignedIn)).toEqual({ kind: "signed-out" });
    });

    test("a signed-in person the directory doesn't know yet is being verified", async () => {
      const { asSignedIn } = await aSession(t, juno);
      await t.run((ctx) => ctx.db.insert("memberVerifications", { workspace: "T1", user: juno.user, attempts: 1, state: "pending" }));

      expect(await myProfile(asSignedIn)).toEqual({ kind: "verifying" });
    });

    test("a signed-in person whose verification failed reads unverified, never a member", async () => {
      const { asSignedIn } = await aSession(t, juno);
      await t.run((ctx) => ctx.db.insert("memberVerifications", { workspace: "T1", user: juno.user, attempts: 3, state: "failed" }));

      expect(await myProfile(asSignedIn)).toEqual({ kind: "unverified" });
    });

    test("a member user_change deactivates reads not-a-member on their next read, whatever their session", async () => {
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, juno);
      expect((await myProfile(asSignedIn)).kind).toBe("member");

      await memberChanged(t, "user_change", { id: juno.user, team_id: "T1", deleted: true });

      expect(await myProfile(asSignedIn)).toEqual({ kind: "not-a-member" });
    });

    test("a member reads their own name and Slack picture from the sign-in", async () => {
      await aMember(t, juno.user);
      await aMember(t, "U_BOB");
      await aSession(t, { user: "U_BOB", name: "Bob" });
      const { asSignedIn } = await aSession(t, juno);

      expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", name: "Juno Whitlock", face: { kind: "slack", image: juno.image } });
    });

    test("a member's Slack picture carries their initials for when it fails to load", async () => {
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, juno);

      expect(await myProfile(asSignedIn)).toMatchObject({ face: { kind: "slack", image: juno.image, initials: "JW" } });
    });

    test("a member without a Slack picture reads their initials", async () => {
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, { user: juno.user, name: "Juno Whitlock" });

      expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", name: "Juno Whitlock", face: { kind: "initials", initials: "JW" } });
    });
  });
});

describe("WS13 WS15 WS18: a member's home answer projects their own homeFacts", () => {
  beforeEach(() => switchWebsite(t, postHog, true));

  test("a member reads their own kudos left, refill, this week and in total, with where to thank someone in Slack", async () => {
    await aMember(t, juno.user);
    await aMember(t, "U_BOB");
    await aMember(t, "U_CAROL");
    await give(t, "U_BOB", juno.user, 1, new Date("2026-10-06T10:00:00Z"));
    await give(t, juno.user, "U_BOB", 2);
    await give(t, "U_CAROL", "U_BOB", 3);
    const { asSignedIn } = await aSession(t, juno);

    expect(await myProfile(asSignedIn)).toEqual({
      kind: "member",
      name: "Juno Whitlock",
      face: { kind: "slack", image: juno.image, initials: "JW" },
      kudosEmoji: "taco",
      allowance: { left: 1, base: 3, refillsAt: Date.parse("2026-10-14T00:00:00Z") },
      thisWeek: { given: 2, received: 0 },
      lifetime: { given: 2, received: 1 },
      chatUrl: "https://app.slack.com/client/T1",
      leaderboard: { kind: "off" },
      features: null,
      journey: null,
      progression: null,
      skillPoints: null,
      groups: false,
    });
  });

  test("the answer is the member's homeFacts, never another member's", async () => {
    await aMember(t, juno.user);
    await aMember(t, "U_BOB");
    await give(t, "U_BOB", juno.user, 3);
    const { asSignedIn } = await aSession(t, juno);
    const facts = await t.run((ctx) => homeFacts(ctx, "T1", juno.user));

    const profile = await myProfile(asSignedIn);

    expect([facts?.kind, profile.kind]).toEqual(["member", "member"]);
    if (facts?.kind !== "member" || profile.kind !== "member") return;
    expect(profile.allowance).toEqual({ left: facts.left, base: facts.base, refillsAt: facts.refillsAt });
    expect(profile.thisWeek).toEqual({ given: facts.givenWeek, received: facts.receivedWeek });
    expect(profile.lifetime).toEqual({ given: facts.given, received: facts.received });
    expect(profile).toMatchObject({ allowance: { left: 3 }, thisWeek: { given: 0, received: 3 } });
  });

  test("the answer updates after a kudos lands", async () => {
    await aMember(t, juno.user);
    await aMember(t, "U_BOB");
    const { asSignedIn } = await aSession(t, juno);
    expect(await myProfile(asSignedIn)).toMatchObject({ allowance: { left: 3 }, thisWeek: { given: 0 } });

    await give(t, juno.user, "U_BOB", 1);

    expect(await myProfile(asSignedIn)).toMatchObject({ allowance: { left: 2 }, thisWeek: { given: 1 }, lifetime: { given: 1 } });
  });

  test("after the member's midnight and a clock tick, the answer is the new day's, without another kudos", async () => {
    await aMember(t, juno.user, "member", "T1", "Europe/Berlin");
    await aMember(t, "U_BOB");
    await give(t, juno.user, "U_BOB", 3);
    const { asSignedIn } = await aSession(t, juno, { endsIn: week });
    expect(await myProfile(asSignedIn)).toMatchObject({ allowance: { left: 0, refillsAt: Date.parse("2026-10-13T22:00:00Z") } });

    vi.setSystemTime(new Date("2026-10-13T22:05:00Z"));
    await t.mutation(internal.website.clock.tick, {});

    expect(await myProfile(asSignedIn)).toMatchObject({ allowance: { left: 3, refillsAt: Date.parse("2026-10-14T22:00:00Z") } });
  });

  test("after the week turns and a clock tick, the answer starts the new week, keeping the totals", async () => {
    await aMember(t, juno.user);
    await aMember(t, "U_BOB");
    await give(t, juno.user, "U_BOB", 2);
    const { asSignedIn } = await aSession(t, juno, { endsIn: week });

    vi.setSystemTime(new Date("2026-10-19T00:05:00Z"));
    await t.mutation(internal.website.clock.tick, {});

    expect(await myProfile(asSignedIn)).toMatchObject({ thisWeek: { given: 0, received: 0 }, lifetime: { given: 2, received: 0 } });
  });
});

describe("level and XP are invisible while xp-levels is off", () => {
  test("WS47: while xp-levels is off, a member with XP reads no progression", async () => {
    await switchWebsite(t, postHog, true);
    const { asSignedIn } = await aMemberWithXp(1600);

    expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", progression: null });
  });

  test.each([
    ["at level 1 with no XP yet", 0, { level: 1, xp: 0, levelStartsAt: 0, nextLevelAt: 20, xpToNextLevel: 20 }],
    ["exactly on a level's threshold", 100, { level: 3, xp: 100, levelStartsAt: 100, nextLevelAt: 300, xpToNextLevel: 200 }],
    ["past level 5, still without skill points", 1600, { level: 7, xp: 1600, levelStartsAt: 1500, nextLevelAt: 2100, xpToNextLevel: 500 }],
  ])("WS47 WS51: while xp-levels is on, a member %s reads their level and the XP to the next one", async (_, xp, progression) => {
    await switchWebsite(t, postHog, true, "xp-levels");
    const { asSignedIn } = await aMemberWithXp(xp);

    const profile = await myProfile(asSignedIn);

    expect(profile).toMatchObject({ kind: "member" });
    expect(profile.kind === "member" && profile.progression).toEqual(progression);
  });

  test("WS47: the progression is progression's own read of the member, never another member's", async () => {
    await switchWebsite(t, postHog, true, "xp-levels");
    const bob = await aMember(t, "U_BOB");
    await t.run((ctx) => ctx.db.insert("memberProgress", { member: bob, xp: 600, pointsSpent: 0 }));
    const { asSignedIn, member } = await aMemberWithXp(300);
    const home = await t.run((ctx) => progressionHomeOf(ctx, member));

    expect(await myProfile(asSignedIn)).toMatchObject({ progression: { level: home.level, xp: home.xp, xpToNextLevel: home.xpToNextLevel } });
  });

  test("WS47: switching xp-levels off hides the progression of a session that was reading it", async () => {
    await switchWebsite(t, postHog, true, "xp-levels");
    const { asSignedIn } = await aMemberWithXp(300);
    expect(await myProfile(asSignedIn)).toMatchObject({ progression: { level: 4 } });

    await switchWebsite(t, postHog, true);

    expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", progression: null });
  });
});

describe("groups are named only while groupsShownTo answers", () => {
  test.each([
    { case: "groups is off", alsoOn: [], aGroupCounts: true, groups: false },
    { case: "groups is on but no group counts in the workspace", alsoOn: ["groups"], aGroupCounts: false, groups: false },
    { case: "groups is on and a group counts in the workspace", alsoOn: ["groups"], aGroupCounts: true, groups: true },
  ])("#417: while $case, getMyProfile says groups is $groups, as groupsShownTo does", async ({ alsoOn, aGroupCounts, groups }) => {
    await switchWebsite(t, postHog, true, ...alsoOn);
    const member = await aMember(t, juno.user);
    if (aGroupCounts) await aCountingGroupWith(member);
    const { asSignedIn } = await aSession(t, juno);

    expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", groups });
    expect(await t.run((ctx) => groupsShownTo(ctx, member))).toBe(groups);
  });

  test("#417: switching groups off hides the groups fact of a session that was reading it", async () => {
    await switchWebsite(t, postHog, true, "groups");
    await aCountingGroupWith(await aMember(t, juno.user));
    const { asSignedIn } = await aSession(t, juno);
    expect(await myProfile(asSignedIn)).toMatchObject({ groups: true });

    await switchWebsite(t, postHog, true);

    expect(await myProfile(asSignedIn)).toMatchObject({ kind: "member", groups: false });
  });
});

function aCountingGroupWith(member: MemberId) {
  return t.run(async (ctx) => {
    const group = await ctx.db.insert("userGroups", { workspace: "T1", group: "S_ANTS", handle: "ants", name: "Ants", enabled: true, automatic: false, members: 3, asOf: 0, membersAsOf: 0 });
    await ctx.db.insert("memberGroups", { workspace: "T1", member, groups: [group], primary: group });
  });
}

async function aMemberWithXp(xp: number) {
  const member = await aMember(t, juno.user);
  if (xp > 0) await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp, pointsSpent: 0 }));
  const { asSignedIn } = await aSession(t, juno);
  return { asSignedIn, member };
}

async function give(t: Backend, giver: string, recipient: string, kudos: number, at = new Date()) {
  await t.run((ctx) =>
    observe(ctx, {
      kind: "posted",
      ref: { workspace: "T1", conversation: "C1", message: `${giver}-${recipient}-${at.getTime()}` },
      author: giver,
      revision: BigInt(at.getTime()) * 1000n,
      at: at.getTime(),
      content: { mentions: [{ kind: "person", user: recipient }], emoji: Array(kudos).fill("taco"), text: "thanks for the review" },
      words: { segments: [{ kind: "text", text: "thanks for the review" }], visibility: "public" },
    }),
  );
}
