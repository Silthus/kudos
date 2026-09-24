import clsx from "clsx";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { motion } from "motion/react";
import { ArrowLeftRight, BarChart3, ChevronRight, FlaskConical, Gem, Gift, LogOut, Monitor, Moon, Settings2, Sun, Trophy, UserRound, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { api } from "../../convex/_generated/api";
import { useViewer } from "@/lib/viewer";
import { THEME_PREFS, useTheme, type ThemePref } from "@/lib/theme";
import { ErrorBoundary } from "./ErrorBoundary";
import { Logo } from "./KudosMark";
import { Avatar } from "./ui";

/** Open store requests on the Admin item. */
function NavBadge({ count, className }: { count: number; className?: string }) {
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={clsx("grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-on-fill tabular", className)}
      title={`${label} open store ${count === 1 ? "request" : "requests"}`}
    >
      {label}
      <span className="sr-only"> open store {count === 1 ? "request" : "requests"}</span>
    </span>
  );
}

/** The sidebar groups, in order. The mobile bar (#41) reuses the same model. */
const NAV_GROUPS = ["You", "Team", "Workspace"] as const;
type NavItem = { to: string; label: string; short: string; icon: LucideIcon; group: (typeof NAV_GROUPS)[number]; badge?: number };

const THEME_ICON: Record<ThemePref, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABEL: Record<ThemePref, string> = { light: "Light", dark: "Dark", system: "System" };

/** Light / Dark / System, as a small segmented control. */
function ThemeSwitch() {
  const { pref, setPref } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="flex gap-0.5 rounded-lemon border border-border bg-bg p-0.5">
      {THEME_PREFS.map((p) => {
        const Icon = THEME_ICON[p];
        return (
          <button
            key={p}
            role="radio"
            aria-checked={pref === p}
            onClick={() => setPref(p)}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1 rounded-[5px] py-1 text-[11px] font-semibold",
              pref === p ? "bg-surface text-text shadow-[0_0_0_1px_var(--k-border-bold)]" : "text-text-3 hover:text-text",
            )}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {THEME_LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}

/** On phones there's no sidebar (yet, #41): one button steps Light → Dark → System. */
function ThemeCycleButton() {
  const { pref, setPref } = useTheme();
  const next = THEME_PREFS[(THEME_PREFS.indexOf(pref) + 1) % THEME_PREFS.length];
  const Icon = THEME_ICON[pref];
  return (
    <button onClick={() => setPref(next)} className="rounded-lemon p-2 text-text-3 hover:text-text" aria-label={`Theme: ${THEME_LABEL[pref]}. Switch to ${THEME_LABEL[next]}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-2 rounded-lemon px-2 py-1.5 text-[13px] font-semibold",
          isActive ? "bg-surface text-text shadow-[0_0_0_1px_var(--k-border-bold),0_2px_0_var(--k-border-bold)]" : "text-text-2 hover:bg-text/[0.06] hover:text-text",
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon className={clsx("h-4 w-4", isActive ? "text-accent" : "text-text-3")} aria-hidden />
          <span>{item.label}</span>
          {!!item.badge && <NavBadge count={item.badge} className="ml-auto" />}
        </>
      )}
    </NavLink>
  );
}

export function AppShell() {
  const viewer = useViewer();
  const { signOut } = useAuthActions();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  // Store requests waiting on an admin; capped server-side, so 100 reads as "99+".
  const openRequests = useQuery(api.storeAdmin.openCount, viewer.member.isAdmin ? {} : "skip") ?? 0;
  const nav: NavItem[] = [
    { to: "/me", label: "My kudos", short: "Me", icon: UserRound, group: "You" },
    { to: "/compare", label: "Compare", short: "Compare", icon: ArrowLeftRight, group: "You" },
    { to: "/leaderboard", label: "Leaderboard", short: "Ranks", icon: Trophy, group: "Team" },
    { to: "/discoveries", label: "Discoveries", short: "Gallery", icon: Gem, group: "Team" },
    ...(viewer.workspace.storeEnabled ? [{ to: "/store", label: "Store", short: "Store", icon: Gift, group: "Team" } as const] : []),
    { to: "/analytics", label: "Analytics", short: "Stats", icon: BarChart3, group: "Team" },
    ...(viewer.workspace.isDemo ? [{ to: "/playground", label: "Slack playground", short: "Try", icon: FlaskConical, group: "Workspace" } as const] : []),
    ...(viewer.member.isAdmin
      ? [{ to: openRequests ? "/admin?tab=store" : "/admin", label: "Admin", short: "Admin", icon: Settings2, group: "Workspace", badge: openRequests } as const]
      : []),
  ];
  const current = nav.find((n) => location.pathname === n.to.split("?")[0]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-border bg-sidebar px-2 py-3 lg:flex">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <Logo />
          <span className="rounded-lemon border border-border-bold px-1.5 py-px text-[10px] font-bold whitespace-nowrap text-text-2">PostHog edition</span>
        </div>
        <div className="mt-3 flex items-center gap-2 px-2 py-1.5">
          {viewer.workspace.iconUrl ? (
            <img src={viewer.workspace.iconUrl} alt="" className="h-6 w-6 rounded" />
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded bg-accent text-xs font-bold text-on-fill" aria-hidden>
              {viewer.workspace.name[0]}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{viewer.workspace.name}</div>
            <div className="text-[11px] text-text-3">{viewer.workspace.isDemo ? "Demo workspace" : "Slack workspace"}</div>
          </div>
        </div>
        <nav className="mt-1 flex flex-col" aria-label="Main">
          {NAV_GROUPS.map((group) => {
            const items = nav.filter((n) => n.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="mt-3 flex flex-col gap-0.5">
                <div className="px-2 pb-1 text-[11px] font-semibold text-text-3">{group}</div>
                {items.map((n) => (
                  <SidebarLink key={n.to} item={n} />
                ))}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 border-t border-border px-1 pt-3">
          <ThemeSwitch />
          <div className="flex items-center gap-2 px-1 py-1">
            <Avatar name={viewer.member.name} src={viewer.member.avatarUrl} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{viewer.member.name}</div>
              <div className="truncate text-[11px] text-text-3">{viewer.member.isAdmin ? "Admin" : (viewer.member.title ?? "Member")}</div>
            </div>
            <button onClick={() => void signOut()} className="rounded-lemon p-1.5 text-text-3 hover:bg-text/10 hover:text-text" title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-sidebar px-4 py-2 lg:hidden">
        <Logo />
        <div className="flex items-center">
          <ThemeCycleButton />
          <button onClick={() => void signOut()} className="rounded-lemon p-2 text-text-3 hover:text-text" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="min-w-0 pb-28 lg:pb-12">
        <div className="z-20 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-b border-border bg-bg px-4 py-2 text-[13px] sm:px-6 lg:sticky lg:top-0">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold text-text-3">{viewer.workspace.name}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-3" aria-hidden />
            <span className="truncate font-semibold text-text" aria-current="page">
              {current?.label ?? "Kudos"}
            </span>
          </nav>
          {viewer.workspace.isDemo && (
            <p className="text-[12px] text-text-2 sm:ml-auto">
              Live demo with this year's sample history.{" "}
              <NavLink to="/playground" className="font-semibold text-link hover:underline">
                Give kudos in the Slack playground
              </NavLink>
            </p>
          )}
        </div>
        {/* Enter-only transition: an exit phase around <Outlet /> can leave the page stuck invisible. */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="mx-auto max-w-[1240px] px-4 pt-5 sm:px-6"
        >
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </motion.div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-sidebar px-1 pt-1.5 pb-[max(env(safe-area-inset-bottom),6px)] lg:hidden"
      >
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => clsx("flex flex-1 flex-col items-center gap-0.5 rounded-lemon py-1 text-[10px] font-semibold", isActive ? "text-text" : "text-text-3")}
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <n.icon className={clsx("h-4 w-4", isActive && "text-accent")} aria-hidden />
                  {!!n.badge && <NavBadge count={n.badge} className="absolute -top-1.5 -right-3" />}
                </span>
                {n.short}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
