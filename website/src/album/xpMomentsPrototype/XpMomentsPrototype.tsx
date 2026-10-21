// PROTOTYPE (Silthus/personal#98), throwaway, never merged: how XP moments feel when a member comes back.
// Three variants on the album's home, switchable with ?variant=A|B|C and the floating prototype bar:
// A "Centre stage" (dim page, excerpts rise to the centre as a deck), B "Away feed" (a Slack-like column fills in),
// C "Under the bar" (no dimming, toasts drop under the XP bar and get pulled into it).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "../../reducedMotion";
import { HedgehogSitting } from "../../hoggies";
import type { Album } from "../answer";
import { paceKeys, paces, partsOf, scenarioKeys, scenarios, type Excerpt } from "./moments";
import { ScatterSequence } from "./Scatter";
import { useRun, type Beat, type Run } from "./sequence";
import "./xpMoments.css";

const variants = [
  { key: "G", name: "Orb & crumble · ring" },
  { key: "H", name: "Orb & crumble · heap" },
  { key: "D", name: "Scatter & poof" },
  { key: "E", name: "XP orb" },
  { key: "F", name: "Wall & crumble" },
  { key: "A", name: "r1 · Centre stage" },
  { key: "B", name: "r1 · Away feed" },
  { key: "C", name: "r1 · Under the bar" },
] as const;

type VariantKey = (typeof variants)[number]["key"];

type Settings = { variant: VariantKey; scenario: string; pace: string; motion: "full" | "reduced" };

const on = Boolean(import.meta.env.VITE_SHELL_FIXTURE);

export const useXpMomentsPrototype = on ? usePrototype : (album: Album) => ({ album, moving: false, overlay: null as ReactNode });

function settingsFromTheAddress(): Settings {
  const search = new URLSearchParams(window.location.search);
  const variant = variants.find(({ key }) => key === search.get("variant"))?.key ?? "G";
  const scenario = scenarioKeys.includes(search.get("scenario") ?? "") ? search.get("scenario")! : "busy";
  const pace = paceKeys.includes(search.get("pace") ?? "") ? search.get("pace")! : "brisk";
  const motion = search.get("motion") === "reduced" ? "reduced" : "full";
  return { variant, scenario, pace, motion };
}

function usePrototype(album: Album) {
  const [settings, setSettings] = useState(settingsFromTheAddress);
  const [replays, setReplays] = useState(0);
  const change = useCallback((next: Partial<Settings>) => {
    setSettings((before) => {
      const after = { ...before, ...next };
      const search = new URLSearchParams(window.location.search);
      Object.entries(after).forEach(([key, value]) => search.set(key, value));
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${search}${window.location.hash}`);
      return after;
    });
    setReplays((count) => count + 1);
  }, []);
  const [shown, setShown] = useState<{ level: Album["level"]; moving: boolean }>({ level: album.level, moving: false });
  const runKey = `${settings.variant}:${settings.scenario}:${settings.pace}:${settings.motion}:${replays}`;
  const overlay = (
    <>
      <Sequence key={runKey} album={album} settings={settings} onShown={setShown} />
      <PrototypeBar settings={settings} onChange={change} onReplay={() => setReplays((count) => count + 1)} />
    </>
  );
  return { album: { ...album, level: shown.level }, moving: shown.moving, overlay };
}

type SequenceProps = { album: Album; settings: Settings; onShown: (shown: { level: Album["level"]; moving: boolean }) => void };

function Sequence({ album, settings, onShown }: SequenceProps) {
  const reduced = settings.motion === "reduced" || prefersReducedMotion();
  if (settings.variant === "D" || settings.variant === "E" || settings.variant === "F" || settings.variant === "G" || settings.variant === "H") return <ScatterSequence variant={settings.variant} scenario={scenarios[settings.scenario]!} pace={paces[settings.pace]!} reduced={reduced} me={album.me.name} onShown={onShown} />;
  return <BeatSequence album={album} settings={settings} onShown={onShown} reduced={reduced} />;
}

function BeatSequence({ album, settings, onShown, reduced }: SequenceProps & { reduced: boolean }) {
  const scenario = scenarios[settings.scenario]!;
  const run = useRun(scenario, paces[settings.pace]!, reduced);
  const [closed, setClosed] = useState<"open" | "later" | "board">("open");
  useLayoutEffect(() => onShown({ level: run.level, moving: run.moving }), [run.level.xp, run.level.level, run.moving]);
  useEscapeSkips(closed === "open" && !run.done, run.skip);
  useEffect(() => publishState(run, scenario.lastVisit, closed));
  if (closed === "board") return <HandoffBoard count={scenario.items} onClose={() => setClosed("later")} />;
  if (closed === "later" || run.beats.length === 0) return null;
  const props: VariantProps = { run, me: album.me.name, reduced, lastVisit: scenario.lastVisit, onTurn: () => setClosed("board"), onLater: () => setClosed("later") };
  if (settings.variant === "B") return <AwayFeed {...props} />;
  if (settings.variant === "C") return <UnderTheBar {...props} />;
  return <CentreStage {...props} />;
}

function useEscapeSkips(active: boolean, skip: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, skip]);
}

let stateLine = "";

export function publishLine(line: string) {
  stateLine = line;
  window.dispatchEvent(new Event("xpm-state"));
}

function publishState(run: Run, lastVisit: string, closed: string) {
  const beat = run.beats[run.at];
  const what = run.at < 0 ? "page settling" : beat ? beatName(beat) : "none";
  const visit = run.done ? (run.skipped ? "moved on skip" : "moved on end") : `still ${lastVisit}`;
  publishLine(`beat ${Math.max(0, run.at + 1)}/${run.beats.length} · ${what} · XP ${run.level.xp} · level ${run.level.level} · last visit ${visit}${closed === "open" ? "" : ` · ${closed}`}`);
}

function beatName(beat: Beat) {
  if (beat.kind === "excerpt") return beat.excerpt.label;
  if (beat.kind === "fold") return `+${beat.count} more`;
  return `${beat.count} items wait`;
}

type VariantProps = { run: Run; me: string; reduced: boolean; lastVisit: string; onTurn: () => void; onLater: () => void };

function totalsOf(run: Run) {
  return run.beats.reduce(
    (sum, beat) => {
      if (beat.kind === "excerpt" && beat.excerpt.kind !== "level") return { count: sum.count + 1, xp: sum.xp + beat.excerpt.xp };
      if (beat.kind === "fold") return { count: sum.count + beat.count, xp: sum.xp + beat.xp };
      return sum;
    },
    { count: 0, xp: 0 },
  );
}

// ---------- Variant A: Centre stage ----------

function CentreStage({ run, me, reduced, onTurn, onLater }: VariantProps) {
  const last = run.beats.length - 1;
  const items = run.beats[last]?.kind === "items" ? run.beats[last] : null;
  return (
    <div className="xpm-stage" data-reduced={reduced ? "" : undefined} onClick={run.done ? undefined : run.advance} role="dialog" aria-label="Since your last visit">
      {!run.done && <SkipButton onSkip={run.skip} className="xpm-stage-skip" />}
      <div className="xpm-deck">
        {run.beats.map((beat, index) => {
          if (beat.kind === "items" || index > run.at) return null;
          const age = run.done ? 9 : run.at - index;
          return (
            <div key={index} className="xpm-deck-card" data-age={Math.min(age, 4)}>
              {beat.kind === "excerpt" ? <ExcerptCard excerpt={beat.excerpt} me={me} chip={run.chip(index)} /> : <FoldLine beat={beat} chip={run.chip(index)} />}
            </div>
          );
        })}
        {run.done && items && (
          <div className="xpm-stage-items" onClick={(event) => event.stopPropagation()}>
            <Summary run={run} />
            <ItemBacks count={items.count} />
            <p className="xpm-items-words">{itemsWords(items.count)}</p>
            <div className="xpm-actions">
              {items.count > 0 && (
                <button type="button" className="xpm-primary" onClick={onTurn} autoFocus>
                  Turn them over
                </button>
              )}
              <button type="button" className="xpm-quiet" onClick={onLater}>
                {items.count > 0 ? "Later" : "Back to the album"}
              </button>
            </div>
          </div>
        )}
      </div>
      {!run.done && <p className="xpm-hint">Click for the next one · Esc skips</p>}
    </div>
  );
}

// ---------- Variant B: Away feed ----------

function AwayFeed({ run, me, reduced, lastVisit, onTurn, onLater }: VariantProps) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [run.at, reduced]);
  const last = run.beats.length - 1;
  const items = run.beats[last]?.kind === "items" ? run.beats[last] : null;
  return (
    <aside className="xpm-feed" data-reduced={reduced ? "" : undefined} aria-label="While you were away">
      <header className="xpm-feed-head">
        <div>
          <p className="xpm-feed-title">While you were away</p>
          <p className="xpm-feed-since">Since {lastVisit}</p>
        </div>
        {!run.done ? <SkipButton onSkip={run.skip} /> : <button type="button" className="xpm-quiet" onClick={onLater} aria-label="Close">✕</button>}
      </header>
      <ol ref={list} className="xpm-feed-list" onClick={run.done ? undefined : run.advance}>
        {run.beats.map((beat, index) => {
          if (beat.kind === "items" || index > run.at) return null;
          return (
            <li key={index} className="xpm-feed-row" data-current={index === run.at && !run.done ? "" : undefined}>
              {beat.kind === "excerpt" ? <ExcerptCard excerpt={beat.excerpt} me={me} chip={run.chip(index)} flat /> : <FoldLine beat={beat} chip={run.chip(index)} />}
            </li>
          );
        })}
      </ol>
      {run.done && items && (
        <footer className="xpm-feed-foot">
          <Summary run={run} />
          <div className="xpm-feed-items">
            <ItemBacks count={items.count} small />
            <p className="xpm-items-words">{itemsWords(items.count)}</p>
            {items.count > 0 && (
              <button type="button" className="xpm-primary" onClick={onTurn} autoFocus>
                Turn them over
              </button>
            )}
          </div>
        </footer>
      )}
    </aside>
  );
}

// ---------- Variant C: Under the bar ----------

function UnderTheBar({ run, me, reduced, onTurn, onLater }: VariantProps) {
  const left = useXpBarLeft();
  const last = run.beats.length - 1;
  const items = run.beats[last]?.kind === "items" ? run.beats[last] : null;
  const style = { "--xpm-left": `${left}px` } as CSSProperties;
  return (
    <div className="xpm-under" style={style} data-reduced={reduced ? "" : undefined}>
      {!run.done &&
        run.beats.map((beat, index) => {
          if (beat.kind === "items" || index !== run.at) return null;
          return (
            <div key={index} className="xpm-toast" data-landed={run.landed.has(index) ? "" : undefined} onClick={run.advance}>
              {beat.kind === "excerpt" ? <ExcerptCard excerpt={beat.excerpt} me={me} chip={run.chip(index)} compact /> : <FoldLine beat={beat} chip={run.chip(index)} />}
              <div className="xpm-toast-foot">
                <span>
                  {index + 1} of {run.beats.length - 1}
                </span>
                <SkipButton onSkip={run.skip} />
              </div>
            </div>
          );
        })}
      {run.done && items && (
        <div className="xpm-under-items">
          <ItemBacks count={items.count} small />
          <div>
            <p className="xpm-items-words">{itemsWords(items.count)}</p>
            <Summary run={run} />
          </div>
          {items.count > 0 && (
            <button type="button" className="xpm-primary" onClick={onTurn}>
              Turn them over →
            </button>
          )}
          <button type="button" className="xpm-quiet" onClick={onLater} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function useXpBarLeft() {
  const [left, setLeft] = useState(16);
  useLayoutEffect(() => {
    const measure = () => setLeft(Math.max(8, document.querySelector(".al-xp")?.getBoundingClientRect().left ?? 16));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return left;
}

// ---------- Shared pieces ----------

export function ExcerptCard({ excerpt, me, chip, flat = false, compact = false }: { excerpt: Excerpt; me: string; chip: (element: HTMLElement | null) => void; flat?: boolean; compact?: boolean }) {
  return (
    <article className="xpm-excerpt" data-kind={excerpt.kind} data-flat={flat ? "" : undefined} data-compact={compact ? "" : undefined}>
      <p className="xpm-excerpt-label">{excerpt.label}</p>
      <div className="xpm-message">
        <Avatar excerpt={excerpt} me={me} />
        <div className="xpm-message-body">
          <p className="xpm-message-head">
            <strong>{excerpt.who === "You" ? me : excerpt.who}</strong>
            {excerpt.kind === "level" && <span className="xpm-app-tag">APP</span>}
            <span className="xpm-message-meta">
              {excerpt.when} · {excerpt.where}
            </span>
          </p>
          <p className="xpm-message-text">
            {partsOf(excerpt.text).map((part, index) =>
              part.kind === "mention" ? (
                <span key={index} className="xpm-mention">
                  @{part.value === "@you" ? me : part.value.slice(1)}
                </span>
              ) : part.kind === "emoji" ? (
                <span key={index} className="xpm-emoji">
                  {part.value}
                </span>
              ) : (
                part.value
              ),
            )}
          </p>
          {excerpt.hugs !== undefined && (
            <p className="xpm-reactions">
              <span className="xpm-reaction">🤗 {excerpt.hugs}</span>
            </p>
          )}
        </div>
      </div>
      {excerpt.xp > 0 && (
        <span ref={chip} className="xpm-chip" title={excerpt.xpWhy}>
          +{excerpt.xp} XP{excerpt.xpWhy && !compact ? <small> {excerpt.xpWhy}</small> : null}
        </span>
      )}
    </article>
  );
}

function Avatar({ excerpt, me }: { excerpt: Excerpt; me: string }) {
  if (excerpt.kind === "level")
    return (
      <span className="xpm-avatar xpm-avatar-app">
        <HedgehogSitting size={26} />
      </span>
    );
  const initials = excerpt.who === "You" ? initialsOf(me) : excerpt.initials;
  return (
    <span className="xpm-avatar" data-tone={excerpt.who === "You" ? 0 : excerpt.tone}>
      {initials}
    </span>
  );
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function FoldLine({ beat, chip }: { beat: Extract<Beat, { kind: "fold" }>; chip: (element: HTMLElement | null) => void }) {
  return (
    <div className="xpm-fold">
      <span className="xpm-fold-faces">
        {beat.initials.map((initials, index) => (
          <span key={initials} className="xpm-avatar xpm-avatar-small" data-tone={index + 1}>
            {initials}
          </span>
        ))}
      </span>
      <span className="xpm-fold-words">+{beat.count} more kudos and hugs</span>
      <span ref={chip} className="xpm-chip">
        +{beat.xp} XP
      </span>
    </div>
  );
}

export function Summary({ run }: { run: Run }) {
  const { count, xp } = totalsOf(run);
  if (count === 0) return <p className="xpm-summary">Nothing new in Slack since your last visit.</p>;
  return (
    <p className="xpm-summary">
      Since your last visit: {count} {count === 1 ? "moment" : "moments"} · <strong>+{xp} XP</strong>
    </p>
  );
}

export function itemsWords(count: number) {
  if (count === 0) return "No items wait";
  return count === 1 ? "1 item waits" : `${count} items wait`;
}

function ItemBacks({ count, small = false }: { count: number; small?: boolean }) {
  return (
    <span className="xpm-backs" data-small={small ? "" : undefined} aria-hidden="true">
      {Array.from({ length: Math.min(count, 3) }, (_, index) => (
        <span key={index} className="xpm-back" style={{ "--i": index } as CSSProperties}>
          ?
        </span>
      ))}
    </span>
  );
}

function SkipButton({ onSkip, className = "" }: { onSkip: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`xpm-skip ${className}`}
      onClick={(event) => {
        event.stopPropagation();
        onSkip();
      }}
    >
      Skip
    </button>
  );
}

export function HandoffBoard({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="xpm-board" role="dialog" aria-label="Your items">
      <div className="xpm-board-card">
        <p className="xpm-board-eyebrow">Hand-off</p>
        <h2 className="xpm-board-title">{itemsWords(count)}</h2>
        <div className="xpm-board-items">
          {Array.from({ length: count }, (_, index) => (
            <span key={index} className="xpm-back xpm-back-big">
              ?
            </span>
          ))}
        </div>
        <p className="xpm-board-note">The item board is its own prototype. This is where it takes over.</p>
        <button type="button" className="xpm-quiet" onClick={onClose} autoFocus>
          Back to the album
        </button>
      </div>
    </div>
  );
}

// ---------- Prototype bar ----------

function PrototypeBar({ settings, onChange, onReplay }: { settings: Settings; onChange: (next: Partial<Settings>) => void; onReplay: () => void }) {
  const index = variants.findIndex(({ key }) => key === settings.variant);
  const cycle = useCallback((step: number) => onChange({ variant: variants[(index + step + variants.length) % variants.length]!.key }), [index, onChange]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") cycle(-1);
      if (event.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);
  const state = useStateLine();
  const variant = variants[index]!;
  return (
    <div className="xpm-bar" aria-label="Prototype controls">
      <div className="xpm-bar-row">
        <button type="button" onClick={() => cycle(-1)} aria-label="Previous variant">
          ‹
        </button>
        <span className="xpm-bar-variant">
          {variant.key} · {variant.name}
        </span>
        <button type="button" onClick={() => cycle(1)} aria-label="Next variant">
          ›
        </button>
        <select value={settings.scenario} onChange={(event) => onChange({ scenario: event.target.value })} aria-label="Scenario">
          {scenarioKeys.map((key) => (
            <option key={key} value={key}>
              {scenarios[key]!.name}
            </option>
          ))}
        </select>
        <select value={settings.pace} onChange={(event) => onChange({ pace: event.target.value })} aria-label="Pace">
          {paceKeys.map((key) => (
            <option key={key} value={key}>
              {paces[key]!.name}
            </option>
          ))}
        </select>
        <select value={settings.motion} onChange={(event) => onChange({ motion: event.target.value as Settings["motion"] })} aria-label="Motion">
          <option value="full">Full motion</option>
          <option value="reduced">Reduced motion</option>
        </select>
        <button type="button" onClick={onReplay}>
          ↻ Replay
        </button>
      </div>
      <p className="xpm-bar-state">{state}</p>
    </div>
  );
}

function useStateLine() {
  const [line, setLine] = useState(stateLine);
  useEffect(() => {
    const onState = () => setLine(stateLine);
    window.addEventListener("xpm-state", onState);
    return () => window.removeEventListener("xpm-state", onState);
  }, []);
  return line;
}
