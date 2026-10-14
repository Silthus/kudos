import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import { HedgehogHeart } from "@posthog/brand/hoggies";
import { IconHome } from "@posthog/icons";
import { AccountMenu } from "./AccountMenu";
import { AppLink } from "./AppLink";
import { ReadyPill, ReadyPillFailure } from "./crates/ReadyPill";
import { skillPointChipAttributes } from "./crates/RewardFlight";
import { useCountUp } from "./countUp";
import { isShownOn, type ReadyCrate } from "./crates/readyCrates";
import { openWebPagesOf } from "./features";
import type { Screen } from "./route";
import type { MemberProfile } from "./shell";
import { SkillPointGlyph } from "./skills/glyphs";
import { chipName } from "./skills/perkWords";
import { ThemeControl } from "./ThemeControl";

type FrameProps = { member?: MemberProfile; ready?: ReadyCrate[]; current?: Screen; busy: boolean; inert?: boolean; onSignOut?: () => void; children: ReactNode };

export function Frame({ member, ready = [], current, busy, inert, onSignOut, children }: FrameProps) {
  const first = ready[0];
  return (
    <div className="hud-root flex min-h-screen flex-col" inert={inert}>
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-x-3 px-4 max-lg:gap-y-1 max-lg:pt-2 max-sm:gap-x-2 md:px-6">
          <Wordmark />
          {member && <ScreenNav current={current} member={member} />}
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 max-sm:gap-1.5">
            {member && member.skillPoints !== null && <SkillPointChip points={member.skillPoints} />}
            {member && <ReadyPill crates={ready} />}
            <ThemeControl />
            {member && onSignOut && <AccountMenu member={member} onSignOut={onSignOut} />}
          </div>
          {member && first !== undefined && !isShownOn(first, current) && <ReadyPillFailure first={first} />}
        </div>
      </header>
      <main aria-busy={busy || undefined} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 md:px-6 md:pt-8">{children}</main>
    </div>
  );
}

function Wordmark() {
  return (
    <AppLink href="/" aria-label="HedgeHug, home" className="flex items-center gap-2.5 rounded-md">
      <HedgehogHeart size={34} title="" className="shrink-0" />
      <span className="flex flex-col leading-none max-sm:hidden">
        <span className="hud-display text-lg font-bold">HedgeHug</span>
        <span className="text-[10px] text-muted-foreground">Thanks a Hog</span>
      </span>
    </AppLink>
  );
}

function SkillPointChip({ points }: { points: number }) {
  const counted = useCountUp(points);
  return (
    <AppLink href="/skills" aria-label={chipName(points)} className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-2.5 text-sm font-medium tabular-nums hover:bg-fill-hover" {...skillPointChipAttributes()}>
      <SkillPointGlyph />
      {counted}
    </AppLink>
  );
}

function ScreenNav({ current, member }: { current?: Screen; member: MemberProfile }) {
  const rail = useCurrentEntryInView(current);
  return (
    <nav
      ref={rail}
      aria-label="Screens"
      onFocus={(event) => bringIntoView(event.target)}
      className="flex flex-nowrap items-center gap-0.5 max-lg:order-last max-lg:-mx-4 max-lg:w-[calc(100%+2rem)] max-lg:overflow-x-auto max-lg:px-3 max-lg:pb-1.5 max-lg:scroll-px-3 md:max-lg:-mx-6 md:max-lg:w-[calc(100%+3rem)] md:max-lg:px-5 lg:mx-auto"
    >
      <ScreenLink href="/" current={current === "home"} Icon={IconHome}>
        Home
      </ScreenLink>
      {openWebPagesOf(member).map(({ screen, href, name, Icon }) => (
        <ScreenLink key={href} href={href} current={current === screen} Icon={Icon}>
          {name}
        </ScreenLink>
      ))}
    </nav>
  );
}

function useCurrentEntryInView(current: Screen | undefined) {
  const rail = useRef<HTMLElement>(null);
  useEffect(() => {
    const entry = rail.current?.querySelector('[aria-current="page"]');
    if (entry) bringIntoView(entry);
  }, [current]);
  return rail;
}

function bringIntoView(entry: Element) {
  entry.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
}

type ScreenLinkProps = { href: string; current: boolean; Icon: ComponentType<{ className?: string }>; children: ReactNode };

function ScreenLink({ href, current, Icon, children }: ScreenLinkProps) {
  return (
    <AppLink
      href={href}
      aria-current={current ? "page" : undefined}
      className={`relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium ${current ? "text-foreground after:absolute after:inset-x-2 after:-bottom-[12px] after:h-0.5 after:rounded-full after:bg-primary max-lg:after:bottom-0" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
    >
      <Icon className="size-4" />
      {children}
    </AppLink>
  );
}
