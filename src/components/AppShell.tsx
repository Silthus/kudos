import clsx from "clsx";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { motion } from "motion/react";
import { ArrowLeftRight, BarChart3, ChevronRight, FlaskConical, Gem, Gift, LogOut, Menu, Monitor, Moon, Settings2, Sun, Trophy, UserRound } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { api } from "../../convex/_generated/api";
import { useViewer } from "@/lib/viewer";
import { ErrorBoundary } from "./ErrorBoundary";
import { Avatar } from "./ui";
import { useTheme } from "@/lib/theme";
import { reducedMotion, setRoaming, useHedgehog, useHedgehogKonami } from "@/lib/hedgehog";

const HedgehogLayer = lazy(() => import("./HedgehogLayer"));

export function Logo({ glyph: _glyph = "" }: { glyph?: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-display text-[19px] font-black tracking-tight text-text">
      <KudosMark />
      kudos
    </span>
  );
}

/** Our own mark: a speech bubble with a raised star, drawn in brand orange. Not a hedgehog, not PostHog's logo. */
function KudosMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <path d="M4 3h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="var(--k-accent)" />
      <path d="M13 6.5l1.5 3.4 3.7.4-2.8 2.5.8 3.6-3.2-1.9-3.2 1.9.8-3.6-2.8-2.5 3.7-.4z" fill="var(--k-surface)" />
    </svg>
  );
}

/** Open store requests on the Admin item. */
function NavBadge({ count, className }: { count: number; className?: string }) {
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={clsx("grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-on-accent", className)}
      title={`${label} open store ${count === 1 ? "request" : "requests"}`}
    >
      {label}
      <span className="sr-only"> open store {count === 1 ? "request" : "requests"}</span>
    </span>
  );
}

type NavItem = { to: string; label: string; short: string; icon: typeof Gift; badge?: number; group: "You" | "Team" | "Workspace" };

export function AppShell() {
  const viewer = useViewer();
  const { signOut } = useAuthActions();
  const location = useLocation();
  const theme = useTheme();
  const hog = useHedgehog();
  useHedgehogKonami();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("theme");
    if (t === "light" || t === "dark" || t === "system") theme.setPref(t);
    const h = new URLSearchParams(location.search).get("hedgehog");
    if (h === "on" || h === "off") setRoaming(h === "on");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
  // Store requests waiting on an admin; capped server-side, so 100 reads as "99+".
  const openRequests = useQuery(api.storeAdmin.openCount, viewer.member.isAdmin ? {} : "skip") ?? 0;
  const nav: NavItem[] = [
    { to: "/me", label: "My kudos", short: "Me", icon: UserRound, group: "You" },
    { to: "/compare", label: "Compare", short: "Compare", icon: ArrowLeftRight, group: "You" },
    { to: "/leaderboard", label: "Leaderboard", short: "Ranks", icon: Trophy, group: "Team" },
    { to: "/discoveries", label: "Discoveries", short: "Gallery", icon: Gem, group: "Team" },
    ...(viewer.workspace.storeEnabled ? [{ to: "/store", label: "Store", short: "Store", icon: Gift, group: "Team" as const }] : []),
    { to: "/analytics", label: "Analytics", short: "Stats", icon: BarChart3, group: "Team" },
    ...(viewer.workspace.isDemo ? [{ to: "/playground", label: "Slack playground", short: "Try", icon: FlaskConical, group: "Workspace" as const }] : []),
    ...(viewer.member.isAdmin ? [{ to: openRequests ? "/admin?tab=store" : "/admin", label: "Admin", short: "Admin", icon: Settings2, badge: openRequests, group: "Workspace" as const }] : []),
  ];
  const current = nav.find((n) => location.pathname.startsWith(n.to.split("?")[0]));
  const showHog = (hog.roaming || hog.cameos.length > 0) && !reducedMotion();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-sidebar px-2 py-3 lg:flex">
        <div className="flex items-center justify-between px-2 py-1">
          <Logo />
          <span className="rounded-[var(--radius-lemon)] border border-border-bold px-1.5 py-px text-[10px] font-bold text-text-2" title="Kudos, PostHog edition">
            PostHog edition
          </span>
        </div>
        <button className="mt-3 flex items-center gap-2 rounded-[var(--radius-lemon)] px-2 py-1.5 text-left hover:bg-text/[0.06]">
          {viewer.workspace.iconUrl ? (
            <img src={viewer.workspace.iconUrl} alt="" className="h-6 w-6 rounded" />
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded bg-series-received text-xs font-bold text-white">{viewer.workspace.name[0]}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{viewer.workspace.name}</div>
            <div className="text-[11px] text-text-3">{viewer.workspace.isDemo ? "Demo workspace" : "Slack workspace"}</div>
          </div>
        </button>
        <nav className="mt-2 flex flex-col">
          {(["You", "Team", "Workspace"] as const).map((g) => {
            const items = nav.filter((n) => n.group === g);
            if (!items.length) return null;
            return (
              <div key={g} className="mt-3">
                <div className="px-2 pb-1 text-[11px] font-semibold text-text-3">{g}</div>
                {items.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    className={({ isActive }) =>
                      clsx(
                        "relative flex items-center gap-2 rounded-[var(--radius-lemon)] px-2 py-1.5 text-[13px] font-semibold",
                        isActive ? "bg-surface text-text shadow-[0_0_0_1px_var(--k-border-bold),0_2px_0_var(--k-border-bold)]" : "text-text-2 hover:bg-text/[0.06] hover:text-text",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <n.icon className={clsx("h-4 w-4", isActive ? "text-accent" : "text-text-3")} />
                        <span>{n.label}</span>
                        {!!n.badge && <NavBadge count={n.badge} className="ml-auto" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto space-y-1 border-t border-border pt-2">
          <div className="flex items-center gap-1 px-1">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => theme.setPref(t)}
                className={clsx("flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-lemon)] py-1 text-[11px] font-semibold", theme.pref === t ? "bg-surface text-text shadow-[0_0_0_1px_var(--k-border-bold)]" : "text-text-3 hover:text-text")}
                aria-pressed={theme.pref === t}
              >
                {t === "light" ? <Sun className="h-3 w-3" /> : t === "dark" ? <Moon className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center justify-between rounded-[var(--radius-lemon)] px-2 py-1 text-[12px] font-semibold text-text-2 hover:bg-text/[0.06]" title='Or type "hedgehog" anywhere'>
            Hedgehog mode
            <input type="checkbox" checked={hog.roaming} onChange={(e) => setRoaming(e.target.checked)} className="accent-[var(--k-accent)]" />
          </label>
          <div className="flex items-center gap-2 rounded-[var(--radius-lemon)] px-2 py-1.5">
            <Avatar name={viewer.member.name} src={viewer.member.avatarUrl} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{viewer.member.name}</div>
              <div className="truncate text-[11px] text-text-3">{viewer.member.isAdmin ? "Admin" : viewer.member.title ?? "Member"}</div>
            </div>
            <button onClick={() => void signOut()} className="rounded p-1.5 text-text-3 hover:bg-text/10 hover:text-text" title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-sidebar px-4 py-2 lg:hidden">
        <Logo />
        <button onClick={() => void signOut()} className="rounded p-2 text-text-3" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="min-w-0 pb-28 lg:pb-12">
        <div className="sticky top-0 z-20 hidden items-center gap-1.5 border-b border-border bg-bg/90 px-6 py-2 text-[13px] backdrop-blur lg:flex">
          <span className="font-semibold text-text-3">{viewer.workspace.name}</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-3" />
          <span className="font-semibold">{current?.label ?? "Kudos"}</span>
          {viewer.workspace.isDemo && (
            <span className="ml-auto text-[12px] text-text-2">
              Live demo with sample data.{" "}
              <NavLink to="/playground" className="font-semibold text-link hover:underline">
                Give kudos in the Slack playground
              </NavLink>
            </span>
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

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-sidebar px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 lg:hidden">
        {nav.slice(0, 4).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => clsx("flex flex-1 flex-col items-center gap-0.5 rounded-[var(--radius-lemon)] py-1 text-[10px] font-semibold", isActive ? "text-text" : "text-text-3")}
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <n.icon className={clsx("h-4 w-4", isActive && "text-accent")} />
                  {!!n.badge && <NavBadge count={n.badge} className="absolute -right-3 -top-1.5" />}
                </span>
                {n.short}
              </>
            )}
          </NavLink>
        ))}
        <button className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-semibold text-text-3">
          <Menu className="h-4 w-4" />
          More
        </button>
      </nav>
      {showHog && (
        <Suspense fallback={null}>
          <HedgehogLayer theme={theme.resolved} />
        </Suspense>
      )}
    </div>
  );
}
