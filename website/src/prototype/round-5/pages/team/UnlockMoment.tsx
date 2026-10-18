// PROTOTYPE (#625, round 6): unlocking a full team's sticker: it lifts to the centre, colour spreads through the grey crest, and its team emoji arrives before it flies home. Never merge to main.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useAlbum, type Team } from "../../../round-3/album";
import { usePrefersReducedMotion } from "../../shell/motion";
import { EmojiArt } from "../../shell/EmojiArt";
import { SealArt } from "./TeamSticker";
import { dateOf, teamEmojiId, teamEmojiOf } from "./team";
import "./moment.css";

const phases = ["lift", "reveal", "named", "emoji", "home"] as const;

type Phase = (typeof phases)[number];

function laterOf(current: Phase, next: Phase) {
  return phases.indexOf(next) > phases.indexOf(current) ? next : current;
}

type Timing = { reveal: number; named: number; emoji: number; liftMs: number; homeMs: number };

const moving: Timing = { reveal: 1000, named: 3100, emoji: 3900, liftMs: 1000, homeMs: 820 };

const still: Timing = { reveal: 250, named: 1500, emoji: 2100, liftMs: 0, homeMs: 260 };

export function UnlockMoment({ team, homeOf, onDone }: { team: Team; homeOf: () => HTMLElement | null; onDone: () => void }) {
  const { album, actions } = useAlbum();
  const reduced = usePrefersReducedMotion();
  const timing = reduced ? still : moving;
  const [phase, setPhaseNow] = useState<Phase>("lift");
  const setPhase = useCallback((next: Phase) => setPhaseNow((current) => laterOf(current, next)), []);
  const [claimedAt] = useState(() => team.claimedAt ?? Date.now());
  const sticker = useRef<HTMLDivElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const emoji = teamEmojiOf(album, team);

  useMomentFlag();
  useLift(sticker, homeOf, timing);
  usePhaseClock(timing, setPhase);
  useClaimAtTheReveal(phase, () => actions.claimTeam(team.team));
  useEmojiSeenWhenShown(phase, () => actions.markEmojisSeen([teamEmojiId(team)]));

  const goHome = useCallback(() => {
    setPhase("home");
    flyHome(sticker.current, homeOf(), timing).then(onDone);
  }, [homeOf, onDone, timing, setPhase]);

  const advance = useCallback(() => {
    if (phase === "named") setPhase("emoji");
    if (phase === "emoji") goHome();
  }, [phase, goHome, setPhase]);

  const continueHome = (event: MouseEvent) => {
    event.stopPropagation();
    if (phase !== "home") goHome();
  };

  useEscapeTo(advance);
  useEffect(() => {
    if (phase === "emoji") continueButton.current?.focus({ preventScroll: true });
  }, [phase]);

  return createPortal(
    <div className="r6m" data-phase={phase} data-reduced={reduced ? "" : undefined} role="dialog" aria-modal="true" aria-labelledby="r6m-title" onClick={advance}>
      <div className="r6m-dim" />
      <div className="r6m-stage">
        <div className="r6m-sticker-spot">
          <span className="r6m-glow" aria-hidden="true">
            <span className="r6m-rays" />
          </span>
          <div ref={sticker} className="r6m-sticker">
            <div className="r6m-pop">
              <div className="r6m-layer r6m-layer-grey">
                <SealArt team={team} coloured={false} />
              </div>
              <div className="r6m-layer r6m-layer-colour">
                <SealArt team={team} coloured />
                <span className="r6m-shine" aria-hidden="true" />
              </div>
              <span className="r6m-ink-edge" aria-hidden="true" />
            </div>
          </div>
          <GoldConfetti />
        </div>
        <div className="r6m-words" aria-live="polite">
          <h2 id="r6m-title" className="r6m-title">
            {team.name} sticker unlocked
          </h2>
          <p className="r6m-sub">
            {dateOf(claimedAt)} · {team.total} of {team.total} people collected
          </p>
        </div>
        <div className="r6m-emoji">
          {emoji !== undefined && <EmojiArt album={album} emoji={{ ...emoji, unlocked: true }} size={52} />}
          <span className="r6m-emoji-words">
            <code className="r6m-emoji-name">{emoji?.name ?? `:${team.team}:`}</code>
            <span>New team emoji · use it in Slack for reactions and kudos</span>
          </span>
        </div>
        <div className="r6m-continue">
          <button ref={continueButton} type="button" className="r6m-continue-button" onClick={continueHome}>
            Put it on the page
          </button>
          <span className="r6m-hint">or click anywhere, or press Esc</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function useMomentFlag() {
  useEffect(() => {
    document.body.dataset.r6Moment = "team";
    return () => {
      delete document.body.dataset.r6Moment;
    };
  }, []);
}

function usePhaseClock(timing: Timing, setPhase: (phase: Phase) => void) {
  useEffect(() => {
    const steps: [Phase, number][] = [
      ["reveal", timing.reveal],
      ["named", timing.named],
      ["emoji", timing.emoji],
    ];
    const timers = steps.map(([phase, at]) => window.setTimeout(() => setPhase(phase), at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [timing, setPhase]);
}

function useOnceWhen(when: boolean, act: () => void) {
  const done = useRef(false);
  const latest = useRef(act);
  latest.current = act;
  useEffect(() => {
    if (!when || done.current) return;
    done.current = true;
    latest.current();
  }, [when]);
}

function useClaimAtTheReveal(phase: Phase, claim: () => void) {
  useOnceWhen(phase !== "lift", claim);
}

function useEmojiSeenWhenShown(phase: Phase, markSeen: () => void) {
  useOnceWhen(phase === "emoji" || phase === "home", markSeen);
}

function useEscapeTo(advance: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);
}

function offsetToward(sticker: HTMLElement, home: HTMLElement) {
  const centre = sticker.getBoundingClientRect();
  const target = home.getBoundingClientRect();
  const scale = target.width / centre.width;
  const x = target.left + target.width / 2 - (centre.left + centre.width / 2);
  const y = target.top + target.height / 2 - (centre.top + centre.height / 2);
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

function useLift(sticker: RefObject<HTMLDivElement | null>, homeOf: () => HTMLElement | null, timing: Timing) {
  useLayoutEffect(() => {
    const element = sticker.current;
    const home = homeOf();
    if (element === null || home === null || timing.liftMs === 0) return;
    const lift = element.animate(
      [
        { transform: offsetToward(element, home), easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
        { transform: "translate(0, 26px) scale(0.72) rotate(-6deg)", offset: 0.45, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
        { transform: "none" },
      ],
      { duration: timing.liftMs, fill: "backwards" },
    );
    return () => lift.cancel();
  }, [sticker, homeOf, timing]);
}

async function flyHome(element: HTMLElement | null, home: HTMLElement | null, timing: Timing) {
  if (element === null || home === null || timing.liftMs === 0) return pause(timing.homeMs);
  const trip = element.animate(
    [
      { transform: "none", easing: "cubic-bezier(0.5, 0, 0.7, 0.4)" },
      { transform: "translate(0, -18px) scale(1.04)", offset: 0.18, easing: "cubic-bezier(0.3, 0.1, 0.25, 1)" },
      { transform: offsetToward(element, home) },
    ],
    { duration: timing.homeMs, fill: "forwards" },
  );
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
    "--colour": ["#e4b520", "#f8e39a", "#c99400", "#fff1b8", "#f7a501", "#fdfdf8"][index % 6],
  } as CSSProperties;
}

function GoldConfetti() {
  return (
    <span className="r6m-confetti" aria-hidden="true">
      {Array.from({ length: confettiCount }, (_, index) => (
        <span key={index} className="r6m-confetto" style={confettoStyle(index)} />
      ))}
    </span>
  );
}
