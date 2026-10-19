import type { MutationCtx, QueryCtx } from "../_generated/server";
import { companyTeamsOf, type CompanyTeam } from "../companyProfiles/teams";
import { levelOf } from "../progression/levels";
import { customEmojiImageOf, originalCustomEmojiOf, originalCustomEmojiStartingWith } from "../workspace/customEmoji";
import type { MemberId } from "../workspace/directory";
import { emojiArtPictureOf, emojiLevels, milestoneTierArtOf, milestoneTierEmojiOf, slugOf } from "./emojiCatalogue";
import { emojiClassesIn, isClassed } from "./emojiClasses";
import { hypeFaceOf, isEarnedBy, teamPictureOf, type EarnedEmojiKind } from "./earnedEmojis";
import { emojiNamed, emojiNameOf, giveEmojiTheName, mapperOf, namesHeldIn, registeredEmojisIn, type EarnedEmojiId } from "./emojiNames";
import type { EmojiMapper } from "./records";

export type SlackEmojiMatch = { name: string; image: string; free: boolean };

export type AppEmojiKind = Exclude<EarnedEmojiKind, "random">;

export type AppEmojiRow = { emoji: EarnedEmojiId; kind: AppEmojiKind; name: string; from: string; picture: string; holders: number; slack: { image: string; mappedBy: EmojiMapper | null } | null };

export const mostMatchesShown = 24;

export const mostHoldingsCounted = 5_000;

const matchesReadPerTerm = 20;

const stemLength = 4;

const shortestWord = 2;

const mostTerms = 8;

const appEmojiKinds: readonly AppEmojiKind[] = ["team", "milestone", "level", "hype"];

export async function slackEmojisNear(ctx: QueryCtx, workspace: string, near: string, search: string): Promise<SlackEmojiMatch[]> {
  const target = slugOf(search.trim() === "" ? near : search);
  if (target === "") return [];
  const found = new Map<string, string>();
  for (const term of termsOf(target)) for (const { name, image } of await originalCustomEmojiStartingWith(ctx, workspace, term, matchesReadPerTerm)) found.set(name, image);
  const held = await namesHeldIn(ctx, workspace);
  const classed = await emojiClassesIn(ctx, workspace);
  const matches = [...found].map(([name, image]) => ({ name, image, free: !held.has(name) && !classed.has(name) }));
  return matches.toSorted(closestTo(target)).slice(0, mostMatchesShown);
}

export async function mapHeldEmoji(ctx: MutationCtx, workspace: string, member: MemberId, emoji: string, name: string): Promise<boolean> {
  const id = earnedEmojiIdOf(emoji);
  if (id === null || !(await isEarnedBy(ctx, member, id))) return false;
  if (!(await isMappableByMembers(ctx, workspace, id)) || !(await isFreeInSlack(ctx, workspace, name))) return false;
  await giveEmojiTheName(ctx, workspace, id, name, { member, as: "member" });
  return true;
}

export async function appEmojisIn(ctx: QueryCtx, workspace: string): Promise<AppEmojiRow[]> {
  const teams = new Map((await companyTeamsOf(ctx)).map((team) => [team.team, team]));
  const holders = await holdersIn(ctx, workspace);
  const rows: AppEmojiRow[] = [];
  for (const { emoji, name, mappedBy } of await registeredEmojisIn(ctx, workspace)) {
    const shown = await shownAppEmojiOf(ctx, workspace, emoji, teams);
    if (shown === null) continue;
    const image = await customEmojiImageOf(ctx, workspace, name);
    rows.push({ emoji, ...shown, name, holders: holders.get(emoji) ?? 0, slack: image === undefined ? null : { image, mappedBy } });
  }
  return rows.toSorted((one, other) => other.holders - one.holders || one.name.localeCompare(other.name));
}

function earnedEmojiIdOf(emoji: string): EarnedEmojiId | null {
  const kind = emoji.slice(0, emoji.indexOf(":"));
  return appEmojiKinds.some((each) => each === kind) ? (emoji as EarnedEmojiId) : null;
}

async function isMappableByMembers(ctx: QueryCtx, workspace: string, emoji: EarnedEmojiId): Promise<boolean> {
  const name = await emojiNameOf(ctx, workspace, emoji);
  if (name === null || (await customEmojiImageOf(ctx, workspace, name)) !== undefined) return false;
  return (await mapperOf(ctx, workspace, emoji))?.as !== "maintainer";
}

async function isFreeInSlack(ctx: QueryCtx, workspace: string, name: string): Promise<boolean> {
  if ((await originalCustomEmojiOf(ctx, workspace, name))?.name !== name) return false;
  return (await emojiNamed(ctx, workspace, name)) === null && !(await isClassed(ctx, workspace, name));
}

function termsOf(target: string): string[] {
  const words = target.split("-").filter((word) => word.length >= shortestWord);
  const stems = words.filter((word) => word.length > stemLength).map((word) => word.slice(0, stemLength));
  return [...new Set([target, ...words, ...stems])].slice(0, mostTerms);
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

async function shownAppEmojiOf(ctx: QueryCtx, workspace: string, emoji: EarnedEmojiId, teams: Map<string, CompanyTeam>): Promise<ShownAppEmoji | null> {
  const colon = emoji.indexOf(":");
  const [kind, cause] = [emoji.slice(0, colon), emoji.slice(colon + 1)];
  if (kind === "team") {
    const team = teams.get(cause);
    return team === undefined ? null : { kind, from: team.name, picture: teamPictureOf(team.crest) };
  }
  if (kind === "milestone") {
    const tier = milestoneTierEmojiOf(cause);
    return tier === null ? null : { kind, from: tier.name, picture: emojiArtPictureOf("milestone", milestoneTierArtOf(tier.milestone, tier.tier)) };
  }
  if (kind === "level") return { kind, from: `Level ${cause}`, picture: emojiArtPictureOf("level", Number(cause)) };
  const { name, picture } = await hypeFaceOf(ctx, workspace, cause as MemberId);
  return { kind: "hype", from: name, picture };
}

async function holdersIn(ctx: QueryCtx, workspace: string): Promise<Map<string, number>> {
  const isCurrentHere = currentMemberTest(ctx, workspace);
  const holdings = new Map<string, Set<MemberId>>();
  const holds = async (member: MemberId, emoji: string) => {
    if (await isCurrentHere(member)) holdings.set(emoji, (holdings.get(emoji) ?? new Set()).add(member));
  };
  for (const { member, team } of await ctx.db.query("teamStickers").take(mostHoldingsCounted)) await holds(member, `team:${team}`);
  for (const { member, milestone, tier } of await ctx.db.query("milestoneTiers").take(mostHoldingsCounted)) await holds(member, `milestone:${milestone}:${tier}`);
  for (const { member, xp } of await ctx.db.query("memberProgress").take(mostHoldingsCounted)) for (const reward of emojiLevels.filter((level) => levelOf(xp) >= level)) await holds(member, `level:${reward}`);
  for (const { giver, recipient } of await ctx.db.query("thoughtfulPacks").take(mostHoldingsCounted)) await holds(giver, `hype:${recipient}`);
  return new Map([...holdings].map(([emoji, members]) => [emoji, members.size]));
}

function currentMemberTest(ctx: QueryCtx, workspace: string): (member: MemberId) => Promise<boolean> {
  const known = new Map<MemberId, Promise<boolean>>();
  return (member) => {
    const answer = known.get(member) ?? ctx.db.get(member).then((row) => row?.kind === "member" && row.workspace === workspace);
    known.set(member, answer);
    return answer;
  };
}
