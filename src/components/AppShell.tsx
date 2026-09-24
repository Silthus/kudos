import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { motion } from "motion/react";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useHashScroll } from "@/lib/hashScroll";
import { navItems } from "@/lib/nav";
import { useViewer } from "@/lib/viewer";
import { BoostBanner } from "./boosts";
import { ErrorBoundary } from "./ErrorBoundary";
import { MobileNav, SidebarNav } from "./Nav";
import { Avatar } from "./ui";

export function Logo({ glyph = "🌮" }: { glyph?: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-saffron/15 text-lg ring-1 ring-saffron/30">{glyph}</span>
      kudos
    </span>
  );
}

/** Picks which of the user's workspaces the app shows; nothing when they're in only one. */
function WorkspaceSwitcher({ className }: { className?: string }) {
  const { workspaces } = useViewer();
  const switchWorkspace = useMutation(api.session.switchWorkspace);
  if (workspaces.length < 2) return null;
  const current = workspaces.find((w) => w.current)!;
  return (
    <select
      aria-label="Switch workspace"
      className={className}
      value={current.memberId}
      onChange={(e) => void switchWorkspace({ memberId: e.target.value as Id<"members"> })}
    >
      {workspaces.map((w) => (
        <option key={w.memberId} value={w.memberId}>
          {w.name}
        </option>
      ))}
    </select>
  );
}

export function AppShell() {
  const viewer = useViewer();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  // Signed-out screens render at whatever URL is open; signing out on purpose goes home instead.
  const leave = () => void signOut().then(() => navigate("/", { replace: true }));
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  // After the scroll to the top: a `#section` link then scrolls on to its section.
  useHashScroll();
  // Store requests waiting on an admin; capped server-side, so 100 reads as "99+".
  const openRequests = useQuery(api.storeAdmin.openCount, viewer.member.isAdmin ? {} : "skip") ?? 0;
  const nav = navItems({
    isAdmin: viewer.member.isAdmin,
    isDemo: viewer.workspace.isDemo,
    storeEnabled: viewer.workspace.storeEnabled,
    // Off, /quests still answers (it says quests are off and keeps the log); it's just not advertised.
    questsEnabled: viewer.workspace.questsEnabled,
    gameShown: viewer.workspace.gameEnabled && !viewer.member.gameHidden,
    openRequests,
  });

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-ink/60 px-4 py-6 backdrop-blur lg:flex">
        <div className="px-2">
          <Logo glyph={viewer.workspace.emojiGlyph} />
        </div>
        <div className="relative mt-6 flex items-center gap-3 rounded-xl border border-line bg-panel/70 px-3 py-2.5 has-[select:focus-visible]:border-saffron/60">
          {viewer.workspace.iconUrl ? (
            <img src={viewer.workspace.iconUrl} alt="" className="h-8 w-8 rounded-lg" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/25 font-display text-sm font-bold text-teal-soft">
              {viewer.workspace.name[0]}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{viewer.workspace.name}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-faint">{viewer.workspace.isDemo ? "Demo workspace" : "Slack workspace"}</div>
          </div>
          <WorkspaceSwitcher className="absolute inset-0 cursor-pointer opacity-0" />
          {viewer.workspaces.length > 1 && <ChevronsUpDown className="h-4 w-4 shrink-0 text-faint" aria-hidden />}
        </div>
        <SidebarNav items={nav} />
        <div className="mt-auto flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={viewer.member.name} src={viewer.member.avatarUrl} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{viewer.member.name}</div>
            <div className="truncate text-xs text-faint">{viewer.member.isAdmin ? "Admin" : viewer.member.title ?? "Member"}</div>
          </div>
          <button onClick={leave} className="rounded-lg p-2 text-faint hover:bg-panel-2 hover:text-cream" title="Sign out" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink/80 px-4 py-3 backdrop-blur lg:hidden">
        <Logo glyph={viewer.workspace.emojiGlyph} />
        <WorkspaceSwitcher className="ml-auto mr-2 max-w-[45%] truncate rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-cream" />
        <button onClick={leave} className="rounded-lg p-2 text-faint" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-8 lg:px-10 lg:pb-12 lg:pt-10">
        {viewer.workspace.isDemo && (
          <p className="mx-auto mb-6 max-w-[1240px] rounded-xl border border-saffron/25 bg-saffron/[0.07] px-4 py-2.5 text-sm leading-relaxed text-cream/90">
            <span className="mr-2 font-mono text-[11px] uppercase tracking-widest text-saffron">Live demo</span>
            You're exploring <b className="font-semibold">Lumen Labs</b>, a sample workspace with this year's history. Try the{" "}
            <NavLink to="/playground" className="font-medium text-saffron underline-offset-4 hover:underline">
              Slack playground
            </NavLink>{" "}
            to give kudos.
          </p>
        )}
        <BoostBanner />
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

      <MobileNav items={nav} />
    </div>
  );
}
