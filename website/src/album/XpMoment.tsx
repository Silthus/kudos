import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { Message, Person } from "../../../convex/activity/entries";
import type { XpMoment } from "../../../convex/website/xpMoment";
import { KudosMessage } from "../activity/KudosMessage";
import { NamedEmoji } from "../Emoji";
import { HedgehogSitting } from "../hoggies";
import type { AlbumMe } from "./answer";
import type { LevelUnlocks } from "./levelUnlocks";
import { LevelUpTakeover } from "./LevelUpTakeover";
import { xpMomentTiming, type XpMomentCard, type XpMomentPhase, type XpMomentPlay } from "./useXpMoment";
import { isPhone, orbSpotOf, spotsOf, type Viewport } from "./xpMomentLayout";
import { barEnd, centreOf, clearParticles, dustInto, streamInto } from "./xpMomentParticles";
import "./xpMoment.css";

type Excerpt = XpMoment["excerpts"][number];

type Entry = Excerpt["entry"];

const leastTeammatesShown = 3;

const collecting: ReadonlySet<XpMomentPhase> = new Set(["arrive", "hold"]);

const orbShown: ReadonlySet<XpMomentPhase> = new Set(["arrive", "hold", "collect", "stream"]);

export function XpMomentCanvas({ play, me, levelUnlocks }: { play: XpMomentPlay; me: AlbumMe; levelUnlocks: LevelUnlocks | null }) {
  const { moment, phase, collect, skip, tookOver } = play;
  const viewport = useViewport();
  const orb = useRef<HTMLButtonElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  useParticles(play, cards, orb);
  return (
    <div className="xpm-canvas" role="dialog" aria-modal="true" aria-label="Since your last visit" style={{ "--xpm-top": `${viewport.top}px` } as CSSProperties} data-phase={phase} data-narrow={isPhone(viewport) ? "" : undefined} onClick={collecting.has(phase) ? collect : undefined}>
      {orbShown.has(phase) && <Cards play={play} me={me} viewport={viewport} cards={cards} />}
      {orbShown.has(phase) && <Orb play={play} viewport={viewport} orb={orb} />}
      {orbShown.has(phase) && (
        <button type="button" className="xpm-skip" onClick={(event) => (event.stopPropagation(), skip())}>
          Skip
        </button>
      )}
      {phase === "takeover" && levelUnlocks !== null && <LevelUpTakeover climb={moment.climb} unlocks={levelUnlocks} onDone={tookOver} />}
      {phase === "caughtUp" && <CaughtUp moment={moment} />}
    </div>
  );
}

export function XpMomentSummary({ moment: { xp, moments, since, timeZone, thoughtfulGivers } }: { moment: XpMoment }) {
  return (
    <div className="xpm-summary">
      {xp > 0 && (
        <p className="xpm-collected">
          <strong>+{xp} XP</strong> from {moments} {moments === 1 ? "moment" : "moments"} since {whenOf(since, timeZone)}
        </p>
      )}
      {thoughtfulGivers !== null && thoughtfulGivers >= leastTeammatesShown && <p className="xpm-norm">{thoughtfulGivers} teammates gave thoughtful kudos this week</p>}
    </div>
  );
}

function CaughtUp({ moment }: { moment: XpMoment }) {
  return (
    <div className="xpm-caught-up">
      <XpMomentSummary moment={moment} />
      <p className="xpm-caught-up-words">All caught up</p>
    </div>
  );
}

function Cards({ play: { cards, out, dissolving, dissolved, moment }, me, viewport, cards: elements }: { play: XpMomentPlay; me: AlbumMe; viewport: Viewport; cards: RefObject<Map<string, HTMLElement>> }) {
  const spots = spotsOf(cards.length, viewport);
  const from = orbSpotOf(viewport);
  const compact = isPhone(viewport);
  return cards.slice(0, out).map((card, index) => {
    if (index < dissolved) return null;
    const spot = spots[index]!;
    const style = { left: `${spot.x}px`, top: `${spot.y}px`, width: `${spot.width}px`, "--rot": `${spot.rot}deg`, "--from-x": `${from.x - spot.x}px`, "--from-y": `${from.y - spot.y}px` } as CSSProperties;
    return (
      <div key={card.key} className="xpm-card" style={style} data-dissolving={index < dissolving ? "" : undefined} ref={(element) => void (element === null ? elements.current.delete(card.key) : elements.current.set(card.key, element))}>
        <CardFace card={card} me={me} timeZone={moment.timeZone} compact={compact} />
      </div>
    );
  });
}

function CardFace({ card, me, timeZone, compact }: { card: XpMomentCard; me: AlbumMe; timeZone: string | null; compact: boolean }) {
  if (card.kind === "fold") return <FoldLine count={card.count} xp={card.xp} />;
  return <ExcerptCard excerpt={card.excerpt} me={me} timeZone={timeZone} compact={compact} />;
}

function Orb({ play: { phase, orbXp, moment, cards, collect }, viewport, orb }: { play: XpMomentPlay; viewport: Viewport; orb: RefObject<HTMLButtonElement | null> }) {
  const spot = orbSpotOf(viewport);
  const mystery = collecting.has(phase);
  const holdMs = xpMomentTiming.holdMs + xpMomentTiming.holdPerCardMs * cards.length;
  return (
    <button ref={orb} type="button" autoFocus className="xpm-orb" aria-label={mystery ? "Collect your XP" : `Collect your XP, +${orbXp} of ${moment.xp} XP`} data-phase={phase} data-launch={phase === "stream" ? "" : undefined} style={{ left: `${spot.x}px`, top: `${spot.y}px` }} onClick={(event) => (event.stopPropagation(), collect())}>
      <svg className="xpm-orb-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="56" pathLength={100} style={{ "--hold": `${holdMs}ms` } as CSSProperties} />
      </svg>
      <span className="xpm-orb-xp">{mystery ? "?" : `+${orbXp}`}</span>
      <span className="xpm-orb-unit">XP</span>
      {mystery && <span className="xpm-orb-hint">Tap to collect</span>}
    </button>
  );
}

function ExcerptCard({ excerpt: { entry, xp }, me, timeZone, compact }: { excerpt: Excerpt; me: AlbumMe; timeZone: string | null; compact: boolean }) {
  const label = labelOf(entry);
  const sender = senderOf(entry, me);
  return (
    <article className="xpm-excerpt" aria-label={label} data-kind={entry.kind} data-compact={compact ? "" : undefined}>
      <p className="xpm-excerpt-label">{label}</p>
      <div className="xpm-message">
        {sender === null ? <AppAvatar /> : <Avatar initials={sender.face.initials} />}
        <div className="xpm-message-body">
          <p className="xpm-message-head">
            <strong>{sender?.name ?? "HedgeHug"}</strong>
            {sender === null && <span className="xpm-app-tag">APP</span>}
            <span className="xpm-message-meta">{whenOf(entry.at, timeZone)}</span>
          </p>
          <ExcerptWords entry={entry} />
          {entry.kind === "hugReceived" && <Reaction emoji={entry.emoji} image={entry.emojiImage} count={entry.hugs} />}
        </div>
      </div>
      {xp > 0 && <span className="xpm-chip">+{xp} XP</span>}
    </article>
  );
}

function ExcerptWords({ entry }: { entry: Entry }): ReactNode {
  if (entry.kind === "levelUp") return <p className="xpm-message-text">You reached level {entry.level}!</p>;
  const message = messageOf(entry);
  if (message === null) return null;
  return (
    <div className="xpm-message-text">
      <KudosMessage message={message} clamped />
    </div>
  );
}

function FoldLine({ count, xp }: { count: number; xp: number }) {
  return (
    <div className="xpm-fold">
      <span className="xpm-fold-words">+{count} more kudos and hugs</span>
      <span className="xpm-chip">+{xp} XP</span>
    </div>
  );
}

function Reaction({ emoji, image, count }: { emoji: string; image?: string; count: number }) {
  return (
    <p className="xpm-reactions">
      <span className="xpm-reaction">
        <NamedEmoji name={emoji} image={image} /> {count}
      </span>
    </p>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="xpm-avatar" data-tone={toneOf(initials)} aria-hidden="true">
      {initials}
    </span>
  );
}

function AppAvatar() {
  return (
    <span className="xpm-avatar xpm-avatar-app" aria-hidden="true">
      <HedgehogSitting size={26} />
    </span>
  );
}

function labelOf(entry: Entry) {
  switch (entry.kind) {
    case "kudosReceived":
      return "Kudos for you";
    case "kudosGiven":
      return "Kudos you gave";
    case "hugReceived":
      return entry.hugs === 1 ? "1 hug on your message" : `${entry.hugs} hugs on your message`;
    case "hugGiven":
      return "A hug you gave";
    case "levelUp":
      return "Level up";
  }
}

function senderOf(entry: Entry, me: AlbumMe): Person | null {
  switch (entry.kind) {
    case "kudosReceived":
      return entry.giver;
    case "hugGiven":
      return entry.people[0] ?? me;
    case "levelUp":
      return null;
    default:
      return me;
  }
}

function messageOf(entry: Exclude<Entry, { kind: "levelUp" }>): Message | null {
  return entry.kind === "kudosReceived" || entry.kind === "kudosGiven" ? entry.message : entry.kudos;
}

function toneOf(initials: string) {
  return [...initials].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 4;
}

const formats = new Map<string, Intl.DateTimeFormat>();

function whenOf(at: number, timeZone: string | null) {
  const key = timeZone ?? "";
  const format = formats.get(key) ?? new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...(timeZone !== null && { timeZone }) });
  formats.set(key, format);
  return format.format(at).replace(",", "");
}

function useParticles({ cards, dissolving, phase }: XpMomentPlay, elements: RefObject<Map<string, HTMLElement>>, orb: RefObject<HTMLButtonElement | null>) {
  const dusted = useRef(0);
  useEffect(() => {
    const target = orb.current === null ? null : centreOf(orb.current);
    for (; dusted.current < dissolving; dusted.current += 1) {
      const card = elements.current.get(cards[dusted.current]?.key ?? "");
      if (card !== undefined && target !== null) dustInto(card, target, xpMomentTiming.sweepMs);
    }
  }, [dissolving, cards, elements, orb]);
  useEffect(() => {
    if (phase === "stream" && orb.current !== null) streamInto(orb.current, barEnd(), xpMomentTiming.streamMs);
  }, [phase, orb]);
  useEffect(() => clearParticles, []);
}

function topBarBottom() {
  return document.querySelector(".al-top")?.getBoundingClientRect().bottom ?? 0;
}

function viewportNow(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight, top: topBarBottom() };
}

function useViewport(): Viewport {
  const [viewport, setViewport] = useState(viewportNow);
  useLayoutEffect(() => setViewport(viewportNow()), []);
  useEffect(() => {
    const remeasure = () => setViewport(viewportNow());
    window.addEventListener("resize", remeasure);
    const bar = document.querySelector(".al-top");
    const barWatch = bar === null || typeof ResizeObserver === "undefined" ? null : new ResizeObserver(remeasure);
    if (bar !== null) barWatch?.observe(bar);
    return () => {
      window.removeEventListener("resize", remeasure);
      barWatch?.disconnect();
    };
  }, []);
  return viewport;
}
