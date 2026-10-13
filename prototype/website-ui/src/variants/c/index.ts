import type { Variant } from "../types";
import { ZineFrame } from "./ZineFrame";
import { ZineLeaderboard } from "./ZineLeaderboard";
import { ZineProfile } from "./ZineProfile";
import { ZineSkills } from "./ZineSkills";

export const variant: Variant = {
  key: "C",
  name: "Zine",
  tagline: "An editorial magazine about your thanks",
  Layout: ZineFrame,
  screens: { profile: ZineProfile, skills: ZineSkills, leaderboard: ZineLeaderboard },
};
