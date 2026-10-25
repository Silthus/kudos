import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { reportMondayDmSent } from "../analytics/isolatedUsage";
import { allowanceDay, wallClockAt, weekOf, type DayKey } from "../engine/allowance";
import { dmLinksFor, type DmLinks } from "../feedback/dmLinks";
import { settingsFooterFor } from "../feedback/settingsFooter";
import { hugsSectionFor, hugsSentInTheMondayDm, type HugsSection } from "../hugs/recap";
import { hiddenItemsShownTo } from "../items/flag";
import { waitingHoggieCountOf } from "../items/ledger";
import { questsSectionFor, type QuestsSection } from "../quests/mondaySection";
import { convexActionTimeLimitMs } from "../slack/strandedJobs";
import { chatUserOf, isMember, timeZoneOf, type MemberId } from "../workspace/directory";
import { questsCopyOf, type QuestsCopy } from "./questsCopy";
import type { MondayDmContent, MondayDmSection } from "./records";
import { mondayDmOf, type MondayDmRow } from "./rows";

export type MondayQuests = QuestsCopy & { waiting: boolean; links: DmLinks | null };

export type MondayDm = { dm: Id<"mondayDms">; workspace: string; user: string } & MondayDmContent;

const startsPerSweep = 100;
const strandedPerSweep = 100;
const dueHour = 9;
const dayMs = 24 * 60 * 60 * 1000;

export const ensureMondayDms = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }): Promise<void> => {
    if (cursor === undefined) await failStrandedStarts(ctx);
    const starts = await ctx.db.query("questStarts").paginate({ numItems: startsPerSweep, cursor: cursor ?? null });
    for (const { member } of starts.page) await ensureMondayDm(ctx, member, Date.now());
    if (!starts.isDone) await ctx.scheduler.runAfter(0, internal.mondayDm.mondayDm.ensureMondayDms, { cursor: starts.continueCursor });
  },
});

const tryArgs = { dm: v.id("mondayDms"), attempt: v.number() };

export const startMondayDm = internalMutation({
  args: tryArgs,
  handler: async (ctx, { dm, attempt }): Promise<MondayDm | null> => {
    const row = await awaitingTry(ctx, dm, attempt - 1);
    if (row === null) return null;
    const dueAt = await dueAtOf(ctx, row.member, row.monday);
    if (dueAt > Date.now()) return scheduleTry(ctx, dm, dueAt, attempt);
    const sections = (await isMember(ctx, row.member)) ? await sectionsOf(ctx, row) : { hugs: null, quests: null };
    const sent = sectionNamesOf(sections);
    if (sent.length === 0) {
      await ctx.db.patch(dm, { state: "skipped" });
      return null;
    }
    const { workspace, user } = await chatUserOf(ctx, row.member);
    const content = await contentOf(ctx, workspace, row.member, sections);
    await ctx.db.patch(dm, { tries: attempt, dueAt: Date.now(), sections: sent, content });
    return { dm, workspace, user, ...content };
  },
});

export const mondayDmLater = internalMutation({
  args: { ...tryArgs, retry: v.object({ at: v.number(), attempt: v.number() }) },
  handler: async (ctx, { dm, attempt, retry }) => {
    if ((await awaitingTry(ctx, dm, attempt)) === null) return;
    await ctx.db.patch(dm, { tries: retry.attempt - 1 });
    await scheduleTry(ctx, dm, retry.at, retry.attempt);
  },
});

export const mondayDmEnded = internalMutation({
  args: { ...tryArgs, outcome: v.union(v.literal("delivered"), v.literal("gone"), v.literal("failed")) },
  handler: async (ctx, { dm, attempt, outcome }) => {
    const row = await awaitingTry(ctx, dm, attempt);
    if (row === null) return;
    const delivered = outcome === "delivered";
    await ctx.db.patch(dm, { state: delivered ? "sent" : "failed" });
    if (delivered) await reportDelivered(ctx, row);
  },
});

async function reportDelivered(ctx: MutationCtx, { member, monday, sections = [] }: MondayDmRow) {
  const { workspace } = await chatUserOf(ctx, member);
  await reportMondayDmSent(ctx, { workspace, member, sections, at: Date.now() });
  if (sections.includes("hugs")) await hugsSentInTheMondayDm(ctx, member, monday);
}

async function ensureMondayDm(ctx: MutationCtx, member: MemberId, at: number) {
  const timeZone = (await timeZoneOf(ctx, member)) ?? undefined;
  const monday = mondayAfter(weekOf(allowanceDay(at, timeZone)).monday);
  if ((await mondayDmOf(ctx, member, monday)) !== null) return;
  const dueAt = wallClockAt(monday, dueHour, timeZone);
  const dm = await ctx.db.insert("mondayDms", { member, monday, state: "scheduled", dueAt, tries: 0 });
  await ctx.scheduler.runAt(dueAt, internal.slack.mondayDm.sendMondayDm, { dm, attempt: 1 });
}

async function sectionsOf(ctx: MutationCtx, { member, monday }: MondayDmRow) {
  const quests = await questsSectionFor(ctx, member, Date.now());
  return { hugs: await hugsSectionFor(ctx, member, monday), quests };
}

function sectionNamesOf({ hugs, quests }: { hugs: HugsSection | null; quests: QuestsSection | null }): MondayDmSection[] {
  return [...(hugs === null ? [] : ["hugs" as const]), ...(quests === null ? [] : ["quests" as const])];
}

async function contentOf(ctx: QueryCtx, workspace: string, member: MemberId, { hugs, quests }: { hugs: HugsSection | null; quests: QuestsSection | null }): Promise<MondayDmContent> {
  return { hugs, quests: await mondayQuestsOf(ctx, workspace, member, quests), footer: hugs === null ? null : await settingsFooterFor(ctx, member) };
}

async function mondayQuestsOf(ctx: QueryCtx, workspace: string, member: MemberId, quests: QuestsSection | null): Promise<MondayQuests | null> {
  if (quests === null) return null;
  const waiting = (await hiddenItemsShownTo(ctx, member)) ? await waitingHoggieCountOf(ctx, member) : 0;
  return { ...questsCopyOf(quests, waiting), waiting: waiting !== 0, links: await dmLinksFor(ctx, workspace, member) };
}

async function scheduleTry(ctx: MutationCtx, dm: Id<"mondayDms">, dueAt: number, attempt: number): Promise<null> {
  await ctx.db.patch(dm, { dueAt });
  await ctx.scheduler.runAt(dueAt, internal.slack.mondayDm.sendMondayDm, { dm, attempt });
  return null;
}

async function failStrandedStarts(ctx: MutationCtx) {
  const stranded = await ctx.db
    .query("mondayDms")
    .withIndex("by_state_due", (q) => q.eq("state", "scheduled").lt("dueAt", Date.now() - convexActionTimeLimitMs))
    .take(strandedPerSweep);
  for (const row of stranded) if (row.tries > 0) await ctx.db.patch(row._id, { state: "failed" });
}

async function awaitingTry(ctx: QueryCtx, dm: Id<"mondayDms">, tries: number): Promise<MondayDmRow | null> {
  const row = await ctx.db.get(dm);
  return row?.state === "scheduled" && row.tries === tries ? row : null;
}

async function dueAtOf(ctx: QueryCtx, member: MemberId, monday: DayKey) {
  return wallClockAt(monday, dueHour, (await timeZoneOf(ctx, member)) ?? undefined);
}

function mondayAfter(monday: DayKey): DayKey {
  return new Date(Date.parse(`${monday}T00:00:00Z`) + 7 * dayMs).toISOString().slice(0, 10);
}
