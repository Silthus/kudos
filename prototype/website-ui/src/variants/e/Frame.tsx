// Variant E frame, from B: a sticky game HUD bar with resources, the equipped hedgehog as avatar, and a Cmd/Ctrl-K command palette.
import { useCallback, useState } from "react";
import { HedgehogHeart } from "@posthog/brand/hoggies";
import { IconBook, IconLeave } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { me } from "../../data/mock";
import { ThemeButton, type LayoutProps } from "../../Layout";
import { useNav, type ScreenId } from "../../nav";
import { screens } from "../../screens";
import { CoinGlyph, HogAvatar, ResourceChip, SkillPointGlyph, levelProgress, useHud } from "./hud";
import { CommandPalette, paletteKey, usePaletteHotkey } from "./palette";

const bookScreens: ScreenId[] = ["stickers", "achievements"];

const navEntries = screens.filter((s) => s.inNav && s.id !== "achievements").map((s) => (s.id === "stickers" ? { ...s, label: "Book", Icon: IconBook } : s));

const isCurrent = (id: ScreenId, current: ScreenId) => id === current || (id === "stickers" && bookScreens.includes(current));

export function Frame({ current, dark, toggle, children }: LayoutProps) {
  useHud();
  const { go, setSignedIn } = useNav();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const togglePalette = useCallback(() => setPaletteOpen((o) => !o), []);
  usePaletteHotkey(togglePalette);
  const nav = navEntries;
  const progress = levelProgress(me.xp, me.xpThisLevelStart, me.xpNextLevel);

  return (
    <div className="hud-root flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/85 shadow-[0_1px_0_0_color-mix(in_oklab,var(--foreground)_4%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-6">
          <a href="#/profile" className="flex items-center gap-2.5">
            <HedgehogHeart size={34} title="HedgeHug" />
            <span className="flex flex-col leading-none">
              <span className="hud-display text-lg font-bold">HedgeHug</span>
              <span className="text-[10px] text-muted-foreground">Thanks a Hog</span>
            </span>
          </a>
          <nav className="mx-auto hidden items-center gap-0.5 lg:flex" aria-label="Screens">
            {nav.map(({ id, label, Icon }) => (
              <a
                key={id}
                href={`#/${id}`}
                aria-current={isCurrent(id, current) ? "page" : undefined}
                title={label}
                className={`relative flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors ${isCurrent(id, current) ? "text-foreground after:absolute after:inset-x-2 after:-bottom-[12px] after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
              >
                <Icon className="size-4" />
                <span className="sr-only xl:not-sr-only xl:whitespace-nowrap">{label}</span>
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <button
              type="button"
              onClick={togglePalette}
              title="Command palette"
              aria-label="Open the command palette"
              className="hidden h-8 items-center whitespace-nowrap rounded-full border border-dashed px-2.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground sm:inline-flex"
            >
              {paletteKey()}
            </button>
            <ResourceChip icon={<SkillPointGlyph />} title="Skill points to spend" href="#/skills">
              {me.skillPointsUnspent}
            </ResourceChip>
            <ResourceChip icon={<CoinGlyph />} title="Coins">
              {me.coins}
            </ResourceChip>
            <a href="#/profile" title={`${me.name}, level ${me.level}`} className="rounded-full">
              <HogAvatar level={me.level} progress={progress} size={36} />
            </a>
            <ThemeButton dark={dark} toggle={toggle} />
            <Button variant="outline" size="icon-sm" className="hidden md:inline-flex" onClick={() => setSignedIn(false)} aria-label="Sign out" title="Sign out">
              <IconLeave />
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label="Screens">
          {nav.map(({ id, label, Icon }) => (
            <a key={id} href={`#/${id}`} aria-current={isCurrent(id, current) ? "page" : undefined} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm ${isCurrent(id, current) ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}>
              <Icon className="size-3.5" />
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-6 md:pt-8">{children}</main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} shell={{ go, dark, toggleTheme: toggle, signOut: () => setSignedIn(false) }} />
    </div>
  );
}
