import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { ReportableError } from "../analytics/exceptions";
import { keepsMembers, maxUserGroupsKept, type UserGroup } from "../workspace/userGroups";
import { readSlack, slackErrorCodeOf, type SlackAnswer, type SlackFailure } from "./webApi";

type SlackUserGroup = { id?: unknown; team_id?: unknown; handle?: unknown; name?: unknown; date_delete?: unknown; auto_type?: unknown };

type UserGroupChanged =
  | { type: "subteam_created" | "subteam_updated"; subteam?: { id?: unknown } }
  | { type: "subteam_members_changed"; subteam_id?: unknown };

type Listing = { kind: "listed"; groups: UserGroup[] } | { kind: "rate-limited"; retryAfterMs: number };

type GroupKey = { workspace: string; group: string };

const userGroupEvents: ReadonlySet<string> = new Set(["subteam_created", "subteam_updated", "subteam_members_changed"]);
const withoutUserGroups = "plan_upgrade_required";
const goneUserGroup = "no_such_subteam";
const membersListSpacingMs = 3_000;
const membersListsPerRun = 100;
const maxAttempts = 3;
const maxMembersKept = 7_500;
const attemptArgs = { attempt: v.optional(v.number()) };

export function isUserGroupChanged(event: { type: string }): event is UserGroupChanged {
  return userGroupEvents.has(event.type);
}

export function userGroupChangeOf(workspace: unknown, eventId: unknown, event: UserGroupChanged) {
  const group = event.type === "subteam_members_changed" ? event.subteam_id : event.subteam?.id;
  const [team, receipt, id] = [textOf(workspace), textOf(eventId), textOf(group)];
  return team === undefined || receipt === undefined || id === undefined ? null : { workspace: team, eventId: receipt, group: id };
}

export const syncUserGroups = observedAction({
  args: attemptArgs,
  handler: async (ctx, { attempt = 1 }) => {
    const asOf = Date.now();
    const listing = await userGroupsListed();
    if (listing.kind === "rate-limited") {
      await ctx.scheduler.runAfter(listing.retryAfterMs, internal.slack.userGroups.syncUserGroups, { attempt: nextAttempt(attempt, "usergroups.list") });
      return;
    }
    await ctx.runMutation(internal.workspace.userGroups.keepUserGroups, { listed: listing.groups, scope: { kind: "every-group" }, asOf });
    await scheduleMembersLists(ctx, listing.groups.filter(keepsMembers).map(({ workspace, group }) => ({ workspace, group })));
  },
});

export const refreshMembersOfEach = observedAction({
  args: { groups: v.array(v.object({ workspace: v.string(), group: v.string() })) },
  handler: (ctx, { groups }) => scheduleMembersLists(ctx, groups),
});

export const refreshUserGroup = observedAction({
  args: { workspace: v.string(), group: v.string(), ...attemptArgs },
  handler: async (ctx, { workspace, group, attempt = 1 }) => {
    const asOf = Date.now();
    const listing = await userGroupsListed();
    if (listing.kind === "rate-limited") {
      await ctx.scheduler.runAfter(listing.retryAfterMs, internal.slack.userGroups.refreshUserGroup, { workspace, group, attempt: nextAttempt(attempt, "usergroups.list") });
      return;
    }
    const listed = listing.groups.filter((listedGroup) => listedGroup.workspace === workspace && listedGroup.group === group);
    await ctx.runMutation(internal.workspace.userGroups.keepUserGroups, { listed, scope: { kind: "one-group", workspace, group }, asOf });
    if (listed.some(keepsMembers)) await refreshMembersOf(ctx, { workspace, group }, 1);
  },
});

export const refreshMembers = observedAction({
  args: { workspace: v.string(), group: v.string(), ...attemptArgs },
  handler: (ctx, { attempt = 1, ...key }) => refreshMembersOf(ctx, key, attempt),
});

async function scheduleMembersLists(ctx: ActionCtx, groups: GroupKey[]) {
  const [now, later] = [groups.slice(0, membersListsPerRun), groups.slice(membersListsPerRun)];
  for (const [index, key] of now.entries()) await ctx.scheduler.runAfter(index * membersListSpacingMs, internal.slack.userGroups.refreshMembers, key);
  if (later.length > 0) await ctx.scheduler.runAfter(now.length * membersListSpacingMs, internal.slack.userGroups.refreshMembersOfEach, { groups: later });
}

async function refreshMembersOf(ctx: ActionCtx, key: GroupKey, attempt: number) {
  const asOf = Date.now();
  const answer = await readSlack<{ users?: unknown }>("usergroups.users.list", { usergroup: key.group, include_disabled: "true" });
  if (!answer.ok && answer.error === "ratelimited") {
    await ctx.scheduler.runAfter(retryDelayOf(answer), internal.slack.userGroups.refreshMembers, { ...key, attempt: nextAttempt(attempt, "usergroups.users.list") });
    return;
  }
  const users = !answer.ok && (answer.error === withoutUserGroups || answer.error === goneUserGroup) ? [] : membersOf(answer);
  await ctx.runMutation(internal.workspace.userGroups.keepUserGroupMembers, { ...key, users, asOf });
}

function membersOf(answer: SlackAnswer<{ users?: unknown }>): string[] {
  if (!answer.ok) throw new ReportableError(`Slack usergroups.users.list failed: ${slackErrorCodeOf(answer.error)}`);
  if (!Array.isArray(answer.users)) throw new ReportableError("Slack usergroups.users.list answered without a users list");
  if (answer.users.length > maxMembersKept) throw new ReportableError("Slack usergroups.users.list answered more members than a user group keeps");
  const users = answer.users.flatMap((user) => textOf(user) ?? []);
  if (users.length !== answer.users.length) throw new ReportableError("Slack usergroups.users.list answered a member it doesn't name");
  return users;
}

async function userGroupsListed(): Promise<Listing> {
  const answer = await readSlack<{ usergroups?: unknown }>("usergroups.list", { include_disabled: "true" });
  if (answer.ok) return { kind: "listed", groups: listedUserGroupsOf(answer.usergroups) };
  if (answer.error === "ratelimited") return { kind: "rate-limited", retryAfterMs: retryDelayOf(answer) };
  if (answer.error === withoutUserGroups) return { kind: "listed", groups: [] };
  throw new ReportableError(`Slack usergroups.list failed: ${slackErrorCodeOf(answer.error)}`);
}

function listedUserGroupsOf(listed: unknown): UserGroup[] {
  if (!Array.isArray(listed)) throw new ReportableError("Slack usergroups.list answered without a usergroups list");
  if (listed.length > maxUserGroupsKept) throw new ReportableError("Slack usergroups.list answered more user groups than the directory keeps");
  const groups = listed.flatMap(userGroupOf);
  if (groups.length !== listed.length) throw new ReportableError("Slack usergroups.list answered a user group it doesn't describe");
  return groups;
}

function userGroupOf(listed: unknown): UserGroup[] {
  if (typeof listed !== "object" || listed === null) return [];
  const group = listed as SlackUserGroup;
  const [workspace, id, handle, name] = [textOf(group.team_id), textOf(group.id), textOf(group.handle), textOf(group.name)];
  if (workspace === undefined || id === undefined || handle === undefined || name === undefined) return [];
  const { date_delete: disabledAt = 0, auto_type: automaticType = null } = group;
  if (typeof disabledAt !== "number" || (automaticType !== null && textOf(automaticType) === undefined)) return [];
  return [{ workspace, group: id, handle, name, enabled: disabledAt === 0, automatic: automaticType !== null }];
}

function nextAttempt(attempt: number, method: string) {
  if (attempt >= maxAttempts) throw new ReportableError(`Slack ${method} stayed rate limited`);
  return attempt + 1;
}

function retryDelayOf({ retryAfterMs }: SlackFailure) {
  return typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) ? retryAfterMs : 1_000;
}

function textOf(value: unknown) {
  return typeof value === "string" && value !== "" ? value : undefined;
}
