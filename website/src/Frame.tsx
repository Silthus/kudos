import { useId, type ReactNode } from "react";
import { HedgehogHeart } from "@posthog/brand/hoggies";
import { IconLeave } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { AppLink } from "./AppLink";
import { ReadyPill, ReadyPillFailure } from "./crates/ReadyPill";
import { isShownOn, type ReadyCrate } from "./crates/readyCrates";
import { LeveledFace } from "./LeveledFace";
import { levelRingName } from "./LevelRing";
import { ScreenNav, usePopIn } from "./nav/ScreenNav";
import type { Screen } from "./route";
import type { MemberProfile } from "./shell";
import { SkillPointGlyph } from "./skills/glyphs";
import { chipName } from "./skills/perkWords";
import { ThemeControl } from "./ThemeControl";

type FrameProps = { member?: MemberProfile; ready?: ReadyCrate[]; current?: Screen; busy: boolean; inert?: boolean; onSignOut?: () => void; children: ReactNode };

export function Frame({ member, ready = [], current, busy, inert, onSignOut, children }: FrameProps) {
  return (
    <div className="hud-root flex min-h-screen flex-col" inert={inert}>
      <header className="sticky top-0 z-40 border-b bg-card/85 shadow-[0_1px_0_0_color-mix(in_oklab,var(--foreground)_4%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-x-3 px-4 max-lg:gap-y-1 max-lg:pt-2 max-sm:gap-x-2 md:px-6">
          <Wordmark />
          {member && <ScreenNav current={current} member={member} />}
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 max-sm:gap-1.5">
            {member && member.skillPoints !== null && <SkillPointChip points={member.skillPoints} />}
            {member && <ReadyPill crates={ready} />}
            {member && <Avatar member={member} />}
            <ThemeControl />
            {member && onSignOut && <SignOut onSignOut={onSignOut} />}
          </div>
          {member && <ReadyPillFailure crates={ready.filter((crate) => !isShownOn(crate, current))} />}
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
  const { className: popIn = "", onAnimationEnd } = usePopIn("skillTree", "chip");
  return (
    <span onAnimationEnd={onAnimationEnd} className={`inline-flex ${popIn}`}>
      <AppLink href="/skills" aria-label={chipName(points)} className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-2.5 text-sm font-medium tabular-nums hover:bg-fill-hover">
        <SkillPointGlyph />
        {points}
      </AppLink>
    </span>
  );
}

function Avatar({ member }: { member: MemberProfile }) {
  const levelId = useId();
  const { progression } = member;
  return (
    <AppLink href="/" aria-label={avatarName(member)} aria-describedby={progression !== null ? levelId : undefined} className="rounded-full">
      <LeveledFace member={member} className="size-8" />
      {progression !== null && <span id={levelId} hidden>{levelRingName(progression)}</span>}
    </AppLink>
  );
}

function avatarName({ name, progression }: MemberProfile) {
  const who = name ?? "Your profile";
  return progression === null ? who : `${who}, level ${progression.level}`;
}

function SignOut({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Button variant="outline" size="icon" aria-label="Sign out" title="Sign out" onClick={onSignOut}>
      <IconLeave />
    </Button>
  );
}
