// PROTOTYPE layout in the PostHog app's shape: a quiet left navigation, a top bar, one content column.
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "@posthog/quill";
import { IconMoon, IconSun } from "./icons";
import { me } from "./data/mock";
import { useNav, type ScreenId } from "./nav";
import { screens } from "./screens";
import { Initials } from "./ui";

export function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(() => localStorage.getItem("kudos-theme") === "dark" || (localStorage.getItem("kudos-theme") === null && matchMedia("(prefers-color-scheme: dark)").matches));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("kudos-theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, () => setDark((d) => !d)];
}

export function ThemeButton({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return (
    <Button variant="outline" size="icon-sm" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
      {dark ? <IconSun /> : <IconMoon />}
    </Button>
  );
}

export function Wordmark() {
  return (
    <a href="#/profile" className="flex flex-col leading-tight">
      <span className="text-[15px] font-bold tracking-tight">HedgeHug</span>
      <span className="text-[11px] text-muted-foreground">Thanks a Hog</span>
    </a>
  );
}

export function Layout({ current, dark, toggle, children }: { current: ScreenId; dark: boolean; toggle: () => void; children: ReactNode }) {
  const { setSignedIn } = useNav();
  const nav = screens.filter((s) => s.inNav);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-12 items-center border-b px-4">
          <Wordmark />
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {nav.map(({ id, label, Icon }) => (
            <a
              key={id}
              href={`#/${id}`}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${id === current ? "bg-fill-selected font-medium text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
            >
              <Icon className="size-4" />
              {label}
              {id === "skills" && me.skillPointsUnspent > 0 && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{me.skillPointsUnspent}</span>}
            </a>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t p-3">
          <Initials name={me.name} size={28} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{me.name}</div>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSignedIn(false)}>
              Sign out
            </button>
          </div>
          <ThemeButton dark={dark} toggle={toggle} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-3 border-b px-4 md:hidden">
          <Wordmark />
          <div className="ml-auto">
            <ThemeButton dark={dark} toggle={toggle} />
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b px-2 py-1.5 md:hidden">
          {nav.map(({ id, label }) => (
            <a key={id} href={`#/${id}`} className={`whitespace-nowrap rounded-md px-2.5 py-1 text-sm ${id === current ? "bg-fill-selected font-medium" : "text-muted-foreground"}`}>
              {label}
            </a>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 md:px-8 md:pt-8">{children}</main>
      </div>
    </div>
  );
}
