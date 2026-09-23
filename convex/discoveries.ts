import { query } from "./_generated/server";
import { requireViewer } from "./lib/access";
import { CATALOG, CATEGORY_LABEL, RARITIES } from "./lib/messages";

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
    const everyone = await ctx.db
      .query("discoveries")
      .withIndex("by_workspace_firstSeen", (q) => q.eq("workspaceId", workspace._id))
      .take(8000);
    const finders = new Map<string, number>();
    for (const d of everyone) finders.set(d.templateKey, (finders.get(d.templateKey) ?? 0) + 1);
    const people = new Set(everyone.map((d) => d.memberId)).size;

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
      collectors: people,
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
