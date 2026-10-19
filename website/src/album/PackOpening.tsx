import { IconX } from "@posthog/icons";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { prefersReducedMotion } from "../reducedMotion";
import type { Rarity } from "../shell";
import type { Album, AlbumLevel, PackOpenReply, WaitingPack } from "./answer";
import { plural } from "./facts";
import {
  beatAfter,
  beatsOf,
  cardNameOf,
  completedTeamOf,
  confettiFor,
  contentsOf,
  hasTurned,
  heldSaying,
  lastBeatOf,
  rarityWordOf,
  shownTeamOf,
  sparklesFor,
  thankedFor,
  type Beat,
  type PackContents,
} from "./opening";
import { keepFocusIn } from "./focusTrap";
import { CardBack, Confetti, HoggieCard, PackWrapper, PersonCard, Ring, Shine, Sparkles } from "./PackCards";
import "./opening.css";
import { FindInSlackWhileOn } from "./findInSlack";

export type Held = { level: AlbumLevel | null; tray: number | null };

export const unheld: Held = { level: null, tray: null };

export const glowTurnsAfterMs = 1100;

export const flightMs = 720;

const flightStaggerMs = 120;

type Reveal = { contents: PackContents; beat: Beat };

type Problem = "refused" | "unreachable";

type After = { kind: "close" } | { kind: "put-all-in" } | { kind: "next"; pack: WaitingPack };

type PackOpeningProps = {
  album: Album;
  openThoughtfulPack: (pack: string) => Promise<PackOpenReply>;
  trayTarget: RefObject<HTMLElement | null>;
  onHold: (held: Partial<Held>) => void;
  onOpened: (pack: string) => void;
  onClose: () => void;
  onPutAllIn: () => void;
};

export function PackOpening({ album, openThoughtfulPack, trayTarget, onHold, onOpened, onClose, onPutAllIn }: PackOpeningProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [active, setActive] = useState<WaitingPack | null>(() => album.packs[0] ?? null);
  const [opened, setOpened] = useState<string[]>([]);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [flying, setFlying] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const landing = useRef<number | undefined>(undefined);
  const waiting = album.packs.filter(({ pack }) => pack !== active?.pack && !opened.includes(pack));
  const ended = reveal !== null && reveal.beat === lastBeatOf(reveal.contents);
  const busy = sending || flying;

  useEffect(() => () => window.clearTimeout(landing.current), []);
  useUnderTheTopBar(dialog, trayTarget);
  useLayoutEffect(() => {
    if (flying) dialog.current?.focus();
  }, [flying]);
  useEffect(() => {
    if (ended) onHold({ level: null });
  }, [ended, onHold]);
  useGlowTurnsByItself(reveal, reduced, setReveal);

  const rip = async () => {
    if (active === null || busy || reveal !== null) return;
    const before = album;
    setSending(true);
    setProblem(null);
    onHold({ level: before.level, tray: before.tray.length });
    try {
      const reply = await openThoughtfulPack(active.pack);
      if (reply.kind !== "opened") return refuse("refused");
      const contents = contentsOf(before, active, reply);
      onOpened(active.pack);
      setOpened((packs) => [...packs, active.pack]);
      setReveal({ contents, beat: reduced ? lastBeatOf(contents) : beatsOf(contents)[0]! });
    } catch {
      refuse("unreachable");
    } finally {
      setSending(false);
    }
  };

  const refuse = (why: Problem) => {
    onHold(unheld);
    setProblem(why);
  };

  const turn = () => setReveal((shown) => shown && { ...shown, beat: beatAfter(shown.contents, shown.beat) });

  const skip = () => setReveal((shown) => shown && { ...shown, beat: lastBeatOf(shown.contents) });

  const finish = (after: After) => {
    if (busy) return;
    const land = () => {
      onHold({ tray: null });
      if (after.kind === "close") return onClose();
      if (after.kind === "put-all-in") return onPutAllIn();
      setActive(after.pack);
      setReveal(null);
      setProblem(null);
    };
    if (reduced || reveal === null) return land();
    aimAtTheTray(stage.current, trayTarget.current);
    setFlying(true);
    landing.current = window.setTimeout(() => {
      setFlying(false);
      land();
    }, flightMs + flightStaggerMs);
  };

  const close = () => (reveal === null ? onClose() : finish({ kind: "close" }));

  useEscape(() => {
    if (busy) return;
    if (reveal !== null && !ended) return skip();
    close();
  });

  return (
    <div ref={dialog} tabIndex={-1} onKeyDown={(event) => event.key === "Tab" && keepFocusIn(dialog.current, event)} className="al-opening" role="dialog" aria-modal="true" aria-label="Open your packs" data-step={flying ? "flying" : (reveal?.beat ?? "sealed")} data-reduced={reduced ? "" : undefined}>
      <div className="al-opening-head">
        <p className="al-opening-count">{countWordsOf(opened.length, album.packs.filter(({ pack }) => !opened.includes(pack)).length)}</p>
        <button type="button" className="al-opening-close" aria-label="Close the pack opening" onClick={close} disabled={busy}>
          <IconX />
        </button>
      </div>
      <div className="al-opening-stage" ref={stage}>
        {active === null ? (
          <NoPacks onDone={onClose} />
        ) : reveal === null ? (
          <SealedPack album={album} pack={active} sending={sending} problem={problem} onRip={() => void rip()} />
        ) : (
          <Turns reveal={reveal} reduced={reduced} flying={flying} waitingAfter={waiting.length} onTurn={turn} onSkip={skip} onFinish={(next) => finish(next && waiting[0] !== undefined ? { kind: "next", pack: waiting[0] } : { kind: "close" })} onPutAllIn={() => finish({ kind: "put-all-in" })} />
        )}
      </div>
      {waiting.length > 0 && <UpNext album={album} waiting={waiting} disabled={busy || (reveal !== null && !ended)} onPick={(pack) => finish({ kind: "next", pack })} />}
      <p role="status" className="al-sr-only ph-no-capture">
        {reveal !== null && ended ? heldSaying(reveal.contents) : ""}
      </p>
    </div>
  );
}

function countWordsOf(openedCount: number, left: number) {
  const waiting = left === 0 ? "none left" : `${plural(left, "pack", "packs")} waiting`;
  return openedCount === 0 ? waiting : `${openedCount} opened · ${waiting}`;
}

function useEscape(onEscape: () => void) {
  const latest = useRef(onEscape);
  latest.current = onEscape;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      latest.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

function useUnderTheTopBar(dialog: RefObject<HTMLElement | null>, inTheTopBar: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const bar = inTheTopBar.current?.closest("header");
    if (dialog.current === null || bar === null || bar === undefined) return;
    const place = () => dialog.current?.style.setProperty("--al-opening-top", `${bar.getBoundingClientRect().height}px`);
    place();
    if (typeof ResizeObserver === "undefined") return;
    const watching = new ResizeObserver(place);
    watching.observe(bar);
    return () => watching.disconnect();
  }, [dialog, inTheTopBar]);
}

function useGlowTurnsByItself(reveal: Reveal | null, reduced: boolean, setReveal: (next: (shown: Reveal | null) => Reveal | null) => void) {
  const glowing = reveal?.beat === "glow" && !reduced;
  useEffect(() => {
    if (!glowing) return;
    const timer = window.setTimeout(() => setReveal((shown) => shown && (shown.beat === "glow" ? { ...shown, beat: beatAfter(shown.contents, "glow") } : shown)), glowTurnsAfterMs);
    return () => window.clearTimeout(timer);
  }, [glowing, setReveal]);
}

function aimAtTheTray(stage: HTMLElement | null, tray: HTMLElement | null) {
  if (stage === null || tray === null) return;
  const to = tray.getBoundingClientRect();
  stage.querySelectorAll<HTMLElement>(".al-slot").forEach((slot, index) => {
    const from = slot.getBoundingClientRect();
    slot.style.setProperty("--fly-x", `${Math.round(to.left + to.width / 2 - (from.left + from.width / 2))}px`);
    slot.style.setProperty("--fly-y", `${Math.round(to.top + to.height / 2 - (from.top + from.height / 2))}px`);
    slot.style.setProperty("--fly-delay", `${index * flightStaggerMs}ms`);
  });
}

function NoPacks({ onDone }: { onDone: () => void }) {
  return (
    <div className="al-opening-none">
      <h2 className="al-opening-title">No packs waiting</h2>
      <p>Thank someone in Slack and say why. Each thoughtful kudos earns a pack, one per person a week.</p>
      <button type="button" className="al-opening-button" data-primary="" onClick={onDone} autoFocus>
        Back to the album
      </button>
    </div>
  );
}

type SealedPackProps = { album: Album; pack: WaitingPack; sending: boolean; problem: Problem | null; onRip: () => void };

function SealedPack({ album, pack, sending, problem, onRip }: SealedPackProps) {
  const thanked = thankedFor(album, pack);
  return (
    <div className="al-sealed" data-ripping={sending ? "" : undefined}>
      <p className="al-opening-hint">{sending ? "Opening…" : "Click or press Enter to rip it open"}</p>
      <button type="button" className="al-sealed-pack" aria-label={`Rip open the pack for thanking ${thanked.name ?? "a teammate"}`} aria-disabled={sending || undefined} onClick={onRip} autoFocus>
        <span className="al-sealed-strip" aria-hidden="true" />
        <PackWrapper thanked={thanked} size="big" />
      </button>
      {problem !== null && (
        <p role="alert" className="al-opening-problem">
          {problem === "refused" ? "This pack can't be opened. It may already be open on another device." : "Can't reach HedgeHug. Try again."}
        </p>
      )}
    </div>
  );
}

type TurnsProps = { reveal: Reveal; reduced: boolean; flying: boolean; waitingAfter: number; onTurn: () => void; onSkip: () => void; onFinish: (next: boolean) => void; onPutAllIn: () => void };

function Turns({ reveal: { contents, beat }, reduced, flying, waitingAfter, onTurn, onSkip, onFinish, onPutAllIn }: TurnsProps) {
  const celebrating = !reduced;
  const ended = beat === lastBeatOf(contents);
  const personUp = hasTurned(contents, beat, "person");
  const hoggieUp = hasTurned(contents, beat, "hoggie");
  const confetti = confettiFor(contents);
  const sparkles = contents.hoggie === null ? 0 : sparklesFor(contents.hoggie.rarity);
  return (
    <div className="al-turns">
      {celebrating && (
        <span className="al-torn" aria-hidden="true">
          <span className="al-torn-strip" />
        </span>
      )}
      <div className="al-turn-cards" onClick={ended || flying ? undefined : onTurn}>
        {celebrating && beat === "person" && confetti !== null && <Confetti size={confetti} seed={contents.pack.earnedAt % 9973} />}
        {contents.sticker !== null && (
          <CardSlot label={personUp ? cardNameOf(contents.thanked) : "The person card, face down"} up={personUp} glow={null} flourish={celebrating && beat === "person"} back={<CardBack />}>
            <PersonCard thanked={contents.thanked} team={shownTeamOf(contents.sticker)} />
            {personUp && contents.sticker.hype !== null && (
              <span className="al-hype ph-no-capture">
                <img src={contents.sticker.hype.picture} alt="" className="al-hype-picture" />
                <span>
                  + <span className="al-emoji-name">:{contents.sticker.hype.name}:</span> unlocked
                </span>
                {ended && <FindInSlackWhileOn emoji={contents.sticker.hype} />}
              </span>
            )}
          </CardSlot>
        )}
        {contents.hoggie !== null && (
          <CardSlot label={hoggieUp ? `${contents.hoggie.name}, ${rarityWordOf(contents.hoggie.rarity)}` : "The hoggie card, face down"} up={hoggieUp} rarity={contents.hoggie.rarity} glow={beat === "glow" ? contents.hoggie.rarity : null} flourish={celebrating && beat === "hoggie"} back={<CardBack />}>
            <HoggieCard hoggie={contents.hoggie} />
            {celebrating && beat === "hoggie" && sparkles > 0 && <Sparkles count={sparkles} seed={contents.pack.earnedAt % 7919} />}
          </CardSlot>
        )}
      </div>
      <div className="al-turn-caption" key={beat}>
        <Caption contents={contents} beat={beat} />
        {ended ? <EndActions waitingAfter={waitingAfter} disabled={flying} onFinish={onFinish} onPutAllIn={onPutAllIn} /> : <TurnActions contents={contents} beat={beat} onTurn={onTurn} onSkip={onSkip} />}
      </div>
    </div>
  );
}

type CardSlotProps = { label: string; up: boolean; rarity?: Rarity; glow: Rarity | null; flourish: boolean; back: ReactNode; children: ReactNode };

function CardSlot({ label, up, rarity, glow, flourish, back, children }: CardSlotProps) {
  return (
    <div role="group" aria-label={label} className="al-slot" data-face-up={up ? "" : undefined} data-rarity={rarity} data-glow={glow ?? undefined}>
      {flourish && up && <Ring />}
      <span className="al-fly-x">
        <span className="al-fly-y">
          <span className="al-flip" data-flipped={up ? "" : undefined}>
            <span className="al-flip-face al-flip-back" aria-hidden={up || undefined}>
              {back}
            </span>
            <span className="al-flip-face al-flip-front" aria-hidden={!up || undefined}>
              {children}
              {flourish && up && <Shine />}
            </span>
          </span>
        </span>
      </span>
    </div>
  );
}

function Caption({ contents, beat }: { contents: PackContents; beat: Beat }) {
  const completed = completedTeamOf(contents);
  const ended = beat === lastBeatOf(contents);
  if (beat === "stack") return <p className="al-opening-title">{holdsTwoCards(contents) ? "Two cards inside" : "One card inside"}</p>;
  if (beat === "glow" && contents.hoggie !== null) return <p className="al-opening-title al-glow-words">Something {rarityWordOf(contents.hoggie.rarity).toLowerCase()}…</p>;
  return (
    <>
      {completed !== null && <p className="al-complete-banner">Team complete! · {completed.name}</p>}
      {beat === "person" && contents.sticker !== null && (
        <>
          <p className="al-opening-title">
            <span className="al-new-tag">New card</span> <span className="ph-no-capture">{contents.thanked.name ?? "Your teammate"}</span>
          </p>
          <TeamLines contents={contents} />
        </>
      )}
      {ended && contents.hoggie !== null && (
        <>
          <p className="al-opening-title">
            <span className="al-new-tag">{contents.hoggie.isNew ? "New hoggie" : "Spare"}</span> {contents.hoggie.name} · {rarityWordOf(contents.hoggie.rarity)}
          </p>
          {contents.xp > 0 && <p className="al-opening-xp">{`+${contents.xp} XP`}</p>}
          <p className="al-opening-hint">Your cards wait in the tray at the top until you put them in.</p>
        </>
      )}
    </>
  );
}

function holdsTwoCards({ sticker, hoggie }: PackContents) {
  return sticker !== null && hoggie !== null;
}

function TeamLines({ contents }: { contents: PackContents }) {
  const teams = contents.sticker?.teams ?? [];
  if (teams.length === 0) return null;
  return (
    <ul className="al-team-lines">
      {teams.map((team) => (
        <li key={team.team} data-complete={team.completes ? "" : undefined}>
          {team.name} {team.before}/{team.total} → {team.after}/{team.total}
        </li>
      ))}
    </ul>
  );
}

function TurnActions({ contents, beat, onTurn, onSkip }: { contents: PackContents; beat: Beat; onTurn: () => void; onSkip: () => void }) {
  return (
    <div className="al-opening-actions">
      <button type="button" className="al-opening-button" data-primary="" onClick={onTurn} autoFocus>
        {turnWordsOf(contents, beat)}
      </button>
      <button type="button" className="al-opening-button" onClick={onSkip}>
        Skip
      </button>
    </div>
  );
}

function turnWordsOf(contents: PackContents, beat: Beat) {
  if (beat === "stack") return holdsTwoCards(contents) ? "Turn the first card" : "Turn the card";
  if (beat === "glow") return "Turn the hoggie";
  return "Next card";
}

function EndActions({ waitingAfter, disabled, onFinish, onPutAllIn }: { waitingAfter: number; disabled: boolean; onFinish: (next: boolean) => void; onPutAllIn: () => void }) {
  if (waitingAfter === 0)
    return (
      <div className="al-opening-actions">
        <button type="button" className="al-opening-button" data-primary="" onClick={() => onFinish(false)} disabled={disabled} autoFocus>
          Done
        </button>
        <button type="button" className="al-opening-button" onClick={onPutAllIn} disabled={disabled}>
          Put them all in
        </button>
      </div>
    );
  return (
    <div className="al-opening-actions">
      <button type="button" className="al-opening-button" data-primary="" onClick={() => onFinish(true)} disabled={disabled} autoFocus>
        Open next pack · {waitingAfter} left
      </button>
      <button type="button" className="al-opening-button" onClick={() => onFinish(false)} disabled={disabled}>
        Done for now
      </button>
    </div>
  );
}

function UpNext({ album, waiting, disabled, onPick }: { album: Album; waiting: WaitingPack[]; disabled: boolean; onPick: (pack: WaitingPack) => void }) {
  return (
    <aside className="al-up-next" aria-label="Up next">
      <h2 className="al-up-next-title">Up next</h2>
      <ul>
        {waiting.slice(0, 4).map((pack) => (
          <li key={pack.pack}>
            <button type="button" className="al-up-next-pack" aria-label={`Open the pack for thanking ${thankedFor(album, pack).name ?? "a teammate"}`} onClick={() => onPick(pack)} disabled={disabled}>
              <PackWrapper thanked={thankedFor(album, pack)} size="mini" />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function useHeld() {
  const [held, setHeld] = useState<Held>(unheld);
  const hold = useCallback((patch: Partial<Held>) => setHeld((current) => ({ ...current, ...patch })), []);
  const release = useCallback(() => setHeld(unheld), []);
  return { held, hold, release };
}
