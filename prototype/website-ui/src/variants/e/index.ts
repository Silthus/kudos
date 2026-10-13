import type { Variant } from "../types";
import { Book } from "./Book";
import { Collection } from "./Collection";
import { Frame } from "./Frame";
import { Leaderboard } from "./Leaderboard";
import { Moments } from "./Moments";
import { Profile } from "./Profile";
import { Quests } from "./Quests";
import { Skills } from "./Skills";
import { gated } from "./unlock-gate";

const GatedBook = gated("book", Book);

export const variant: Variant = {
  key: "E",
  name: "Combined",
  tagline: "Round 9: only the core loop, with quests",
  Layout: Frame,
  screens: {
    profile: Profile,
    quests: gated("quests", Quests),
    leaderboard: gated("leaderboard", Leaderboard),
    stickers: GatedBook,
    achievements: GatedBook,
    skills: gated("skills", Skills),
    collection: gated("collection", Collection),
    landing: Moments,
  },
};
