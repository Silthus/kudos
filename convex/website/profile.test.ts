import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite } from "../../testing/website";
import { api, components, internal } from "../_generated/api";

const now = new Date("2026-10-13T10:00:00Z");
const ada = { user: "U_ADA", name: "Ada Lovelace", image: "https://avatars.slack-edge.com/ada.png" };

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
      await aMember(t, ada.user);
      const { asSignedIn } = await aSession(t, ada);
      await switchWebsite(t, postHog, false);

      expect(await myProfile(asSignedIn)).toEqual({ kind: "closed" });
    });

    test("a visitor with no session reads closed, not signed out, while the flag is off", async () => {
      await switchWebsite(t, postHog, false);

      expect(await myProfile()).toEqual({ kind: "closed" });
    });

    test("a flag nobody created in PostHog answers off", async () => {
      await aMember(t, ada.user);
      const { asSignedIn } = await aSession(t, ada);
      await t.action(components.posthog.lib.refreshFlagDefinitions, {});
      await t.mutation(internal.website.flag.prepareWebsiteFlag, {});

      expect(await myProfile(asSignedIn)).toEqual({ kind: "closed" });
    });

    test("the flag on for the workspace still reads closed until prepareWebsiteFlag made its workspace key", async () => {
      await aMember(t, ada.user);
      const { asSignedIn } = await aSession(t, ada);
      postHog.withFlags({ key: "website", filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });
      await t.action(components.posthog.lib.refreshFlagDefinitions, {});

      expect(await myProfile(asSignedIn)).toEqual({ kind: "closed" });
    });

    test("an unset SLACK_WORKSPACE_ID reads closed, whatever the flag says", async () => {
      await aMember(t, ada.user);
      const { asSignedIn } = await aSession(t, ada);
      await switchWebsite(t, postHog, true);
      vi.stubEnv("SLACK_WORKSPACE_ID", "");

      expect(await myProfile(asSignedIn)).toEqual({ kind: "closed" });
    });

    test("switching the flag off closes a session that was reading the member's profile", async () => {
      await aMember(t, ada.user);
      const { asSignedIn } = await aSession(t, ada);
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
      await aMember(t, ada.user);
      const { asSignedIn, sessionId } = await aSession(t, ada);
      await t.run((ctx) => ctx.db.delete(sessionId));

      expect(await myProfile(asSignedIn)).toEqual({ kind: "signed-out" });
    });

    test("an expired session reads signed out", async () => {
      await aMember(t, ada.user);
      const { asSignedIn } = await aSession(t, ada, { endsIn: 60_000 });
      vi.advanceTimersByTime(60_000);

      expect(await myProfile(asSignedIn)).toEqual({ kind: "signed-out" });
    });

    test("a session left over after SLACK_WORKSPACE_ID changes reads signed out, even for a member of its old workspace", async () => {
      await aMember(t, ada.user);
      const { asSignedIn } = await aSession(t, ada);
      vi.stubEnv("SLACK_WORKSPACE_ID", "T_NEW");
      await switchWebsite(t, postHog, true);

      expect(await myProfile(asSignedIn)).toEqual({ kind: "signed-out" });
    });

    test("a signed-in person the directory doesn't know yet is being verified", async () => {
      const { asSignedIn } = await aSession(t, ada);
      await t.run((ctx) => ctx.db.insert("memberVerifications", { workspace: "T1", user: ada.user, attempts: 1, state: "pending" }));

      expect(await myProfile(asSignedIn)).toEqual({ kind: "verifying" });
    });

    test("a signed-in person whose verification failed reads unverified, never a member", async () => {
      const { asSignedIn } = await aSession(t, ada);
      await t.run((ctx) => ctx.db.insert("memberVerifications", { workspace: "T1", user: ada.user, attempts: 3, state: "failed" }));

      expect(await myProfile(asSignedIn)).toEqual({ kind: "unverified" });
    });

    test("a member user_change deactivates reads not-a-member on their next read, whatever their session", async () => {
      await aMember(t, ada.user);
      const { asSignedIn } = await aSession(t, ada);
      expect((await myProfile(asSignedIn)).kind).toBe("member");

      await memberChanged(t, "user_change", { id: ada.user, team_id: "T1", deleted: true });

      expect(await myProfile(asSignedIn)).toEqual({ kind: "not-a-member" });
    });

    test("a member reads their own name and Slack picture from the sign-in", async () => {
      await aMember(t, ada.user);
      await aMember(t, "U_BOB");
      await aSession(t, { user: "U_BOB", name: "Bob" });
      const { asSignedIn } = await aSession(t, ada);

      expect(await myProfile(asSignedIn)).toEqual({ kind: "member", name: "Ada Lovelace", face: { kind: "slack", image: ada.image } });
    });

    test("a member without a Slack picture reads their initials", async () => {
      await aMember(t, ada.user);
      const { asSignedIn } = await aSession(t, { user: ada.user, name: "Ada Lovelace" });

      expect(await myProfile(asSignedIn)).toEqual({ kind: "member", name: "Ada Lovelace", face: { kind: "initials", initials: "AL" } });
    });
  });
});
