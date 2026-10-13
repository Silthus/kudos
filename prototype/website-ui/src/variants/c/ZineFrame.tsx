// The Zine frame: a slim masthead with the issue line and a numbered horizontal section nav.
import { ThemeButton, type LayoutProps } from "../../Layout";
import { me } from "../../data/mock";
import { useNav } from "../../nav";
import { screens } from "../../screens";
import { Display, pad2 } from "./zine";

const issueDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

export function ZineFrame({ current, dark, toggle, children }: LayoutProps) {
  const { setSignedIn } = useNav();
  const nav = screens.filter((s) => s.inNav);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2 border-foreground">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
          <a href="#/profile" className="flex items-baseline gap-3">
            <Display as="span" className="text-2xl md:text-3xl">
              HedgeHug
            </Display>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Thanks a Hog</span>
          </a>
          <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
            {issueDate} · Vol. {me.level} · {me.name}'s edition
          </span>
          <button onClick={() => setSignedIn(false)} className="ml-auto text-xs text-muted-foreground hover:text-foreground md:ml-0">
            Sign out
          </button>
          <ThemeButton dark={dark} toggle={toggle} />
        </div>
        <nav className="mx-auto flex w-full max-w-6xl gap-5 overflow-x-auto border-t border-foreground/20 px-4 md:gap-7 md:px-8" aria-label="Sections">
          {nav.map(({ id, label }, i) => (
            <a
              key={id}
              href={`#/${id}`}
              aria-current={id === current ? "page" : undefined}
              className={`flex shrink-0 items-baseline gap-1.5 border-b-[3px] py-2.5 text-sm ${id === current ? "border-foreground font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <span className="text-[10px] tabular-nums tracking-wider">{pad2(i + 1)}</span>
              {label}
              {id === "skills" && me.skillPointsUnspent > 0 && <span className="rounded-full bg-foreground px-1.5 text-[10px] font-bold leading-4 text-background">{me.skillPointsUnspent}</span>}
            </a>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pt-8">{children}</main>
      <footer className="border-t border-foreground/20">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline justify-between gap-2 px-4 py-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground md:px-8">
          <span>HedgeHug · Thanks a Hog</span>
          <span>Set in RoundHog · Printed for {me.name} only</span>
        </div>
      </footer>
    </div>
  );
}
