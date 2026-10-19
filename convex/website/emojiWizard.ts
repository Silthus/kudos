import { v } from "convex/values";
import { appEmojisIn, mapHeldEmoji, slackEmojisNear, type AppEmojiKind, type SlackEmojiMatch } from "../album/emojiWizard";
import { targetOf } from "../album/emojiMappings";
import { emojiWizardShownTo } from "../album/flag";
import type { EmojiMapper } from "../album/records";
import type { QueryCtx } from "../_generated/server";
import { nameAndPictureOf } from "../workspace/directory";
import { workspaceSettingsShownTo } from "../workspace/workspaceSettings";
import type { ShownTarget } from "./emojiMappings";
import { memberMutation } from "./memberMutation";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { teammateKeyOf } from "./teammateKeys";

export type SlackEmojiMatches = { kind: "matches"; matches: SlackEmojiMatch[] };

export type SlackEmojiMatchesRead = { kind: "off" } | SlackEmojiMatches;

export type EmojiMappedBy = { by: EmojiMapper["as"]; name: string };

export type AppEmoji = { key: string; kind: AppEmojiKind; name: string; from: string; picture: string; holders: number; slack: { image: string; setBy: EmojiMappedBy | null } | null; place: ShownTarget };

export type AppEmojis = { kind: "app-emojis"; emojis: AppEmoji[] };

export type AppEmojisRead = { kind: "off" } | AppEmojis;

export type MyEmojiMappingAnswer = { kind: "mapped" } | { kind: "refused" };

const unnamedMapper = "A former member";

export const findSlackEmojis = memberQuery({
  args: { near: v.string(), search: v.string() },
  handler: async (ctx, me, { near, search }): Promise<SlackEmojiMatchesRead> => {
    if (!(await emojiWizardShownTo(ctx, me.member))) return { kind: "off" };
    return { kind: "matches", matches: await slackEmojisNear(ctx, me.workspace, near, search) };
  },
});

export const mapMyEmoji = memberMutation({
  args: { emoji: v.string(), to: v.string() },
  handler: async (ctx, me, _person, { emoji, to }): Promise<MyEmojiMappingAnswer> => {
    if (!(await emojiWizardShownTo(ctx, me.member))) return { kind: "refused" };
    return (await mapHeldEmoji(ctx, me.workspace, me.member, emoji, to)) ? { kind: "mapped" } : { kind: "refused" };
  },
});

export const getAppEmojis = memberQuery(async (ctx, me): Promise<AppEmojisRead> => {
  if (!(await emojiWizardShownTo(ctx, me.member)) || !(await workspaceSettingsShownTo(ctx, me.member))) return { kind: "off" };
  const emojis: AppEmoji[] = [];
  for (const { emoji, kind, name, from, picture, holders, slack } of await appEmojisIn(ctx, me.workspace)) {
    const place = await shownPlaceOf(me, targetOf(emoji));
    if (place === null) continue;
    emojis.push({ key: `${place.kind}:${"person" in place ? place.person : emoji.slice(emoji.indexOf(":") + 1)}`, kind, name, from, picture, holders, place, slack: slack === null ? null : { image: slack.image, setBy: slack.mappedBy === null ? null : await mappedByOf(ctx, slack.mappedBy) } });
  }
  return { kind: "app-emojis", emojis };
});

async function shownPlaceOf(me: VerifiedMember, target: ReturnType<typeof targetOf>): Promise<ShownTarget | null> {
  if (target === null || target.kind === "random") return null;
  return target.kind === "hype" ? { kind: "hype", person: await teammateKeyOf(me, target.person) } : target;
}

async function mappedByOf(ctx: QueryCtx, { member, as }: EmojiMapper): Promise<EmojiMappedBy> {
  return { by: as, name: (await nameAndPictureOf(ctx, member)).name ?? unnamedMapper };
}
