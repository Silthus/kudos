import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { exposed, memberDecision } from "../analytics/flags";
import { customEmojiScopeMissingIn } from "../workspace/customEmoji";
import { chatUserOf, lookup, type MemberId } from "../workspace/directory";
import { slackEmojiImageOf, slackEmojiNamed, slackEmojiReachOf, slackEmojiStartingWith, type SlackEmojiReach } from "../workspace/slackEmoji";
import { customItemOf, isCatalogueEmoji, type StoreItem } from "./catalogue";
import { customKudosEmojiFlag } from "./customKudosEmojiFlag";
import { storeShownAndExposedTo, storeShownTo } from "./visibility";

export type CustomKudosEmojiPicker = { kind: "reinstall" } | { kind: "pick"; picked: string[]; reach: SlackEmojiReach };

export type CustomItems = { all: StoreItem[]; picked: StoreItem[] };

type Admin = { member: MemberId; admin: boolean };

const optionsPerSearch = 100;

export const customKudosEmojiPerWorkspace = 20;

const noCustomItems: CustomItems = { all: [], picked: [] };

export const customKudosEmojiOptions = internalQuery({
  args: { workspace: v.string(), user: v.string(), typed: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, { workspace, user, typed }): Promise<string[]> => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind !== "member" || !person.admin || !(await customKudosEmojiShownTo(ctx, person.member))) return [];
    const found = await slackEmojiStartingWith(ctx, workspace, typed.trim().toLowerCase().replace(/^:|:$/g, ""), optionsPerSearch, await slackEmojiReachOf(ctx, person.member));
    return found.map(({ name }) => name).filter((name) => !isCatalogueEmoji(name));
  },
});

export async function customKudosEmojiShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await storeShownTo(ctx, member)) && (await memberDecision(ctx, customKudosEmojiFlag, member));
}

export async function customKudosEmojiShownAndExposedTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  return (await storeShownAndExposedTo(ctx, member)) && (await customKudosEmojiOnAndExposedFor(ctx, member));
}

export async function customKudosEmojiOnAndExposedFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const on = await memberDecision(ctx, customKudosEmojiFlag, member);
  await exposed(ctx, customKudosEmojiFlag, member, on);
  return on;
}

export async function customItemsShownTo(ctx: QueryCtx, member: MemberId): Promise<CustomItems> {
  const rows = await customRowsIn(ctx, (await chatUserOf(ctx, member)).workspace);
  if (rows.length === 0 || !(await customKudosEmojiShownTo(ctx, member))) return noCustomItems;
  return customItemsOf(rows);
}

export async function customItemsShownAndExposedTo(ctx: MutationCtx, member: MemberId): Promise<CustomItems> {
  const rows = await customRowsIn(ctx, (await chatUserOf(ctx, member)).workspace);
  if (rows.length === 0 || !(await customKudosEmojiShownAndExposedTo(ctx, member))) return noCustomItems;
  return customItemsOf(rows);
}

export async function customKudosEmojiPickerFor(ctx: MutationCtx, workspace: string, person: Admin): Promise<CustomKudosEmojiPicker | null> {
  if (!(await picksCustomKudosEmoji(ctx, person))) return null;
  if (await customEmojiScopeMissingIn(ctx, workspace)) return { kind: "reinstall" };
  const rows = await customRowsIn(ctx, workspace);
  for (const row of rows) await refreshArt(ctx, workspace, row);
  return { kind: "pick", picked: rows.filter(isPicked).map(({ name }) => name), reach: await slackEmojiReachOf(ctx, person.member) };
}

export async function setCustomKudosEmoji(ctx: MutationCtx, workspace: string, person: Admin, names: string[]): Promise<boolean> {
  if (!(await picksCustomKudosEmoji(ctx, person)) || (await customEmojiScopeMissingIn(ctx, workspace))) return false;
  const wanted = await originalsOf(ctx, workspace, names, await slackEmojiReachOf(ctx, person.member));
  const rows = await customRowsIn(ctx, workspace);
  const at = Date.now();
  let changed = false;
  for (const row of rows) {
    const url = wanted.get(row.name);
    if (url === undefined && isPicked(row)) await ctx.db.patch(row._id, { unpickedAt: at });
    else if (url !== undefined && !isPicked(row)) await ctx.db.patch(row._id, { url, pickedAt: at, unpickedAt: undefined });
    else continue;
    changed = true;
  }
  for (const [name, url] of wanted) {
    if (rows.some((row) => row.name === name)) continue;
    await ctx.db.insert("customKudosEmoji", { workspace, name, url, pickedAt: at });
    changed = true;
  }
  return changed;
}

async function picksCustomKudosEmoji(ctx: MutationCtx, { member, admin }: Admin) {
  return admin && (await customKudosEmojiShownAndExposedTo(ctx, member));
}

async function originalsOf(ctx: QueryCtx, workspace: string, names: string[], reach: SlackEmojiReach) {
  const originals = new Map<string, string>();
  for (const name of names) {
    if (originals.size === customKudosEmojiPerWorkspace) break;
    const original = await slackEmojiNamed(ctx, workspace, name, reach);
    if (original !== null && !isCatalogueEmoji(original.name)) originals.set(original.name, original.image);
  }
  return originals;
}

async function refreshArt(ctx: MutationCtx, workspace: string, row: Doc<"customKudosEmoji">) {
  const url = await slackEmojiImageOf(ctx, workspace, row.name);
  if (url !== undefined && url !== row.url) await ctx.db.patch(row._id, { url });
}

function customItemsOf(rows: Doc<"customKudosEmoji">[]): CustomItems {
  const items = (picked: Doc<"customKudosEmoji">[]) => picked.map(({ name, url }) => customItemOf(name, url));
  return { all: items(rows), picked: items(rows.filter(isPicked)) };
}

function isPicked(row: Doc<"customKudosEmoji">) {
  return row.unpickedAt === undefined;
}

function customRowsIn(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("customKudosEmoji")
    .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace))
    .collect();
}
