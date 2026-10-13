import type { Variant } from "../types";
import { DashboardFrame } from "./Frame";
import { DashboardLeaderboard } from "./Leaderboard";
import { DashboardProfile } from "./Profile";
import { DashboardSkills } from "./Skills";

export const variant: Variant = {
  key: "A",
  name: "Dashboard",
  tagline: "Your kudos as PostHog insights",
  Layout: DashboardFrame,
  screens: { profile: DashboardProfile, skills: DashboardSkills, leaderboard: DashboardLeaderboard },
};
