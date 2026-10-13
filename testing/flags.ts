import { vi } from "vitest";
import { components } from "../convex/_generated/api";
import { FakePostHog, flagsKey, postHogHost, projectToken, routedFetch, type FlagDefinition } from "./fakePostHog";
import type { Backend } from "./slackBackend";

export const onForEveryone = (key: string): FlagDefinition => ({ key, filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });

export const offForEveryone = (key: string): FlagDefinition => ({ key, filters: { groups: [{ properties: [], rollout_percentage: 0 }] } });

export const onInTheSandboxOnly = (key: string): FlagDefinition => ({
  key,
  filters: { groups: [{ properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 }] },
});

export function postHogDeciding(environment: "sandbox" | "production" = "sandbox") {
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", flagsKey);
  vi.stubEnv("KUDOS_ENVIRONMENT", environment);
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  return new FakePostHog();
}

export async function flagsFromPostHog(t: Backend, postHog: FakePostHog, ...definitions: FlagDefinition[]) {
  postHog.withFlags(...definitions);
  return flagsLoaded(t);
}

export function flagsOnForEveryone(chatFetch: typeof fetch, ...keys: string[]) {
  const postHog = postHogDeciding("sandbox").withFlags(...keys.map(onForEveryone));
  vi.stubGlobal("fetch", routedFetch(postHog, chatFetch));
  return postHog;
}

export async function flagsLoaded(t: Backend) {
  await t.action(components.posthog.lib.refreshFlagDefinitions, {});
  return t;
}
