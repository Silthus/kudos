import { PostHog } from "@posthog/convex";
import { v } from "convex/values";
import { components } from "../_generated/api";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { captureSettings, environmentSetting } from "./capture";
import { analyticsIdOf, existingAnalyticsId, existingWorkspaceKey, record, workspaceKeyOf } from "./outbox";

type FlagValue = string | boolean;

export type Flag<V extends FlagValue> = { key: string; subject: "member" | "workspace"; safeDefault: V; values: readonly V[] };

export const flagSeamCheck = { key: "kudos-flag-seam-check", subject: "member", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

const postHog = new PostHog(components.posthog);

export async function flag<V extends FlagValue>(ctx: QueryCtx | MutationCtx, read: Flag<V>, subject: MemberId | string): Promise<V> {
  if (!flagsKeySet()) return read.safeDefault;
  try {
    const distinctId = await distinctIdOf(ctx, read, subject);
    if (distinctId === null) return read.safeDefault;
    const value = await postHog.getFeatureFlag(ctx, { key: read.key, distinctId, personProperties: personProperties() });
    return declaredValue(read, value);
  } catch {
    console.warn(`flag ${read.key} could not be evaluated; it answers its safe default`);
    return read.safeDefault;
  }
}

export async function exposed<V extends FlagValue>(ctx: MutationCtx, read: Flag<V>, member: MemberId, value: V): Promise<void> {
  if (captureSettings() === null) return;
  const exposure = { member, flag: read.key, value };
  const earlier = await ctx.db
    .query("flagExposures")
    .withIndex("by_member_flag_value", (q) => q.eq("member", member).eq("flag", read.key).eq("value", value))
    .unique();
  if (earlier !== null) return;
  await ctx.db.insert("flagExposures", exposure);
  const { workspace } = await chatUserOf(ctx, member);
  await record(ctx, workspace, [
    {
      event: "$feature_flag_called",
      subject: { member },
      at: Date.now(),
      properties: { feature_flag: read.key, feature_flag_response: value, locally_evaluated: true },
    },
  ]);
}

export const seamCheck = internalQuery({
  args: { member: v.id("members") },
  returns: v.boolean(),
  handler: (ctx, { member }) => flag(ctx, flagSeamCheck, member),
});

function flagsKeySet() {
  return (process.env.POSTHOG_PERSONAL_API_KEY ?? "").trim() !== "";
}

async function distinctIdOf(ctx: QueryCtx | MutationCtx, read: Flag<FlagValue>, subject: MemberId | string) {
  if (read.subject === "member") {
    const member = subject as MemberId;
    return canWrite(ctx) ? analyticsIdOf(ctx, member) : existingAnalyticsId(ctx, member);
  }
  return canWrite(ctx) ? workspaceKeyOf(ctx, subject) : existingWorkspaceKey(ctx, subject);
}

function canWrite(ctx: QueryCtx | MutationCtx): ctx is MutationCtx {
  return "insert" in ctx.db;
}

function personProperties() {
  const environment = environmentSetting();
  return environment === null ? {} : { environment };
}

function declaredValue<V extends FlagValue>(read: Flag<V>, value: unknown): V {
  return read.values.find((declared) => declared === value) ?? read.safeDefault;
}
