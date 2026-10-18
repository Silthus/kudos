import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { captureSettings, type Environment } from "./capture";
import type { Flag } from "./flags";
import { existingAnalyticsId } from "./person";

export const websiteAnalyticsFlag = { key: "website-analytics", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export type BrowserIdentity = { token: string; host: string; distinctId: string; environment: Environment };

export async function browserIdentityOf(ctx: QueryCtx, member: MemberId): Promise<BrowserIdentity | null> {
  const capture = captureSettings();
  const host = configuredHost();
  if (capture === null || host === null) return null;
  const distinctId = await existingAnalyticsId(ctx, member);
  if (distinctId === null) return null;
  return { token: capture.token, host, distinctId, environment: capture.environment };
}

export function configuredHost(): string | null {
  const host = (process.env.POSTHOG_HOST ?? "").trim();
  return isWebUrl(host) ? host : null;
}

function isWebUrl(text: string): boolean {
  if (!URL.canParse(text)) return false;
  const { protocol } = new URL(text);
  return protocol === "https:" || protocol === "http:";
}
