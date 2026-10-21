import { v, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type ActionCtx, type MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { ReportableError, typeOf, withholdingWords } from "../analytics/exceptions";
import { awaitedUsers, recheck, takeStrandedChecks, type Observation } from "../engine/engine";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";
import { republishOnRoleChange } from "../feedback/homes";
import { directoryRecordArgs, lookup, record, type DirectoryEntry, type DirectoryRecord } from "../workspace/directory";
import type { MemberProfile } from "../workspace/memberProfile";
import { convexActionTimeLimitMs, strandedPerSweep } from "./strandedJobs";
import { readSlack, slackErrorCodeOf } from "./webApi";

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
  profile?: { display_name?: string; real_name?: string; email?: string; title?: string; image_72?: string; image_192?: string };
};

export type MemberChanged = { type: "team_join" | "user_change"; user: SlackUser; event_ts: string };

const slackbot = "USLACKBOT";

export function isMemberChanged(event: { type: string }): event is MemberChanged {
  return event.type === "team_join" || event.type === "user_change";
}

export function directoryRecordOfEvent(workspace: unknown, eventId: unknown, event: MemberChanged): (DirectoryRecord & { eventId: string }) | null {
  const [team, id, receipt] = [textOf(workspace), textOf(event.user?.id), textOf(eventId)];
  if (team === undefined || id === undefined || receipt === undefined) return null;
  return { eventId: receipt, ...directoryRecordOf(team, id, event.user, Number(event.event_ts) * 1000) };
}

function directoryRecordOf(workspace: string, id: string, user: SlackUser, asOf: number): DirectoryRecord {
  return { workspace, user: id, entry: directoryEntryOf({ ...user, id }, workspace), asOf };
}

export async function checkDirectoryLater(ctx: MutationCtx, ref: MessageRef, observation: Observation) {
  if (observation.kind !== "awaiting-directory") return;
  await ctx.scheduler.runAfter(observation.retryInMs, internal.slack.directory.checkDirectory, { ref, attempt: observation.attempt });
}

const failedCheckRetriesMs = [10, 60, 300, 1800].map((seconds) => seconds * 1000);

const checkDirectoryArgs = { ref: messageRefValidator, attempt: v.int64(), failures: v.optional(v.number()) };

export const checkDirectory = observedAction({
  args: checkDirectoryArgs,
  handler: async (ctx, args) => {
    try {
      await checkPeopleOf(ctx, args.ref, args.attempt);
    } catch (error) {
      await checkAgainAfterFailure(ctx, args);
      throw error;
    }
  },
});

async function checkPeopleOf(ctx: ActionCtx, ref: MessageRef, attempt: bigint) {
  const users = await ctx.runQuery(internal.slack.directory.usersAwaited, { ref, attempt });
  if (users === null) return;
  for (const user of users) await lookUpUser(ctx, ref.workspace, user);
  await ctx.runMutation(internal.slack.directory.recheckMessage, { ref, attempt });
}

async function checkAgainAfterFailure(ctx: ActionCtx, { ref, attempt, failures = 0 }: ObjectType<typeof checkDirectoryArgs>) {
  const retryInMs = failedCheckRetriesMs[failures];
  if (retryInMs === undefined) return;
  await ctx.scheduler.runAfter(retryInMs, internal.slack.directory.checkDirectory, { ref, attempt, failures: failures + 1 });
}

const checkTries = failedCheckRetriesMs.length + 1;
const strandedAfterMs = failedCheckRetriesMs.reduce((total, retryMs) => total + retryMs, 0) + checkTries * convexActionTimeLimitMs;

export const recheckStranded = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const { checkAgain, pageWasFull } = await takeStrandedChecks(ctx, Date.now() - strandedAfterMs, strandedPerSweep);
    for (const { ref, attempt } of checkAgain) await ctx.scheduler.runAfter(0, internal.slack.directory.checkDirectory, { ref, attempt });
    if (pageWasFull) await ctx.scheduler.runAfter(0, internal.slack.directory.recheckStranded, {});
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

const recheckArgs = { ref: messageRefValidator, attempt: v.int64() };

export const recheckMessage = internalMutation({
  args: recheckArgs,
  handler: withholdingWords(async (ctx: MutationCtx, { ref, attempt }: ObjectType<typeof recheckArgs>) => {
    await checkDirectoryLater(ctx, ref, await recheck(ctx, ref, attempt));
  }),
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
      if (!page.ok) throw new ReportableError(`Slack users.list failed: ${slackErrorCodeOf(page.error)}`);
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
      if (!page.ok) throw new ReportableError(`Slack users.list failed: ${slackErrorCodeOf(page.error)}`);
      await ctx.runMutation(internal.workspace.directory.fillProfiles, { profiles: page.members.flatMap((user) => memberProfileOf(user, asOf)) });
      cursor = page.response_metadata?.next_cursor ?? "";
    } while (cursor !== "");
    await ctx.runMutation(internal.analytics.person.catchUp, {});
  },
});

export const listSlackMembers = observedAction({
  args: {},
  handler: async (ctx) => {
    let cursor = "";
    do {
      const asOf = Date.now();
      const page = await readSlack<UsersPage>("users.list", { limit: "200", ...(cursor && { cursor }) });
      if (!page.ok) throw new ReportableError(`Slack users.list failed: ${slackErrorCodeOf(page.error)}`);
      await ctx.runMutation(internal.workspace.listedMembers.keepListedMembers, { listings: page.members.flatMap((user) => listingOf(user, asOf)) });
      cursor = page.response_metadata?.next_cursor ?? "";
    } while (cursor !== "");
  },
});

function listingOf(user: SlackUser, asOf: number): DirectoryRecord[] {
  const [id, workspace] = [textOf(user.id), textOf(user.team_id)];
  return id === undefined || workspace === undefined ? [] : [directoryRecordOf(workspace, id, user, asOf)];
}

function memberProfileOf(user: SlackUser, asOf: number) {
  const listed = listedMemberOf(user);
  return listed === null ? [] : [{ workspace: listed.workspace, user: listed.id, profile: profileOf(user), asOf }];
}

function memberNameOf(user: SlackUser) {
  const listed = listedMemberOf(user);
  return listed?.entry.kind === "member" && listed.entry.name ? [{ workspace: listed.workspace, user: listed.id, name: listed.entry.name }] : [];
}

function listedMemberOf(user: SlackUser) {
  const id = textOf(user.id);
  const workspace = textOf(user.team_id);
  if (id === undefined || workspace === undefined) return null;
  const entry = directoryEntryOf(user, workspace);
  return entry.kind === "member" ? { id, workspace, entry } : null;
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
  if (!answer?.ok) return { kind: "failed", ...retryDelayOf(answer) };
  if (typeof answer.user !== "object" || answer.user === null) return { kind: "failed" };
  await ctx.runMutation(keep, directoryRecordOf(workspace, user, answer.user, askedAt));
  return { kind: "found" };
}

function retryDelayOf(refusal: { retryAfterMs?: unknown } | null) {
  const retryAfterMs = refusal?.retryAfterMs;
  return typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) ? { retryAfterMs } : {};
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
  const timeZone = textOf(user.tz);
  return {
    kind: "member",
    ...(name && { name }),
    ...(timeZone && { timeZone }),
    ...((user.is_admin || user.is_owner) && { admin: true }),
    ...profileOf(user),
  };
}

function profileOf({ profile, real_name }: SlackUser): MemberProfile {
  const email = textOf(profile?.email);
  const realName = textOf(profile?.real_name) ?? textOf(real_name);
  const displayName = textOf(profile?.display_name);
  const title = textOf(profile?.title);
  const picture = httpsAddressOf(profile?.image_192) ?? httpsAddressOf(profile?.image_72);
  return { ...(email && { email }), ...(realName && { realName }), ...(displayName && { displayName }), ...(title && { title }), ...(picture && { picture }) };
}

function httpsAddressOf(value: unknown) {
  const text = textOf(value);
  return text !== undefined && isHttpsAddress(text) ? text : undefined;
}

function isHttpsAddress(text: string) {
  try {
    return new URL(text).protocol === "https:";
  } catch {
    return false;
  }
}

function displayNameOf(user: SlackUser) {
  return textOf(user.profile?.display_name) ?? textOf(user.profile?.real_name) ?? textOf(user.real_name) ?? textOf(user.name);
}

export function textOf(value: unknown) {
  return typeof value === "string" && value !== "" ? value : undefined;
}
