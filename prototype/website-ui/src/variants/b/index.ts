import type { Variant } from "../types";
import { Frame } from "./Frame";
import { Leaderboard } from "./Leaderboard";
import { Profile } from "./Profile";
import { Skills } from "./Skills";

export const variant: Variant = { key: "B", name: "Character sheet", tagline: "A game HUD for your thanks", Layout: Frame, screens: { profile: Profile, skills: Skills, leaderboard: Leaderboard } };
