import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { gameShownTo, playerOf } from "./game";
import { requireViewer } from "./lib/access";
import { LORE } from "./lib/lore";
import { CATALOG, CATEGORY_LABEL, RARITIES } from "./lib/messages";
import { rollupsReady } from "./lib/rebuild";
import { ANY_MESSAGE } from "./lib/rollups";

/** `messageStats` rows per workspace: one per catalog message and ANY_MESSAGE, with room for strays. */
const MAX_MESSAGE_ROWS = 2 * CATALOG.length + 1;

type Finders = { finders: Map<string, number>; collectors: number };

/** How many members found each message, and anything at all: the rollup, exact at any size. */
async function messageFinders(ctx: QueryCtx, workspaceId: Id<"workspaces">): Promise<Finders> {
  const rows = await ctx.db
    .query("messageStats")
    .withIndex("by_workspace_template", (q) => q.eq("workspaceId", workspaceId))
    .take(MAX_MESSAGE_ROWS);
  const finders = new Map(rows.map((r) => [r.templateKey, r.finders]));
  return { finders, collectors: finders.get(ANY_MESSAGE) ?? 0 };
}

/** Until the workspace is backfilled: a capped scan of its discoveries. */
async function legacyFinders(ctx: QueryCtx, workspaceId: Id<"workspaces">): Promise<Finders> {
  const everyone = await ctx.db
    .query("discoveries")
    .withIndex("by_workspace_firstSeen", (q) => q.eq("workspaceId", workspaceId))
    .take(8000);
  const finders = new Map<string, number>();
  for (const d of everyone) finders.set(d.templateKey, (finders.get(d.templateKey) ?? 0) + 1);
  return { finders, collectors: new Set(everyone.map((d) => d.memberId)).size };
}

/** The full message catalog; undiscovered messages keep their text hidden. */
export const gallery = query({
  args: {},
  handler: async (ctx) => {
    const { member, workspace } = await requireViewer(ctx);
    const mine = await ctx.db
      .query("discoveries")
      .withIndex("by_member_template", (q) => q.eq("memberId", member._id))
      .take(500);
    const byKey = new Map(mine.map((d) => [d.templateKey, d]));

    // How many teammates found each message: makes rare finds feel rare.
    const { finders, collectors } = rollupsReady(workspace)
      ? await messageFinders(ctx, workspace._id)
      : await legacyFinders(ctx, workspace._id);

    const items = CATALOG.map((t) => {
      const d = byKey.get(t.key);
      return {
        key: t.key,
        rarity: t.rarity,
        category: t.category,
        categoryLabel: CATEGORY_LABEL[t.category],
        discovered: Boolean(d),
        text: d ? t.text : null,
        length: t.text.length,
        timesSeen: d?.timesSeen ?? 0,
        firstSeenAt: d?.firstSeenAt ?? null,
        lastSeenAt: d?.lastSeenAt ?? null,
        foundBy: finders.get(t.key) ?? 0,
      };
    });

    return {
      total: CATALOG.length,
      discovered: mine.length,
      collectors,
      byRarity: RARITIES.map((rarity) => ({
        rarity,
        total: CATALOG.filter((t) => t.rarity === rarity).length,
        discovered: mine.filter((d) => d.rarity === rarity).length,
      })),
      categories: Object.entries(CATEGORY_LABEL).map(([id, label]) => ({
        id,
        label,
        total: CATALOG.filter((t) => t.category === id).length,
        discovered: mine.filter((d) => d.category === id).length,
      })),
      items,
    };
  },
});

/**
 * The gallery's blight crests (#164): one for each blight the viewer helped beat, newest first, with
 * the damage they dealt it. Our own pixel heraldry, drawn on the page. Empty while the game isn't shown.
 */
export const crests = query({
  args: {},
  returns: v.array(v.object({ number: v.number(), damage: v.number(), wonAt: v.number() })),
  handler: async (ctx) => {
    const { member, workspace } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return [];
    const fought = await ctx.db
      .query("blightContributors")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .order("desc")
      .take(CRESTS_SHOWN);
    const crests = [];
    for (const row of fought) {
      const blight = await ctx.db.get(row.blightId);
      if (blight?.status === "won") crests.push({ number: blight.number, damage: row.damage, wonAt: blight.endedAt ?? blight.endsAt });
    }
    return crests;
  },
});

/** Blights a member fought that the gallery reads: a blight comes every 2–4 weeks, so years of them. */
const CRESTS_SHOWN = 200;

/**
 * The gallery's lore cards (#162): the twelve secrets the ruins keep, in the tree's voice. A card is
 * found in a ruin's secret room or, rarely, at the end of a cleared run (lib/rpg.ts), once per
 * member (`players.lore`); unfound cards keep their words hidden. Empty while the game isn't shown.
 */
export const lore = query({
  args: {},
  returns: v.object({
    found: v.number(),
    cards: v.array(v.object({ index: v.number(), title: v.union(v.string(), v.null()), text: v.union(v.string(), v.null()), foundAt: v.union(v.number(), v.null()) })),
  }),
  handler: async (ctx) => {
    const { member, workspace } = await requireViewer(ctx);
    const player = gameShownTo(workspace, member) ? await playerOf(ctx, member._id) : null;
    const found = new Map((player?.lore ?? []).map((l) => [l.lore, l.at]));
    return {
      found: found.size,
      cards: LORE.map((card, index) => {
        const at = found.get(index);
        return at === undefined ? { index, title: null, text: null, foundAt: null } : { index, title: card.title, text: card.text, foundAt: at };
      }),
    };
  },
});
