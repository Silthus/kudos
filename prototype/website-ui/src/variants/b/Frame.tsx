// Variant B frame: a sticky game HUD bar with the hero's level ring and resources, and a game-menu navigation.
import { HedgehogSuperhero } from "@posthog/brand/hoggies";
import { me } from "../../data/mock";
import { ThemeButton, type LayoutProps } from "../../Layout";
import { useNav } from "../../nav";
import { screens } from "../../screens";
import { CoinGlyph, LevelRing, ResourceChip, SkillPointGlyph, levelProgress, useHud } from "./hud";

export function Frame({ current, dark, toggle, children }: LayoutProps) {
  useHud();
  const { setSignedIn } = useNav();
  const nav = screens.filter((s) => s.inNav);
  const progress = levelProgress(me.xp, me.xpThisLevelStart, me.xpNextLevel);

  return (
    <div className="hud-root flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-6">
          <a href="#/profile" className="flex items-center gap-2.5">
            <HedgehogSuperhero size={34} title="HedgeHug" />
            <span className="flex flex-col leading-none">
              <span className="hud-display text-lg font-bold">HedgeHug</span>
              <span className="text-[10px] text-muted-foreground">Thanks a Hog</span>
            </span>
          </a>
          <nav className="mx-auto hidden items-center gap-0.5 md:flex" aria-label="Screens">
            {nav.map(({ id, label, Icon }) => (
              <a
                key={id}
                href={`#/${id}`}
                aria-current={id === current ? "page" : undefined}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${id === current ? "text-foreground after:absolute after:inset-x-3 after:-bottom-[12px] after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
              >
                <Icon className="size-4" />
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <ResourceChip icon={<SkillPointGlyph />} title="Skill points to spend" href="#/skills" pulse={me.skillPointsUnspent > 0}>
              {me.skillPointsUnspent}
            </ResourceChip>
            <ResourceChip icon={<CoinGlyph />} title="Coins">
              {me.coins}
            </ResourceChip>
            <a href="#/profile" title={`${me.name}, level ${me.level}`} className="hidden sm:block">
              <LevelRing level={me.level} progress={progress} size={34} stroke={3} compact />
            </a>
            <ThemeButton dark={dark} toggle={toggle} />
            <button className="hidden whitespace-nowrap text-xs text-muted-foreground hover:text-foreground md:block" onClick={() => setSignedIn(false)}>
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label="Screens">
          {nav.map(({ id, label, Icon }) => (
            <a key={id} href={`#/${id}`} aria-current={id === current ? "page" : undefined} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm ${id === current ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground"}`}>
              <Icon className="size-3.5" />
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-6 md:pt-8">{children}</main>
    </div>
  );
}
