import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { chatUserOf, lookup, personFactsOf, type MemberId } from "../workspace/directory";
import { userGroupsOf } from "../workspace/userGroups";
import { captureSettings, type Capture, type Environment } from "./capture";
import { wakeDrain } from "./drain";
import { sharedPropertiesOf } from "./outbox";

export type PersonProfile = {
  email?: string;
  name?: string;
  display_name?: string;
  title?: string;
  slack_user_id?: string;
  slack_team_id?: string;
  is_admin?: boolean;
  teams?: string[];
  environment: Environment;
};

const profileKeys = ["email", "name", "display_name", "title", "slack_user_id", "slack_team_id", "is_admin", "teams", "environment"] as const satisfies (keyof PersonProfile)[];

const personEvents: readonly string[] = ["$identify", "$set"];

const catchUpBatchSize = 100;
const peopleFollowedPerJob = 200;

type Identity = Doc<"analyticsIds">;
type OutboxRow = Doc<"analyticsOutbox">;

export async function analyticsIdOf(ctx: MutationCtx, member: MemberId) {
  const existing = await existingAnalyticsId(ctx, member);
  if (existing !== null) return existing;
  const analyticsId = crypto.randomUUID();
  await ctx.db.insert("analyticsIds", { member, analyticsId });
  await followPerson(ctx, member);
  return analyticsId;
}

export async function existingAnalyticsId(ctx: QueryCtx, member: MemberId) {
  return (await identityOf(ctx, member))?.analyticsId ?? null;
}

export async function followPerson(ctx: MutationCtx, member: MemberId) {
  const capture = captureSettings();
  const identity = await identityOf(ctx, member);
  if (capture === null || identity === null) return;
  await recordProfileChange(ctx, capture, identity);
}

export const followPeople = internalMutation({
  args: { workspace: v.string(), users: v.array(v.string()) },
  handler: async (ctx, { workspace, users }) => {
    for (const user of users) {
      const facts = await lookup(ctx, workspace, user);
      if (facts?.kind === "member") await followPerson(ctx, facts.member);
    }
  },
});

export async function followPeopleLater(ctx: MutationCtx, workspace: string, users: string[]) {
  if (captureSettings() === null) return;
  for (let start = 0; start < users.length; start += peopleFollowedPerJob) {
    await ctx.scheduler.runAfter(0, internal.analytics.person.followPeople, { workspace, users: users.slice(start, start + peopleFollowedPerJob) });
  }
}

export const catchUp = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const capture = captureSettings();
    if (capture === null) return;
    const page = await ctx.db.query("analyticsIds").paginate({ cursor: cursor ?? null, numItems: catchUpBatchSize });
    for (const identity of page.page) await recordProfileChange(ctx, capture, identity);
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.analytics.person.catchUp, { cursor: page.continueCursor });
  },
});

export function requestCatchUp(ctx: MutationCtx) {
  return ctx.scheduler.runAfter(0, internal.analytics.person.catchUp, {});
}

export async function forgetRecordedProfiles(ctx: MutationCtx, rows: OutboxRow[]) {
  for (const row of rows.filter(isPersonEvent)) {
    const identity = await ctx.db
      .query("analyticsIds")
      .withIndex("by_analytics_id", (q) => q.eq("analyticsId", row.distinctId))
      .unique();
    if (identity !== null) await ctx.db.patch(identity._id, { profileFingerprint: null });
  }
}

export async function isSuperseded(ctx: QueryCtx, row: OutboxRow) {
  if (!isPersonEvent(row)) return false;
  for (const event of personEvents) {
    const sameKind = await ctx.db
      .query("analyticsOutbox")
      .withIndex("by_person_event", (q) => q.eq("distinctId", row.distinctId).eq("event", event))
      .collect();
    if (sameKind.some((other) => other._creationTime > row._creationTime)) return true;
  }
  return false;
}

function isPersonEvent({ event }: Pick<OutboxRow, "event">) {
  return personEvents.includes(event);
}

async function recordProfileChange(ctx: MutationCtx, capture: Capture, identity: Identity) {
  const profile = await profileOf(ctx, capture.environment, identity.member);
  const fingerprint = await fingerprintOf(profile);
  if (identity.profileFingerprint === fingerprint) return;
  await dropWaitingPersonEvents(ctx, identity.analyticsId);
  const { workspace } = await chatUserOf(ctx, identity.member);
  const firstTime = identity.profileFingerprint === undefined;
  await ctx.db.insert("analyticsOutbox", {
    uuid: crypto.randomUUID(),
    event: firstTime ? "$identify" : "$set",
    distinctId: identity.analyticsId,
    timestamp: Date.now(),
    properties: await sharedPropertiesOf(ctx, capture, workspace),
    person: { set: profile, unset: firstTime ? [] : profileKeys.filter((key) => profile[key] === undefined) },
    state: "pending",
    failures: 0,
    dueAt: Date.now(),
  });
  await ctx.db.patch(identity._id, { profileFingerprint: fingerprint });
  await wakeDrain(ctx);
}

async function profileOf(ctx: QueryCtx, environment: Environment, member: MemberId): Promise<PersonProfile> {
  const facts = await personFactsOf(ctx, member);
  if (facts === null) return { environment };
  const teams = (await userGroupsOf(ctx, facts.workspace, facts.user)).map(({ handle }) => handle);
  return {
    ...(facts.email !== undefined && { email: facts.email }),
    ...(facts.realName !== undefined && { name: facts.realName }),
    ...(facts.displayName !== undefined && { display_name: facts.displayName }),
    ...(facts.title !== undefined && { title: facts.title }),
    slack_user_id: facts.user,
    slack_team_id: facts.workspace,
    is_admin: facts.admin,
    ...(teams.length > 0 && { teams }),
    environment,
  };
}

async function fingerprintOf(profile: PersonProfile) {
  const canonical = JSON.stringify(profileKeys.map((key) => [key, profile[key] ?? null]));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function dropWaitingPersonEvents(ctx: MutationCtx, distinctId: string) {
  for (const event of personEvents) {
    const waiting = await ctx.db
      .query("analyticsOutbox")
      .withIndex("by_person_event", (q) => q.eq("distinctId", distinctId).eq("event", event).eq("state", "pending"))
      .collect();
    for (const row of waiting) await ctx.db.delete(row._id);
  }
}

function identityOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("analyticsIds")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
