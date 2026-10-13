// Variant C: one long page. Every screen is a chapter of a notebook; the tabs scroll to it.
// A deep link shows its landing card on top, then the rest of the notebook follows.
import { useEffect } from "react";
import { BrandMark, KudosLeft, ThemeToggle, UserChip } from "../chrome";
import { screens } from "../screens";
import { Hand, Squiggle } from "../ui";
import type { ShellProps } from "./types";

export function NotebookShell({ current, dark, toggle, children }: ShellProps) {
  useEffect(() => {
    if (current === "landing") return scrollTo({ top: 0 });
    document.getElementById(`chapter-${current}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [current]);
  const chapters = screens.filter((s) => s.inNav);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
          <BrandMark />
          <div className="ml-auto flex items-center gap-2">
            <KudosLeft />
            <ThemeToggle dark={dark} toggle={toggle} />
            <UserChip />
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
          {chapters.map((s, i) => (
            <a
              key={s.id}
              href={`#/${s.id}`}
              className={`-mb-px whitespace-nowrap rounded-t-lg border border-b-0 px-3 py-1.5 text-sm font-bold ${s.id === current ? "border-line-strong bg-surface" : "border-transparent text-muted hover:text-ink"}`}
            >
              <span className="mr-1 font-hand text-lg text-orange">{i + 1}.</span>
              {s.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-32 pt-6">
        {current === "landing" && <div className="mb-10">{children}</div>}
        {chapters.map((s, i) => (
          <section key={s.id} id={`chapter-${s.id}`} className="scroll-mt-28 border-t-2 border-dashed border-line py-10 first:border-t-0 first:pt-2">
            <div className="mb-5 flex items-end gap-3">
              <span className="font-hand text-5xl leading-none text-orange">{i + 1}</span>
              <div>
                <h2 className="font-display text-3xl font-black tracking-tight">
                  {s.icon} {s.label}
                </h2>
                <Squiggle width={160} />
              </div>
              {i === 0 && <Hand className="ml-auto hidden -rotate-3 md:block">scroll down, it's all one page ↓</Hand>}
            </div>
            <s.Component />
          </section>
        ))}
      </main>
    </div>
  );
}
