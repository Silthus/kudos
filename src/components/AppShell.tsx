import clsx from "clsx";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { motion } from "motion/react";
import { BarChart3, FlaskConical, Gem, Gift, LogOut, Settings2, Trophy, UserRound } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { api } from "../../convex/_generated/api";
import { useViewer } from "@/lib/viewer";
import { ErrorBoundary } from "./ErrorBoundary";
import { Avatar } from "./ui";

export function Logo({ glyph = "🌮" }: { glyph?: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-saffron/15 text-lg ring-1 ring-saffron/30">{glyph}</span>
      kudos
    </span>
  );
}

/** Open store requests on the Admin item. */
function NavBadge({ count, className }: { count: number; className?: string }) {
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={clsx("grid h-[18px] min-w-[18px] place-items-center rounded-full bg-saffron px-1 font-mono text-[10px] font-semibold leading-none text-ink", className)}
      title={`${label} open store ${count === 1 ? "request" : "requests"}`}
    >
      {label}
      <span className="sr-only"> open store {count === 1 ? "request" : "requests"}</span>
    </span>
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
  const nav: { to: string; label: string; short: string; icon: typeof Gift; badge?: number }[] = [
    { to: "/me", label: "My kudos", short: "Me", icon: UserRound },
    { to: "/leaderboard", label: "Leaderboard", short: "Ranks", icon: Trophy },
    { to: "/discoveries", label: "Discoveries", short: "Gallery", icon: Gem },
    ...(viewer.workspace.storeEnabled ? [{ to: "/store", label: "Store", short: "Store", icon: Gift }] : []),
    { to: "/analytics", label: "Analytics", short: "Stats", icon: BarChart3 },
    ...(viewer.workspace.isDemo ? [{ to: "/playground", label: "Playground", short: "Try", icon: FlaskConical }] : []),
    ...(viewer.member.isAdmin ? [{ to: openRequests ? "/admin?tab=store" : "/admin", label: "Admin", short: "Admin", icon: Settings2, badge: openRequests }] : []),
  ];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-ink/60 px-4 py-6 backdrop-blur lg:flex">
        <div className="px-2">
          <Logo glyph={viewer.workspace.emojiGlyph} />
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-panel/70 px-3 py-2.5">
          {viewer.workspace.iconUrl ? (
            <img src={viewer.workspace.iconUrl} alt="" className="h-8 w-8 rounded-lg" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/25 font-display text-sm font-bold text-teal-soft">
              {viewer.workspace.name[0]}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{viewer.workspace.name}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-faint">{viewer.workspace.isDemo ? "Demo workspace" : "Slack workspace"}</div>
          </div>
        </div>
        <nav className="mt-6 flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                clsx(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "text-cream" : "text-muted hover:bg-panel/70 hover:text-cream",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl border border-line-strong bg-panel-2" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />
                  )}
                  <n.icon className={clsx("relative h-4 w-4", isActive && "text-saffron")} />
                  <span className="relative">{n.label}</span>
                  {!!n.badge && <NavBadge count={n.badge} className="relative ml-auto" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={viewer.member.name} src={viewer.member.avatarUrl} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{viewer.member.name}</div>
            <div className="truncate text-xs text-faint">{viewer.member.isAdmin ? "Admin" : viewer.member.title ?? "Member"}</div>
          </div>
          <button onClick={() => void signOut()} className="rounded-lg p-2 text-faint hover:bg-panel-2 hover:text-cream" title="Sign out" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink/80 px-4 py-3 backdrop-blur lg:hidden">
        <Logo glyph={viewer.workspace.emojiGlyph} />
        <button onClick={() => void signOut()} className="rounded-lg p-2 text-faint" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-8 lg:px-10 lg:pb-12 lg:pt-10">
        {viewer.workspace.isDemo && (
          <p className="mx-auto mb-6 max-w-[1240px] rounded-xl border border-saffron/25 bg-saffron/[0.07] px-4 py-2.5 text-sm leading-relaxed text-cream/90">
            <span className="mr-2 font-mono text-[11px] uppercase tracking-widest text-saffron">Live demo</span>
            You're exploring <b className="font-semibold">Lumen Labs</b>, a sample workspace with ~4 months of history. Try the{" "}
            <NavLink to="/playground" className="font-medium text-saffron underline-offset-4 hover:underline">
              Slack playground
            </NavLink>{" "}
            to give kudos.
          </p>
        )}
        {/* Enter-only transition: an exit phase around <Outlet /> can leave the page stuck invisible. */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="mx-auto max-w-[1240px]"
        >
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </motion.div>
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl border border-line-strong bg-panel/90 p-1.5 backdrop-blur-xl lg:hidden">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              clsx("flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium", isActive ? "bg-panel-3 text-saffron" : "text-faint")
            }
          >
            <span className="relative">
              <n.icon className="h-4 w-4" />
              {!!n.badge && <NavBadge count={n.badge} className="absolute -right-3 -top-1.5" />}
            </span>
            {n.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
