// Variant E frame, from B: a sticky game HUD bar whose screens and resource chips appear as the previewed level unlocks them, the equipped hedgehog as avatar, a Cmd/Ctrl-K palette and a prototype level scrubber.
import { useCallback, useState, type ComponentType } from "react";
import { HedgehogHeart } from "@posthog/brand/hoggies";
import { IconBook, IconLeave, IconLock } from "@posthog/icons";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@posthog/quill";
import { me } from "../../data/mock";
import { ThemeButton, type LayoutProps } from "../../Layout";
import { useNav, type ScreenId } from "../../nav";
import { screens } from "../../screens";
import { CoinGlyph, HogAvatar, ResourceChip, SkillPointGlyph, levelProgress, useHud } from "./hud";
import { CommandPalette, paletteKey, usePaletteHotkey } from "./palette";
import { nextUnlock, screenFeature } from "./unlock-features";
import { PreviewLevelBar } from "./unlock-preview";
import { unlockOf, unlockedAt, usePreviewLevel, type Feature } from "./unlocks";

const bookScreens: ScreenId[] = ["stickers", "achievements"];

type NavEntry = { id: ScreenId; label: string; Icon: ComponentType<{ className?: string }>; feature?: Feature };

const navEntries: NavEntry[] = screens
  .filter((s) => s.inNav && s.id !== "achievements")
  .map((s) => ({ ...(s.id === "stickers" ? { ...s, label: "Book", Icon: IconBook } : s), feature: screenFeature[s.id] }));

const navFeatures = navEntries.flatMap((e) => (e.feature ? [e.feature] : []));

const isCurrent = (id: ScreenId, current: ScreenId) => id === current || (id === "stickers" && bookScreens.includes(current));

type NavState = { entry: NavEntry; current: boolean; locked: boolean; next: boolean };

export function Frame({ current, dark, toggle, children }: LayoutProps) {
  useHud();
  const { go, setSignedIn } = useNav();
  const level = usePreviewLevel();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const togglePalette = useCallback(() => setPaletteOpen((o) => !o), []);
  usePaletteHotkey(togglePalette);
  const progress = levelProgress(me.xp, me.xpThisLevelStart, me.xpNextLevel);
  const upcoming = nextUnlock(level, navFeatures)?.feature;
  const nav: NavState[] = navEntries.map((entry) => ({
    entry,
    current: isCurrent(entry.id, current),
    locked: entry.feature !== undefined && !unlockedAt(entry.feature, level),
    next: entry.feature !== undefined && entry.feature === upcoming,
  }));

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
            {nav.map((item) => (item.locked ? <LockedDesktopItem key={item.entry.id} {...item} /> : <DesktopItem key={item.entry.id} {...item} />))}
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
            {unlockedAt("skills", level) && (
              <ResourceChip icon={<SkillPointGlyph />} title="Skill points to spend" href="#/skills">
                {me.skillPointsUnspent}
              </ResourceChip>
            )}
            {unlockedAt("coins", level) && (
              <ResourceChip icon={<CoinGlyph />} title={`${me.coins} coins. ${unlockOf("coins").how}`}>
                {me.coins}
              </ResourceChip>
            )}
            <a href="#/profile" title={`${me.name}, level ${level}`} className="rounded-full">
              <HogAvatar level={level} progress={progress} size={36} />
            </a>
            <ThemeButton dark={dark} toggle={toggle} />
            <Button variant="outline" size="icon-sm" className="hidden md:inline-flex" onClick={() => setSignedIn(false)} aria-label="Sign out" title="Sign out">
              <IconLeave />
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label="Screens">
          {nav.map((item) => (item.locked ? <LockedMobileItem key={item.entry.id} {...item} /> : <MobileItem key={item.entry.id} {...item} />))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-6 md:px-6 md:pt-8">{children}</main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} shell={{ go, dark, toggleTheme: toggle, signOut: () => setSignedIn(false) }} />
      <PreviewLevelBar />
    </div>
  );
}

function DesktopItem({ entry: { id, label, Icon }, current }: NavState) {
  return (
    <a
      href={`#/${id}`}
      aria-current={current ? "page" : undefined}
      title={label}
      className={`relative flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors ${current ? "text-foreground after:absolute after:inset-x-2 after:-bottom-[12px] after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
    >
      <Icon className="size-4" />
      <span className="sr-only xl:not-sr-only xl:whitespace-nowrap">{label}</span>
    </a>
  );
}

function LockedDesktopItem({ entry: { label, feature }, next }: NavState) {
  const unlock = unlockOf(feature!);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="link"
            tabIndex={0}
            aria-disabled="true"
            aria-label={`${label}, locked. Unlocks at level ${unlock.level}`}
            className={`flex cursor-default items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${next ? "text-muted-foreground" : "text-muted-foreground/55"}`}
          />
        }
      >
        <IconLock className="size-4" />
        <span className="sr-only xl:not-sr-only xl:whitespace-nowrap">{label}</span>
        {next && <span className="rounded-full border px-1.5 text-[10px] font-semibold leading-4 tabular-nums">Lv {unlock.level}</span>}
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">
          {next ? "Next unlock · " : ""}
          {unlock.name}
        </div>
        <div>Unlocks at level {unlock.level}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function MobileItem({ entry: { id, label, Icon }, current }: NavState) {
  return (
    <a href={`#/${id}`} aria-current={current ? "page" : undefined} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm ${current ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}>
      <Icon className="size-3.5" />
      {label}
    </a>
  );
}

function LockedMobileItem({ entry: { label, feature }, next }: NavState) {
  const unlock = unlockOf(feature!);
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-label={`${label}, locked. Unlocks at level ${unlock.level}`}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm ${next ? "border border-dashed text-muted-foreground" : "text-muted-foreground/55"}`}
    >
      <IconLock className="size-3.5" />
      {label}
      <span className="text-[10px] font-semibold tabular-nums">Lv {unlock.level}</span>
    </span>
  );
}
