import type { Variant } from "../types";
import { Book } from "./Book";
import { Collection } from "./Collection";
import { Frame } from "./Frame";
import { Leaderboard } from "./Leaderboard";
import { Moments } from "./Moments";
import { Profile } from "./Profile";
import { Skills } from "./Skills";

export const variant: Variant = {
  key: "E",
  name: "Combined",
  tagline: "Round 5: three deep trees, one book, gear on the profile",
  Layout: Frame,
  screens: { profile: Profile, skills: Skills, stickers: Book, achievements: Book, leaderboard: Leaderboard, collection: Collection, landing: Moments },
};
