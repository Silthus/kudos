import type { MutationCtx, QueryCtx } from "../_generated/server";
import { companyTeamsOf, type CompanyTeam } from "../companyProfiles/teams";
import { levelOf } from "../progression/levels";
import { currentMembersNamedIn, type MemberId, type NamedMember } from "../workspace/directory";
import { slackEmojiImageOf, slackEmojiNamed, slackEmojiReachOf, slackEmojiStartingWith, type SlackEmojiReach } from "../workspace/slackEmoji";
import { workspaceSettingsShownTo } from "../workspace/workspaceSettings";
import { emojiMappingInPlaceShownTo, emojiWizardShownTo } from "./flag";
import { emojiArtPictureOf, everyEmojiLevel, milestoneTierArtOf, milestoneTierEmojiOf, slugOf } from "./emojiCatalogue";
import { levelEmojiPictureOf } from "./levelEmojis";
import { emojiClassesIn, isClassed } from "./emojiClasses";
import { hypeFaceOf, isEarnedBy, teamPictureOf, type EarnedEmojiKind } from "./earnedEmojis";
import { placeSlackEmoji, targetOf, type MappingTarget } from "./emojiMappings";
import { emojiNamed, emojiNameOf, firstHypeEmojiNameFor, giveEmojiTheName, hypeNameHintsIn, mapperOf, namesHeldIn, registeredEmojisIn, teamPrefixed, type EarnedEmojiId, type RegisteredEmoji } from "./emojiNames";
import type { EmojiMapper } from "./records";

export type SlackEmojiMatch = { name: string; image: string; free: boolean };

export type AppEmojiKind = Exclude<EarnedEmojiKind, "random">;

export type EmojiInPlace = "admin" | "member" | null;

export type AppEmojiRow = { emoji: EarnedEmojiId; kind: AppEmojiKind; name: string; from: string; picture: string; holders: number; slack: { image: string; mappedBy: EmojiMapper | null } | null };

export const mostMatchesShown = 24;

export const mostHoldingsCounted = 5_000;

export const mostAppEmojisListed = 500;

const matchesReadPerTerm = 20;

const stemLength = 4;

const shortestWord = 2;

const mostTerms = 9;

const appEmojiKinds: readonly AppEmojiKind[] = ["team", "milestone", "level", "hype"];

export async function slackEmojisNear(ctx: QueryCtx, workspace: string, near: string, search: string, reach: SlackEmojiReach): Promise<SlackEmojiMatch[]> {
  const typed = typedNameOf(search);
  const target = typed === "" ? near : typed;
  if (slugOf(target) === "") return [];
  const found = new Map<string, string>();
  for (const term of termsOf(target)) for (const { name, image } of await slackEmojiStartingWith(ctx, workspace, term, matchesReadPerTerm, reach)) found.set(name, image);
  const held = await namesHeldIn(ctx, workspace);
  const classed = await emojiClassesIn(ctx, workspace);
  const matches = [...found].map(([name, image]) => ({ name, image, free: !held.has(name) && !classed.has(name) }));
  return matches.toSorted(closestTo(target)).slice(0, mostMatchesShown);
}

export async function mapHeldEmoji(ctx: MutationCtx, workspace: string, member: MemberId, emoji: string, name: string): Promise<boolean> {
  const id = earnedEmojiIdOf(emoji);
  if (id === null || !(await isEarnedBy(ctx, member, id))) return false;
  if (!(await isMappableByMembers(ctx, workspace, id)) || !(await isFreeInSlack(ctx, workspace, name, await slackEmojiReachOf(ctx, member)))) return false;
  await giveEmojiTheName(ctx, workspace, id, name, { member, as: "member" });
  return true;
}

export async function emojiInPlaceFor(ctx: QueryCtx, member: MemberId): Promise<EmojiInPlace> {
  if (!(await emojiWizardShownTo(ctx, member)) || !(await emojiMappingInPlaceShownTo(ctx, member))) return null;
  return (await workspaceSettingsShownTo(ctx, member)) ? "admin" : "member";
}

export async function mapAppEmojiInPlace(ctx: MutationCtx, workspace: string, maintainer: MemberId, emoji: string, name: string): Promise<boolean> {
  const place = appEmojiPlaceOf(ctx, emoji);
  return place !== null && (await placeSlackEmoji(ctx, workspace, name, place, false, { member: maintainer, as: "maintainer" }));
}

export type AppEmojiRows = { rows: AppEmojiRow[]; more: boolean };

type ListedAppEmoji = RegisteredEmoji & { named: boolean; fullName?: string };

export async function appEmojisIn(ctx: QueryCtx, workspace: string, levels: readonly number[], everyHype: boolean): Promise<AppEmojiRows> {
  const teams = new Map((await companyTeamsOf(ctx)).map((team) => [team.team, team]));
  const people = await currentMembersNamedIn(ctx, workspace);
  const currentMembers = new Set<string>(people.map(({ member }) => member));
  const holders = await holdersIn(ctx, currentMembers);
  const registered = await registeredEmojisIn(ctx, workspace);
  const listed: ListedAppEmoji[] = [...registered.map((row) => ({ ...row, named: true })), ...(everyHype ? unnamedHypesOf(people, registered) : [])];
  const hintFor = hypeNameHintsIn(ctx, workspace);
  const rows: AppEmojiRow[] = [];
  for (const { emoji, name, mappedBy, named, fullName = "", holders: held } of listed.map((row) => ({ ...row, holders: holders.get(row.emoji) ?? 0 })).toSorted((one, other) => other.holders - one.holders || one.name.localeCompare(other.name))) {
    const shown = await shownAppEmojiOf(ctx, workspace, emoji, { teams, currentMembers, levels });
    if (shown === null) continue;
    if (rows.length === mostAppEmojisListed) return { rows, more: true };
    const image = named ? await slackEmojiImageOf(ctx, workspace, name) : undefined;
    rows.push({ emoji, ...shown, name: named ? name : await hintFor(fullName), holders: held, slack: image === undefined ? null : { image, mappedBy } });
  }
  return { rows, more: false };
}

function unnamedHypesOf(people: NamedMember[], registered: RegisteredEmoji[]): ListedAppEmoji[] {
  const named = new Set<string>(registered.map(({ emoji }) => emoji));
  return people.filter(({ member }) => !named.has(`hype:${member}`)).map(({ member, fullName }) => ({ emoji: `hype:${member}`, name: firstHypeEmojiNameFor(fullName), fullName, mappedBy: null, named: false }));
}


function splitOnce(id: string): [string, string] {
  const colon = id.indexOf(":");
  return [id.slice(0, colon), id.slice(colon + 1)];
}

function earnedEmojiIdOf(emoji: string): EarnedEmojiId | null {
  const kind = emoji.slice(0, emoji.indexOf(":"));
  return appEmojiKinds.some((each) => each === kind) ? (emoji as EarnedEmojiId) : null;
}

function appEmojiPlaceOf(ctx: QueryCtx, emoji: string): MappingTarget | null {
  const id = earnedEmojiIdOf(emoji);
  const target = id === null ? null : targetOf(id);
  if (target?.kind !== "hype") return target;
  const person = ctx.db.normalizeId("members", target.person);
  return person === null ? null : { kind: "hype", person };
}

async function isMappableByMembers(ctx: QueryCtx, workspace: string, emoji: EarnedEmojiId): Promise<boolean> {
  const name = await emojiNameOf(ctx, workspace, emoji);
  if (name === null || (await slackEmojiImageOf(ctx, workspace, name)) !== undefined) return false;
  return (await mapperOf(ctx, workspace, emoji))?.as !== "maintainer";
}

async function isFreeInSlack(ctx: QueryCtx, workspace: string, name: string, reach: SlackEmojiReach): Promise<boolean> {
  if ((await slackEmojiNamed(ctx, workspace, name, reach))?.name !== name) return false;
  return (await emojiNamed(ctx, workspace, name)) === null && !(await isClassed(ctx, workspace, name));
}

function typedNameOf(search: string): string {
  return search.trim().toLowerCase().replace(/^:+|:+$/g, "");
}

function termsOf(target: string): string[] {
  const slug = slugOf(target);
  const words = slug.split("-").filter((word) => word.length >= shortestWord);
  const stems = words.filter((word) => word.length > stemLength).map((word) => word.slice(0, stemLength));
  return [...new Set([target, slug, teamPrefixed(slug), ...words, ...stems])].slice(0, mostTerms);
}

function closestTo(target: string) {
  const closeness = (name: string) => (name === target ? 2 : diceOf(bigramsOf(target), bigramsOf(name)));
  return (one: SlackEmojiMatch, other: SlackEmojiMatch) => Number(other.free) - Number(one.free) || closeness(other.name) - closeness(one.name) || one.name.localeCompare(other.name);
}

function bigramsOf(name: string): string[] {
  return Array.from({ length: Math.max(0, name.length - 1) }, (_, at) => name.slice(at, at + 2));
}

function diceOf(one: string[], other: string[]): number {
  if (one.length + other.length === 0) return 0;
  const left = [...other];
  let shared = 0;
  for (const bigram of one) {
    const at = left.indexOf(bigram);
    if (at === -1) continue;
    shared += 1;
    left.splice(at, 1);
  }
  return (2 * shared) / (one.length + other.length);
}

type ShownAppEmoji = Pick<AppEmojiRow, "kind" | "from" | "picture">;

type AppEmojiCauses = { teams: Map<string, CompanyTeam>; currentMembers: Set<string>; levels: readonly number[] };

async function shownAppEmojiOf(ctx: QueryCtx, workspace: string, emoji: EarnedEmojiId, { teams, currentMembers, levels }: AppEmojiCauses): Promise<ShownAppEmoji | null> {
  const [kind, cause] = splitOnce(emoji);
  if (kind === "team") {
    const team = teams.get(cause);
    return team === undefined ? null : { kind, from: team.name, picture: teamPictureOf(team.crest) };
  }
  if (kind === "milestone") {
    const tier = milestoneTierEmojiOf(cause);
    return tier === null ? null : { kind, from: tier.name, picture: emojiArtPictureOf("milestone", milestoneTierArtOf(tier.milestone, tier.tier)) };
  }
  if (kind === "level") return levels.includes(Number(cause)) ? { kind, from: `Level ${cause}`, picture: levelEmojiPictureOf(Number(cause)) } : null;
  if (!currentMembers.has(cause)) return null;
  const { name, picture } = await hypeFaceOf(ctx, workspace, cause as MemberId);
  return { kind: "hype", from: name, picture };
}

async function holdersIn(ctx: QueryCtx, currentMembers: Set<string>): Promise<Map<string, number>> {
  const holdings = new Map<string, Set<MemberId>>();
  const holds = (member: MemberId, emoji: string) => {
    if (currentMembers.has(member)) holdings.set(emoji, (holdings.get(emoji) ?? new Set()).add(member));
  };
  for (const { member, team } of await ctx.db.query("teamStickers").take(mostHoldingsCounted)) holds(member, `team:${team}`);
  for (const { member, milestone, tier } of await ctx.db.query("milestoneTiers").take(mostHoldingsCounted)) holds(member, `milestone:${milestone}:${tier}`);
  for (const { member, xp } of await ctx.db.query("memberProgress").take(mostHoldingsCounted)) for (const reward of everyEmojiLevel.filter((level) => levelOf(xp) >= level)) holds(member, `level:${reward}`);
  for (const { giver, recipient } of await ctx.db.query("thoughtfulPacks").take(mostHoldingsCounted)) holds(giver, `hype:${recipient}`);
  return new Map([...holdings].map(([emoji, members]) => [emoji, members.size]));
}
