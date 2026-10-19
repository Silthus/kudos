import type { MutationCtx, QueryCtx } from "../_generated/server";
import { companyTeamsOf } from "../companyProfiles/teams";
import { customEmojiImageOf, customEmojiListedIn } from "../workspace/customEmoji";
import { personFactsOf, type MemberId } from "../workspace/directory";
import { emojiLevels, milestoneTierEmojiOf, milestoneTierEmojis } from "./emojiCatalogue";
import { classEmoji, emojiClassesIn, unclassEmoji } from "./emojiClasses";
import { freeTheName, giveEmojiTheName, namesHeldIn, openTheRegistryIn, type EarnedEmojiId } from "./emojiNames";

export type MappingTarget = { kind: "team"; team: string } | { kind: "milestone"; milestone: string } | { kind: "level"; level: number } | { kind: "hype"; person: MemberId } | { kind: "random" };

export type EmojiPlace = MappingTarget | { kind: "unmapped" };

export type SlackEmojiMapping = { name: string; image: string; mapping: MappingTarget | null };

export type MappableTeam = { team: string; name: string };

export type MappableMilestone = { milestone: string; name: string };

export type SlackEmojiMappings = { emoji: SlackEmojiMapping[]; more: boolean; randomDrops: boolean; teams: MappableTeam[]; milestones: MappableMilestone[]; levels: number[] };

export const mostSlackEmojiListed = 10_000;

export async function slackEmojiMappingsIn(ctx: QueryCtx, workspace: string, randomDrops: boolean): Promise<SlackEmojiMappings> {
  const listed = await customEmojiListedIn(ctx, workspace, mostSlackEmojiListed + 1);
  const named = await namesHeldIn(ctx, workspace);
  const classes = await emojiClassesIn(ctx, workspace);
  const mappingOf = (name: string): MappingTarget | null => (classes.get(name) === "random" ? { kind: "random" } : targetOf(named.get(name)));
  return {
    emoji: listed.slice(0, mostSlackEmojiListed).map(({ name, image }) => ({ name, image, mapping: mappingOf(name) })),
    more: listed.length > mostSlackEmojiListed,
    randomDrops,
    teams: (await companyTeamsOf(ctx)).map(({ team, name }) => ({ team, name })).toSorted((one, other) => one.name.localeCompare(other.name)),
    milestones: milestoneTierEmojis.map(({ milestone, tier, name }) => ({ milestone: `${milestone}:${tier}`, name })),
    levels: [...emojiLevels],
  };
}

export async function placeSlackEmoji(ctx: MutationCtx, workspace: string, name: string, place: EmojiPlace, randomDrops: boolean, maintainer: MemberId): Promise<boolean> {
  if ((await customEmojiImageOf(ctx, workspace, name)) === undefined || (place.kind === "random" && !randomDrops)) return false;
  await openTheRegistryIn(ctx, workspace);
  if (place.kind === "unmapped" || place.kind === "random") {
    if (!(await classEmoji(ctx, workspace, name, place.kind))) return false;
    await freeTheName(ctx, workspace, name);
    return true;
  }
  const emoji = await earnedEmojiAt(ctx, workspace, place);
  if (emoji === null) return false;
  await unclassEmoji(ctx, workspace, name);
  await giveEmojiTheName(ctx, workspace, emoji, name, { member: maintainer, as: "maintainer" });
  return true;
}

export function targetOf(emoji: EarnedEmojiId | undefined): MappingTarget | null {
  if (emoji === undefined) return null;
  const colon = emoji.indexOf(":");
  const [kind, cause] = [emoji.slice(0, colon), emoji.slice(colon + 1)];
  if (kind === "team") return { kind, team: cause };
  if (kind === "milestone") return { kind, milestone: cause };
  if (kind === "level") return { kind, level: Number(cause) };
  return { kind: "hype", person: cause as MemberId };
}

async function earnedEmojiAt(ctx: QueryCtx, workspace: string, place: Exclude<MappingTarget, { kind: "random" }>): Promise<EarnedEmojiId | null> {
  switch (place.kind) {
    case "team":
      return (await companyTeamsOf(ctx)).some(({ team }) => team === place.team) ? `team:${place.team}` : null;
    case "milestone":
      return milestoneTierEmojiOf(place.milestone) === null ? null : (`milestone:${place.milestone}` as EarnedEmojiId);
    case "level":
      return emojiLevels.some((level) => level === place.level) ? `level:${place.level}` : null;
    case "hype":
      return (await personFactsOf(ctx, place.person))?.workspace === workspace ? `hype:${place.person}` : null;
  }
}
