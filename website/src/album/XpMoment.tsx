import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { Message, Person } from "../../../convex/activity/entries";
import type { XpMoment } from "../../../convex/website/xpMoment";
import { KudosMessage } from "../activity/KudosMessage";
import type { AlbumMe } from "./answer";
import type { EmojisOnTheirWay } from "./emojisOnTheirWay";
import type { LevelUnlocks } from "./levelUnlocks";
import { LevelUpTakeover } from "./LevelUpTakeover";
import { SlackMessage, SlackReaction, SlackText } from "./SlackMessage";
import { xpMomentTiming, type XpMomentPhase, type XpMomentPlay } from "./useXpMoment";
import { columnsOf, isNarrow, type Viewport } from "./xpMomentLayout";
import { barEnd, centreOf, clearParticles, dustInto, streamInto } from "./xpMomentParticles";
import "./xpMoment.css";

type Excerpt = XpMoment["excerpts"][number];

type Entry = Excerpt["entry"];

const leastTeammatesShown = 3;

const collecting: ReadonlySet<XpMomentPhase> = new Set(["arrive", "hold"]);

const orbShown: ReadonlySet<XpMomentPhase> = new Set(["arrive", "hold", "collect", "stream"]);

export function XpMomentCanvas({ play, me, levelUnlocks, onTheirWay }: { play: XpMomentPlay; me: AlbumMe; levelUnlocks: LevelUnlocks | null; onTheirWay: EmojisOnTheirWay }) {
  const { moment, phase, skip, tookOver } = play;
  const viewport = useViewport();
  const orb = useRef<HTMLButtonElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  useParticles(play, cards, orb);
  return (
    <div className="xpm-canvas" role="dialog" aria-modal="true" aria-label="Since your last visit" style={{ "--xpm-top": `${viewport.top}px` } as CSSProperties} data-phase={phase} data-narrow={isNarrow(viewport) ? "" : undefined}>
      {orbShown.has(phase) && <Orb play={play} orb={orb} />}
      {orbShown.has(phase) && <Cards play={play} me={me} viewport={viewport} cards={cards} orb={orb} />}
      {orbShown.has(phase) && (
        <button type="button" className="xpm-skip" onClick={skip}>
          Skip
        </button>
      )}
      {phase === "takeover" && levelUnlocks !== null && <LevelUpTakeover climb={moment.climb} unlocks={levelUnlocks} onTheirWay={onTheirWay} onDone={tookOver} />}
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

type CardsProps = { play: XpMomentPlay; me: AlbumMe; viewport: Viewport; cards: RefObject<Map<string, HTMLElement>>; orb: RefObject<HTMLButtonElement | null> };

function Cards({ play: { cards, out, dissolving, dissolved, moment }, me, viewport, cards: elements, orb }: CardsProps) {
  const keep = (key: string) => (element: HTMLElement | null) => void (element === null ? elements.current.delete(key) : elements.current.set(key, element));
  return (
    <div className="xpm-board">
      {columnsOf(cards, viewport).map((column, side) => (
        <div key={side} className="xpm-column">
          {column.map(({ item: card, index }) => (
            <Card key={card.key} shown={index < out && index >= dissolved} dissolving={index < dissolving} orb={orb} keep={keep(card.key)}>
              {card.kind === "fold" ? <FoldLine count={card.count} xp={card.xp} /> : <ExcerptCard excerpt={card.excerpt} me={me} timeZone={moment.timeZone} />}
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}

type CardProps = { shown: boolean; dissolving: boolean; orb: RefObject<HTMLButtonElement | null>; keep: (element: HTMLElement | null) => void; children: ReactNode };

function Card({ shown, dissolving, orb, keep, children }: CardProps) {
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (shown && card.current !== null && orb.current !== null) flyFrom(card.current, centreOf(orb.current));
  }, [shown, orb]);
  const holdBoth = (element: HTMLDivElement | null) => {
    card.current = element;
    keep(element);
  };
  return (
    <div ref={holdBoth} className="xpm-card" data-shown={shown ? "" : undefined} data-dissolving={dissolving ? "" : undefined} aria-hidden={!shown} inert={!shown}>
      {children}
    </div>
  );
}

function flyFrom(card: HTMLElement, from: { x: number; y: number }) {
  const at = centreOf(card);
  card.style.setProperty("--from-x", `${from.x - at.x}px`);
  card.style.setProperty("--from-y", `${from.y - at.y}px`);
}

function Orb({ play: { phase, orbXp, moment, collect }, orb }: { play: XpMomentPlay; orb: RefObject<HTMLButtonElement | null> }) {
  const mystery = collecting.has(phase);
  return (
    <button ref={orb} type="button" autoFocus className="xpm-orb" aria-label={mystery ? "Collect your XP" : `Collect your XP, +${orbXp} of ${moment.xp} XP`} data-phase={phase} data-launch={phase === "stream" ? "" : undefined} onClick={collect}>
      <span className="xpm-orb-xp">{mystery ? "?" : `+${orbXp}`}</span>
      <span className="xpm-orb-unit">XP</span>
      {mystery && <span className="xpm-orb-hint">Tap to collect</span>}
    </button>
  );
}

function ExcerptCard({ excerpt: { entry, xp }, me, timeZone }: { excerpt: Excerpt; me: AlbumMe; timeZone: string | null }) {
  const label = labelOf(entry);
  return (
    <article className="xpm-excerpt" aria-label={label} data-kind={entry.kind}>
      <div className="xpm-excerpt-top">
        <p className="xpm-excerpt-label">{label}</p>
        {xp > 0 && <span className="xpm-chip">+{xp} XP</span>}
      </div>
      <SlackMessage sender={senderOf(entry, me)} at={whenOf(entry.at, timeZone)}>
        <ExcerptWords entry={entry} me={me} />
        {entry.kind === "hugReceived" && <SlackReaction emoji={entry.emoji} image={entry.emojiImage} count={entry.hugs} />}
      </SlackMessage>
    </article>
  );
}

function ExcerptWords({ entry, me }: { entry: Entry; me: AlbumMe }): ReactNode {
  if (entry.kind === "levelUp") return <SlackText>You reached level {entry.level}!</SlackText>;
  const message = messageOf(entry);
  if (message === null) return null;
  return (
    <SlackText>
      <KudosMessage message={message} look="slack" me={me} />
    </SlackText>
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
