import type { Variant } from "../types";
import { TerminalFrame } from "./Frame";
import { TerminalLeaderboard } from "./Leaderboard";
import { TerminalProfile } from "./Profile";
import { TerminalSkills } from "./Skills";

export const variant: Variant = {
  key: "D",
  name: "Terminal",
  tagline: "HedgeHug for people who live in a shell",
  Layout: TerminalFrame,
  screens: { profile: TerminalProfile, skills: TerminalSkills, leaderboard: TerminalLeaderboard },
};
