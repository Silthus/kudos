// Variant B: the PostHog app layout. A left sidebar, a breadcrumb bar, full-width content.
import { BrandMark, KudosLeft, ThemeToggle } from "../chrome";
import { me } from "../data/mock";
import { useNav } from "../nav";
import { screens } from "../screens";
import { Avatar, Progress } from "../ui";
import type { ShellProps } from "./types";

export function AppShell({ current, dark, toggle, children }: ShellProps) {
  const { setSignedIn } = useNav();
  const screen = screens.find((s) => s.id === current);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="border-b border-line px-4 py-3">
          <BrandMark />
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {screens.filter((s) => s.inNav).map((s) => (
            <a
              key={s.id}
              href={`#/${s.id}`}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold ${s.id === current ? "bg-surface-2 text-ink ring-1 ring-line-strong" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
            >
              <span className="text-base">{s.icon}</span>
              {s.label}
              {s.id === "skills" && me.skillPointsUnspent > 0 && <span className="ml-auto rounded-full bg-orange px-1.5 text-[11px] font-bold text-white">{me.skillPointsUnspent}</span>}
            </a>
          ))}
        </nav>
        <div className="mt-auto space-y-3 border-t border-line p-3">
          <div className="flex items-center gap-2">
            <Avatar initials={me.initials} hue={me.hue} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{me.name}</div>
              <div className="text-xs text-muted">Level {me.level} · {me.loadout.title}</div>
            </div>
          </div>
          <Progress value={me.xp - me.xpThisLevelStart} max={me.xpNextLevel - me.xpThisLevelStart} height={8} />
          <div className="flex items-center justify-between">
            <ThemeToggle dark={dark} toggle={toggle} />
            <button className="text-xs font-semibold text-muted hover:text-ink" onClick={() => setSignedIn(false)}>
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/90 px-6 py-2.5 backdrop-blur">
          <span className="text-sm text-muted">HedgeHug</span>
          <span className="text-faint">/</span>
          <span className="text-sm font-bold">{screen?.label}</span>
          <div className="ml-auto flex items-center gap-2">
            <KudosLeft />
            <span className="md:hidden">
              <ThemeToggle dark={dark} toggle={toggle} />
            </span>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden">
          {screens.filter((s) => s.inNav).map((s) => (
            <a key={s.id} href={`#/${s.id}`} className={`whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-semibold ${s.id === current ? "bg-surface-2" : "text-muted"}`}>
              {s.icon} {s.label}
            </a>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
