import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type ActionCtx, type MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { ReportableError, typeOf } from "../analytics/exceptions";
import { awaitedUsers, recheck, type Observation } from "../engine/engine";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";
import { republishOnRoleChange } from "../feedback/homes";
import { directoryRecordArgs, lookup, record, type DirectoryEntry, type DirectoryRecord } from "../workspace/directory";
import type { MemberProfile } from "../workspace/memberProfile";
import { readSlack } from "./webApi";

type SlackUser = {
  id: string;
  team_id?: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_admin?: boolean;
  is_owner?: boolean;
  tz?: string;
  name?: string;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string; email?: string; title?: string };
};

export type MemberChanged = { type: "team_join" | "user_change"; user: SlackUser; event_ts: string };

const slackbot = "USLACKBOT";

export function isMemberChanged(event: { type: string }): event is MemberChanged {
  return event.type === "team_join" || event.type === "user_change";
}

export function directoryRecordOfEvent(workspace: string, event: MemberChanged): DirectoryRecord {
  return directoryRecordOf(workspace, event.user, Number(event.event_ts) * 1000);
}

function directoryRecordOf(workspace: string, user: SlackUser, asOf: number): DirectoryRecord {
  return { workspace, user: user.id, entry: directoryEntryOf(user, workspace), asOf };
}

export async function checkDirectoryLater(ctx: MutationCtx, ref: MessageRef, observation: Observation) {
  if (observation.kind !== "awaiting-directory") return;
  await ctx.scheduler.runAfter(observation.retryInMs, internal.slack.directory.checkDirectory, { ref, attempt: observation.attempt });
}

export const checkDirectory = observedAction({
  args: { ref: messageRefValidator, attempt: v.int64() },
  handler: async (ctx, { ref, attempt }) => {
    const users = await ctx.runQuery(internal.slack.directory.usersAwaited, { ref, attempt });
    if (users === null) return;
    for (const user of users) await lookUpUser(ctx, ref.workspace, user);
    await ctx.runMutation(internal.slack.directory.recheckMessage, { ref, attempt });
  },
});

export const knows = internalQuery({
  args: { workspace: v.string(), user: v.string() },
  handler: async (ctx, { workspace, user }) => (await lookup(ctx, workspace, user)) !== undefined,
});

export const usersAwaited = internalQuery({
  args: { ref: messageRefValidator, attempt: v.int64() },
  handler: (ctx, { ref, attempt }) => awaitedUsers(ctx, ref, attempt),
});

export const recheckMessage = internalMutation({
  args: { ref: messageRefValidator, attempt: v.int64() },
  handler: async (ctx, { ref, attempt }) => {
    await checkDirectoryLater(ctx, ref, await recheck(ctx, ref, attempt));
  },
});

export const refreshPerson = internalMutation({
  args: directoryRecordArgs,
  handler: (ctx, directoryRecord) => recordPerson(ctx, directoryRecord),
});

export async function recordPerson(ctx: MutationCtx, directoryRecord: DirectoryRecord) {
  const before = await lookup(ctx, directoryRecord.workspace, directoryRecord.user);
  await record(ctx, directoryRecord);
  await republishOnRoleChange(ctx, before, await lookup(ctx, directoryRecord.workspace, directoryRecord.user));
}

type UsersPage = { members: SlackUser[]; response_metadata?: { next_cursor?: string } };

export const fillMissingNames = observedAction({
  args: {},
  handler: async (ctx) => {
    let cursor = "";
    do {
      const page = await readSlack<UsersPage>("users.list", { limit: "200", ...(cursor && { cursor }) });
      if (!page.ok) throw new ReportableError(`Slack users.list failed: ${page.error}`);
      await ctx.runMutation(internal.workspace.directory.nameMembersWithoutName, { names: page.members.flatMap(memberNameOf) });
      cursor = page.response_metadata?.next_cursor ?? "";
    } while (cursor !== "");
  },
});

export const fillMemberProfiles = observedAction({
  args: {},
  handler: async (ctx) => {
    let cursor = "";
    do {
      const asOf = Date.now();
      const page = await readSlack<UsersPage>("users.list", { limit: "200", ...(cursor && { cursor }) });
      if (!page.ok) throw new ReportableError(`Slack users.list failed: ${page.error}`);
      await ctx.runMutation(internal.workspace.directory.fillProfiles, { profiles: page.members.flatMap((user) => memberProfileOf(user, asOf)) });
      cursor = page.response_metadata?.next_cursor ?? "";
    } while (cursor !== "");
  },
});

function memberProfileOf(user: SlackUser, asOf: number) {
  const workspace = user.team_id ?? "";
  const entry = directoryEntryOf(user, workspace);
  return entry.kind === "member" ? [{ workspace, user: user.id, profile: profileOf(user), asOf }] : [];
}

function memberNameOf(user: SlackUser) {
  const workspace = user.team_id ?? "";
  const entry = directoryEntryOf(user, workspace);
  return entry.kind === "member" && entry.name ? [{ workspace, user: user.id, name: entry.name }] : [];
}

export type LookUp = { kind: "found" } | { kind: "failed"; retryAfterMs?: number };

export function lookUpUser(ctx: ActionCtx, workspace: string, user: string): Promise<LookUp> {
  return askSlackAbout(ctx, workspace, user, internal.workspace.directory.fillEntry);
}

export function refreshUser(ctx: ActionCtx, workspace: string, user: string): Promise<LookUp> {
  return askSlackAbout(ctx, workspace, user, internal.slack.directory.refreshPerson);
}

type Keep = typeof internal.workspace.directory.fillEntry | typeof internal.slack.directory.refreshPerson;

async function askSlackAbout(ctx: ActionCtx, workspace: string, user: string, keep: Keep): Promise<LookUp> {
  const askedAt = Date.now();
  const answer = await usersInfo(user);
  if (!answer?.ok) return { kind: "failed", ...(answer?.retryAfterMs !== undefined && { retryAfterMs: answer.retryAfterMs }) };
  await ctx.runMutation(keep, directoryRecordOf(workspace, answer.user, askedAt));
  return { kind: "found" };
}

async function usersInfo(user: string) {
  try {
    return await readSlack<{ user: SlackUser }>("users.info", { user });
  } catch (error) {
    console.warn("slack.users_info_failed", { error: typeOf(error) });
    return null;
  }
}

function directoryEntryOf(user: SlackUser, workspace: string): DirectoryEntry {
  if (user.is_bot || user.id === slackbot) return { kind: "bot" };
  if (user.deleted || user.team_id !== workspace) return { kind: "not-a-member" };
  const name = displayNameOf(user);
  return {
    kind: "member",
    ...(name && { name }),
    ...(user.tz && { timeZone: user.tz }),
    ...((user.is_admin || user.is_owner) && { admin: true }),
    ...profileOf(user),
  };
}

function profileOf(user: SlackUser): MemberProfile {
  const realName = user.profile?.real_name || user.real_name;
  const { email, display_name: displayName, title } = user.profile ?? {};
  return { ...(email && { email }), ...(realName && { realName }), ...(displayName && { displayName }), ...(title && { title }) };
}

function displayNameOf(user: SlackUser) {
  return user.profile?.display_name || user.profile?.real_name || user.real_name || user.name;
}
