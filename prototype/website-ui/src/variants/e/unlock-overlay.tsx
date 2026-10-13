// Variant E unlock overlay: the full-screen loot moment where a member opens a ready feature's crate, sees what waits, and goes there, waits, or opens the next crate.
import { useEffect, useRef, type CSSProperties } from "react";
import { IconArrowRight, IconCheck } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { useNav } from "../../nav";
import { unlockMoments } from "./moments-data";
import { CrateGlyph, FeatureCrateStage, isOpened, useFeatureCrate } from "./unlock-crate";
import { featureLook } from "./unlock-features";
import { showCrate, unlockOf, useReadyFeatures, useShownCrate, type Feature } from "./unlocks";

const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

export function UnlockOverlay() {
  const feature = useShownCrate();
  return feature ? <CrateDialog key={feature} feature={feature} /> : null;
}

function CrateDialog({ feature }: { feature: Feature }) {
  const { go } = useNav();
  const { phase, open } = useFeatureCrate(feature);
  const waiting = useReadyFeatures().filter((f) => f !== feature);
  const unlock = unlockOf(feature);
  const facts = unlockMoments[feature];
  const { screen, param } = featureLook[feature];
  const revealed = phase === "open";
  const opened = isOpened(phase);
  const later = () => showCrate(null);
  useLockedScroll();
  useEscape(later);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="uc-title" className="uc-scrim fixed inset-0 z-50 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-5 pb-12 pt-[clamp(2.5rem,8vh,5rem)] text-center">
        <span className="hud-label" style={{ color: "rgba(255,255,255,.65)" }}>
          Level {unlock.level} unlock
        </span>
        <h2 id="uc-title" className="mo-headline text-[clamp(2.25rem,9vw,3.5rem)]">
          {opened ? facts.headline : "Something's inside"}
        </h2>
        <div className="mt-2">
          <FeatureCrateStage feature={feature} phase={phase} onOpen={open} width={Math.min(260, innerWidth - 120)} autoFocus />
        </div>
        {revealed ? (
          <Reveal feature={feature} waiting={waiting} onGo={() => (showCrate(null), go(screen, param))} onLater={later} />
        ) : (
          <Button variant="link-muted" size="sm" className="mt-2 text-white/60 hover:text-white" onClick={later}>
            Later
          </Button>
        )}
      </div>
    </div>
  );
}

function Reveal({ feature, waiting, onGo, onLater }: { feature: Feature; waiting: Feature[]; onGo: () => void; onLater: () => void }) {
  const unlock = unlockOf(feature);
  const facts = unlockMoments[feature];
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => go.current?.focus(), []);
  const next = waiting[0];
  return (
    <section className="uc-reveal mt-4 flex w-full max-w-md flex-col gap-4 rounded-2xl bg-card p-5 text-left text-card-foreground shadow-2xl" aria-label="Waiting for you">
      <p className="text-base">{unlock.teaser}</p>
      <ul className="flex flex-col gap-2">
        {facts.waiting.map((line, i) => (
          <li key={line} className="uc-reveal flex items-start gap-2.5 text-sm" style={delay(0.15 + i * 0.12)}>
            <IconCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {line}
          </li>
        ))}
      </ul>
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center">
        <Button variant="link-muted" size="sm" onClick={onLater}>
          Later
        </Button>
        {next && (
          <Button variant="outline" className="sm:ml-auto" onClick={() => showCrate(next)}>
            <CrateGlyph className="size-4" />
            Open the next one
            {waiting.length > 1 && <span className="tabular-nums text-muted-foreground">· {waiting.length} left</span>}
          </Button>
        )}
        <Button ref={go} variant="primary" className={next ? "" : "sm:ml-auto"} onClick={onGo}>
          Go there
          <IconArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}

function useLockedScroll() {
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
}

function useEscape(onEscape: () => void) {
  const latest = useRef(onEscape);
  latest.current = onEscape;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
}
