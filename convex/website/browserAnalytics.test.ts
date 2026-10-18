import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, postHogHost, projectToken, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone } from "../../testing/flags";
import { memberChanged, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, aSession, aSignedInSession } from "../../testing/website";
import { api } from "../_generated/api";

const flag = "website-analytics";
const ann = { user: "U_ANN", name: "Ann Quill", email: "ann@example.com" };
const bea = { user: "U_BEA", name: "Bea Marsh", email: "bea@example.com" };
const off = { kind: "off" };

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-18T10:00:00Z") });
  aDeploymentForWorkspace();
  const slack = new FakeSlack().withMember(ann.user, slackProfileOf(ann)).withMember(bea.user, slackProfileOf(bea));
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a browser learns only its own analytics ID", { timeout: 30_000 }, () => {
  test("a member the flag is on for reads their own analytics ID with the project token, the host and the environment", async () => {
    const t = await workspace();
    const asAnn = await signedIn(t, ann);

    expect(await asAnn.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toStrictEqual({
      kind: "capture",
      token: projectToken,
      host: postHogHost,
      distinctId: await analyticsIdOf(t, ann),
      environment: "sandbox",
    });
  });

  test("two members in turn each read only their own analytics ID", async () => {
    const t = await workspace();
    const asAnn = await signedIn(t, ann);
    const asBea = await signedIn(t, bea);

    const annRead = await asAnn.query(api.website.browserAnalytics.getBrowserAnalytics, {});
    const beaRead = await asBea.query(api.website.browserAnalytics.getBrowserAnalytics, {});

    expect(annRead).toMatchObject({ kind: "capture", distinctId: await analyticsIdOf(t, ann) });
    expect(beaRead).toMatchObject({ kind: "capture", distinctId: await analyticsIdOf(t, bea) });
    expect(annRead).not.toEqual(beaRead);
  });

  test("the flag on only for another member's email reads off", async () => {
    const t = await workspace({ flags: [onForEveryone("website"), onForEmails(flag, bea.email)] });
    const asAnn = await signedIn(t, ann);

    expect(await asAnn.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toStrictEqual(off);
  });

  test("the flag off reads off", async () => {
    const t = await workspace({ flags: [onForEveryone("website"), offForEveryone(flag)] });
    const asAnn = await signedIn(t, ann);

    expect(await asAnn.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toStrictEqual(off);
  });

  test("the flag never created reads off", async () => {
    const t = await workspace({ flags: [onForEveryone("website")] });
    const asAnn = await signedIn(t, ann);

    expect(await asAnn.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toStrictEqual(off);
  });

  test("a deployment without the flags key never answers capture, since the website closes with it", async () => {
    const t = await workspace();
    const asAnn = await signedIn(t, ann);
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");

    expect(await asAnn.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toStrictEqual({ kind: "closed" });
  });

  test("a member without an analytics ID reads off, and the read records none", async () => {
    const t = await workspace();
    const { asSignedIn } = await aSession(t, { user: ann.user, name: ann.name });

    expect(await asSignedIn.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toStrictEqual(off);
    expect(await t.run((ctx) => ctx.db.query("analyticsIds").take(1))).toEqual([]);
  });

  test("a deployment without the project token reads off", async () => {
    const t = await workspace();
    const asAnn = await signedIn(t, ann);
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "");

    expect(await asAnn.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toStrictEqual(off);
  });

  test("a deployment without POSTHOG_HOST reads off", async () => {
    const t = await workspace();
    const asAnn = await signedIn(t, ann);
    vi.stubEnv("POSTHOG_HOST", "");

    expect(await asAnn.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toStrictEqual(off);
  });

  test("an argument that names another member is rejected", async () => {
    const t = await workspace();
    const asAnn = await signedIn(t, ann);
    const withAnotherMember = { user: bea.user } as unknown as Record<string, never>;

    await expect(asAnn.query(api.website.browserAnalytics.getBrowserAnalytics, withAnotherMember)).rejects.toThrow(/user/);
  });
});

describe("website reads pass one guard", { timeout: 30_000 }, () => {
  test("getBrowserAnalytics reads closed while the website flag is off, even with website-analytics on", async () => {
    const t = await workspace({ flags: [offForEveryone("website"), onForEveryone(flag)] });
    const { asSignedIn } = await aSession(t, { user: ann.user, name: ann.name });

    expect(await asSignedIn.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toEqual({ kind: "closed" });
  });

  test("getBrowserAnalytics reads signed out without a session", async () => {
    const t = await workspace();

    expect(await t.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toEqual({ kind: "signed-out" });
  });

  test("getBrowserAnalytics reads verifying for a person the directory doesn't know yet", async () => {
    const t = await workspace();
    const { asSignedIn } = await aSession(t, { user: "U_NEW" });

    expect(await asSignedIn.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toEqual({ kind: "verifying" });
  });

  test("getBrowserAnalytics reads not-a-member for a former member with a live session", async () => {
    const t = await workspace();
    await aMember(t, "U_GONE", "not-a-member");
    const { asSignedIn } = await aSession(t, { user: "U_GONE" });

    expect(await asSignedIn.query(api.website.browserAnalytics.getBrowserAnalytics, {})).toEqual({ kind: "not-a-member" });
  });
});

type WorkspaceSetup = { flags?: FlagDefinition[] };

async function workspace({ flags = [onForEveryone("website"), onForEveryone(flag)] }: WorkspaceSetup = {}) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flags);
  for (const person of [ann, bea]) await memberChanged(t, "team_join", { id: person.user, ...slackProfileOf(person) });
  await settle(t);
  await t.run((ctx) => ctx.db.insert("workspaceKeys", { workspace: "T1", workspaceKey: "the-workspace-key" }));
  return t;
}

function slackProfileOf({ name, email }: { name: string; email: string }) {
  return { profile: { display_name: name, email } };
}

async function signedIn(t: Backend, { user, name }: { user: string; name: string }) {
  const { asSignedIn } = await aSignedInSession(t, { user, name });
  return asSignedIn;
}

async function analyticsIdOf(t: Backend, { user }: { user: string }) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    const identity = await ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member!._id))
      .unique();
    return identity!.analyticsId;
  });
}
