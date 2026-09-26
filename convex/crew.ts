import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { gameShownTo, playerOf } from "./game";
import { Gains } from "./gains";
import { assertNotDemo, requireAdmin, requireViewer, type Viewer } from "./lib/access";
import { coinBalance, WALLET_LEVEL } from "./lib/coins";
import { bannerText, BANNER_TEXT, CREW, crewPart, partsAvailable, validOption, type CrewPart } from "./lib/crewCatalogue";
import { DAY_MS, dayKeyFor, workspaceNow } from "./lib/time";
import { districtsOpen, stageForGrowth, TREE_STAGE_BY_ID, type TreeStageId } from "./lib/tree";
import { crewPartTitle } from "./lib/treeView";
import { crewProposersValidator } from "./schema";
import { announceTreeEvent, treeOf } from "./tree";
import { spendCoins } from "./wallet";

/**
 * Crew quests (#161, design plan #152 S6; the catalogue is `lib/crewCatalogue.ts`). The crew pools Hog
 * coins on a part of the Ancient Tree:
 *
 * - **Propose** (`propose`): admins, or players from CREW.proposeLevel unless the gatehouse says admins
 *   only; a part the tree's stage allows that isn't built (once-only parts) or open already; CREW.maxOpen
 *   quests open at once (proposed or funded, not yet built). A banner's saying is one line of plain
 *   text; with banner moderation on, a banner proposed by someone who isn't an admin waits for an
 *   admin's approval (`approveBanner`) before it takes coins. A quest nobody has given to can be withdrawn.
 * - **Contribute** (`contribute`): coins are spent at once from the wallet (`spendCoins`), never
 *   refunded, and only what the goal still needs. The quest row holds the running total, so
 *   contributions racing for the last coins conflict and retry: exactly one funds it. The ledger
 *   (`crewContributions`) keeps one line per member per quest. A member's first contribution ever
 *   is their `crew` game event (#159's step Together).
 * - **Funded → built**: funding is a `crew_funded` tree event and a post in the announcement channel;
 *   CREW.buildDays later on the workspace clock `build` writes the part into the tree's cosmetics
 *   (once: only a funded quest builds), a `crew_built` event and post, and one DM to each contributor.
 *   The build is scheduled; a simulator's clock runs ahead, so its days build it too (`settleCrew`).
 *
 * Quests and contributions are state: a game rebuild never touches them, and a member who leaves
 * stays on the plaque as "a former teammate".
 */

/** Ledger lines a quest keeps: one per member, so this many teammates may give to one quest. */
export const CONTRIBUTORS_MAX = 500;
/** Built quests the plaque shows, newest first (each with up to CONTRIBUTORS_MAX names). */
const PLAQUE_MAX = 12;
/** Quests a workspace may have open at once is CREW.maxOpen; reads take a few more in case of a race. */
const OPEN_READ = CREW.maxOpen + 4;
const FORMER = "a former teammate";
const BUILD_MS = CREW.buildDays * DAY_MS;

type Quest = Doc<"crewQuests">;

/** The quests not yet built (proposed or funded), oldest first. */
async function openQuests(ctx: QueryCtx, workspaceId: Id<"workspaces">): Promise<Quest[]> {
  const proposed = await ctx.db
    .query("crewQuests")
    .withIndex("by_workspace_status", (q) => q.eq("workspaceId", workspaceId).eq("status", "proposed"))
    .take(OPEN_READ);
  const funded = await ctx.db
    .query("crewQuests")
    .withIndex("by_workspace_status", (q) => q.eq("workspaceId", workspaceId).eq("status", "funded"))
    .take(OPEN_READ);
  return [...proposed, ...funded].sort((a, b) => a.proposedAt - b.proposedAt);
}

/** The parts built on the tree, one per part id (a style built again replaced the one before). */
async function builtParts(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return (await treeOf(ctx, workspaceId))?.cosmetics ?? [];
}

async function stageOf(ctx: QueryCtx, workspaceId: Id<"workspaces">): Promise<TreeStageId> {
  return stageForGrowth((await treeOf(ctx, workspaceId))?.peakGrowth ?? 0);
}

const crewOpen = (stage: TreeStageId) => districtsOpen(stage).includes("crew");

/** Whether the viewer may propose now, and if not, why (in words for the window). */
async function mayPropose(ctx: QueryCtx, viewer: Viewer, stage: TreeStageId, open: Quest[]): Promise<{ ok: true } | { ok: false; why: string }> {
  const { workspace, member } = viewer;
  if (!crewOpen(stage)) return { ok: false, why: `Crew quests begin when the tree is ${TREE_STAGE_BY_ID.great.name}.` };
  if (!member.isAdmin) {
    if (workspace.crewProposers === "admins") return { ok: false, why: "In this workspace only admins propose crew quests." };
    const level = (await playerOf(ctx, member._id))?.level ?? 1;
    if (level < CREW.proposeLevel) return { ok: false, why: `From level ${CREW.proposeLevel} you can propose crew quests. Until then, give to the crew's.` };
  }
  if (open.length >= CREW.maxOpen) return { ok: false, why: `${CREW.maxOpen} crew quests are open. Once one is built, propose the next.` };
  return { ok: true };
}

/** A game viewer, or the reason there's nothing to do here. */
async function gameViewer(ctx: QueryCtx) {
  const viewer = await requireViewer(ctx);
  if (!gameShownTo(viewer.workspace, viewer.member)) throw new ConvexError("Crew quests are part of the game: switch it on (or show it on your Me page).");
  return viewer;
}

async function questIn(ctx: QueryCtx, workspaceId: Id<"workspaces">, questId: Id<"crewQuests">): Promise<Quest | null> {
  const quest = await ctx.db.get(questId);
  return quest && quest.workspaceId === workspaceId ? quest : null;
}

// ── Proposing ───────────────────────────────────────────────────────────────

export const propose = mutation({
  args: { partId: v.string(), option: v.optional(v.string()), text: v.optional(v.string()) },
  returns: v.id("crewQuests"),
  handler: async (ctx, { partId, option, text }) => {
    const viewer = await gameViewer(ctx);
    const { workspace, member } = viewer;
    const stage = await stageOf(ctx, workspace._id);
    const open = await openQuests(ctx, workspace._id);
    const may = await mayPropose(ctx, viewer, stage, open);
    if (!may.ok) throw new ConvexError(may.why);
    const built = (await builtParts(ctx, workspace._id)).map((b) => b.part);
    const part = partsAvailable(stage, { built, open: open.map((q) => q.part) }).find((p) => p.id === partId);
    if (!part) throw new ConvexError("That part isn't in the catalogue right now: it's built, open already, or needs a bigger tree.");
    if (!validOption(part, option)) throw new ConvexError("options" in part ? `Pick one of: ${part.options.join(", ")}.` : "Pick nothing for this part: it comes as it is.");
    let saying: string | undefined;
    if (part.kind === "banner") {
      saying = bannerText(text ?? "") ?? undefined;
      if (!saying) throw new ConvexError(`Write the banner's saying: one line of plain text, up to ${BANNER_TEXT.max} characters.`);
    } else if (text !== undefined) throw new ConvexError("Only a banner has a saying.");
    const waits = part.kind === "banner" && workspace.crewBannerModeration === true && !member.isAdmin;
    return await ctx.db.insert("crewQuests", {
      workspaceId: workspace._id,
      part: part.id,
      ...(option !== undefined ? { option } : {}),
      ...(saying !== undefined ? { text: saying } : {}),
      proposedBy: member._id,
      proposedAt: workspaceNow(workspace),
      goal: part.cost,
      contributed: 0,
      contributors: 0,
      status: "proposed",
      ...(waits ? { awaitingApproval: true as const } : {}),
    });
  },
});

/** An admin lets a banner waiting for approval take coins. */
export const approveBanner = mutation({
  args: { questId: v.id("crewQuests") },
  returns: v.null(),
  handler: async (ctx, { questId }) => {
    const { workspace } = await requireAdmin(ctx);
    const quest = await questIn(ctx, workspace._id, questId);
    if (!quest?.awaitingApproval) throw new ConvexError("That banner isn't waiting for approval.");
    await ctx.db.patch(quest._id, { awaitingApproval: undefined });
    return null;
  },
});

/** Its proposer or an admin withdraws a quest nobody has given to yet (an admin turning a banner down, too). */
export const withdraw = mutation({
  args: { questId: v.id("crewQuests") },
  returns: v.null(),
  handler: async (ctx, { questId }) => {
    const { workspace, member } = await gameViewer(ctx);
    const quest = await questIn(ctx, workspace._id, questId);
    if (!quest || quest.status !== "proposed") throw new ConvexError("That crew quest isn't open.");
    if (!member.isAdmin && quest.proposedBy !== member._id) throw new ConvexError("Only whoever proposed it, or an admin, can withdraw it.");
    if (quest.contributed > 0) throw new ConvexError("Teammates have given to it already: it stays until it's funded.");
    await ctx.db.delete(quest._id);
    return null;
  },
});

// ── Contributing ────────────────────────────────────────────────────────────

export const contribute = mutation({
  args: { questId: v.id("crewQuests"), coins: v.number() },
  returns: v.object({ added: v.number(), funded: v.boolean() }),
  handler: async (ctx, { questId, coins }) => {
    const { workspace, member } = await gameViewer(ctx);
    if (!Number.isInteger(coins) || coins < 1) throw new ConvexError("Give a whole number of Hog coins, 1 or more.");
    const quest = await questIn(ctx, workspace._id, questId);
    if (!quest || quest.status === "built") throw new ConvexError("That crew quest isn't open.");
    if (quest.status === "funded") throw new ConvexError("That crew quest is funded already: it's being built.");
    if (quest.awaitingApproval) throw new ConvexError("That banner is waiting for an admin's approval before it takes coins.");
    const player = await playerOf(ctx, member._id);
    if (!player || player.level < WALLET_LEVEL) throw new ConvexError(`Your Hog coin wallet opens at level ${WALLET_LEVEL}: give a few thoughtful kudos first.`);
    const added = Math.min(coins, quest.goal - quest.contributed);
    const line = await ctx.db
      .query("crewContributions")
      .withIndex("by_quest_member", (q) => q.eq("questId", quest._id).eq("memberId", member._id))
      .unique();
    if (!line && quest.contributors >= CONTRIBUTORS_MAX) throw new ConvexError(`${CONTRIBUTORS_MAX} teammates have given to this quest: it's theirs to finish.`);
    await spendCoins(ctx, member, player, added, "This contribution");
    const now = workspaceNow(workspace);
    if (line) await ctx.db.patch(line._id, { amount: line.amount + added, lastAt: now });
    else await ctx.db.insert("crewContributions", { workspaceId: workspace._id, questId: quest._id, memberId: member._id, amount: added, at: now, lastAt: now });
    const contributed = quest.contributed + added;
    const funded = contributed >= quest.goal;
    await ctx.db.patch(quest._id, { contributed, contributors: quest.contributors + (line ? 0 : 1), ...(funded ? { status: "funded" as const, fundedAt: now } : {}) });
    await firstCrewEvent(ctx, workspace, member._id, now);
    if (funded) await fund(ctx, workspace, quest._id, now);
    return { added, funded };
  },
});

/** A member's first contribution ever is one `crew` game event (#159's step Together); rebuilds keep it. */
async function firstCrewEvent(ctx: MutationCtx, workspace: Doc<"workspaces">, memberId: Id<"members">, now: number) {
  const batchId = `crew:${memberId}`;
  if (await ctx.db.query("gameEvents").withIndex("by_batch", (q) => q.eq("batchId", batchId)).first()) return;
  await ctx.db.insert("gameEvents", { workspaceId: workspace._id, memberId, kind: "crew", batchId, dayKey: dayKeyFor(now, workspace.timezone), at: now, xp: 0 });
}

/** The quest reached its goal: an event and a post, and the build CREW.buildDays from now. */
async function fund(ctx: MutationCtx, workspace: Doc<"workspaces">, questId: Id<"crewQuests">, now: number) {
  const quest = (await ctx.db.get(questId))!;
  const eventId = await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "crew_funded", at: now, questId, part: quest.part });
  await announceTreeEvent(ctx, workspace, eventId);
  await ctx.scheduler.runAfter(BUILD_MS, internal.crew.build, { questId });
}

// ── Building ────────────────────────────────────────────────────────────────

/**
 * Builds a funded quest whose days are up on the workspace clock: its part goes into the tree's
 * cosmetics (replacing the same part built before), an event and a post, and a DM to each contributor.
 * Exactly once: only a funded quest builds. Returns whether it built.
 */
async function buildIfDue(ctx: MutationCtx, workspace: Doc<"workspaces">, quest: Quest): Promise<boolean> {
  if (quest.status !== "funded" || quest.fundedAt === undefined) return false;
  const now = workspaceNow(workspace);
  const due = quest.fundedAt + BUILD_MS;
  if (now < due) return false;
  await ctx.db.patch(quest._id, { status: "built", builtAt: due });
  const tree = await treeOf(ctx, workspace._id);
  if (tree) {
    const built = { part: quest.part, questId: quest._id, builtAt: due, ...(quest.option !== undefined ? { option: quest.option } : {}), ...(quest.text !== undefined ? { text: quest.text } : {}) };
    await ctx.db.patch(tree._id, { cosmetics: [...(tree.cosmetics ?? []).filter((b) => b.part !== quest.part), built] });
  }
  const eventId = await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "crew_built", at: due, questId: quest._id, part: quest.part });
  await announceTreeEvent(ctx, workspace, eventId);
  await tellContributors(ctx, workspace, quest, now);
  return true;
}

/** One DM to each contributor still here, through the gains pipeline (nobody who doesn't see the game). */
async function tellContributors(ctx: MutationCtx, workspace: Doc<"workspaces">, quest: Quest, now: number) {
  const lines = await ctx.db
    .query("crewContributions")
    .withIndex("by_quest_at", (q) => q.eq("questId", quest._id))
    .take(CONTRIBUTORS_MAX);
  const title = crewPartTitle(quest.part, quest.option);
  const gains = new Gains(ctx, workspace, now);
  for (const l of lines) if (l.memberId) gains.add(l.memberId, { kind: "crew_built", part: title.charAt(0).toUpperCase() + title.slice(1), contributors: quest.contributors });
  const ids = await gains.flush();
  if (ids.length > 0 && !workspace.isDemo) await ctx.scheduler.runAfter(0, internal.slack.deliverNotifications, { workspaceId: workspace._id, ids });
}

/** Scheduled at funding for when its days are up; a clock that isn't there yet (a retimed one) tries again then. */
export const build = internalMutation({
  args: { questId: v.id("crewQuests") },
  returns: v.null(),
  handler: async (ctx, { questId }) => {
    const quest = await ctx.db.get(questId);
    const workspace = quest && (await ctx.db.get(quest.workspaceId));
    if (!quest || !workspace || quest.status !== "funded" || quest.fundedAt === undefined) return null;
    if (!(await buildIfDue(ctx, workspace, quest))) {
      await ctx.scheduler.runAfter(Math.max(60_000, quest.fundedAt + BUILD_MS - workspaceNow(workspace)), internal.crew.build, { questId });
    }
    return null;
  },
});

/** Builds every funded quest whose days are up: a simulator's day went by (its clock runs ahead of the scheduler's). */
export async function settleCrew(ctx: MutationCtx, workspace: Doc<"workspaces">): Promise<string[]> {
  const funded = await ctx.db
    .query("crewQuests")
    .withIndex("by_workspace_status", (q) => q.eq("workspaceId", workspace._id).eq("status", "funded"))
    .take(OPEN_READ);
  const built: string[] = [];
  for (const quest of funded) if (await buildIfDue(ctx, workspace, quest)) built.push(crewPartTitle(quest.part, quest.option));
  return built;
}

// ── Stories (the demo, #165) ────────────────────────────────────────────────

export type QuestStory = {
  part: string;
  option?: string;
  text?: string;
  proposedBy: Id<"members">;
  proposedAt: number;
  /** Who gave what, in order; their wallets are left alone (scenery). */
  gifts: { memberId: Id<"members">; coins: number; at: number }[];
  /** Built at this time (it must be fully funded), or left open. */
  builtAt?: number;
};

/**
 * Writes a crew quest as a story tells it (the demo's, and #165's): proposed, given to, and funded and
 * built when `builtAt` says so, with its tree events and its part on the tree. Never a DM, a post or a
 * game event: it's history, not something happening now.
 */
export async function seedQuest(ctx: MutationCtx, workspace: Doc<"workspaces">, story: QuestStory): Promise<Id<"crewQuests">> {
  const part = crewPart(story.part);
  if (!part || !validOption(part, story.option)) throw new Error(`Not a crew part: ${story.part} ${story.option ?? ""}`);
  const contributed = Math.min(part.cost, story.gifts.reduce((s, g) => s + g.coins, 0));
  const funded = story.builtAt !== undefined;
  if (funded && contributed < part.cost) throw new Error(`${story.part} isn't fully funded: ${contributed} of ${part.cost}.`);
  const fundedAt = funded ? story.builtAt! - BUILD_MS : undefined;
  const questId = await ctx.db.insert("crewQuests", {
    workspaceId: workspace._id,
    part: part.id,
    ...(story.option !== undefined ? { option: story.option } : {}),
    ...(story.text !== undefined ? { text: story.text } : {}),
    proposedBy: story.proposedBy,
    proposedAt: story.proposedAt,
    goal: part.cost,
    contributed,
    contributors: new Set(story.gifts.map((g) => g.memberId)).size,
    status: funded ? "built" : "proposed",
    ...(funded ? { fundedAt, builtAt: story.builtAt } : {}),
  });
  const lines = new Map<Id<"members">, { amount: number; at: number; lastAt: number }>();
  for (const g of story.gifts) {
    const l = lines.get(g.memberId);
    lines.set(g.memberId, l ? { ...l, amount: l.amount + g.coins, lastAt: g.at } : { amount: g.coins, at: g.at, lastAt: g.at });
  }
  for (const [memberId, l] of lines) await ctx.db.insert("crewContributions", { workspaceId: workspace._id, questId, memberId, ...l });
  if (funded) {
    await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "crew_funded", at: fundedAt!, questId, part: part.id });
    await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "crew_built", at: story.builtAt!, questId, part: part.id });
    const tree = await treeOf(ctx, workspace._id);
    const built = { part: part.id, questId, builtAt: story.builtAt!, ...(story.option !== undefined ? { option: story.option } : {}), ...(story.text !== undefined ? { text: story.text } : {}) };
    if (tree) await ctx.db.patch(tree._id, { cosmetics: [...(tree.cosmetics ?? []).filter((b) => b.part !== part.id), built] });
  }
  return questId;
}

/**
 * A story's crew quest from the command line or a later story (#165): `part` proposed by the
 * workspace's first admin, given to by its first members (not bots) in turn, `share` of its goal
 * funded (1 by default), and built when `built`.
 *
 *   npx convex run crew:seedStory '{"workspaceId":"…","part":"style_terrace","option":"blossom","built":true}'
 */
export const seedStory = internalMutation({
  args: { workspaceId: v.id("workspaces"), part: v.string(), option: v.optional(v.string()), text: v.optional(v.string()), built: v.boolean(), share: v.optional(v.number()) },
  returns: v.id("crewQuests"),
  handler: async (ctx, { workspaceId, part: partId, option, text, built, share = 1 }) => {
    const workspace = await ctx.db.get(workspaceId);
    const part = crewPart(partId);
    if (!workspace || !part) throw new ConvexError("No such workspace or part.");
    const members = (
      await ctx.db
        .query("members")
        .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId))
        .take(50)
    ).filter((m) => !m.isBot && !m.deactivated);
    const proposer = members.find((m) => m.isAdmin) ?? members[0];
    if (!proposer) throw new ConvexError("The workspace has nobody to propose it.");
    const now = workspaceNow(workspace);
    const goal = Math.round(part.cost * (built ? 1 : Math.min(0.99, share)));
    const givers = members.slice(0, 5);
    const gifts = givers.map((m, i) => ({ memberId: m._id, coins: Math.floor(goal / givers.length) + (i === 0 ? goal % givers.length : 0), at: now - (5 - i) * 60_000 }));
    return await seedQuest(ctx, workspace, { part: partId, option, text, proposedBy: proposer._id, proposedAt: now - DAY_MS, gifts, builtAt: built ? now : undefined });
  },
});

// ── Reading ─────────────────────────────────────────────────────────────────

const partValidator = v.object({
  id: v.string(),
  kind: v.string(),
  name: v.string(),
  about: v.string(),
  cost: v.number(),
  district: v.union(v.null(), v.string()),
  options: v.array(v.string()),
});

function partView(p: CrewPart) {
  return { id: p.id, kind: p.kind, name: p.name, about: p.about, cost: p.cost, district: "district" in p ? p.district : null, options: "options" in p ? [...p.options] : [] };
}

const nameOf = async (ctx: QueryCtx, memberId: Id<"members"> | undefined) => (memberId && (await ctx.db.get(memberId))?.name) || FORMER;

const questValidator = v.object({
  _id: v.id("crewQuests"),
  part: v.string(),
  kind: v.string(),
  name: v.string(),
  option: v.union(v.null(), v.string()),
  text: v.union(v.null(), v.string()),
  goal: v.number(),
  contributed: v.number(),
  contributors: v.number(),
  status: v.union(v.literal("proposed"), v.literal("funded")),
  awaitingApproval: v.boolean(),
  proposedBy: v.string(),
  /** Whether the viewer proposed it (they may withdraw it while nobody has given). */
  proposedByMe: v.boolean(),
  fundedAt: v.union(v.null(), v.number()),
  /** When it's built, on the workspace clock. */
  buildsAt: v.union(v.null(), v.number()),
  /** What the viewer gave to it. */
  mine: v.number(),
});

/**
 * The crew's plaque window and the notice board (reactive): whether crew quests are open (the game
 * shown and the tree great), the open quests with their progress and what the viewer gave, the
 * catalogue the viewer may propose from, whether they may propose (and why not), their wallet (null
 * below level 3) and the gatehouse's settings.
 */
export const open = query({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    stage: v.string(),
    quests: v.array(questValidator),
    available: v.array(partValidator),
    canPropose: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), why: v.string() })),
    wallet: v.union(v.null(), v.number()),
    isAdmin: v.boolean(),
    settings: v.object({ proposers: crewProposersValidator, bannerModeration: v.boolean() }),
  }),
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const { workspace, member } = viewer;
    const settings = { proposers: workspace.crewProposers ?? ("level" as const), bannerModeration: workspace.crewBannerModeration === true };
    const shown = gameShownTo(workspace, member);
    const stage = shown ? await stageOf(ctx, workspace._id) : "seed";
    const off = { enabled: false, stage, quests: [], available: [], canPropose: { ok: false as const, why: "" }, wallet: null, isAdmin: member.isAdmin, settings };
    if (!shown || !crewOpen(stage)) return off;
    const quests = await openQuests(ctx, workspace._id);
    const built = (await builtParts(ctx, workspace._id)).map((b) => b.part);
    const player = await playerOf(ctx, member._id);
    return {
      enabled: true,
      stage,
      quests: await Promise.all(
        quests.map(async (q) => {
          const line = await ctx.db
            .query("crewContributions")
            .withIndex("by_quest_member", (x) => x.eq("questId", q._id).eq("memberId", member._id))
            .unique();
          const part = crewPart(q.part);
          return {
            _id: q._id,
            part: q.part,
            kind: part?.kind ?? "structure",
            name: part?.name ?? q.part,
            option: q.option ?? null,
            text: q.text ?? null,
            goal: q.goal,
            contributed: q.contributed,
            contributors: q.contributors,
            status: q.status as "proposed" | "funded",
            awaitingApproval: q.awaitingApproval === true,
            proposedBy: await nameOf(ctx, q.proposedBy),
            proposedByMe: q.proposedBy === member._id,
            fundedAt: q.fundedAt ?? null,
            buildsAt: q.fundedAt !== undefined ? q.fundedAt + BUILD_MS : null,
            mine: line?.amount ?? 0,
          };
        }),
      ),
      available: partsAvailable(stage, { built, open: quests.map((q) => q.part) }).map(partView),
      canPropose: await mayPropose(ctx, viewer, stage, quests),
      wallet: player && player.level >= WALLET_LEVEL ? coinBalance(player, member).balance : null,
      isAdmin: member.isAdmin,
      settings,
    };
  },
});

/**
 * The plaque: what the crew built, newest first (the latest PLAQUE_MAX), each with who proposed it and
 * the names of everyone who gave, in the order they gave. Someone who left is "a former teammate".
 */
export const built = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("crewQuests"),
      part: v.string(),
      name: v.string(),
      option: v.union(v.null(), v.string()),
      text: v.union(v.null(), v.string()),
      builtAt: v.number(),
      proposedBy: v.string(),
      contributed: v.number(),
      contributors: v.array(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return [];
    const quests = await ctx.db
      .query("crewQuests")
      .withIndex("by_workspace_status", (q) => q.eq("workspaceId", workspace._id).eq("status", "built"))
      .order("desc")
      .take(PLAQUE_MAX);
    return await Promise.all(
      quests.map(async (q) => {
        const lines = await ctx.db
          .query("crewContributions")
          .withIndex("by_quest_at", (x) => x.eq("questId", q._id))
          .take(CONTRIBUTORS_MAX);
        return {
          _id: q._id,
          part: q.part,
          name: crewPart(q.part)?.name ?? q.part,
          option: q.option ?? null,
          text: q.text ?? null,
          builtAt: q.builtAt ?? q.proposedAt,
          proposedBy: await nameOf(ctx, q.proposedBy),
          contributed: q.contributed,
          contributors: await Promise.all(lines.map((l) => nameOf(ctx, l.memberId))),
        };
      }),
    );
  },
});

// ── The gatehouse ───────────────────────────────────────────────────────────

/** Who may propose crew quests, and whether banners wait for an admin's approval. */
export const updateSettings = mutation({
  args: { proposers: crewProposersValidator, bannerModeration: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { proposers, bannerModeration }) => {
    const { workspace } = await requireAdmin(ctx);
    assertNotDemo(workspace, "Crew settings are");
    await ctx.db.patch(workspace._id, { crewProposers: proposers, crewBannerModeration: bannerModeration });
    return null;
  },
});
