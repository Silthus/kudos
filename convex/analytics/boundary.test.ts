import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, postHogHost, projectToken } from "../../testing/fakePostHog";
import { callingFailingReference, failingReference, fixturePath } from "../../testing/observedActions";
import { settle } from "../../testing/slackBackend";
import schema from "../schema";
import { modules } from "../test.setup";
import { isObserved } from "./boundary";

const now = new Date("2026-10-13T10:00:00Z");

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("KUDOS_ENVIRONMENT", "production");
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", postHog.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function backendWithFixtures() {
  return convexTest(schema, { ...modules, [fixturePath]: () => import("../../testing/observedActions") });
}

describe("O22: the error boundary", () => {
  test("an action called by another action reports once, from the action it left first", async () => {
    const t = backendWithFixtures();

    await expect(t.action(callingFailingReference, { reason: "Slack chat.postMessage failed: not_authed" })).rejects.toThrow("[reported] ReportableError");
    await settle(t);

    expect(exceptions().map((event) => event.properties.function_path)).toEqual(["testing/observedActions:failing"]);
  });

  test("if recording the exception fails, it logs a fixed code and the original error still propagates", async () => {
    const t = backendWithFixtures();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      throw new Error("no randomness today");
    });

    await expect(t.action(failingReference, { reason: "Slack chat.postMessage failed: not_authed" })).rejects.toThrow(/^Slack chat\.postMessage failed: not_authed$/);

    expect(logged).toHaveBeenCalledWith("analytics.exception_not_recorded");
    expect(await t.run((ctx) => ctx.db.query("analyticsOutbox").collect())).toEqual([]);
  });
});

describe("O22: coverage", () => {
  test("every exported httpAction and internalAction runs inside the error boundary, except the analytics module's own and Convex Auth's", async () => {
    const actions = await exportedActions();
    const ours = actions.filter(({ path }) => !convexAuthActions.includes(path));

    expect(actions.map(({ path }) => path)).toEqual(expect.arrayContaining(convexAuthActions));
    expect(ours.filter(({ path, observed }) => !path.startsWith("analytics/") && !observed).map(({ path }) => path)).toEqual([]);
    expect(actions.filter(({ path, observed }) => path.startsWith("analytics/") && observed).map(({ path }) => path)).toEqual([]);
    expect(actions.map(({ path }) => path)).toEqual(expect.arrayContaining(["analytics/drain:drain", "slack/events:slackEvents", "slack/commands:addToChannel"]));
  });
});

const convexAuthActions = ["auth:signIn", "auth:signOut"];

type RegisteredFunction = { isAction?: boolean; isHttp?: boolean };

async function exportedActions() {
  const found: Array<{ path: string; observed: boolean }> = [];
  for (const [file, load] of Object.entries(modules)) {
    if (file.startsWith("./_generated/")) continue;
    const exports = (await load()) as Record<string, RegisteredFunction>;
    for (const [name, fn] of Object.entries(exports)) {
      if (!fn?.isAction && !fn?.isHttp) continue;
      found.push({ path: `${file.replace(/^\.\//, "").replace(/\.ts$/, "")}:${name}`, observed: isObserved(fn) });
    }
  }
  return found;
}

function exceptions() {
  return postHog.events().filter((event) => event.event === "$exception");
}
