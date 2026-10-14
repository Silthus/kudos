import { vi } from "vitest";
import { components } from "../convex/_generated/api";
import { FakePostHog, flagsKey, postHogHost, projectToken, routedFetch, type FlagDefinition } from "./fakePostHog";
import { achievementsLiveIn } from "../convex/achievements/flag";
import { questsLiveIn } from "../convex/quests/flag";
import { unlocksLiveIn } from "../convex/unlocks/launch";
import { settle, testBackend, type Backend } from "./slackBackend";

export const onForEveryone = (key: string): FlagDefinition => ({ key, filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });

export const offForEveryone = (key: string): FlagDefinition => ({ key, filters: { groups: [{ properties: [], rollout_percentage: 0 }] } });

export const onInTheSandboxOnly = (key: string): FlagDefinition => ({
  key,
  filters: { groups: [{ properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 }] },
});

export const onForHalf = (key: string): FlagDefinition => ({ key, filters: { groups: [{ properties: [], rollout_percentage: 50 }] } });

export async function anIdInHalfOf(flag: string, inside: boolean) {
  for (let attempt = 0; ; attempt++) {
    const id = `id-${inside ? "in" : "out"}-${attempt}`;
    if ((await rolloutHashOf(flag, id)) <= 0.5 === inside) return id;
  }
}

async function rolloutHashOf(flag: string, distinctId: string) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${flag}.${distinctId}`));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return parseInt(hex.slice(0, 15), 16) / 0xfffffffffffffff;
}

export const onForEmails = (key: string, ...emails: string[]): FlagDefinition => ({
  key,
  filters: { groups: [{ properties: [{ key: "email", type: "person", value: emails, operator: "exact" }], rollout_percentage: 100 }] },
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

export function testBackendServing(postHog: FakePostHog, ...definitions: FlagDefinition[]) {
  return flagsFromPostHog(testBackend(), postHog, ...definitions);
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

export async function unlocksShippedBeforeAnyoneJoined(t: Backend, workspace = "T1") {
  await t.run((ctx) => unlocksLiveIn(ctx, workspace));
  return t;
}

export async function journeyShippedBeforeAnyoneJoined(t: Backend, workspace = "T1") {
  await unlocksShippedBeforeAnyoneJoined(t, workspace);
  await t.run((ctx) => questsLiveIn(ctx, workspace));
  return t;
}

export async function bookShippedBeforeAnyoneJoined(t: Backend, workspace = "T1") {
  await unlocksShippedBeforeAnyoneJoined(t, workspace);
  await t.run((ctx) => achievementsLiveIn(ctx, workspace));
  await settle(t);
  return t;
}
