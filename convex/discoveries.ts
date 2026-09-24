import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireViewer } from "./lib/access";
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
