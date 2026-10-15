import { useCallback, useId, useState, type ReactNode } from "react";
import { HedgehogHeart } from "@posthog/brand/hoggies";
import { IconLeave } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { AppLink, useNavigate } from "./AppLink";
import { ReadyPill, ReadyPillFailure } from "./crates/ReadyPill";
import { coinsChipAttributes, hudAvatarAttributes, skillPointChipAttributes } from "./crates/RewardFlight";
import { useCountUp } from "./countUp";
import { useMoments } from "./crates/moments";
import { featureCrateOf, type ReadyCrate } from "./crates/readyCrates";
import { LeveledFace } from "./LeveledFace";
import { levelRingName } from "./LevelRing";
import { ScreenNav, usePopIn } from "./nav/ScreenNav";
import { CommandPalette } from "./palette/CommandPalette";
import { commandsOf, type Shell } from "./palette/commands";
import { paletteShortcut, usePaletteShortcut } from "./palette/shortcut";
import type { Screen } from "./route";
import type { MemberProfile } from "./shell";
import { CoinGlyph, SkillPointGlyph } from "./skills/glyphs";
import { chipName, coinsToSpend } from "./skills/perkWords";
import { useTheme } from "./theme";
import { ThemeControl } from "./ThemeControl";

type FrameProps = { member?: MemberProfile; ready?: ReadyCrate[]; readyElsewhere?: ReadyCrate[]; current?: Screen; busy: boolean; inert?: boolean; notice?: ReactNode; onSignOut?: () => void; children: ReactNode };

export function Frame({ member, ready = [], readyElsewhere = [], current, busy, inert, notice, onSignOut, children }: FrameProps) {
  const palette = usePalette(member !== undefined && !inert);
  return (
    <>
      <div className="hud-root flex min-h-screen flex-col" inert={inert || palette.open}>
        <header className="sticky top-0 z-40 border-b bg-card/85 shadow-[0_1px_0_0_color-mix(in_oklab,var(--foreground)_4%,transparent)] backdrop-blur-md">
          <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-x-3 px-4 max-lg:gap-y-1 max-lg:pt-2 max-sm:gap-x-2 md:px-6">
            <Wordmark />
            {member && <ScreenNav current={current} member={member} />}
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 max-sm:gap-1.5">
              {member && <PaletteChip onOpen={palette.toggle} />}
              {member && member.skillPoints !== null && <SkillPointChip points={member.skillPoints} />}
              {member && member.coins !== null && <CoinsChip coins={member.coins} />}
              {member && <ReadyPill crates={ready} />}
              {member && <Avatar member={member} />}
              <ThemeControl />
              {member && onSignOut && <SignOut onSignOut={onSignOut} />}
            </div>
            {member && <ReadyPillFailure crates={readyElsewhere} />}
          </div>
        </header>
        <main aria-busy={busy || undefined} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 md:px-6 md:pt-8">
          {notice}
          {children}
        </main>
      </div>
      {palette.open && member && <MemberPalette member={member} onSignOut={onSignOut} onClose={palette.close} />}
    </>
  );
}

function usePalette(available: boolean) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((wasOpen) => !wasOpen), []);
  const close = useCallback(() => setOpen(false), []);
  usePaletteShortcut(toggle, { enabled: available, palette: paletteElement });
  return { open: open && available, toggle, close };
}

function MemberPalette({ member, onSignOut, onClose }: { member: MemberProfile; onSignOut?: () => void; onClose: () => void }) {
  const navigate = useNavigate();
  const moments = useMoments();
  const { choice, choose } = useTheme();
  const shell: Shell = {
    go: navigate,
    openCrate: (card) => moments?.open(featureCrateOf(card)),
    theme: choice,
    chooseTheme: choose,
    signOut: () => onSignOut?.(),
  };
  return <CommandPalette commands={commandsOf(member)} shell={shell} onClose={onClose} />;
}

function paletteElement() {
  return document.querySelector('[role="dialog"][aria-label="Command palette"]');
}

function PaletteChip({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open the command palette"
      title="Command palette"
      className="hidden h-8 items-center whitespace-nowrap rounded-full border border-dashed border-muted-foreground px-2.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground sm:inline-flex"
    >
      {paletteShortcut()}
    </button>
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
  const counted = useCountUp(points);
  return (
    <span onAnimationEnd={onAnimationEnd} className={`inline-flex ${popIn}`}>
      <AppLink href="/skills" aria-label={chipName(points)} className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-2.5 text-sm font-medium tabular-nums hover:bg-fill-hover" {...skillPointChipAttributes()}>
        <SkillPointGlyph />
        {counted}
      </AppLink>
    </span>
  );
}

function CoinsChip({ coins }: { coins: number }) {
  const { className: popIn = "", onAnimationEnd } = usePopIn("coins", "chip");
  const counted = useCountUp(coins);
  const name = coinsToSpend(coins);
  return (
    <span role="img" aria-label={name} title={name} onAnimationEnd={onAnimationEnd} className={`inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-2.5 text-sm font-medium tabular-nums ${popIn}`} {...coinsChipAttributes()}>
      <CoinGlyph />
      {counted}
    </span>
  );
}

function Avatar({ member }: { member: MemberProfile }) {
  const levelId = useId();
  const { progression } = member;
  return (
    <AppLink href="/" aria-label={avatarName(member)} aria-describedby={progression !== null ? levelId : undefined} className="rounded-full" {...hudAvatarAttributes()}>
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
