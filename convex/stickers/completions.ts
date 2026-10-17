import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { countTeamPagesCompleted, type CompletedUnder } from "../achievements/achievements";
import { publish } from "../bus/publish";
import type { KudosGivenEvent } from "../bus/events";
import { companyTeamsOf } from "../companyProfiles/teams";
import { awardIdValidator, latestInAwardOrder, messageOfAward, type AwardId, type LatestInAwardOrder } from "../engine/awards";
import type { CompletedTeam } from "../feedback/notify";
import { crestsCollectedBy } from "../hoggies/collection";
import { crestsShownTo } from "../hoggies/flag";
import { memberRowsIn, type MemberId } from "../workspace/directory";
import { teamSpiritAppliesTo } from "./flag";
import { completionRecordsInOrder, teamsCompletedBy } from "./completionRecords";
import { stickersNewestFirst, type HeldSticker } from "./records";
import { isFull, teamPagesOf, type CollectedCrest, type TeamPageOf } from "./teamPages";

export const completionsPerMutation = 25;

const checkValidator = v.object({ workspace: v.string(), member: v.id("members"), award: awardIdValidator, at: v.number() });

type Check = Infer<typeof checkValidator>;

export type NewSticker = { member: MemberId; award: AwardId };

type DuePage = { page: TeamPageOf; completing: { award: AwardId; at: number } };

export async function checkTeamPagesAfter(ctx: MutationCtx, { workspace, at }: KudosGivenEvent, newStickers: NewSticker[]) {
  const awardOf = new Map<MemberId, AwardId>();
  for (const { member, award } of newStickers) if (!awardOf.has(member)) awardOf.set(member, award);
  for (const [member, award] of awardOf) await ctx.scheduler.runAfter(0, internal.stickers.completions.checkTeamPages, { check: { workspace, member, award, at } });
}

export const checkTeamPages = internalMutation({
  args: { check: checkValidator },
  handler: async (ctx, { check }) => {
    if (!(await teamSpiritAppliesTo(ctx, check.member))) return;
    const roster = await rosterCrestsOf(ctx, check.member);
    const { pages: due, held } = await fullUnrecordedPages(ctx, check, roster);
    const recorded = due.slice(0, completionsPerMutation);
    const finished = recorded.length === due.length;
    const told = await toldAfterTheFirstCheck(ctx, check, finished);
    const completed = await recordCompletions(ctx, check, await withCompletingAwards(ctx, recorded, held), { told, roster });
    await countTeamPagesCompleted(ctx, check, await completionRecordsInOrder(ctx, check.member), told ? completed : new Map());
    if (!finished) await ctx.scheduler.runAfter(0, internal.stickers.completions.checkTeamPages, { check });
  },
});

async function rosterCrestsOf(ctx: QueryCtx, member: MemberId): Promise<CollectedCrest[]> {
  return (await crestsShownTo(ctx, member)) ? crestsCollectedBy(ctx, member) : [];
}

async function toldAfterTheFirstCheck(ctx: MutationCtx, { member, at }: Check, finished: boolean): Promise<boolean> {
  const first = await ctx.db
    .query("teamPageChecks")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  if (first === null) await ctx.db.insert("teamPageChecks", { member, at, finished });
  else if (!first.finished && finished) await ctx.db.patch(first._id, { finished });
  return first?.finished === true;
}

type HeldStickers = Map<MemberId, HeldSticker>;

async function fullUnrecordedPages(ctx: QueryCtx, { workspace, member }: Check, crests: CollectedCrest[]): Promise<{ pages: TeamPageOf[]; held: HeldStickers }> {
  const stickers = await stickersNewestFirst(ctx, member);
  const pages = await teamPagesOf(ctx, { member, workspace }, { members: await memberRowsIn(ctx, workspace), stickers, crests });
  const recorded = new Set(await teamsCompletedBy(ctx, member));
  const full = pages.filter((page) => page.listed && isFull(page) && !recorded.has(page.team)).toSorted(byNameThenTeam);
  return { pages: full, held: new Map(stickers.map((sticker) => [sticker.person, sticker])) };
}

async function withCompletingAwards(ctx: QueryCtx, pages: TeamPageOf[], held: HeldStickers): Promise<DuePage[]> {
  const latestOf = latestInAwardOrder(ctx);
  const due: DuePage[] = [];
  for (const page of pages) due.push({ page, completing: await completingAwardOf(page, held, latestOf) });
  return due;
}

async function completingAwardOf({ people }: TeamPageOf, held: HeldStickers, latestOf: LatestInAwardOrder) {
  const stickers = people.flatMap(({ person }) => held.get(person) ?? []);
  const at = Math.max(...stickers.map(({ firstAt }) => firstAt));
  const latest = [...new Set(stickers.filter(({ firstAt }) => firstAt === at).map(({ firstAward }) => firstAward))];
  const award = latest.length === 1 ? latest[0]! : ((await latestOf(latest)) ?? latest[0]!);
  return { award, at };
}

function byNameThenTeam(first: TeamPageOf, second: TeamPageOf) {
  return first.name.localeCompare(second.name) || first.team.localeCompare(second.team);
}

type Recording = { told: boolean; roster: CollectedCrest[] };

async function recordCompletions(ctx: MutationCtx, { workspace, member }: Check, due: DuePage[], { told, roster }: Recording): Promise<CompletedUnder> {
  if (due.length === 0) return new Map();
  const crestImages = new Map((await companyTeamsOf(ctx)).map(({ team, crestImage }) => [team, crestImage]));
  const completed = new Map<AwardId, { at: number; teams: CompletedTeam[]; counted: Array<{ team: string; people: number }> }>();
  for (const { page, completing } of due) {
    const crestImage = crestImages.get(page.team);
    await ctx.db.insert("teamPageCompletions", { member, team: page.team, name: page.name, ...(crestImage !== undefined && { crestImage }), ...completing, people: page.total, told });
    const under = completed.get(completing.award) ?? { at: completing.at, teams: [], counted: [] };
    under.teams.push({ team: page.team, name: page.name, crestEarned: !rosterHeldBy(roster, page.team, completing.at) });
    under.counted.push({ team: page.team, people: page.total });
    completed.set(completing.award, under);
  }
  for (const [award, { at, counted }] of completed) {
    const message = await messageOfAward(ctx, award);
    if (message !== null) await publish(ctx, { type: "teamPagesCompleted", workspace, member, message, award, teams: counted, at, told });
  }
  return new Map([...completed].map(([award, { at, teams }]) => [award, { at, teams }]));
}

function rosterHeldBy(roster: CollectedCrest[], team: string, at: number) {
  return roster.some(({ crest, collectedAt }) => crest === team && collectedAt <= at);
}

