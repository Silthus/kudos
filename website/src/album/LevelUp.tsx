import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AppLink } from "../AppLink";
import { AnswerPage, type Answers } from "../pages/AnswerPage";
import { LoadingPage } from "../pages/LoadingPage";
import { PageTitle } from "../PageTitle";
import { prefersReducedMotion } from "../reducedMotion";
import type { AlbumEmoji, AlbumLevelUp, CardHoggie, LevelUpShown } from "./answer";
import { EmojiPicture } from "./EmojiPicture";
import { earnedFromWords } from "./emojiShelf";
import { rarityWordOf, sparklesFor } from "./opening";
import { CardBack, CardSlot, Confetti, HoggieCard, Sparkles } from "./PackCards";
import { hrefOf } from "./place";
import "./opening.css";
import "./levelUp.css";

export const levelUpTiming = { burstMs: 1_200, turnMs: 650 };

const ordinals = ["first", "second", "third"];

const hoggiesHref = hrefOf({ kind: "hoggies", hoggie: null });

type LevelUpAnswerProps = { shown: LevelUpShown | undefined; onEmojisShown: (ids: string[]) => void } & Answers;

export function LevelUpAnswerPage({ shown, onEmojisShown, ...answers }: LevelUpAnswerProps) {
  if (shown === undefined) return <LoadingPage shape="column" />;
  if (shown.kind === "off") return <NoReveal line="Level-up reveals aren't open to you yet." />;
  if (shown.kind === "none") return <NoReveal line="There's no level up to reveal here." />;
  if (shown.kind !== "levelUp") return <AnswerPage answer={shown} {...answers} />;
  return <LevelUpReveal levelUp={shown} onEmojisShown={onEmojisShown} />;
}

export function isWaitingForTheLevelUp(shown: LevelUpShown | undefined) {
  return shown === undefined;
}

function NoReveal({ line }: { line: string }) {
  return (
    <div className="al-page-body">
      <PageTitle tab="Level up" size="hero">
        Nothing to reveal
      </PageTitle>
      <p className="al-lede">{line}</p>
      <WayOn />
    </div>
  );
}

function LevelUpReveal({ levelUp, onEmojisShown }: { levelUp: AlbumLevelUp; onEmojisShown: (ids: string[]) => void }) {
  const [reduced] = useState(prefersReducedMotion);
  const { turned, showAll } = useTurns(levelUp.hoggies.length, reduced);
  const ended = turned === levelUp.hoggies.length;
  const title = useFocusedOnArrival();
  return (
    <article className="al-page-body al-level-up" data-reduced={reduced ? "" : undefined}>
      <header className="al-level-up-burst">
        {!reduced && <Confetti size="gold" seed={levelUp.at % 9973} />}
        <p className="al-level-up-kicker">You reached</p>
        <h1 ref={title} tabIndex={-1} className="al-level-up-title">
          Level {levelUp.level}
        </h1>
        <p className="al-level-up-from">Reaching level {levelUp.level} brought you three hoggies</p>
      </header>
      <div className="al-level-up-cards">
        {levelUp.hoggies.map((hoggie, index) => (
          <TurningCard key={hoggie.hoggie + index} hoggie={hoggie} index={index} up={index < turned} emphasised={index === levelUp.hoggies.length - 1} flourish={!reduced && index === turned - 1} reduced={reduced} />
        ))}
      </div>
      <p role="status" className="al-sr">
        {ended ? broughtSaying(levelUp) : ""}
      </p>
      <div className="al-level-up-after" data-shown={ended ? "" : undefined}>
        {!ended && (
          <button type="button" className="al-level-up-skip" onClick={showAll}>
            Show them all
          </button>
        )}
        {ended && levelUp.emojis.length > 0 && <EarnedEmojis emojis={levelUp.emojis} onShown={onEmojisShown} />}
        {ended && <WayOn />}
      </div>
    </article>
  );
}

type TurningCardProps = { hoggie: CardHoggie; index: number; up: boolean; emphasised: boolean; flourish: boolean; reduced: boolean };

function TurningCard({ hoggie, index, up, emphasised, flourish, reduced }: TurningCardProps) {
  const sparkles = emphasised && up && !reduced ? sparklesFor(hoggie.rarity) : 0;
  return (
    <div className="al-level-up-card" data-emphasised={emphasised ? "" : undefined} style={{ "--card-index": index } as CSSProperties}>
      <CardSlot label={up ? `${hoggie.name}, ${rarityWordOf(hoggie.rarity)}` : `The ${ordinals[index] ?? "next"} hoggie card, face down`} up={up} rarity={hoggie.rarity} glow={null} flourish={flourish} back={<CardBack />}>
        <HoggieCard hoggie={hoggie} />
        {sparkles > 0 && <Sparkles count={sparkles} seed={index + 1} />}
      </CardSlot>
      {up && !hoggie.isNew && <p className="al-level-up-spare">Spare</p>}
    </div>
  );
}

function EarnedEmojis({ emojis, onShown }: { emojis: AlbumEmoji[]; onShown: (ids: string[]) => void }) {
  useShownOnce(emojis, onShown);
  return (
    <section className="al-level-up-emojis">
      <h2 className="al-level-up-emojis-title">New emojis from this level up</h2>
      <ul aria-label="New emojis from this level up" className="al-level-up-emoji-list">
        {emojis.map((emoji) => (
          <li key={emoji.id} className="al-level-up-emoji">
            <EmojiPicture emoji={emoji} size={56} />
            <span className="al-level-up-emoji-name ph-no-capture">:{emoji.name}:</span>
            <span className="al-level-up-emoji-from">{earnedFromWords(emoji)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WayOn() {
  return (
    <AppLink href={hoggiesHref} className="al-level-up-on">
      See all your hoggies
    </AppLink>
  );
}

function broughtSaying({ level, hoggies }: AlbumLevelUp) {
  const cards = hoggies.map(({ name, rarity, isNew }) => `${name}, ${rarityWordOf(rarity)}, ${isNew ? "new" : "a spare"}`);
  return `Level ${level} brought you ${[cards.slice(0, -1).join(", "), cards.at(-1)].filter(Boolean).join(", and ")}.`;
}

function useTurns(cards: number, reduced: boolean) {
  const [turned, setTurned] = useState(reduced ? cards : 0);
  useEffect(() => {
    if (turned >= cards) return;
    const timer = window.setTimeout(() => setTurned(turned + 1), turned === 0 ? levelUpTiming.burstMs : levelUpTiming.turnMs);
    return () => window.clearTimeout(timer);
  }, [turned, cards]);
  return { turned, showAll: () => setTurned(cards) };
}

function useFocusedOnArrival() {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = "HedgeHug · Level up";
    title.current?.focus({ preventScroll: true });
  }, []);
  return title;
}

function useShownOnce(emojis: AlbumEmoji[], onShown: (ids: string[]) => void) {
  const told = useRef(false);
  useEffect(() => {
    if (told.current) return;
    told.current = true;
    onShown(emojis.map(({ id }) => id));
  }, [emojis, onShown]);
}
