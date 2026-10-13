// PROTOTYPE frame in the PostHog app's shape: project top bar with a Cmd-K search, product sidebar, one content column.
import { IconSearch } from "@posthog/icons";
import { Button, Kbd, KbdGroup } from "@posthog/quill";
import { ThemeButton, type LayoutProps } from "../../Layout";
import { me } from "../../data/mock";
import { useNav } from "../../nav";
import { screens } from "../../screens";
import { HedgehogChart } from "@posthog/brand/hoggies";
import { Initials } from "../../ui";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function DashboardFrame({ current, dark, toggle, children }: LayoutProps) {
  const { setSignedIn } = useNav();
  const nav = screens.filter((s) => s.inNav);
  const label = nav.find((s) => s.id === current)?.label ?? "Overview";
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex h-11 items-center gap-2 border-b bg-chrome px-3">
        <a href="#/profile" className="flex items-center gap-2">
          <HedgehogChart size={26} />
          <span className="hidden text-sm font-bold tracking-tight sm:inline">HedgeHug</span>
        </a>
        <nav className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex" aria-label="Breadcrumb">
          <span>/</span>
          <span>{me.primaryGroup.name}</span>
          <span>/</span>
          <span className="font-medium text-foreground">{label}</span>
        </nav>
        <button type="button" className="ml-auto flex h-8 w-full max-w-xs items-center gap-2 rounded-md border bg-background px-2.5 text-left text-xs text-muted-foreground hover:bg-fill-hover" onClick={() => alert("Prototype: search and Max are stubs.")}>
          <IconSearch className="size-3.5" />
          <span className="flex-1 truncate">Search or ask Max…</span>
          <KbdGroup className="hidden sm:flex">
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </button>
        <ThemeButton dark={dark} toggle={toggle} />
        <Initials name={me.name} size={26} />
      </header>
      <div className="flex flex-1">
        <aside className="sticky top-11 hidden h-[calc(100vh-2.75rem)] w-52 shrink-0 flex-col border-r bg-card md:flex">
          <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Thanks a Hog</div>
          <nav className="flex flex-col gap-0.5 px-2">
            {nav.map(({ id, label, Icon }) => (
              <a key={id} href={`#/${id}`} className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${id === current ? "bg-fill-selected font-medium" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}>
                <Icon className="size-4" />
                {label}
                {id === "skills" && me.skillPointsUnspent > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular-nums">{me.skillPointsUnspent}</span>}
              </a>
            ))}
          </nav>
          <div className="mt-auto border-t p-3 text-xs text-muted-foreground">
            <div className="truncate font-medium text-foreground">{me.name}</div>
            <div className="truncate">{me.loadout.title}</div>
            <Button variant="link-muted" size="xs" className="mt-1 px-0" onClick={() => setSignedIn(false)}>
              Sign out
            </Button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <nav className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-1.5 md:hidden">
            {nav.map(({ id, label }) => (
              <a key={id} href={`#/${id}`} className={`whitespace-nowrap rounded-md px-2.5 py-1 text-sm ${id === current ? "bg-fill-selected font-medium" : "text-muted-foreground"}`}>
                {label}
              </a>
            ))}
          </nav>
          <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-20 pt-4 sm:px-5 md:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
