import type { ComponentType } from "react";
import { IconBook, IconCheckbox, IconHome, IconListTree, IconPalette, IconRibbon, IconStar, IconUser } from "@posthog/icons";
import type { ScreenId } from "../nav";
import { Achievements } from "./Achievements";
import { Collection } from "./Collection";
import { Landing } from "./Landing";
import { Leaderboard } from "./Leaderboard";
import { Profile } from "./Profile";
import { Skills } from "./Skills";
import { Stickers } from "./Stickers";

function NoQuests() {
  return <p className="text-sm text-muted-foreground">Quests are only in variant E.</p>;
}

export type ScreenDef = { id: ScreenId; label: string; Icon: ComponentType<{ className?: string }>; Component: ComponentType<{ param?: string }>; inNav: boolean };

export const screens: ScreenDef[] = [
  { id: "profile", label: "Profile", Icon: IconUser, Component: Profile, inNav: true },
  { id: "quests", label: "Quests", Icon: IconCheckbox, Component: NoQuests, inNav: false },
  { id: "skills", label: "Skill tree", Icon: IconListTree, Component: Skills, inNav: true },
  { id: "stickers", label: "Sticker book", Icon: IconBook, Component: Stickers, inNav: true },
  { id: "achievements", label: "Achievements", Icon: IconRibbon, Component: Achievements, inNav: true },
  { id: "collection", label: "Collection", Icon: IconPalette, Component: Collection, inNav: true },
  { id: "leaderboard", label: "Leaderboard", Icon: IconStar, Component: Leaderboard, inNav: true },
  { id: "landing", label: "Welcome back", Icon: IconHome, Component: Landing, inNav: false },
];
