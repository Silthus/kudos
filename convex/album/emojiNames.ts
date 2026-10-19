import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { companyTeamsReplacedEventValidator } from "../bus/events";
import { companyTeamsOf } from "../companyProfiles/teams";
import { displayNameOf, personFactsOf, type MemberId } from "../workspace/directory";
import { emojiLevels, milestoneTierEmojis, slugOf } from "./emojiCatalogue";
import type { MilestoneId, MilestoneTier } from "./records";
import { standardEmojiNames } from "./standardEmojiNames";

export type EarnedEmojiId = `level:${number}` | `milestone:${MilestoneId}:${MilestoneTier}` | `team:${string}` | `hype:${MemberId}`;

const hypeSuffix = "-hype";
const firstUse: EarnedEmojiId = `level:${emojiLevels[0]}`;

export async function emojiNameOf(ctx: QueryCtx, workspace: string, emoji: EarnedEmojiId): Promise<string | null> {
  return (await registeredAs(ctx, workspace, emoji))?.name ?? null;
}

export async function nameHypeEmojiOf(ctx: MutationCtx, workspace: string, person: MemberId): Promise<void> {
  if ((await registeredAs(ctx, workspace, `hype:${person}`)) !== null) return;
  await reserveSharedNamesIn(ctx, workspace);
  await reserveTeamNamesShapedLikeHypes(ctx, workspace);
  await allocate(ctx, workspace, `hype:${person}`, { slug: slugOf(await fullNameOf(ctx, person)), empty: "person", suffix: hypeSuffix });
}

export async function teamEmojiNameOf(ctx: MutationCtx, workspace: string, team: string): Promise<string> {
  if ((await emojiNameOf(ctx, workspace, `team:${team}`)) === null) await openTheRegistryOrNameItsTeamsIn(ctx, workspace);
  const name = await emojiNameOf(ctx, workspace, `team:${team}`);
  if (name === null) throw new Error(`the company copy holds no team ${team} to name`);
  return name;
}

async function openTheRegistryOrNameItsTeamsIn(ctx: MutationCtx, workspace: string) {
  if ((await registeredAs(ctx, workspace, firstUse)) === null) await reserveSharedNamesIn(ctx, workspace);
  else await reserveCompanyTeamNamesIn(ctx, workspace);
}

export const reserveTeamNamesAfterTheSync = internalMutation({
  args: { event: companyTeamsReplacedEventValidator },
  returns: v.null(),
  handler: async (ctx) => {
    for (const workspace of await workspacesWithARegistry(ctx)) {
      await reserveCatalogueNamesIn(ctx, workspace);
      await reserveCompanyTeamNamesIn(ctx, workspace);
    }
    return null;
  },
});

export const reserveSharedEmojiNames = internalMutation({
  args: { workspace: v.string() },
  returns: v.null(),
  handler: async (ctx, { workspace }) => {
    await reserveSharedNamesIn(ctx, workspace);
    return null;
  },
});

async function workspacesWithARegistry(ctx: QueryCtx): Promise<string[]> {
  const firstUses = await ctx.db
    .query("emojiNames")
    .withIndex("by_emoji", (q) => q.eq("emoji", firstUse).eq("person", undefined))
    .collect();
  return firstUses.map(({ workspace }) => workspace);
}

async function fullNameOf(ctx: QueryCtx, person: MemberId): Promise<string> {
  return (await personFactsOf(ctx, person))?.realName ?? (await displayNameOf(ctx, person)) ?? "";
}

async function reserveSharedNamesIn(ctx: MutationCtx, workspace: string) {
  const opening = (await registeredAs(ctx, workspace, firstUse)) === null;
  await reserveCatalogueNamesIn(ctx, workspace);
  if (opening) await reserveCompanyTeamNamesIn(ctx, workspace);
}

async function reserveCatalogueNamesIn(ctx: MutationCtx, workspace: string) {
  for (const level of emojiLevels) await allocate(ctx, workspace, `level:${level}`, { slug: `level-${level}`, empty: "level", suffix: "" });
  for (const { milestone, tier, name } of milestoneTierEmojis) await allocate(ctx, workspace, `milestone:${milestone}:${tier}`, { slug: slugOf(name), empty: "milestone", suffix: "" });
}

async function reserveCompanyTeamNamesIn(ctx: MutationCtx, workspace: string, only: (slug: string) => boolean = () => true) {
  const teams = (await companyTeamsOf(ctx)).toSorted((one, other) => one.team.localeCompare(other.team));
  for (const { team, name } of teams) if (only(slugOf(name))) await allocate(ctx, workspace, `team:${team}`, { slug: slugOf(name), empty: "team", suffix: "" });
}

function reserveTeamNamesShapedLikeHypes(ctx: MutationCtx, workspace: string) {
  return reserveCompanyTeamNamesIn(ctx, workspace, (slug) => slug.endsWith(hypeSuffix));
}

type NameShape = { slug: string; empty: string; suffix: string };

async function allocate(ctx: MutationCtx, workspace: string, emoji: EarnedEmojiId, shape: NameShape): Promise<void> {
  if ((await registeredAs(ctx, workspace, emoji)) !== null) return;
  await ctx.db.insert("emojiNames", { workspace, ...storedKeyOf(emoji), name: await firstFreeName(ctx, workspace, shape) });
}

async function firstFreeName(ctx: MutationCtx, workspace: string, { slug, empty, suffix }: NameShape): Promise<string> {
  const plain = `${slug}${suffix}`;
  if (slug !== "" && (await isFree(ctx, workspace, plain))) return plain;
  const stem = slug === "" ? empty : slug;
  const numbering = await numberingOf(ctx, workspace, `${stem}${suffix}`);
  for (let n = (numbering?.last ?? (slug === "" ? 0 : 1)) + 1; ; n += 1) {
    const name = `${stem}-${n}${suffix}`;
    if (!(await isFree(ctx, workspace, name))) continue;
    if (numbering === null) await ctx.db.insert("emojiNameNumbers", { workspace, stem: `${stem}${suffix}`, last: n });
    else await ctx.db.patch(numbering._id, { last: n });
    return name;
  }
}

async function isFree(ctx: QueryCtx, workspace: string, name: string) {
  return !standardEmojiNames.has(name) && !(await nameTaken(ctx, workspace, name));
}

function numberingOf(ctx: QueryCtx, workspace: string, stem: string) {
  return ctx.db
    .query("emojiNameNumbers")
    .withIndex("by_workspace_stem", (q) => q.eq("workspace", workspace).eq("stem", stem))
    .unique();
}

function registeredAs(ctx: QueryCtx, workspace: string, emoji: EarnedEmojiId) {
  const { emoji: key, person } = storedKeyOf(emoji);
  return ctx.db
    .query("emojiNames")
    .withIndex("by_workspace_emoji", (q) => q.eq("workspace", workspace).eq("emoji", key).eq("person", person))
    .unique();
}

function storedKeyOf(emoji: EarnedEmojiId): { emoji: string; person?: MemberId } {
  const [kind, ...rest] = emoji.split(":");
  return kind === "hype" ? { emoji: kind, person: rest.join(":") as MemberId } : { emoji: goldKeepsTheKeyItHadAlone(emoji) };
}

function goldKeepsTheKeyItHadAlone(emoji: EarnedEmojiId): string {
  return emoji.replace(/^(milestone:[a-z]+):gold$/, "$1");
}

async function nameTaken(ctx: QueryCtx, workspace: string, name: string) {
  const owner = await ctx.db
    .query("emojiNames")
    .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace).eq("name", name))
    .unique();
  return owner !== null;
}
