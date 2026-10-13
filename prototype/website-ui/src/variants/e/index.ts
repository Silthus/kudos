import type { Variant } from "../types";
import { Collection } from "./Collection";
import { Frame } from "./Frame";
import { Leaderboard } from "./Leaderboard";
import { Moments } from "./Moments";
import { Profile } from "./Profile";
import { Skills } from "./Skills";

export const variant: Variant = {
  key: "E",
  name: "Combined",
  tagline: "Round 4: the locked-in mix",
  Layout: Frame,
  screens: { profile: Profile, skills: Skills, leaderboard: Leaderboard, collection: Collection, landing: Moments },
};
