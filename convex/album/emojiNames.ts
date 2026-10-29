import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { companyTeamsReplacedEventValidator } from "../bus/events";
import { companyTeamsOf } from "../companyProfiles/teams";
import { fullNameOf, type MemberId } from "../workspace/directory";
import { slackEmojiImageOf } from "../workspace/slackEmoji";
import { isStandardEmojiName } from "../workspace/standardEmoji";
import { emojiLevels, levelTwoEmoji, milestoneTierEmojiOf, milestoneTierEmojis, slugOf } from "./emojiCatalogue";
import { isClassed } from "./emojiClasses";
import type { EmojiMapper, MilestoneId, MilestoneTier } from "./records";

export type EarnedEmojiId = `level:${number}` | `milestone:${MilestoneId}:${MilestoneTier}` | `team:${string}` | `hype:${MemberId}`;

const hypeSuffix = "-hype";
const teamStem = "team";
const firstUse: EarnedEmojiId = `level:${emojiLevels[0]}`;

export async function emojiNameOf(ctx: QueryCtx, workspace: string, emoji: EarnedEmojiId): Promise<string | null> {
  return (await registeredAs(ctx, workspace, emoji))?.name ?? null;
}

export async function nameHypeEmojiOf(ctx: MutationCtx, workspace: string, person: MemberId): Promise<void> {
  if ((await registeredAs(ctx, workspace, `hype:${person}`)) !== null) return;
  await reserveSharedNamesIn(ctx, workspace);
  await reserveTeamNamesShapedLikeHypes(ctx, workspace);
  await allocate(ctx, workspace, `hype:${person}`, hypeNameShapeOf(await fullNameOf(ctx, person)));
}

export function firstHypeEmojiNameFor(fullName: string): string {
  return firstCandidateOf(hypeNameShapeOf(fullName));
}

export async function hypeEmojiNameFor(ctx: QueryCtx, workspace: string, fullName: string, alsoTaken: AlsoTaken): Promise<string> {
  return (await nextFreeName(ctx, workspace, hypeNameShapeOf(fullName), alsoTaken)).name;
}

function hypeNameShapeOf(fullName: string): NameShape {
  return { slug: slugOf(fullName), empty: "person", suffix: hypeSuffix };
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
  return new Map([...(await secondNamesIn(ctx, workspace)), ...rows.map((row): [string, EarnedEmojiId] => [row.name, emojiIdOf(row)])]);
}

async function secondNamesIn(ctx: QueryCtx, workspace: string): Promise<[string, EarnedEmojiId][]> {
  const rows = await ctx.db
    .query("secondEmojiNames")
    .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace))
    .collect();
  return rows.map(({ name, emoji }) => [name, emoji as EarnedEmojiId]);
}

export const giveEmojiASecondName = internalMutation({
  args: { workspace: v.string(), emoji: v.string(), name: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { workspace, emoji, name }) => {
    if ((await registeredAs(ctx, workspace, emoji as EarnedEmojiId)) === null || (await isTakenOrClassed(ctx, workspace, name))) return false;
    await ctx.db.insert("secondEmojiNames", { workspace, emoji, name });
    return true;
  },
});

export async function openTheRegistryIn(ctx: MutationCtx, workspace: string): Promise<void> {
  await reserveSharedNamesIn(ctx, workspace);
}

export async function giveEmojiTheName(ctx: MutationCtx, workspace: string, emoji: EarnedEmojiId, name: string, mappedBy: EmojiMapper): Promise<void> {
  const named = await registeredAs(ctx, workspace, emoji);
  if (named?.name === name) {
    if (named.mappedBy?.as !== mappedBy.as) await ctx.db.patch(named._id, { mappedBy });
    return;
  }
  await freeTheName(ctx, workspace, name);
  if (named === null) await ctx.db.insert("emojiNames", { workspace, ...storedKeyOf(emoji), name, mappedBy });
  else await ctx.db.patch(named._id, { name, mappedBy });
}

export async function freeTheName(ctx: MutationCtx, workspace: string, name: string): Promise<void> {
  const secondHolder = await secondHolderOf(ctx, workspace, name);
  if (secondHolder !== null) await ctx.db.delete(secondHolder._id);
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
  if (holder !== null) return emojiIdOf(holder);
  return ((await secondHolderOf(ctx, workspace, name))?.emoji as EarnedEmojiId | undefined) ?? null;
}

export async function mapperOf(ctx: QueryCtx, workspace: string, emoji: EarnedEmojiId): Promise<EmojiMapper | null> {
  return (await registeredAs(ctx, workspace, emoji))?.mappedBy ?? null;
}

async function slackHas(ctx: QueryCtx, workspace: string, name: string) {
  return (await slackEmojiImageOf(ctx, workspace, name)) !== undefined;
}

async function naturalShapeOf(ctx: QueryCtx, emoji: EarnedEmojiId): Promise<NameShape> {
  const [kind, cause] = splitOnce(emoji);
  if (kind === "level") return levelNameShapeOf(cause);
  if (kind === "milestone") return { slug: slugOf(milestoneTierEmojiOf(cause)?.name ?? cause), empty: "milestone", suffix: "" };
  if (kind === "team") return teamNameShapeOf((await companyTeamsOf(ctx)).find(({ team }) => team === cause)?.name ?? cause);
  return hypeNameShapeOf(await fullNameOf(ctx, cause as MemberId));
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
      await moveBareTeamNamesToTheTeamPrefixIn(ctx, workspace);
      await reserveCatalogueNamesIn(ctx, workspace);
      await reserveCompanyTeamNamesIn(ctx, workspace);
    }
    return null;
  },
});

export const reserveSharedEmojiNames = internalMutation({
  args: { workspace: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { workspace }) => {
    for (const each of workspace === undefined ? await workspacesWithARegistry(ctx) : [workspace]) {
      await reserveSharedNamesIn(ctx, each);
      await reserveCatalogueNamesIn(ctx, each);
    }
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

async function reserveSharedNamesIn(ctx: MutationCtx, workspace: string) {
  if ((await registeredAs(ctx, workspace, firstUse)) !== null) return;
  await reserveCatalogueNamesIn(ctx, workspace);
  await reserveCompanyTeamNamesIn(ctx, workspace);
}

async function moveBareTeamNamesToTheTeamPrefixIn(ctx: MutationCtx, workspace: string) {
  const teamNames = new Map((await companyTeamsOf(ctx)).map(({ team, name }) => [team, name]));
  for (const row of await teamEmojiRowsIn(ctx, workspace)) {
    if (row.mappedBy !== undefined || row.name.startsWith(teamPrefixed(""))) continue;
    const [, team] = splitOnce(row.emoji);
    await ctx.db.patch(row._id, { name: await firstFreeName(ctx, workspace, teamNameShapeOf(teamNames.get(team) ?? team)) });
  }
}

function teamEmojiRowsIn(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("emojiNames")
    .withIndex("by_workspace_emoji", (q) => q.eq("workspace", workspace).gte("emoji", "team:").lt("emoji", "team:\uffff"))
    .collect();
}

async function reserveCatalogueNamesIn(ctx: MutationCtx, workspace: string) {
  for (const level of emojiLevels) await allocate(ctx, workspace, levelEmojiIdOf(level), levelNameShapeOf(level));
  await reserveLevelTwoNameIn(ctx, workspace);
  for (const { milestone, tier, name } of milestoneTierEmojis) await allocate(ctx, workspace, `milestone:${milestone}:${tier}`, { slug: slugOf(name), empty: "milestone", suffix: "" });
}

async function reserveCompanyTeamNamesIn(ctx: MutationCtx, workspace: string, only: (slug: string) => boolean = () => true) {
  const teams = (await companyTeamsOf(ctx)).toSorted((one, other) => one.team.localeCompare(other.team));
  for (const { team, name } of teams) {
    const shape = teamNameShapeOf(name);
    if (only(shape.slug)) await allocate(ctx, workspace, `team:${team}`, shape);
  }
}

async function reserveLevelTwoNameIn(ctx: MutationCtx, workspace: string) {
  const emoji = levelEmojiIdOf(levelTwoEmoji.level);
  if ((await registeredAs(ctx, workspace, emoji)) !== null) return;
  const name = (await isTakenOrClassed(ctx, workspace, levelTwoEmoji.name)) ? await firstFreeName(ctx, workspace, levelNameShapeOf(levelTwoEmoji.level)) : levelTwoEmoji.name;
  await ctx.db.insert("emojiNames", { workspace, ...storedKeyOf(emoji), name });
}

function levelEmojiIdOf(level: number): EarnedEmojiId {
  return `level:${level}`;
}

function levelNameShapeOf(level: number | string): NameShape {
  return { slug: `level-${level}`, empty: "level", suffix: "" };
}

function reserveTeamNamesShapedLikeHypes(ctx: MutationCtx, workspace: string) {
  return reserveCompanyTeamNamesIn(ctx, workspace, (slug) => slug.endsWith(hypeSuffix));
}

type NameShape = { slug: string; empty: string; suffix: string };

function teamNameShapeOf(teamName: string): NameShape {
  const slug = slugOf(teamName);
  return { slug: slug === "" ? "" : teamPrefixed(slug), empty: teamStem, suffix: "" };
}

export function teamPrefixed(slug: string): string {
  return `${teamStem}-${slug}`;
}

async function allocate(ctx: MutationCtx, workspace: string, emoji: EarnedEmojiId, shape: NameShape): Promise<void> {
  if ((await registeredAs(ctx, workspace, emoji)) !== null) return;
  await ctx.db.insert("emojiNames", { workspace, ...storedKeyOf(emoji), name: await firstFreeName(ctx, workspace, shape) });
}

export type AlsoTaken = (name: string) => Promise<boolean>;

type FreeName = { name: string; number?: number };

function firstCandidateOf({ slug, empty, suffix }: NameShape): string {
  return slug === "" ? `${empty}-1${suffix}` : `${slug}${suffix}`;
}

async function firstFreeName(ctx: MutationCtx, workspace: string, shape: NameShape, alsoTaken: AlsoTaken = async () => false): Promise<string> {
  const { name, number } = await nextFreeName(ctx, workspace, shape, alsoTaken);
  if (number !== undefined) await recordNumberOf(ctx, workspace, shape, number);
  return name;
}

async function nextFreeName(ctx: QueryCtx, workspace: string, shape: NameShape, alsoTaken: AlsoTaken): Promise<FreeName> {
  const { slug, empty, suffix } = shape;
  const isFreeHere = async (name: string) => (await isFree(ctx, workspace, name)) && !(await alsoTaken(name));
  const plain = firstCandidateOf(shape);
  if (slug !== "" && (await isFreeHere(plain))) return { name: plain };
  const stem = slug === "" ? empty : slug;
  const numbering = await numberingOf(ctx, workspace, numberedStemOf(shape));
  for (let n = (numbering?.last ?? (slug === "" ? 0 : 1)) + 1; ; n += 1) {
    const name = `${stem}-${n}${suffix}`;
    if (await isFreeHere(name)) return { name, number: n };
  }
}

async function recordNumberOf(ctx: MutationCtx, workspace: string, shape: NameShape, last: number): Promise<void> {
  const stem = numberedStemOf(shape);
  const numbering = await numberingOf(ctx, workspace, stem);
  if (numbering === null) await ctx.db.insert("emojiNameNumbers", { workspace, stem, last });
  else await ctx.db.patch(numbering._id, { last });
}

function numberedStemOf({ slug, empty, suffix }: NameShape): string {
  return `${slug === "" ? empty : slug}${suffix}`;
}

async function isFree(ctx: QueryCtx, workspace: string, name: string) {
  return !isStandardEmojiName(name) && !(await isTakenOrClassed(ctx, workspace, name));
}

async function isTakenOrClassed(ctx: QueryCtx, workspace: string, name: string) {
  return (await nameTaken(ctx, workspace, name)) || (await isClassed(ctx, workspace, name));
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

function secondHolderOf(ctx: QueryCtx, workspace: string, name: string) {
  return ctx.db
    .query("secondEmojiNames")
    .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace).eq("name", name))
    .unique();
}

async function nameTaken(ctx: QueryCtx, workspace: string, name: string) {
  return (await emojiNamed(ctx, workspace, name)) !== null;
}
