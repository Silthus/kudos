import { ArrowLeftRight, BarChart3, FlaskConical, Gem, Gift, Settings2, Target, Trophy, UserRound, type LucideIcon } from "lucide-react";

/**
 * The app's navigation, built once: the desktop sidebar and the mobile tab bar + More sheet
 * both render from it, so a page's condition, group and badge live in exactly one place.
 */

export type NavContext = {
  isAdmin: boolean;
  isDemo: boolean;
  storeEnabled: boolean;
  /** Weekly quests; undefined means on (workspaces installed before the switch). */
  questsEnabled?: boolean;
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

/** Which pages earn one of the four mobile tabs, most wanted first; the rest go to More. */
const TAB_PRIORITY = ["me", "leaderboard", "quests", "discoveries", "compare", "store", "analytics", "playground", "admin"];
export const TAB_COUNT = 4;

function item(id: string, path: string, label: string, short: string, icon: LucideIcon, group: NavGroupId, extra: Partial<NavItem> = {}): NavItem {
  return { id, to: path, path, label, short, icon, group, ...extra };
}

export function navItems(ctx: NavContext): NavItem[] {
  const requests = ctx.openRequests;
  return [
    item("me", "/me", "My kudos", "Me", UserRound, "personal"),
    item("discoveries", "/discoveries", "Discoveries", "Gallery", Gem, "personal"),
    ...(ctx.questsEnabled ?? true ? [item("quests", "/quests", "Quest log", "Quests", Target, "personal")] : []),
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

export function isActive(item: NavItem, pathname: string): boolean {
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

/**
 * The mobile split: four tabs by priority, the rest grouped in the More sheet. When the open
 * page lives in More it takes the last tab (the page it displaces moves into More), so the
 * current page is always on screen. More's badge counts whatever badges it hides.
 */
export function mobileNav(items: NavItem[], pathname: string): { tabs: NavItem[]; more: NavGroup[]; moreBadge?: NavBadge } {
  const rank = (i: NavItem) => TAB_PRIORITY.indexOf(i.id);
  const byPriority = [...items].sort((a, b) => rank(a) - rank(b));
  const tabs = byPriority.slice(0, TAB_COUNT);
  const active = byPriority.slice(TAB_COUNT).find((i) => isActive(i, pathname));
  if (active) tabs[TAB_COUNT - 1] = active;
  const more = items.filter((i) => !tabs.includes(i));
  const badges = more.flatMap((i) => (i.badge ? [i.badge] : []));
  const moreBadge = badges.length ? { count: badges.reduce((n, b) => n + b.count, 0), label: badges.map((b) => b.label).join(", ") } : undefined;
  return { tabs, more: navGroups(more), moreBadge };
}
