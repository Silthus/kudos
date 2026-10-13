// Variant E frame, from B: a sticky game HUD bar whose screens, ordered by the level they open at, turn into glowing crates when ready and into real screens once the member opens them, an unlocks-ready pill by the hedgehog avatar, a Cmd/Ctrl-K palette and a prototype level scrubber.
import { Fragment, useCallback, useState, type ComponentType, type ReactNode } from "react";
import { HedgehogHeart } from "@posthog/brand/hoggies";
import { IconBook, IconLeave, IconLock } from "@posthog/icons";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@posthog/quill";
import { me } from "../../data/mock";
import { ThemeButton, type LayoutProps } from "../../Layout";
import { useNav, type ScreenId } from "../../nav";
import { screens } from "../../screens";
import { CoinGlyph, HogAvatar, ResourceChip, SkillPointGlyph, levelProgress, useHud } from "./hud";
import { unspentPointsAt } from "./moments-data";
import { CommandPalette, paletteKey, usePaletteHotkey } from "./palette";
import { CrateGlyph } from "./unlock-crate";
import { nextUnlock, screenFeature } from "./unlock-features";
import { UnlockOverlay } from "./unlock-overlay";
import { PreviewLevelBar } from "./unlock-preview";
import { featureStateAt, justOpened, showCrate, unlockOf, unlockedAt, useOpenings, usePreviewLevel, useReadyFeatures, type Feature, type FeatureState } from "./unlocks";

const bookScreens: ScreenId[] = ["stickers", "achievements"];

type NavEntry = { id: ScreenId; label: string; Icon: ComponentType<{ className?: string }>; feature?: Feature };

const navOrder: ScreenId[] = ["profile", "quests", "leaderboard", "stickers", "skills", "collection"];

const navEntries: NavEntry[] = navOrder
  .map((id) => screens.find((s) => s.id === id)!)
  .map((s) => ({ ...(s.id === "stickers" ? { ...s, label: "Book", Icon: IconBook } : s), feature: screenFeature[s.id] }));

const navFeatures = navEntries.flatMap((e) => (e.feature ? [e.feature] : []));

const isCurrent = (id: ScreenId, current: ScreenId) => id === current || (id === "stickers" && bookScreens.includes(current));

type NavState = { entry: NavEntry; current: boolean; state: FeatureState; next: boolean };

export function Frame({ current, dark, toggle, children }: LayoutProps) {
  useHud();
  const { go, setSignedIn } = useNav();
  const level = usePreviewLevel();
  const ready = useReadyFeatures();
  const openings = useOpenings();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const togglePalette = useCallback(() => setPaletteOpen((o) => !o), []);
  usePaletteHotkey(togglePalette);
  const progress = levelProgress(me.xp, me.xpThisLevelStart, me.xpNextLevel);
  const upcoming = nextUnlock(level, navFeatures)?.feature;
  const nav: NavState[] = navEntries.map((entry) => ({
    entry,
    current: isCurrent(entry.id, current),
    state: entry.feature ? featureStateAt(entry.feature, level) : "unlocked",
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
            {nav.map((item) => {
              const Item = desktopItems[item.state];
              return <Item key={item.entry.id} {...item} />;
            })}
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
              <PopIn feature="skills">
                <ResourceChip icon={<SkillPointGlyph />} title="Skill points to spend" href="#/skills">
                  {unspentPointsAt(level)}
                </ResourceChip>
              </PopIn>
            )}
            {unlockedAt("coins", level) && (
              <PopIn feature="coins">
                <ResourceChip icon={<CoinGlyph />} title={`${me.coins} coins. ${unlockOf("coins").how}`}>
                  {me.coins}
                </ResourceChip>
              </PopIn>
            )}
            {ready.length > 0 && <ReadyPill ready={ready} />}
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
          {nav.map((item) => {
            const Item = mobileItems[item.state];
            return <Item key={item.entry.id} {...item} />;
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-6 md:px-6 md:pt-8">
        <Fragment key={current === "landing" ? "landing" : openings}>{children}</Fragment>
      </main>
      <UnlockOverlay />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} shell={{ go, dark, toggleTheme: toggle, signOut: () => setSignedIn(false) }} />
      <PreviewLevelBar />
    </div>
  );
}

function ReadyPill({ ready }: { ready: Feature[] }) {
  const text = ready.length === 1 ? "1 unlock ready" : `${ready.length} unlocks ready`;
  return (
    <button
      type="button"
      onClick={() => showCrate(ready[0])}
      title={`${text}: open it`}
      aria-label={`${text}. Open the crate`}
      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-2.5 text-sm font-medium hover:bg-fill-hover"
    >
      <CrateGlyph className="size-4" />
      <span className="tabular-nums sm:hidden">{ready.length}</span>
      <span className="hidden sm:inline">{text}</span>
    </button>
  );
}

function PopIn({ feature, children }: { feature: Feature; children: ReactNode }) {
  const fresh = useFresh(feature);
  return <span className={`inline-flex ${fresh ? "uc-pop" : ""}`}>{children}</span>;
}

function useFresh(feature?: Feature) {
  const [fresh] = useState(() => feature !== undefined && justOpened(feature));
  return fresh;
}

function DesktopItem({ entry: { id, label, Icon, feature }, current }: NavState) {
  const fresh = useFresh(feature);
  return (
    <a
      href={`#/${id}`}
      aria-current={current ? "page" : undefined}
      title={label}
      className={`relative flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors ${fresh ? "uc-pop" : ""} ${current ? "text-foreground after:absolute after:inset-x-2 after:-bottom-[12px] after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
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

function ReadyDesktopItem({ entry: { label, feature } }: NavState) {
  const unlock = unlockOf(feature!);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => showCrate(feature!)}
            aria-label={`${label}: unlock ready. Open its crate`}
            className="uc-token flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <CrateGlyph className="size-4" />
        <span className="sr-only xl:not-sr-only xl:whitespace-nowrap">{label}</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">{unlock.name} is ready</div>
        <div>Open its crate to unlock it</div>
      </TooltipContent>
    </Tooltip>
  );
}

function ReadyMobileItem({ entry: { label, feature } }: NavState) {
  return (
    <button
      type="button"
      onClick={() => showCrate(feature!)}
      aria-label={`${label}: unlock ready. Open its crate`}
      className="uc-token flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold"
    >
      <CrateGlyph className="size-4" />
      {label}
    </button>
  );
}

function MobileItem({ entry: { id, label, Icon, feature }, current }: NavState) {
  const fresh = useFresh(feature);
  return (
    <a href={`#/${id}`} aria-current={current ? "page" : undefined} className={`${fresh ? "uc-pop" : ""} flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm ${current ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}>
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

const desktopItems: Record<FeatureState, ComponentType<NavState>> = { locked: LockedDesktopItem, ready: ReadyDesktopItem, unlocked: DesktopItem };

const mobileItems: Record<FeatureState, ComponentType<NavState>> = { locked: LockedMobileItem, ready: ReadyMobileItem, unlocked: MobileItem };
