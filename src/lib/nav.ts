import { ArrowLeftRight, BarChart3, FlaskConical, Gem, Gift, HandCoins, Network, Settings2, Sprout, Target, Trophy, UserRound, type LucideIcon } from "lucide-react";

/**
 * The app's navigation, built once: the world's places (`src/world/places.ts`) and the Places list
 * render from it, so a page's condition, group and badge live in exactly one place.
 */

export type NavContext = {
  isAdmin: boolean;
  isDemo: boolean;
  storeEnabled: boolean;
  /** Weekly quests; undefined means on (workspaces installed before the switch). */
  questsEnabled?: boolean;
  /** The game is on and the member hasn't hidden it: the skill tree has a page. */
  gameShown?: boolean;
  /** Store requests waiting on an admin. */
  openRequests: number;
};

export type NavGroupId = "personal" | "team" | "workspace";

export type NavItem = {
  id: string;
  /** Link target; may carry a query (Admin jumps to the store tab while requests wait). */
  to: string;
  /** The page's own path: an item is active on it and anything below it, whatever the query. */
  path: string;
  label: string;
  /** Tab-bar label, short enough for a quarter of a 320 px screen. */
  short: string;
  icon: LucideIcon;
  group: NavGroupId;
  badge?: NavBadge;
};

export type NavBadge = { count: number; label: string };

export type NavGroup = { id: NavGroupId; label: string; items: NavItem[] };

const GROUPS: { id: NavGroupId; label: string }[] = [
  { id: "personal", label: "You" },
  { id: "team", label: "Team" },
  { id: "workspace", label: "Workspace" },
];

function item(id: string, path: string, label: string, short: string, icon: LucideIcon, group: NavGroupId, extra: Partial<NavItem> = {}): NavItem {
  return { id, to: path, path, label, short, icon, group, ...extra };
}

export function navItems(ctx: NavContext): NavItem[] {
  const requests = ctx.openRequests;
  return [
    item("me", "/me", "My kudos", "Me", UserRound, "personal"),
    item("discoveries", "/discoveries", "Discoveries", "Gallery", Gem, "personal"),
    ...(ctx.questsEnabled ?? true ? [item("quests", "/quests", "Quest log", "Quests", Target, "personal")] : []),
    ...(ctx.gameShown
      ? [
          item("offering", "/offering", "Offering stone", "Stone", HandCoins, "personal"),
          item("skills", "/skills", "Skill tree", "Skills", Network, "personal"),
          item("garden", "/garden", "Garden", "Garden", Sprout, "personal"),
        ]
      : []),
    ...(ctx.storeEnabled ? [item("store", "/store", "Store", "Store", Gift, "personal")] : []),
    item("leaderboard", "/leaderboard", "Leaderboard", "Ranks", Trophy, "team"),
    item("compare", "/compare", "Compare", "Compare", ArrowLeftRight, "team"),
    item("analytics", "/analytics", "Analytics", "Stats", BarChart3, "team"),
    ...(ctx.isDemo ? [item("playground", "/playground", "Playground", "Try", FlaskConical, "workspace")] : []),
    ...(ctx.isAdmin
      ? [
          item("admin", "/admin", "Admin", "Admin", Settings2, "workspace", {
            to: requests ? "/admin?tab=store" : "/admin",
            badge: requests ? { count: requests, label: `${requests > 99 ? "99+" : requests} open store ${requests === 1 ? "request" : "requests"}` } : undefined,
          }),
        ]
      : []),
  ];
}

/** Items under their group headings, in group order; empty groups are dropped. */
export function navGroups(items: NavItem[]): NavGroup[] {
  return GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.group === g.id) })).filter((g) => g.items.length > 0);
}

/** Case-insensitive, like the router: /Admin renders Admin, so Admin is the active item. */
export function isActive(item: NavItem, pathname: string): boolean {
  const path = pathname.toLowerCase();
  return path === item.path || path.startsWith(`${item.path}/`);
}
