import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireViewer } from "./lib/access";
import {
  COSMETICS,
  cosmeticByKey,
  EMOJI_VARIANTS,
  type KudosEmoji,
  type Look,
  ownedVariants,
  readKudosEmoji,
  SUPER_SUFFIX,
  superKudosPerMonth,
  variantShortcode,
} from "./lib/cosmetics";
import { countEmoji } from "./lib/parse";
import { hasSkill, type Allocation } from "./lib/skills";
import { parseToday } from "./lib/time";
import { levelProgress } from "./lib/xp";
import { gameOn, gameShownTo, playerOf, skillsOf } from "./game";
import { itemsBought } from "./items";
import { findMember } from "./engine";
import { superKudosUsed } from "./superKudos";

/**
 * Cosmetics (#98, #55 §G5, §G12): what a member owns and wears, their kudos emoji, and the profile
 * others see. Buying goes through the Store (`lib/items.ts`); wearing is free and instant.
 */

export const lookValidator = v.object({ frame: v.optional(v.string()), banner: v.optional(v.string()), sticker: v.optional(v.string()) });

/**
 * What a member wears, as others see it: only while the game is on and neither they nor the viewer
 * hide it. Never ranked: it's shown next to a name, never sorted by (§G12).
 */
export function shownLook(workspace: Pick<Doc<"workspaces">, "gameEnabled">, member: Pick<Doc<"members">, "gameHidden" | "look">, viewer?: Pick<Doc<"members">, "gameHidden">): Look {
  if (!gameShownTo(workspace, member) || viewer?.gameHidden) return {};
  return { ...(member.look ?? {}) };
}

/** The emoji variants a member owns (suffixes): bought in the Store, or from Signature emoji. */
export async function variantsOf(ctx: QueryCtx, memberId: Id<"members">, skills: Allocation): Promise<string[]> {
  const bought = [];
  for (const v of EMOJI_VARIANTS) if (v.item && (await itemsBought(ctx, memberId, v.item)) > 0) bought.push(v.item);
  return ownedVariants(skills, bought);
}

/**
 * How the kudos emoji in a giver's messages count: the workspace's kudos emoji always; while the
 * game is on, also the Super kudos emoji (for everyone) and the giver's own variants. Everyone
 * else's variants are only emoji. One read of the giver's game state, however many texts it reads
 * (a message and its edit).
 */
export async function kudosEmojiReader(ctx: QueryCtx, workspace: Doc<"workspaces">, giverSlackId: string): Promise<(text: string) => KudosEmoji> {
  if (!gameOn(workspace)) return (text) => ({ amount: countEmoji(text, workspace.emojiName), variant: null, superEmoji: 0 });
  const giver = await findMember(ctx, workspace, giverSlackId);
  const owned = giver ? await variantsOf(ctx, giver._id, skillsOf(await playerOf(ctx, giver._id))) : [];
  return (text) => readKudosEmoji(text, workspace.emojiName, owned);
}

const emojiValidator = v.object({
  shortcode: v.string(),
  name: v.string(),
  source: v.union(v.literal("workspace"), v.literal("store"), v.literal("skill")),
  suffix: v.union(v.string(), v.null()),
});

/**
 * The viewer's cosmetics: what they own and wear, the kudos emoji they can give with (with the
 * Slack shortcode to type) and, with the Herald skill, their Super kudos this month. `today` is the
 * viewer's workspace day. Null while the game is off or hidden from them.
 */
export const mine = query({
  args: { today: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      look: lookValidator,
      owned: v.array(v.string()),
      emoji: v.array(emojiValidator),
      superKudos: v.union(
        v.null(),
        v.object({ shortcode: v.string(), perMonth: v.number(), used: v.number(), left: v.number(), spotlight: v.boolean() }),
      ),
    }),
  ),
  handler: async (ctx, { today }) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const skills = skillsOf(await playerOf(ctx, member._id));
    const owned = [];
    for (const c of COSMETICS) if ((await itemsBought(ctx, member._id, c.key)) > 0) owned.push(c.key);
    const variants = await variantsOf(ctx, member._id, skills);
    const perMonth = superKudosPerMonth(skills);
    const used = perMonth > 0 ? await superKudosUsed(ctx, member._id, parseToday(today).slice(0, 7)) : 0;
    return {
      look: member.look ?? {},
      owned,
      emoji: [
        { shortcode: `:${workspace.emojiName}:`, name: "Kudos emoji", source: "workspace" as const, suffix: null },
        ...EMOJI_VARIANTS.filter((ev) => variants.includes(ev.suffix)).map((ev) => ({
          shortcode: variantShortcode(workspace.emojiName, ev.suffix),
          name: ev.name,
          source: ev.source.kind,
          suffix: ev.suffix,
        })),
      ],
      superKudos:
        perMonth > 0
          ? { shortcode: variantShortcode(workspace.emojiName, SUPER_SUFFIX), perMonth, used, left: Math.max(0, perMonth - used), spotlight: hasSkill(skills, "spotlight") }
          : null,
    };
  },
});

/** Wears a cosmetic you own in its slot, or takes the slot's cosmetic off (`key: null`). */
export const wear = mutation({
  args: { slot: v.union(v.literal("frame"), v.literal("banner"), v.literal("sticker")), key: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { slot, key }) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameOn(workspace)) throw new ConvexError("The game isn't on in this workspace.");
    if (member.gameHidden) throw new ConvexError("You've hidden the game. Show it again on your Me page to wear cosmetics.");
    const look = { ...(member.look ?? {}) };
    if (key === null) {
      delete look[slot];
    } else {
      const cosmetic = cosmeticByKey(key);
      if (!cosmetic || (await itemsBought(ctx, member._id, cosmetic.key)) === 0) throw new ConvexError("You don't have that yet: it's in the Store.");
      if (cosmetic.slot !== slot) throw new ConvexError(`${cosmetic.name} isn't a ${slot}.`);
      look[slot] = cosmetic.key;
    }
    await ctx.db.patch(member._id, { look });
    return null;
  },
});

/**
 * A member's profile (§G12): their level, title and kudos given, and what they wear. Never ranked.
 * Level and cosmetics only while the game is on and neither they nor the viewer hide it.
 */
export const profile = query({
  args: { memberId: v.id("members") },
  returns: v.object({
    name: v.string(),
    avatarUrl: v.union(v.string(), v.null()),
    level: v.union(v.number(), v.null()),
    title: v.union(v.string(), v.null()),
    given: v.number(),
    look: lookValidator,
  }),
  handler: async (ctx, { memberId }) => {
    const { workspace, member: viewer } = await requireViewer(ctx);
    const member = await ctx.db.get(memberId);
    if (!member || member.workspaceId !== workspace._id || member.isBot) throw new ConvexError("Member not found.");
    const shown = gameShownTo(workspace, member) && !viewer.gameHidden;
    const player = shown ? await playerOf(ctx, member._id) : null;
    const progress = player ? levelProgress(player.xp, player.level) : null;
    return {
      name: member.name,
      avatarUrl: member.avatarUrl ?? null,
      level: progress?.level ?? null,
      title: progress?.title ?? null,
      given: member.totalGiven,
      look: shownLook(workspace, member, viewer),
    };
  },
});
