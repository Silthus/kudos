import { v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { emojiStackOf } from "../album/earnedEmojis";
import { workspaceDecisionWithoutWriting, type Flag } from "../analytics/flags";
import { hoggieSharePictureOf } from "../items/shareArt";
import type { Face } from "../website/faces";
import { siteOriginFor } from "../website/link";
import { crestPictureOf } from "../website/linkCardStats";
import { emojisOnTheCard, playerCardOf, type PlayerCard } from "../website/playerCard";
import type { DrawnCard, DrawnFace } from "./playerCard";

export const cardImageFlag = { key: "card-image", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export const cardImageShownIn = internalQuery({
  args: { workspace: v.string() },
  handler: (ctx, { workspace }): Promise<boolean> => workspaceDecisionWithoutWriting(ctx, cardImageFlag, workspace),
});

export const drawnCardOf = internalQuery({
  args: { workspace: v.string(), person: v.id("members") },
  handler: async (ctx, { workspace, person }): Promise<Omit<DrawnCard, "emojis"> | null> => {
    const origin = siteOriginFor(workspace);
    return origin === null ? null : drawnCardFrom(origin, await playerCardOf(ctx, workspace, person));
  },
});

export const drawnEmojisOf = internalQuery({
  args: { workspace: v.string(), person: v.id("members") },
  handler: async (ctx, { workspace, person }): Promise<DrawnCard["emojis"] | null> => {
    const origin = siteOriginFor(workspace);
    if (origin === null) return null;
    const { count, shown } = await emojiStackOf(ctx, workspace, person, emojisOnTheCard);
    return { count, pictures: shown.map(({ picture }) => absoluteOn(origin, picture)) };
  },
});

export const pictureAt = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }): Promise<string | null> => {
    const kept = await keptAt(ctx, key);
    return kept === null ? null : ctx.storage.getUrl(kept.picture);
  },
});

export const kept = internalMutation({
  args: { key: v.string(), picture: v.id("_storage") },
  handler: async (ctx, { key, picture }): Promise<string | null> => {
    const earlier = await keptAt(ctx, key);
    if (earlier !== null) {
      await ctx.storage.delete(picture);
      return ctx.storage.getUrl(earlier.picture);
    }
    await ctx.db.insert("cardPictures", { key, picture });
    return ctx.storage.getUrl(picture);
  },
});

function keptAt(ctx: QueryCtx, key: string) {
  return ctx.db
    .query("cardPictures")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
}

function drawnCardFrom(origin: string, card: PlayerCard): Omit<DrawnCard, "emojis"> {
  const { name, face, level, team, place, hoggies, people, medals } = card;
  return {
    name,
    face: drawnFaceOf(origin, face),
    level: level === null ? null : { level: level.level, xp: level.xp, share: levelShareOf(level) },
    team: team === null ? null : { name: team.name, crest: crestPictureOf(origin, team.art) },
    place,
    hoggies: hoggies === null ? null : { found: hoggies.found, total: hoggies.total, rarest: hoggies.rarest === null ? null : { name: hoggies.rarest.name, rarity: hoggies.rarest.rarity, picture: `${origin}${hoggieSharePictureOf(hoggies.rarest.hoggie)}`, foundAt: hoggies.rarest.firstAt } },
    people: { held: people.held, newest: people.newest.map((person) => drawnFaceOf(origin, person.face)) },
    medals: { count: medals.count, best: medals.best.map(({ tier }) => tier) },
  };
}

function drawnFaceOf(origin: string, face: Face): DrawnFace {
  return { picture: face.kind === "initials" ? null : absoluteOn(origin, face.image), initials: face.initials };
}

function levelShareOf({ xp, startsAt, nextAt }: PlayerCard["level"] & {}) {
  return nextAt <= startsAt ? 1 : Math.min(1, Math.max(0, (xp - startsAt) / (nextAt - startsAt)));
}

function absoluteOn(origin: string, picture: string) {
  return picture.startsWith("/") ? `${origin}${picture}` : picture;
}
