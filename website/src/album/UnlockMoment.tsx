import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { prefersReducedMotion } from "../reducedMotion";
import { TeamEmojiPicture } from "./TeamEmojiPicture";
import type { AlbumEmoji, AlbumTeam, TeamSticker } from "./answer";
import { SealArt } from "./Seal";
import { FindInSlackWhileOn, useEmojiWizardOn } from "./findInSlack";
import { dateOf, newTeamEmojiWords } from "./teamPage";
import "./moment.css";

const phases = ["lift", "reveal", "named", "emoji", "home"] as const;

type Phase = (typeof phases)[number];

type Timing = { reveal: number; named: number; emoji: number; liftMs: number; homeMs: number };

export const unlockTiming: Timing = { reveal: 1000, named: 3100, emoji: 3900, liftMs: 1000, homeMs: 820 };

const momentSealSize = 264;

type UnlockMomentProps = { sticker: TeamSticker; collected: number; emoji: AlbumEmoji | undefined; onDone: () => void };

export function UnlockMoment({ sticker, collected, emoji, onDone }: UnlockMomentProps) {
  const wizardOn = useEmojiWizardOn();
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhaseNow] = useState<Phase>(reduced ? "emoji" : "lift");
  const setPhase = useCallback((next: Phase) => setPhaseNow((current) => (phases.indexOf(next) > phases.indexOf(current) ? next : current)), []);
  const dialog = useRef<HTMLDivElement>(null);
  const sealOnStage = useRef<HTMLDivElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const shown = sealOf(sticker, collected);
  const team = sticker.team;

  useLayoutEffect(() => dialog.current?.focus(), []);
  useLift(sealOnStage, team, reduced);
  usePhaseClock(reduced, setPhase);
  useEffect(() => {
    if (phase === "emoji") continueButton.current?.focus({ preventScroll: true });
  }, [phase]);

  const goHome = useCallback(() => {
    setPhase("home");
    if (reduced) return onDone();
    void flyHome(sealOnStage.current, sealOnThePage(team)).then(onDone);
  }, [reduced, onDone, setPhase, team]);

  const advance = useCallback(() => {
    if (phase === "lift" || phase === "reveal") return;
    if (phase === "named") return setPhase("emoji");
    if (phase === "emoji") goHome();
  }, [phase, goHome, setPhase]);

  useEscapeTo(advance);

  return (
    <div ref={dialog} tabIndex={-1} className="al-unlock-moment" role="dialog" aria-modal="true" aria-label={`${sticker.name} sticker unlocked`} data-phase={phase} data-reduced={reduced ? "" : undefined} onClick={advance} onKeyDown={(event) => event.key === "Tab" && keepFocusOnTheWayBack(event, continueButton.current)}>
      <div className="al-unlock-dim" aria-hidden="true" />
      <div className="al-unlock-stage">
        <div className="al-unlock-spot">
          {!reduced && (
            <span className="al-unlock-glow" aria-hidden="true">
              <span className="al-unlock-rays" />
            </span>
          )}
          <div ref={sealOnStage} className="al-unlock-seal">
            <div className="al-unlock-layer" data-layer="grey">
              <SealArt team={{ ...shown, state: "ready" }} coloured={false} size={momentSealSize} />
            </div>
            <div className="al-unlock-layer" data-layer="colour">
              <SealArt team={shown} coloured size={momentSealSize} />
              <span className="al-unlock-shine" aria-hidden="true" />
            </div>
            <span className="al-unlock-stamp" aria-hidden="true" />
          </div>
          {!reduced && <GoldConfetti />}
        </div>
        {phase !== "lift" && phase !== "reveal" && (
          <>
            <div className="al-unlock-words">
              <h2 className="al-unlock-title">{sticker.name} sticker unlocked</h2>
              <p className="al-unlock-sub">
                {dateOf(sticker.at)}
                {collected > 0 && ` · ${collected} of ${collected} people collected`}
              </p>
            </div>
            {phase !== "named" && (
              <>
                <div className="al-unlock-emoji ph-no-capture">
                  <span className="al-emoji-picture">
                    <TeamEmojiPicture art={sticker.art} name={sticker.name} emoji={emoji} size={48} />
                  </span>
                  <span className="al-unlock-emoji-words">
                    <code>:{emoji?.name ?? sticker.emoji}:</code>
                    <span>{newTeamEmojiWords(emoji, wizardOn)}</span>
                  </span>
                  {emoji !== undefined && <FindInSlackWhileOn emoji={emoji} />}
                </div>
                <div className="al-unlock-continue">
                  <button
                    ref={continueButton}
                    type="button"
                    className="al-unlock-continue-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (phase !== "home") goHome();
                    }}
                  >
                    Put it on the page
                  </button>
                  <span className="al-unlock-hint" data-pointer="fine">
                    or click anywhere, or press Esc
                  </span>
                  <span className="al-unlock-hint" data-pointer="coarse">
                    or tap anywhere
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function sealOf({ team, name, art, at }: TeamSticker, collected: number): AlbumTeam {
  return { team, name, art, mine: false, people: [], unmatched: [], held: collected, total: collected, state: "unlocked", unlockedAt: at };
}

function usePhaseClock(reduced: boolean, setPhase: (phase: Phase) => void) {
  useEffect(() => {
    if (reduced) return;
    const steps: [Phase, number][] = [
      ["reveal", unlockTiming.reveal],
      ["named", unlockTiming.named],
      ["emoji", unlockTiming.emoji],
    ];
    const timers = steps.map(([phase, at]) => window.setTimeout(() => setPhase(phase), at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reduced, setPhase]);
}

function useEscapeTo(advance: () => void) {
  const latest = useRef(advance);
  latest.current = advance;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function keepFocusOnTheWayBack(event: ReactKeyboardEvent<HTMLElement>, button: HTMLButtonElement | null) {
  event.preventDefault();
  (button ?? (event.currentTarget as HTMLElement)).focus();
}

function sealOnThePage(team: string) {
  return document.querySelector<HTMLElement>(`main [data-al-seal="${CSS.escape(team)}"]`);
}

function canAnimate(element: HTMLElement | null): element is HTMLElement {
  return element !== null && typeof element.animate === "function";
}

function offsetToward(element: HTMLElement, home: HTMLElement) {
  const centre = element.getBoundingClientRect();
  const target = home.getBoundingClientRect();
  const scale = centre.width === 0 ? 1 : target.width / centre.width;
  const x = target.left + target.width / 2 - (centre.left + centre.width / 2);
  const y = target.top + target.height / 2 - (centre.top + centre.height / 2);
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

function useLift(sealOnStage: RefObject<HTMLDivElement | null>, team: string, reduced: boolean) {
  useLayoutEffect(() => {
    const element = sealOnStage.current;
    const home = sealOnThePage(team);
    if (reduced || !canAnimate(element) || home === null) return;
    const lift = element.animate([{ transform: offsetToward(element, home) }, { transform: "translate(0, 26px) scale(0.72) rotate(-6deg)", offset: 0.45 }, { transform: "none" }], { duration: unlockTiming.liftMs, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "backwards" });
    return () => lift.cancel();
  }, [sealOnStage, team, reduced]);
}

async function flyHome(element: HTMLElement | null, home: HTMLElement | null) {
  if (!canAnimate(element) || home === null) return pause(unlockTiming.homeMs);
  const trip = element.animate([{ transform: "none" }, { transform: "translate(0, -18px) scale(1.04)", offset: 0.18 }, { transform: offsetToward(element, home) }], { duration: unlockTiming.homeMs, easing: "cubic-bezier(0.3, 0.1, 0.25, 1)", fill: "forwards" });
  await trip.finished.catch(() => undefined);
}

function pause(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

const confettiCount = 56;

function wobble(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function confettoStyle(index: number): CSSProperties {
  const angle = (index / confettiCount) * Math.PI * 2 + wobble(index, 1) * 0.5;
  const distance = 170 + wobble(index, 2) * 260;
  return {
    "--x": `${Math.round(Math.cos(angle) * distance)}px`,
    "--y": `${Math.round(Math.sin(angle) * distance * 0.75 - 40)}px`,
    "--fall": `${Math.round(120 + wobble(index, 3) * 160)}px`,
    "--turn": `${Math.round(wobble(index, 4) * 900 - 450)}deg`,
    "--delay": `${Math.round(wobble(index, 5) * 160)}ms`,
    "--tone": `var(--al-moment-gold-${(index % 4) + 1})`,
  } as CSSProperties;
}

function GoldConfetti() {
  return (
    <span className="al-unlock-confetti" data-confetti="" aria-hidden="true">
      {Array.from({ length: confettiCount }, (_, index) => (
        <span key={index} className="al-unlock-confetto" style={confettoStyle(index)} />
      ))}
    </span>
  );
}
