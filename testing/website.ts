import { vi } from "vitest";
import { components, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { FakePostHog, flagsKey, postHogHost, projectToken, type FlagDefinition } from "./fakePostHog";
import { signingSecret } from "./signedSlack";
import type { Backend } from "./slackBackend";

export const allowedWorkspace = "T1";

const hour = 60 * 60 * 1000;

const onEverywhere: FlagDefinition = { key: "website", filters: { groups: [{ properties: [], rollout_percentage: 100 }] } };
const offEverywhere: FlagDefinition = { key: "website", active: false, filters: { groups: [{ properties: [], rollout_percentage: 100 }] } };

export function aDeploymentForWorkspace(workspace: string | undefined = allowedWorkspace) {
  vi.stubEnv("SLACK_WORKSPACE_ID", workspace ?? "");
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", flagsKey);
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  vi.stubEnv("KUDOS_ENVIRONMENT", "sandbox");
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
}

export async function switchWebsite(t: Backend, postHog: FakePostHog, open: boolean) {
  postHog.withFlags(open ? onEverywhere : offEverywhere);
  await t.action(components.posthog.lib.refreshFlagDefinitions, {});
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
}

export type SignInIdentity = { workspace?: string; user: string; name?: string; image?: string };

export async function aSession(t: Backend, { workspace = allowedWorkspace, user, name, image }: SignInIdentity, { endsIn = hour } = {}) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { ...(name && { name }), ...(image && { image }), chatIdentity: { workspace, user } }),
  );
  const sessionId: Id<"authSessions"> = await t.run((ctx) => ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + endsIn }));
  return { sessionId, asSignedIn: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
}

export function aMember(t: Backend, user: string, kind: "member" | "not-a-member" = "member", workspace = allowedWorkspace, timeZone?: string) {
  return t.run((ctx) => ctx.db.insert("members", { workspace, user, kind, asOf: 0, ...(timeZone && { timeZone }) }));
}
