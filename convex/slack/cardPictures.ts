import { v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { workspaceDecisionWithoutWriting, type Flag } from "../analytics/flags";

export const cardImageFlag = { key: "card-image", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export const cardImageShownIn = internalQuery({
  args: { workspace: v.string() },
  handler: (ctx, { workspace }): Promise<boolean> => workspaceDecisionWithoutWriting(ctx, cardImageFlag, workspace),
});

export const pictureAt = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }): Promise<string | null> => {
    const kept = await keptAt(ctx, key);
    return kept === null ? null : ctx.storage.getUrl(kept.picture);
  },
});

export const kept = internalMutation({
  args: { key: v.string(), picture: v.id("_storage") },
  handler: async (ctx, { key, picture }): Promise<string | null> => {
    const earlier = await keptAt(ctx, key);
    if (earlier !== null) {
      await ctx.storage.delete(picture);
      return ctx.storage.getUrl(earlier.picture);
    }
    await ctx.db.insert("cardPictures", { key, picture });
    return ctx.storage.getUrl(picture);
  },
});

function keptAt(ctx: QueryCtx, key: string) {
  return ctx.db
    .query("cardPictures")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
}
