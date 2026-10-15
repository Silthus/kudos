import type { ComponentType } from "react";
import { IconGear, IconUser } from "@posthog/icons";
import { webPageOf, type WebPage } from "../features";
import type { Screen } from "../route";
import type { Feature, FeatureCard, MemberProfile } from "../shell";

type Icon = ComponentType<{ className?: string }>;

export type OpenEntry = { state: "open"; screen: Screen; href: string; name: string; Icon: Icon; feature?: Feature };

export type ReadyEntry = { state: "ready"; card: FeatureCard; name: string };

export type LockedEntry = { state: "locked"; feature: Feature; name: string; level: number; next: boolean };

export type NavEntry = OpenEntry | ReadyEntry | LockedEntry;

export const profileEntry: OpenEntry = { state: "open", screen: "home", href: "/", name: "Profile", Icon: IconUser };

export const settingsEntry: OpenEntry = { state: "open", screen: "settings", href: "/settings", name: "Settings", Icon: IconGear };

const fallbackLeaderboard = { feature: "leaderboard", name: "Leaderboard", state: "open" } as const;

export function navEntriesOf(member: Pick<MemberProfile, "features" | "leaderboard" | "settings">): NavEntry[] {
  return [profileEntry, ...featureEntriesOf(member), ...(member.settings ? [settingsEntry] : [])];
}

function featureEntriesOf({ features, leaderboard }: Pick<MemberProfile, "features" | "leaderboard">): NavEntry[] {
  if (features === null) return leaderboard.kind === "open" ? [openEntryOf(fallbackLeaderboard, webPageOf("leaderboard")!)] : [];
  const nextUnlock = features.find(({ feature, state }) => state === "locked" && webPageOf(feature) !== undefined);
  return features.flatMap((card) => featureEntryOf(card, card === nextUnlock));
}

function featureEntryOf(card: FeatureCard, next: boolean): NavEntry[] {
  const page = webPageOf(card.feature);
  if (page === undefined) return [];
  if (card.state === "open") return [openEntryOf(card, page)];
  if (card.state === "ready") return [{ state: "ready", card, name: card.name }];
  return [{ state: "locked", feature: card.feature, name: card.name, level: card.level, next }];
}

function openEntryOf({ feature, name }: Pick<FeatureCard, "feature" | "name">, { screen, href, Icon }: WebPage): OpenEntry {
  return { state: "open", screen, href, name, Icon, feature };
}
