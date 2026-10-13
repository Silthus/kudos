import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack, httpStatus, rateLimitedFor } from "../../testing/fakeSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, allowedWorkspace, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { SignedInProfile } from "../slack/signIn";
import { rememberSignedInMember } from "./signIn";

const now = new Date("2026-10-13T10:00:00Z");
const ada: SignedInProfile = {
  id: `${allowedWorkspace}/U_ADA`,
  chatWorkspace: allowedWorkspace,
  chatUser: "U_ADA",
  name: "Ada Lovelace",
  givenName: "Ada",
  familyName: "Lovelace",
  image: "https://avatars.slack-edge.com/ada.png",
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

async function profileOf(userId: Id<"users">) {
  const sessionId = await t.run((ctx) => ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 3_600_000 }));
  return t.withIdentity({ subject: `${userId}|${sessionId}` }).query(api.website.profile.getMyProfile, {});
}

describe("WS3 WS6: only the allowed workspace signs in, and only while open", () => {
  test("while the flag is off the callback refuses and no account appears", async () => {
    await switchWebsite(t, postHog, false);

    await expect(signIn(ada)).rejects.toThrow(/closed/);
    expect(await users()).toEqual([]);
  });

  test("a profile from another workspace is refused", async () => {
    await expect(signIn({ ...ada, id: "T_OTHER/U_ADA", chatWorkspace: "T_OTHER" })).rejects.toThrow(/another workspace/);
    expect(await users()).toEqual([]);
  });

  test("a profile with an empty Slack user is refused", async () => {
    await expect(signIn({ ...ada, id: `${allowedWorkspace}/`, chatUser: "" })).rejects.toThrow(/user_id/);
    expect(await users()).toEqual([]);
  });

  test("an unset SLACK_WORKSPACE_ID refuses every sign-in", async () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "");

    await expect(signIn(ada)).rejects.toThrow();
    expect(await users()).toEqual([]);
  });
});

describe("WS7: accounts link only by the Slack pair", () => {
  test("a first sign-in keeps the Slack pair and the display claims, and no email", async () => {
    await aMember(t, "U_ADA");
    await signIn(ada);

    expect(await users()).toEqual([
      expect.objectContaining({
        name: "Ada Lovelace",
        givenName: "Ada",
        familyName: "Lovelace",
        image: ada.image,
        chatIdentity: { workspace: allowedWorkspace, user: "U_ADA" },
      }),
    ]);
    expect(Object.keys((await users())[0]!)).not.toContain("email");
  });

  test("signing in again refreshes the display claims on the same user, and drops one Slack no longer sends", async () => {
    await aMember(t, "U_ADA");
    const first = await signIn(ada);
    const { image: _dropped, ...withoutPicture } = ada;

    const second = await signIn({ ...withoutPicture, name: "Ada King" }, first);

    expect(second).toBe(first);
    const [user] = await users();
    expect(user).toMatchObject({ name: "Ada King", chatIdentity: { workspace: allowedWorkspace, user: "U_ADA" } });
    expect(user!.image).toBeUndefined();
  });
});

describe("WS8: a person the directory doesn't know yet is verified with users.info", () => {
  test("they read verifying, then member once users.info answers, with the directory filled", async () => {
    slack.withMember("U_ADA", { tz: "Europe/London" });
    const userId = await signIn(ada);
    expect(await profileOf(userId)).toEqual({ kind: "verifying" });

    await settle(t);

    expect((await profileOf(userId)).kind).toBe("member");
    expect(slack.callsTo("users.info")).toEqual([{ user: "U_ADA" }]);
  });

  test("a person users.info knows as deleted reads not-a-member", async () => {
    slack.withMember("U_ADA", { deleted: true });
    const userId = await signIn(ada);

    await settle(t);

    expect(await profileOf(userId)).toEqual({ kind: "not-a-member" });
  });

  test("after 3 failed lookups, each waiting the Retry-After Slack asked for, they read unverified and the directory stays empty", async () => {
    slack.withMember("U_ADA").answering("users.info", rateLimitedFor(30), rateLimitedFor(30), httpStatus(500));
    const userId = await signIn(ada);

    await settleInTimeOrder(t);

    expect(await profileOf(userId)).toEqual({ kind: "unverified" });
    const askedAt = slack.timesOf("users.info").map((at) => (at - now.getTime()) / 1000);
    expect(askedAt).toEqual([0, 30, 60]);
    expect(await t.run((ctx) => ctx.db.query("members").collect())).toEqual([]);
  });

  test("signing in again after a failed verification starts a fresh check", async () => {
    slack.withMember("U_ADA").answering("users.info", httpStatus(500), httpStatus(500), httpStatus(500));
    const userId = await signIn(ada);
    await settleInTimeOrder(t);
    expect(await profileOf(userId)).toEqual({ kind: "unverified" });

    await signIn(ada, userId);
    expect(await profileOf(userId)).toEqual({ kind: "verifying" });
    await settle(t);

    expect((await profileOf(userId)).kind).toBe("member");
    expect(slack.callsTo("users.info")).toHaveLength(4);
  });

  test("a member the directory already knows is not looked up", async () => {
    await aMember(t, "U_ADA");
    await signIn(ada);
    await settle(t);

    expect(slack.callsTo("users.info")).toEqual([]);
  });
});
