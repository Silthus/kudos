import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack, httpStatus, rateLimitedFor } from "../../testing/fakeSlack";
import { convexStops, settle, settleInTimeOrder, settleUntil, testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, allowedWorkspace, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { SignedInProfile } from "../slack/signIn";
import { rememberSignedInMember } from "./signIn";

const now = new Date("2026-10-13T10:00:00Z");
const juno: SignedInProfile = {
  id: `${allowedWorkspace}/U_JUNO`,
  chatWorkspace: allowedWorkspace,
  chatUser: "U_JUNO",
  name: "Juno Whitlock",
  givenName: "Juno",
  familyName: "Whitlock",
  image: "https://avatars.slack-edge.com/juno.png",
};

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(async () => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  await switchWebsite(t, postHog, true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function signIn(profile: SignedInProfile, existingUserId: Id<"users"> | null = null) {
  return t.run((ctx) => rememberSignedInMember(ctx, { existingUserId, profile }));
}

function users() {
  return t.run((ctx) => ctx.db.query("users").collect());
}

function minutesAfterSignIn(minutes: number) {
  return new Date(now.getTime() + minutes * 60_000);
}

async function sweepAt(at: Date) {
  vi.setSystemTime(at);
  await t.mutation(internal.slack.verifyMember.retryStranded, {});
  await settle(t);
}

async function profileOf(userId: Id<"users">) {
  const sessionId = await t.run((ctx) => ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 3_600_000 }));
  return t.withIdentity({ subject: `${userId}|${sessionId}` }).query(api.website.profile.getMyProfile, {});
}

describe("WS3 WS6: only the allowed workspace signs in, and only while open", () => {
  test("while the flag is off the callback refuses and no account appears", async () => {
    await switchWebsite(t, postHog, false);

    await expect(signIn(juno)).rejects.toThrow(/closed/);
    expect(await users()).toEqual([]);
  });

  test("a profile from another workspace is refused", async () => {
    await expect(signIn({ ...juno, id: "T_OTHER/U_JUNO", chatWorkspace: "T_OTHER" })).rejects.toThrow(/another workspace/);
    expect(await users()).toEqual([]);
  });

  test("a profile with an empty Slack user is refused", async () => {
    await expect(signIn({ ...juno, id: `${allowedWorkspace}/`, chatUser: "" })).rejects.toThrow(/user_id/);
    expect(await users()).toEqual([]);
  });

  test("an unset SLACK_WORKSPACE_ID refuses every sign-in", async () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "");

    await expect(signIn(juno)).rejects.toThrow();
    expect(await users()).toEqual([]);
  });
});

describe("WS7: accounts link only by the Slack pair", () => {
  test("a first sign-in keeps the Slack pair and the display claims, and no email", async () => {
    await aMember(t, "U_JUNO");
    await signIn(juno);

    expect(await users()).toEqual([
      expect.objectContaining({
        name: "Juno Whitlock",
        givenName: "Juno",
        familyName: "Whitlock",
        image: juno.image,
        chatIdentity: { workspace: allowedWorkspace, user: "U_JUNO" },
      }),
    ]);
    expect(Object.keys((await users())[0]!)).not.toContain("email");
  });

  test("signing in again refreshes the display claims on the same user, and drops one Slack no longer sends", async () => {
    await aMember(t, "U_JUNO");
    const first = await signIn(juno);
    const { image: _dropped, ...withoutPicture } = juno;

    const second = await signIn({ ...withoutPicture, name: "Juno Ashby" }, first);

    expect(second).toBe(first);
    const [user] = await users();
    expect(user).toMatchObject({ name: "Juno Ashby", chatIdentity: { workspace: allowedWorkspace, user: "U_JUNO" } });
    expect(user!.image).toBeUndefined();
  });
});

describe("WS8: a person the directory doesn't know yet is verified with users.info", () => {
  test("they read verifying, then member once users.info answers, with the directory filled", async () => {
    slack.withMember("U_JUNO", { tz: "Europe/London" });
    const userId = await signIn(juno);
    expect(await profileOf(userId)).toEqual({ kind: "verifying" });

    await settle(t);

    expect((await profileOf(userId)).kind).toBe("member");
    expect(slack.callsTo("users.info")).toEqual([{ user: "U_JUNO" }]);
  });

  test("a person users.info knows as deleted reads not-a-member", async () => {
    slack.withMember("U_JUNO", { deleted: true });
    const userId = await signIn(juno);

    await settle(t);

    expect(await profileOf(userId)).toEqual({ kind: "not-a-member" });
  });

  test("after 3 failed lookups, each waiting the Retry-After Slack asked for, they read unverified and the directory stays empty", async () => {
    slack.withMember("U_JUNO").answering("users.info", rateLimitedFor(30), rateLimitedFor(30), httpStatus(500));
    const userId = await signIn(juno);

    await settleInTimeOrder(t);

    expect(await profileOf(userId)).toEqual({ kind: "unverified" });
    const askedAt = slack.timesOf("users.info").map((at) => (at - now.getTime()) / 1000);
    expect(askedAt).toEqual([0, 30, 60]);
    expect(await t.run((ctx) => ctx.db.query("members").collect())).toEqual([]);
  });

  test("a person users.info keeps answering ok without a user for reads unverified after the retries", async () => {
    const okWithoutUser = () => Response.json({ ok: true });
    slack.withMember("U_JUNO").answering("users.info", okWithoutUser, okWithoutUser, okWithoutUser);
    const userId = await signIn(juno);

    await settleInTimeOrder(t);

    expect(await profileOf(userId)).toEqual({ kind: "unverified" });
    expect(slack.callsTo("users.info")).toHaveLength(3);
  });

  test("signing in again after a failed verification starts a fresh check", async () => {
    slack.withMember("U_JUNO").answering("users.info", httpStatus(500), httpStatus(500), httpStatus(500));
    const userId = await signIn(juno);
    await settleInTimeOrder(t);
    expect(await profileOf(userId)).toEqual({ kind: "unverified" });

    await signIn(juno, userId);
    expect(await profileOf(userId)).toEqual({ kind: "verifying" });
    await settle(t);

    expect((await profileOf(userId)).kind).toBe("member");
    expect(slack.callsTo("users.info")).toHaveLength(4);
  });

  test("a member the directory already knows is not looked up", async () => {
    await aMember(t, "U_JUNO");
    await signIn(juno);
    await settle(t);

    expect(slack.callsTo("users.info")).toEqual([]);
  });
});

describe("a stranded verification is tried again", () => {
  test("a verification Convex stopped is tried again once the sweep finds it stranded, and they read member", async () => {
    slack.withMember("U_JUNO");
    const userId = await signIn(juno);
    await convexStops(t, "slack/verifyMember:verifyMember");
    await settle(t);
    expect(await profileOf(userId)).toEqual({ kind: "verifying" });

    await sweepAt(minutesAfterSignIn(11));

    expect((await profileOf(userId)).kind).toBe("member");
  });

  test("a verification whose try Convex may still be running is left alone", async () => {
    slack.withMember("U_JUNO");
    const userId = await signIn(juno);
    await convexStops(t, "slack/verifyMember:verifyMember");

    await sweepAt(minutesAfterSignIn(10));

    expect(await profileOf(userId)).toEqual({ kind: "verifying" });
    expect(slack.callsTo("users.info")).toEqual([]);
  });

  test("a verification waiting out a long Retry-After is left alone", async () => {
    slack.withMember("U_JUNO").answering("users.info", rateLimitedFor(30 * 60));
    await signIn(juno);
    await settleUntil(t, minutesAfterSignIn(11));

    await t.mutation(internal.slack.verifyMember.retryStranded, {});
    await settleUntil(t, minutesAfterSignIn(12));

    expect(slack.callsTo("users.info")).toHaveLength(1);
  });

  test("a verification from before due times were recorded is left to its own try", async () => {
    slack.withMember("U_JUNO").answering("users.info", rateLimitedFor(30 * 60));
    await signIn(juno);
    await settleUntil(t, minutesAfterSignIn(11));
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("memberVerifications").collect()) await ctx.db.patch(row._id, { nextTryAt: undefined });
    });

    await t.mutation(internal.slack.verifyMember.retryStranded, {});
    await settleUntil(t, minutesAfterSignIn(12));

    expect(slack.callsTo("users.info")).toHaveLength(1);
  });

  test("a stranded try counts as one of the 3 tries", async () => {
    slack.withMember("U_JUNO").answering("users.info", httpStatus(500), httpStatus(500), httpStatus(500));
    const userId = await signIn(juno);
    await settleInTimeOrder(t, { until: now.getTime() + 1000 });
    await convexStops(t, "slack/verifyMember:verifyMember");

    await sweepAt(minutesAfterSignIn(11));
    await settleInTimeOrder(t);

    expect(await profileOf(userId)).toEqual({ kind: "unverified" });
    expect(slack.callsTo("users.info")).toHaveLength(2);
  });
});
