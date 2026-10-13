// Variant A: posthog.com's "desktop" metaphor. Screens open as a window on a desk with icons.
import { BrandMark, KudosLeft, ThemeToggle, UserChip } from "../chrome";
import { screens } from "../screens";
import { Hand, Hog } from "../ui";
import type { ShellProps } from "./types";

export function DesktopShell({ current, dark, toggle, children }: ShellProps) {
  const screen = screens.find((s) => s.id === current);
  return (
    <div className="min-h-screen bg-desk">
      <header className="sticky top-0 z-40 mx-2 mt-2 flex items-center gap-1 rounded-lg border border-line bg-surface/90 px-3 py-1.5 shadow-ph backdrop-blur">
        <BrandMark compact />
        <nav className="ml-2 hidden gap-0.5 lg:flex">
          {screens.filter((s) => s.inNav).map((s) => (
            <a key={s.id} href={`#/${s.id}`} className={`rounded px-2.5 py-1 text-sm font-semibold hover:bg-surface-2 ${s.id === current ? "bg-surface-2 text-orange" : ""}`}>
              {s.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <KudosLeft />
          <ThemeToggle dark={dark} toggle={toggle} />
          <UserChip />
        </div>
      </header>
      <div className="relative flex gap-4 px-2 pb-24 pt-4">
        <aside className="hidden w-24 shrink-0 flex-col items-center gap-4 pt-2 md:flex">
          {screens.filter((s) => s.inNav).map((s) => (
            <a key={s.id} href={`#/${s.id}`} className="group flex w-24 flex-col items-center gap-1 text-center">
              <span className={`flex size-12 items-center justify-center rounded-xl border-2 text-2xl transition group-hover:-translate-y-0.5 ${s.id === current ? "border-orange bg-surface shadow-ph" : "border-transparent bg-surface/60"}`}>
                {s.icon}
              </span>
              <span className={`rounded px-1 text-xs font-semibold ${s.id === current ? "bg-orange text-white" : "text-ink"}`}>{s.label}</span>
            </a>
          ))}
        </aside>
        <main className="relative z-10 mx-auto w-full max-w-6xl">
          <div className="overflow-hidden rounded-xl border border-line-strong bg-bg shadow-2xl">
            <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-3 rounded-full bg-coral" />
                <span className="size-3 rounded-full bg-yellow" />
                <span className="size-3 rounded-full bg-green" />
              </span>
              <span className="mx-auto font-display text-sm font-extrabold">
                {screen?.icon} {screen?.label}
              </span>
              <span className="w-12" />
            </div>
            <div className="p-4 md:p-6">{children}</div>
          </div>
        </main>
        <div className="pointer-events-none fixed bottom-6 right-6 hidden flex-col items-end xl:flex">
          <Hand className="mb-1 -rotate-6">hi, I'm Max (placeholder)</Hand>
          <Hog size={110} mood="happy" hat="glasses" />
        </div>
      </div>
    </div>
  );
}
