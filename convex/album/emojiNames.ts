import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { companyTeamsReplacedEventValidator } from "../bus/events";
import { companyTeamsOf } from "../companyProfiles/teams";
import { customEmojiImageOf } from "../workspace/customEmoji";
import { displayNameOf, personFactsOf, type MemberId } from "../workspace/directory";
import { emojiLevels, milestoneTierEmojiOf, milestoneTierEmojis, slugOf } from "./emojiCatalogue";
import { isClassed } from "./emojiClasses";
import type { EmojiMapper, MilestoneId, MilestoneTier } from "./records";
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

export async function namesHeldIn(ctx: QueryCtx, workspace: string): Promise<Map<string, EarnedEmojiId>> {
  const rows = await ctx.db
    .query("emojiNames")
    .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace))
    .collect();
  return new Map(rows.map((row) => [row.name, emojiIdOf(row)]));
}

export async function openTheRegistryIn(ctx: MutationCtx, workspace: string): Promise<void> {
  await reserveSharedNamesIn(ctx, workspace);
}

export async function giveEmojiTheName(ctx: MutationCtx, workspace: string, emoji: EarnedEmojiId, name: string, mappedBy: EmojiMapper): Promise<void> {
  const named = await registeredAs(ctx, workspace, emoji);
  if (named?.name === name) {
    if (named.mappedBy !== undefined && named.mappedBy.as !== mappedBy.as) await ctx.db.patch(named._id, { mappedBy });
    return;
  }
  await freeTheName(ctx, workspace, name);
  if (named === null) await ctx.db.insert("emojiNames", { workspace, ...storedKeyOf(emoji), name, mappedBy });
  else await ctx.db.patch(named._id, { name, mappedBy });
}

export async function freeTheName(ctx: MutationCtx, workspace: string, name: string): Promise<void> {
  const holder = await holderOf(ctx, workspace, name);
  if (holder === null) return;
  const shape = await naturalShapeOf(ctx, emojiIdOf(holder));
  await ctx.db.patch(holder._id, { name: await firstFreeName(ctx, workspace, shape, (candidate) => slackHas(ctx, workspace, candidate)), mappedBy: undefined });
}

export type RegisteredEmoji = { emoji: EarnedEmojiId; name: string; mappedBy: EmojiMapper | null };

export async function registeredEmojisIn(ctx: QueryCtx, workspace: string): Promise<RegisteredEmoji[]> {
  const rows = await ctx.db
    .query("emojiNames")
    .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace))
    .collect();
  return rows.map((row) => ({ emoji: emojiIdOf(row), name: row.name, mappedBy: row.mappedBy ?? null }));
}

export async function emojiNamed(ctx: QueryCtx, workspace: string, name: string): Promise<EarnedEmojiId | null> {
  const holder = await holderOf(ctx, workspace, name);
  return holder === null ? null : emojiIdOf(holder);
}

export async function mapperOf(ctx: QueryCtx, workspace: string, emoji: EarnedEmojiId): Promise<EmojiMapper | null> {
  return (await registeredAs(ctx, workspace, emoji))?.mappedBy ?? null;
}

async function slackHas(ctx: QueryCtx, workspace: string, name: string) {
  return (await customEmojiImageOf(ctx, workspace, name)) !== undefined;
}

async function naturalShapeOf(ctx: QueryCtx, emoji: EarnedEmojiId): Promise<NameShape> {
  const [kind, cause] = splitOnce(emoji);
  if (kind === "level") return { slug: `level-${cause}`, empty: "level", suffix: "" };
  if (kind === "milestone") return { slug: slugOf(milestoneTierEmojiOf(cause)?.name ?? cause), empty: "milestone", suffix: "" };
  if (kind === "team") return { slug: slugOf((await companyTeamsOf(ctx)).find(({ team }) => team === cause)?.name ?? cause), empty: "team", suffix: "" };
  return { slug: slugOf(await fullNameOf(ctx, cause as MemberId)), empty: "person", suffix: hypeSuffix };
}

function splitOnce(id: string): [string, string] {
  const colon = id.indexOf(":");
  return [id.slice(0, colon), id.slice(colon + 1)];
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
    await reserveCatalogueNamesIn(ctx, workspace);
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
  if ((await registeredAs(ctx, workspace, firstUse)) !== null) return;
  await reserveCatalogueNamesIn(ctx, workspace);
  await reserveCompanyTeamNamesIn(ctx, workspace);
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

type AlsoTaken = (name: string) => Promise<boolean>;

async function firstFreeName(ctx: MutationCtx, workspace: string, { slug, empty, suffix }: NameShape, alsoTaken: AlsoTaken = async () => false): Promise<string> {
  const isFreeHere = async (name: string) => (await isFree(ctx, workspace, name)) && !(await alsoTaken(name));
  const plain = `${slug}${suffix}`;
  if (slug !== "" && (await isFreeHere(plain))) return plain;
  const stem = slug === "" ? empty : slug;
  const numbering = await numberingOf(ctx, workspace, `${stem}${suffix}`);
  for (let n = (numbering?.last ?? (slug === "" ? 0 : 1)) + 1; ; n += 1) {
    const name = `${stem}-${n}${suffix}`;
    if (!(await isFreeHere(name))) continue;
    if (numbering === null) await ctx.db.insert("emojiNameNumbers", { workspace, stem: `${stem}${suffix}`, last: n });
    else await ctx.db.patch(numbering._id, { last: n });
    return name;
  }
}

async function isFree(ctx: QueryCtx, workspace: string, name: string) {
  return !standardEmojiNames.has(name) && !(await nameTaken(ctx, workspace, name)) && !(await isClassed(ctx, workspace, name));
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

function goldOfTheKeyItHadAlone(storedKey: string): string {
  return storedKey.replace(/^(milestone:[a-z]+)$/, "$1:gold");
}

function emojiIdOf({ emoji, person }: { emoji: string; person?: MemberId }): EarnedEmojiId {
  return (person === undefined ? goldOfTheKeyItHadAlone(emoji) : `hype:${person}`) as EarnedEmojiId;
}

function holderOf(ctx: QueryCtx, workspace: string, name: string) {
  return ctx.db
    .query("emojiNames")
    .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace).eq("name", name))
    .unique();
}

async function nameTaken(ctx: QueryCtx, workspace: string, name: string) {
  return (await holderOf(ctx, workspace, name)) !== null;
}
