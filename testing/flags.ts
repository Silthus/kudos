import { vi } from "vitest";
import { components } from "../convex/_generated/api";
import { flagsKey, postHogHost, projectToken, type FakePostHog, type FlagDefinition } from "./fakePostHog";
import { testBackend, type Backend } from "./slackBackend";

export const everyone = (key: string): FlagDefinition => ({ key, filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });

export const inTheSandboxOnly = (key: string): FlagDefinition => ({
  key,
  filters: { groups: [{ properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 }] },
});

export function stubSandboxWithFlags() {
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", flagsKey);
  vi.stubEnv("KUDOS_ENVIRONMENT", "sandbox");
  vi.stubEnv("POSTHOG_HOST", postHogHost);
}

export async function serveFlags(t: Backend, postHog: FakePostHog, ...definitions: FlagDefinition[]) {
  postHog.withFlags(...definitions);
  await t.action(components.posthog.lib.refreshFlagDefinitions, {});
}

export async function testBackendServing(postHog: FakePostHog, ...definitions: FlagDefinition[]) {
  const t = testBackend();
  await serveFlags(t, postHog, ...definitions);
  return t;
}
