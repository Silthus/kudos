import type { ComponentType } from "react";
import type { ScreenId } from "../nav";
import { Achievements } from "./Achievements";
import { Collection } from "./Collection";
import { Landing } from "./Landing";
import { Leaderboard } from "./Leaderboard";
import { Profile } from "./Profile";
import { Skills } from "./Skills";
import { Stickers } from "./Stickers";

export type ScreenDef = { id: ScreenId; label: string; icon: string; Component: ComponentType<{ param?: string }>; inNav: boolean };

export const screens: ScreenDef[] = [
  { id: "profile", label: "Profile", icon: "🦔", Component: Profile, inNav: true },
  { id: "skills", label: "Skill tree", icon: "🌱", Component: Skills, inNav: true },
  { id: "stickers", label: "Sticker book", icon: "📒", Component: Stickers, inNav: true },
  { id: "achievements", label: "Achievements", icon: "🏅", Component: Achievements, inNav: true },
  { id: "collection", label: "Collection", icon: "🎒", Component: Collection, inNav: true },
  { id: "leaderboard", label: "Leaderboard", icon: "🏆", Component: Leaderboard, inNav: true },
  { id: "landing", label: "Welcome back", icon: "🔗", Component: Landing, inNav: false },
];
