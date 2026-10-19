import { catalogue as hoggieCatalogue } from "../hoggies/catalogue";
import { milestoneCatalogue } from "./milestoneCatalogue";

export const emojiLevels = [5, 10, 15, 20, 25] as const;

export const milestoneGoldNames = milestoneCatalogue.milestones.map(({ id, steps: [, , gold] }) => ({ milestone: id, gold: gold.name }));

export type EmojiArtKind = "team" | "milestone" | "level";

export const emojiArt = {
  team: hoggieCatalogue.crests.map(({ crest }) => crest),
  milestone: milestoneCatalogue.milestones.map(({ id }) => id),
  level: emojiLevels.map(String),
} as const satisfies Record<EmojiArtKind, readonly string[]>;

export const teamEmblemPicture = "/emoji/team.png";

export const hypeEmblemPicture = "/emoji/hype.png";

export function emojiArtPictureOf(kind: EmojiArtKind, catalogueId: string | number): string {
  return `/emoji/${kind}-${catalogueId}.png`;
}
