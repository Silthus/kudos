import { v, type Infer } from "convex/values";
import { teamArtValidator } from "../album/records";

export const sharedRarityValidator = v.union(v.literal("legendary"), v.literal("epic"));

export const winValidator = v.union(
  v.object({ kind: v.literal("hoggie"), hoggie: v.string(), name: v.string(), rarity: sharedRarityValidator }),
  v.object({ kind: v.literal("teamPage"), team: v.string(), name: v.string(), art: teamArtValidator }),
);

export const itemShareValidator = v.object({ workspace: v.string(), member: v.id("members"), item: v.id("items"), win: winValidator, wonAt: v.number(), sharedAt: v.optional(v.number()) });

export type Win = Infer<typeof winValidator>;
