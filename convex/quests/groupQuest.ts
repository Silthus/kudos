import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { exposed, memberDecision, workspaceDecision } from "../analytics/flags";
import { awardsAttributedEventValidator, type AwardsAttributedEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { republish } from "../feedback/homes";
import { attributedToGroupPage } from "../groups/attribution";
import { groupsFlag } from "../groups/flag";
import { availableIn, countsAsGroup, groupModeOf, groupsShownTo, memberGroupsOf, type GroupId, type GroupMode, type GroupRef } from "../groups/groups";
import { primaryGroupAt } from "../groups/history";
import { reconcilePageOf } from "../groups/reconcile";
import { rewardOf } from "../progression/rewards";
import { openedAtOf } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";
import { maxUserGroupsKept } from "../workspace/userGroups";
import { questsApplyIn, questsApplyTo } from "./flag";
import { crateOpeningOf, groupWeekOfRewardKey, rewardKeyOf, rewardKeyPrefixOf } from "./crates";
import { finishQuest } from "./finish";
import { doesGroupQuestAction, drawGroupQuest, groupGoalOf, groupQuestPool, groupTargetOf, type GroupQuestId } from "./groupPool";
import { groupQuestFlag } from "./groupQuestFlag";
import type { Reward } from "./journey";
import type { GroupQuestCrate } from "./step";
import { weekKeyOf, weekStartOf, type WeekKey } from "./week";

const membersPerPage = 100;
const groupsPerPage = 25;
const participantsPerEvent = 500;
const workspacesPerSweep = 500;
const attributionsPerCatchUp = 1;
const weekMs = 7 * 24 * 60 * 60 * 1000;

const tallyValidator = v.array(v.object({ group: v.id("userGroups"), membersInside: v.number(), participants: v.array(v.id("members")) }));

type Tally = Infer<typeof tallyValidator>;

type GroupTally = Tally[number];

export type GroupQuest = {
  group: GroupRef;
  quest: GroupQuestId;
  goal: string;
  week: WeekKey;
  endsAt: number;
  tookPart: number;
  target: number;
  you: boolean;
  done: boolean;
  reward: Reward;
  crate: { key: string; opened: boolean } | null;
};

export type WaitingGroupCrate = { crate: GroupQuestCrate; group: string; goal: string };

export const sweep = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const now = Date.now();
    const week = groupWeekOf(now);
    let scheduled = 0;
    for (const workspace of await workspacesWithGroups(ctx)) {
      if (scheduled === workspacesPerSweep || !(await isDueToDraw(ctx, workspace, week, now))) continue;
      await ctx.scheduler.runAfter(0, internal.quests.groupQuest.tallyParticipants, { workspace, week, members: 0, tally: [] });
      scheduled += 1;
    }
  },
});

export const tallyParticipants = internalMutation({
  args: { workspace: v.string(), week: v.string(), after: v.optional(v.string()), members: v.number(), tally: tallyValidator },
  handler: async (ctx, { workspace, week, after, members, tally }): Promise<void> => {
    const page = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => (after === undefined ? q.eq("workspace", workspace) : q.eq("workspace", workspace).gt("user", after)))
      .take(membersPerPage);
    const people = page.filter(({ kind }) => kind !== "bot");
    const unreconciled = await reconcilePageOf(ctx, people.map(({ _id }) => _id));
    const tallied = people.slice(0, people.length - unreconciled.length);
    const groups = new Map(tally.map((entry) => [entry.group, entry]));
    for (const person of tallied) await tallyMember(ctx, groups, person, weekStartOf(week, undefined));
    const next = { workspace, week, members: members + tallied.filter(({ kind }) => kind === "member").length, tally: [...groups.values()] };
    const readUpTo = unreconciled.length === 0 ? page.at(-1)?.user : tallied.at(-1)?.user;
    if (page.length === membersPerPage || unreconciled.length > 0) await ctx.scheduler.runAfter(0, internal.quests.groupQuest.tallyParticipants, { ...next, after: readUpTo ?? after });
    else await ctx.scheduler.runAfter(0, internal.quests.groupQuest.drawGroupQuests, next);
  },
});

export const drawGroupQuests = internalMutation({
  args: { workspace: v.string(), week: v.string(), members: v.number(), tally: tallyValidator },
  handler: async (ctx, { workspace, week, members, tally }): Promise<void> => {
    const mode = await groupModeOf(ctx, workspace);
    for (const entry of tally.slice(0, groupsPerPage)) await drawFor(ctx, { workspace, week, members, mode }, entry);
    const rest = tally.slice(groupsPerPage);
    if (rest.length > 0) await ctx.scheduler.runAfter(0, internal.quests.groupQuest.drawGroupQuests, { workspace, week, members, tally: rest });
    else if ((await drawnWeekIn(ctx, workspace, week)) === null) await ctx.db.insert("groupQuestWeeks", { workspace, week, drawnAt: Date.now() });
  },
});

export const followAwardsAttributed = internalMutation({
  args: { event: awardsAttributedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await contribute(ctx, event);
  },
});

export const catchUpContributions = internalMutation({
  args: { quest: v.id("groupQuests"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { quest, cursor }): Promise<void> => {
    const drawn = (await ctx.db.get(quest))!;
    const weekStart = weekStartOf(drawn.week, undefined);
    const { events, isDone, continueCursor } = await attributedToGroupPage(ctx, drawn.group, { from: weekStart, to: weekStart + weekMs }, cursor, attributionsPerCatchUp);
    for (const event of events) await contribute(ctx, event);
    if (!isDone) await ctx.scheduler.runAfter(0, internal.quests.groupQuest.catchUpContributions, { quest, cursor: continueCursor });
  },
});

export const groupQuestOf = internalQuery({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<GroupQuest | null> => ((await groupQuestAppliesTo(ctx, member)) ? groupQuestFor(ctx, member, Date.now()) : null),
});

export async function groupQuestShownAndExposedTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  if (!(await groupsShownTo(ctx, member)) || !(await questsApplyTo(ctx, member))) return false;
  const applies = await memberDecision(ctx, groupQuestFlag, member);
  await exposed(ctx, groupQuestFlag, member, applies);
  return applies;
}

export async function groupQuestFor(ctx: QueryCtx, member: MemberId, at: number): Promise<GroupQuest | null> {
  const week = groupWeekOf(at);
  const startedIn = await primaryGroupAt(ctx, member, weekStartOf(week, undefined));
  const drawn = startedIn === null ? null : await groupQuestIn(ctx, startedIn, week);
  const group = drawn === null || !drawn.participants.includes(member) ? null : await ctx.db.get(drawn.group);
  if (drawn === null || group === null) return null;
  const { quest, target, reward } = drawn;
  const tookPart = (await contributorsOf(ctx, drawn)).length;
  return {
    group: { group: group._id, name: group.name },
    quest,
    goal: groupGoalOf(quest, group.name),
    week,
    endsAt: weekStartOf(week, undefined) + weekMs,
    tookPart,
    target,
    you: await hasContributed(ctx, drawn, member),
    done: tookPart === target,
    reward,
    crate: await crateOf(ctx, member, crateOfWeek(drawn)),
  };
}

export async function earlierGroupCratesOf(ctx: QueryCtx, member: MemberId, at: number): Promise<WaitingGroupCrate[]> {
  const prefix = rewardKeyPrefixOf("group");
  const pending = await ctx.db
    .query("pendingCrates")
    .withIndex("by_member_key", (q) => q.eq("member", member).gte("key", prefix).lt("key", `${prefix}\uffff`))
    .collect();
  const waiting: WaitingGroupCrate[] = [];
  for (const { key } of pending) {
    const crate = await groupCrateOfKey(ctx, key);
    if (crate !== null && crate.crate.week !== groupWeekOf(at)) waiting.push(crate);
  }
  return waiting.sort((one, other) => one.crate.week.localeCompare(other.crate.week));
}

async function groupCrateOfKey(ctx: QueryCtx, key: string): Promise<WaitingGroupCrate | null> {
  const parsed = groupWeekOfRewardKey(key);
  const group = parsed === null ? null : ctx.db.normalizeId("userGroups", parsed.group);
  const row = group === null ? null : await ctx.db.get(group);
  const drawn = row === null ? null : await groupQuestIn(ctx, row._id, parsed!.week);
  if (row === null || drawn === null) return null;
  return { crate: crateOfWeek(drawn), group: row.name, goal: groupGoalOf(drawn.quest, row.name) };
}

export async function groupQuestIdOf(ctx: QueryCtx, { group, week }: GroupQuestCrate): Promise<GroupQuestId | null> {
  return (await groupQuestIn(ctx, group, week))?.quest ?? null;
}

async function contribute(ctx: MutationCtx, event: AwardsAttributedEvent) {
  const drawn = await groupQuestContributedToBy(ctx, event);
  if (drawn === null || (await hasContributed(ctx, drawn, event.giver))) return;
  const before = await contributorsOf(ctx, drawn);
  const { workspace, giver, message, at } = event;
  await ctx.db.insert("groupQuestContributions", { workspace, group: drawn.group, week: drawn.week, member: giver, message, at });
  for (const member of rewardedBy(drawn, before, giver)) await rewardContributor(ctx, drawn, member, at);
  await republish(ctx, giver);
}

async function groupQuestContributedToBy(ctx: QueryCtx, { group, giver, at, awards }: AwardsAttributedEvent): Promise<Doc<"groupQuests"> | null> {
  const drawn = group === null ? null : await groupQuestIn(ctx, group, groupWeekOf(at));
  if (drawn === null || !drawn.participants.includes(giver) || !doesGroupQuestAction(drawn.quest, drawn.group, awards)) return null;
  return (await groupQuestAppliesTo(ctx, giver)) ? drawn : null;
}

function rewardedBy({ target }: Doc<"groupQuests">, before: MemberId[], contributor: MemberId): MemberId[] {
  if (before.length >= target) return [contributor];
  return before.length + 1 === target ? [...before, contributor] : [];
}

async function rewardContributor(ctx: MutationCtx, drawn: Doc<"groupQuests">, member: MemberId, at: number) {
  if (!(await groupQuestAppliesTo(ctx, member))) return;
  const { workspace, reward, catalogueVersion, quest } = drawn;
  await finishQuest(ctx, workspace, member, crateOfWeek(drawn), { reward, catalogueVersion, poolQuest: quest }, at);
}

async function crateOf(ctx: QueryCtx, member: MemberId, quest: GroupQuestCrate): Promise<GroupQuest["crate"]> {
  const key = rewardKeyOf(quest);
  if ((await rewardOf(ctx, member, key)) === null) return null;
  return { key, opened: (await crateOpeningOf(ctx, member, key)) !== null };
}

function crateOfWeek({ group, week }: Doc<"groupQuests">): GroupQuestCrate {
  return { kind: "group", group, week };
}

async function contributorsOf(ctx: QueryCtx, { group, week, target }: Doc<"groupQuests">): Promise<MemberId[]> {
  const contributions = await ctx.db
    .query("groupQuestContributions")
    .withIndex("by_group_week_member", (q) => q.eq("group", group).eq("week", week))
    .take(target);
  return contributions.map(({ member }) => member);
}

async function hasContributed(ctx: QueryCtx, { group, week }: Doc<"groupQuests">, member: MemberId): Promise<boolean> {
  const contribution = await ctx.db
    .query("groupQuestContributions")
    .withIndex("by_group_week_member", (q) => q.eq("group", group).eq("week", week).eq("member", member))
    .unique();
  return contribution !== null;
}

export async function groupQuestAppliesTo(ctx: QueryCtx | MutationCtx, member: MemberId): Promise<boolean> {
  return (await memberDecision(ctx, groupQuestFlag, member)) && (await groupsShownTo(ctx, member)) && (await questsApplyTo(ctx, member));
}

async function groupQuestAppliesIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return (await workspaceDecision(ctx, groupQuestFlag, workspace)) && (await workspaceDecision(ctx, groupsFlag, workspace)) && (await availableIn(ctx, workspace)) && (await questsApplyIn(ctx, workspace));
}

async function takesPart(ctx: MutationCtx, member: MemberId, weekStart: number): Promise<boolean> {
  const openedAt = await openedAtOf(ctx, member, "quests");
  if (openedAt === null || openedAt > weekStart) return false;
  return (await memberDecision(ctx, groupQuestFlag, member)) && (await memberDecision(ctx, groupsFlag, member)) && (await questsApplyTo(ctx, member));
}

async function tallyMember(ctx: MutationCtx, groups: Map<GroupId, GroupTally>, person: Doc<"members">, weekStart: number) {
  const entryOf = (group: GroupId) => groups.get(group) ?? groups.set(group, { group, membersInside: 0, participants: [] }).get(group)!;
  const now = (await memberGroupsOf(ctx, person._id))?.primary ?? null;
  if (person.kind === "member" && now !== null) entryOf(now).membersInside += 1;
  const startedIn = await primaryGroupAt(ctx, person._id, weekStart);
  if (startedIn !== null && (await takesPart(ctx, person._id, weekStart))) entryOf(startedIn).participants.push(person._id);
}

type Draw = { workspace: string; week: WeekKey; members: number; mode: GroupMode };

async function drawFor(ctx: MutationCtx, { workspace, week, members, mode }: Draw, { group, membersInside, participants }: GroupTally) {
  if (participants.length < 2 || (await groupQuestIn(ctx, group, week)) !== null) return;
  const row = await ctx.db.get(group);
  if (row === null || !countsAsGroup(row, mode)) return;
  const feasibleBecause = { participants: participants.length, membersOutside: members - membersInside };
  const quest = drawGroupQuest(group, week, feasibleBecause);
  const drawnAt = Date.now();
  const { version: catalogueVersion, reward } = groupQuestPool;
  const drawn = await ctx.db.insert("groupQuests", { workspace, group, week, quest, participants, target: groupTargetOf(participants.length), reward, catalogueVersion, feasibleBecause, drawnAt });
  await ctx.scheduler.runAfter(0, internal.quests.groupQuest.catchUpContributions, { quest: drawn, cursor: null });
  for (let start = 0; start < participants.length; start += participantsPerEvent) {
    await publish(ctx, { type: "groupQuestDrawn", workspace, week, quest, participants: participants.slice(start, start + participantsPerEvent), at: drawnAt });
  }
}

async function isDueToDraw(ctx: MutationCtx, workspace: string, week: WeekKey, now: number): Promise<boolean> {
  const launch = await ctx.db
    .query("groupQuestLaunches")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
  if (launch !== null) return launch.at < weekStartOf(week, undefined) && (await drawnWeekIn(ctx, workspace, week)) === null;
  if (await groupQuestAppliesIn(ctx, workspace)) await ctx.db.insert("groupQuestLaunches", { workspace, at: now });
  return false;
}

async function workspacesWithGroups(ctx: QueryCtx): Promise<string[]> {
  const groups = await ctx.db.query("userGroups").take(maxUserGroupsKept);
  return [...new Set(groups.map(({ workspace }) => workspace))];
}

function groupWeekOf(at: number): WeekKey {
  return weekKeyOf(at, undefined);
}

function drawnWeekIn(ctx: QueryCtx, workspace: string, week: WeekKey) {
  return ctx.db
    .query("groupQuestWeeks")
    .withIndex("by_workspace_week", (q) => q.eq("workspace", workspace).eq("week", week))
    .unique();
}

function groupQuestIn(ctx: QueryCtx, group: GroupId, week: WeekKey) {
  return ctx.db
    .query("groupQuests")
    .withIndex("by_group_week", (q) => q.eq("group", group).eq("week", week))
    .unique();
}
