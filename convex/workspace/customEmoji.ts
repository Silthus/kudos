import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";

export const customEmojiValidator = v.object({ name: v.string(), image: v.string(), aliasOf: v.optional(v.string()) });

export type CustomEmoji = Infer<typeof customEmojiValidator>;

const forgottenPerRun = 1_000;

export type ListedEmoji = { name: string; image: string };

export async function customEmojiImageOf(ctx: QueryCtx, workspace: string, name: string): Promise<string | undefined> {
  return (await emojiRow(ctx, workspace, name))?.image;
}

export async function originalCustomEmojiOf(ctx: QueryCtx, workspace: string, name: string): Promise<ListedEmoji | null> {
  const row = await emojiRow(ctx, workspace, name);
  return row === null ? null : { name: row.aliasOf ?? row.name, image: row.image };
}

export async function originalCustomEmojiStartingWith(ctx: QueryCtx, workspace: string, typed: string, limit: number): Promise<ListedEmoji[]> {
  const rows = await ctx.db
    .query("customEmoji")
    .withIndex("by_name", (q) => q.eq("workspace", workspace).gte("name", typed).lt("name", `${typed}\uffff`))
    .take(limit * 2);
  const originals = new Map(rows.map(({ name, image, aliasOf }) => [aliasOf ?? name, { name: aliasOf ?? name, image }]));
  return [...originals.values()].toSorted((first, second) => first.name.localeCompare(second.name)).slice(0, limit);
}

export async function customEmojiScopeMissingIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return (await listingsRow(ctx, workspace))?.scopeMissing === true;
}

export async function claimCustomEmojiRefresh(ctx: MutationCtx, workspace: string, inMs: number): Promise<boolean> {
  const listings = await listingsRow(ctx, workspace);
  if (listings?.refreshDueAt !== undefined && listings.refreshDueAt > Date.now()) return false;
  const refreshDueAt = Date.now() + inMs;
  if (listings === null) await ctx.db.insert("customEmojiListings", { workspace, begun: 0, refreshDueAt });
  else await ctx.db.patch(listings._id, { refreshDueAt });
  return true;
}

export const beginCustomEmojiListing = internalMutation({
  args: { workspace: v.string() },
  returns: v.number(),
  handler: async (ctx, { workspace }) => {
    const listings = await listingsRow(ctx, workspace);
    if (listings === null) {
      await ctx.db.insert("customEmojiListings", { workspace, begun: 1 });
      return 1;
    }
    await ctx.db.patch(listings._id, { begun: listings.begun + 1 });
    return listings.begun + 1;
  },
});

export const keepCustomEmoji = internalMutation({
  args: { workspace: v.string(), emoji: v.array(customEmojiValidator), listing: v.number(), scopeMissing: v.optional(v.boolean()) },
  returns: v.boolean(),
  handler: async (ctx, { workspace, emoji, listing, scopeMissing }) => {
    const listings = await listingsRow(ctx, workspace);
    if (listings === null || (listings.written ?? 0) > listing) return false;
    if (listings.written !== listing || listings.scopeMissing !== scopeMissing) await ctx.db.patch(listings._id, { written: listing, scopeMissing });
    for (const listed of emoji) await keepOne(ctx, workspace, listed, listing);
    return true;
  },
});

export const forgetUnlistedCustomEmoji = internalMutation({
  args: { workspace: v.string(), listing: v.number() },
  handler: async (ctx, { workspace, listing }) => {
    if ((await listingsRow(ctx, workspace))?.written !== listing) return;
    const unlisted = await ctx.db
      .query("customEmoji")
      .withIndex("by_listing", (q) => q.eq("workspace", workspace).lt("listing", listing))
      .take(forgottenPerRun);
    for (const row of unlisted) await ctx.db.delete(row._id);
    if (unlisted.length === forgottenPerRun) await ctx.scheduler.runAfter(0, internal.workspace.customEmoji.forgetUnlistedCustomEmoji, { workspace, listing });
  },
});

async function keepOne(ctx: MutationCtx, workspace: string, { name, image, aliasOf }: CustomEmoji, listing: number) {
  const row = await emojiRow(ctx, workspace, name);
  if (row === null) await ctx.db.insert("customEmoji", { workspace, name, image, aliasOf, listing });
  else await ctx.db.patch(row._id, { image, aliasOf, listing });
}

function emojiRow(ctx: QueryCtx, workspace: string, name: string) {
  return ctx.db
    .query("customEmoji")
    .withIndex("by_name", (q) => q.eq("workspace", workspace).eq("name", name))
    .unique();
}

function listingsRow(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("customEmojiListings")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}
