import { v } from "convex/values";
import { randomEmojisShownTo } from "../album/flag";
import { placeSlackEmoji, slackEmojiMappingsIn, type EmojiPlace, type MappingTarget, type SlackEmojiMappings } from "../album/emojiMappings";
import type { QueryCtx } from "../_generated/server";
import { peopleIn, type MemberId } from "../workspace/directory";
import { slackEmojiReachOf } from "../workspace/slackEmoji";
import { workspaceSettingsShownTo } from "../workspace/workspaceSettings";
import { memberMutation } from "./memberMutation";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { teammateKeyOf, teammateOfKey } from "./teammateKeys";

export type ShownTarget = Exclude<MappingTarget, { kind: "hype" }> | { kind: "hype"; person: string };

export type MappablePerson = { key: string; name: string };

export type EmojiMappings = { kind: "mappings"; emoji: { name: string; image: string; mapping: ShownTarget | null }[]; people: MappablePerson[] } & Omit<SlackEmojiMappings, "emoji">;

export type EmojiMappingsRead = { kind: "off" } | EmojiMappings;

export type EmojiMappingAnswer = { kind: "mapped" } | { kind: "refused" };

const placeValidator = v.union(
  v.object({ kind: v.literal("team"), team: v.string() }),
  v.object({ kind: v.literal("milestone"), milestone: v.string() }),
  v.object({ kind: v.literal("level"), level: v.number() }),
  v.object({ kind: v.literal("hype"), person: v.string() }),
  v.object({ kind: v.literal("random") }),
  v.object({ kind: v.literal("unmapped") }),
);

export const getEmojiMappings = memberQuery(async (ctx, me): Promise<EmojiMappingsRead> => {
  if (!(await workspaceSettingsShownTo(ctx, me.member))) return { kind: "off" };
  const { emoji, ...targets } = await slackEmojiMappingsIn(ctx, me.workspace, await randomEmojisShownTo(ctx, me.member), await slackEmojiReachOf(ctx, me.member));
  const people = await mappablePeopleOf(ctx, me);
  const keyOf = new Map(people.map(({ member, key }) => [member, key]));
  return {
    kind: "mappings",
    ...targets,
    emoji: await Promise.all(emoji.map(async ({ mapping, ...listed }) => ({ ...listed, mapping: mapping?.kind === "hype" ? { kind: "hype", person: keyOf.get(mapping.person) ?? (await teammateKeyOf(me, mapping.person)) } : mapping }))),
    people: people.map(({ key, name }) => ({ key, name })),
  };
});

export const mapSlackEmoji = memberMutation({
  args: { emoji: v.string(), to: placeValidator },
  handler: async (ctx, me, _person, { emoji, to }): Promise<EmojiMappingAnswer> => {
    if (!(await workspaceSettingsShownTo(ctx, me.member))) return { kind: "refused" };
    const place = await placeOf(ctx, me, to);
    return place !== null && (await placeSlackEmoji(ctx, me.workspace, emoji, place, await randomEmojisShownTo(ctx, me.member), me.member)) ? { kind: "mapped" } : { kind: "refused" };
  },
});

async function placeOf(ctx: QueryCtx, me: VerifiedMember, to: ShownTarget | { kind: "unmapped" }): Promise<EmojiPlace | null> {
  if (to.kind !== "hype") return to;
  const person = await teammateOfKey(ctx, me, to.person);
  return person === null ? null : { kind: "hype", person };
}

async function mappablePeopleOf(ctx: QueryCtx, me: VerifiedMember): Promise<(MappablePerson & { member: MemberId })[]> {
  const people = [...(await peopleIn(ctx, me.workspace))].filter(([, { former }]) => !former);
  const keyed = await Promise.all(people.map(async ([member, { name }]) => ({ member, key: await teammateKeyOf(me, member), name: name ?? "" })));
  return keyed.toSorted((one, other) => one.name.localeCompare(other.name));
}
