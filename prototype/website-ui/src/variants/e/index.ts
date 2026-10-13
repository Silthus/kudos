import type { Variant } from "../types";
import { Book } from "./Book";
import { Collection } from "./Collection";
import { Frame } from "./Frame";
import { Leaderboard } from "./Leaderboard";
import { Moments } from "./Moments";
import { Profile } from "./Profile";
import { Skills } from "./Skills";
import { gated } from "./unlock-gate";

const GatedBook = gated("book", Book);

export const variant: Variant = {
  key: "E",
  name: "Combined",
  tagline: "Round 8: open each unlock like a loot crate",
  Layout: Frame,
  screens: { profile: Profile, skills: gated("skills", Skills), stickers: GatedBook, achievements: GatedBook, leaderboard: Leaderboard, collection: gated("collection", Collection), landing: Moments },
};
