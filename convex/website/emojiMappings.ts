import { v } from "convex/values";
import { randomEmojisShownTo } from "../album/flag";
import { placeSlackEmoji, slackEmojiMappingsIn, type EmojiPlace, type MappingTarget, type SlackEmojiMappings } from "../album/emojiMappings";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { peopleIn, type MemberId } from "../workspace/directory";
import { recordListedMember, unknownListedMembersIn } from "../workspace/listedMembers";
import { slackEmojiNamed, slackEmojiReachOf } from "../workspace/slackEmoji";
import { workspaceSettingsShownTo } from "../workspace/workspaceSettings";
import { memberMutation } from "./memberMutation";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { listedMemberKeyOf, listedMemberOfKey, teammateKeyOf, teammateOfKey } from "./teammateKeys";

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
  const members = await mappableMembersOf(ctx, me);
  const keyOf = new Map(members.map(({ member, key }) => [member, key]));
  const people = [...members, ...(await mappableListedMembersOf(ctx, me))].toSorted((one, other) => one.name.localeCompare(other.name));
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
    const place = await placeOf(ctx, me, emoji, to);
    return place !== null && (await placeSlackEmoji(ctx, me.workspace, emoji, place, await randomEmojisShownTo(ctx, me.member), me.member)) ? { kind: "mapped" } : { kind: "refused" };
  },
});

async function placeOf(ctx: MutationCtx, me: VerifiedMember, emoji: string, to: ShownTarget | { kind: "unmapped" }): Promise<EmojiPlace | null> {
  if (to.kind !== "hype") return to;
  const person = (await teammateOfKey(ctx, me, to.person)) ?? (await listedMemberHypedWith(ctx, me, emoji, to.person));
  return person === null ? null : { kind: "hype", person };
}

async function listedMemberHypedWith(ctx: MutationCtx, me: VerifiedMember, emoji: string, key: string): Promise<MemberId | null> {
  const user = await listedMemberOfKey(ctx, me, key);
  if (user === null || !(await canPick(ctx, me, emoji))) return null;
  return recordListedMember(ctx, me.workspace, user);
}

async function canPick(ctx: QueryCtx, me: VerifiedMember, emoji: string) {
  return (await slackEmojiNamed(ctx, me.workspace, emoji, await slackEmojiReachOf(ctx, me.member))) !== null;
}

async function mappableMembersOf(ctx: QueryCtx, me: VerifiedMember): Promise<(MappablePerson & { member: MemberId })[]> {
  const people = [...(await peopleIn(ctx, me.workspace))].filter(([, { former }]) => !former);
  return Promise.all(people.map(async ([member, { name }]) => ({ member, key: await teammateKeyOf(me, member), name: name ?? "" })));
}

async function mappableListedMembersOf(ctx: QueryCtx, me: VerifiedMember): Promise<MappablePerson[]> {
  return Promise.all((await unknownListedMembersIn(ctx, me.workspace)).map(async ({ user, name }) => ({ key: await listedMemberKeyOf(me, user), name: name ?? "" })));
}
