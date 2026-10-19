import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { prefersReducedMotion } from "../reducedMotion";
import type { Album, AlbumEmoji, SeenReply } from "./answer";
import { EmojiPicture } from "./EmojiPicture";
import { bundleSize, earnedFromWords, momentsOwedOf, whyWords } from "./emojiShelf";
import { keepFocusIn } from "./focusTrap";
import { MomentSlackLine } from "./MomentSlackLine";
import "./emoji.css";

export const emojiMomentTiming = { settleMs: 700, flightMs: 850, flightStaggerMs: 90, cardsRiseAfterMs: 700, cardStaggerMs: 110, cardRiseMs: 560 };

const momentPictureSize = 128;

const bundlePictureSize = 72;

export type EmojiMoments = { playing: AlbumEmoji[]; more: number; take: () => void; seeThemAll: () => void; shownElsewhere: (ids: string[]) => void };

export function useEmojiMoments(album: Album, waits: boolean, markEmojisSeen: (ids: string[]) => Promise<SeenReply>, showTheEmojis: (ids: string[]) => void): EmojiMoments {
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  const [playing, setPlaying] = useState<AlbumEmoji[]>([]);
  const owed = useMemo(() => momentsOwedOf(album, shown), [album, shown]);
  useEffect(() => {
    if (waits || playing.length > 0 || owed.length === 0) return;
    const timer = window.setTimeout(() => setPlaying(owed.slice(0, bundleSize)), emojiMomentTiming.settleMs);
    return () => window.clearTimeout(timer);
  }, [waits, playing, owed]);
  const shownElsewhere = useCallback(
    (ids: string[]) => {
      setShown((before) => new Set([...before, ...ids]));
      markEmojisSeen(ids).catch(() => undefined);
    },
    [markEmojisSeen],
  );
  const markShown = useCallback(
    (ids: string[]) => {
      shownElsewhere(ids);
      setPlaying([]);
    },
    [shownElsewhere],
  );
  const take = useCallback(() => markShown(playing.map(({ id }) => id)), [playing, markShown]);
  const seeThemAll = useCallback(() => {
    const ids = owed.map(({ id }) => id);
    markShown(ids);
    showTheEmojis(ids);
  }, [owed, markShown, showTheEmojis]);
  const more = owed.filter(({ id }) => !playing.some((emoji) => emoji.id === id)).length;
  return { playing, more, take, seeThemAll, shownElsewhere };
}

type EmojiMomentProps = { moments: EmojiMoments; emojiButton: RefObject<HTMLButtonElement | null> };

export function EmojiMoment({ moments, emojiButton }: EmojiMomentProps) {
  const { playing, more, take, seeThemAll } = moments;
  const described = useId();
  const [flying, setFlying] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  const dialog = useRef<HTMLDivElement>(null);
  const backToTheEmojis = useRef(false);
  const bundled = playing.length > 1;
  const revealed = useRevealedAfter(bundled && !reduced ? revealMsOf(playing.length) : 0);
  const [takeAsked, setTakeAsked] = useState(false);
  useFocusWhileShown(dialog, emojiButton, backToTheEmojis);

  const flyIn = useCallback(() => {
    if (flying) return;
    if (!revealed) return setTakeAsked(true);
    if (reduced) return take();
    setFlying(true);
    void flyAllInto(dialog.current, emojiButton.current).then(take);
  }, [flying, revealed, reduced, take, emojiButton]);

  useEffect(() => {
    if (revealed && takeAsked) flyIn();
  }, [revealed, takeAsked, flyIn]);

  const seeThemAllInTheEmojis = () => {
    backToTheEmojis.current = true;
    seeThemAll();
  };

  useEscapeTo(flyIn);

  const [only] = playing;
  if (only === undefined) return null;
  return (
    <div ref={dialog} tabIndex={-1} className="al-emoji-moment" role="dialog" aria-modal="true" aria-label={bundled ? "New emojis unlocked" : "New emoji unlocked"} aria-describedby={bundled ? `${described}-cards` : `${described}-name ${described}-why ${described}-use`} data-flying={flying ? "" : undefined} data-reduced={reduced ? "" : undefined} onClick={(event) => event.target === event.currentTarget && flyIn()} onKeyDown={(event) => event.key === "Tab" && keepFocusIn(dialog.current, event)}>
      <div className="al-emoji-moment-stage">
        {bundled ? <Bundle emojis={playing} more={more} described={described} reduced={reduced} flying={flying} onSeeThemAll={seeThemAllInTheEmojis} /> : <OneEmoji emoji={only} described={described} reduced={reduced} />}
        <div className="al-emoji-moment-actions">
          <button type="button" className="al-emoji-moment-take" onClick={flyIn}>
            Add to my emojis
          </button>
        </div>
      </div>
    </div>
  );
}

function OneEmoji({ emoji, described, reduced }: { emoji: AlbumEmoji; described: string; reduced: boolean }) {
  return (
    <div className="al-emoji-moment-card">
      <p className="al-emoji-moment-kicker">New emoji unlocked</p>
      <span className="al-emoji-moment-picture" data-flies="">
        {!reduced && <span className="al-emoji-moment-rays" aria-hidden="true" />}
        <EmojiPicture emoji={emoji} size={momentPictureSize} />
      </span>
      <h2 id={`${described}-name`} className="al-emoji-moment-name ph-no-capture">
        :{emoji.name}:
      </h2>
      <p id={`${described}-why`} className="al-emoji-moment-why ph-no-capture">
        {whyWords(emoji)}
      </p>
      <MomentSlackLine emoji={emoji} short={false} id={`${described}-use`} className="al-emoji-moment-use" />
    </div>
  );
}

type BundleProps = { emojis: AlbumEmoji[]; more: number; described: string; reduced: boolean; flying: boolean; onSeeThemAll: () => void };

function Bundle({ emojis, more, described, reduced, flying, onSeeThemAll }: BundleProps) {
  return (
    <div className="al-emoji-bundle">
      <h2 className="al-emoji-moment-kicker">{emojis.length + more} new emojis unlocked</h2>
      {!reduced && (
        <span className="al-emoji-bundle-wrapper" aria-hidden="true">
          <span className="al-emoji-bundle-tear" />
          <span className="al-emoji-bundle-brand">HedgeHug</span>
          <span className="al-emoji-bundle-kind">Emoji bundle</span>
        </span>
      )}
      <div className="al-emoji-bundle-row">
        <ul id={`${described}-cards`} className="al-emoji-bundle-cards" aria-label="Your new emojis">
          {emojis.map((emoji, index) => (
            <li key={emoji.id} className="al-emoji-bundle-card" style={cardRiseOf(index, reduced)}>
              <span className="al-emoji-bundle-picture" data-flies="">
                <EmojiPicture emoji={emoji} size={bundlePictureSize} />
              </span>
              <h3 className="al-emoji-bundle-name ph-no-capture">:{emoji.name}:</h3>
              <p className="al-emoji-bundle-from ph-no-capture">{earnedFromWords(emoji)}</p>
              <MomentSlackLine emoji={emoji} short className="al-emoji-bundle-slack" />
            </li>
          ))}
        </ul>
        {more > 0 && (
          <button type="button" className="al-emoji-bundle-card al-emoji-bundle-more" style={cardRiseOf(emojis.length, reduced)} onClick={onSeeThemAll} disabled={flying}>
            +{more} more
          </button>
        )}
      </div>
    </div>
  );
}

function revealMsOf(cards: number) {
  const { cardsRiseAfterMs, cardStaggerMs, cardRiseMs } = emojiMomentTiming;
  return cardsRiseAfterMs + (cards - 1) * cardStaggerMs + cardRiseMs;
}

function cardRiseOf(index: number, reduced: boolean): CSSProperties | undefined {
  if (reduced) return undefined;
  const { cardsRiseAfterMs, cardStaggerMs, cardRiseMs } = emojiMomentTiming;
  return { animationDelay: `${cardsRiseAfterMs + index * cardStaggerMs}ms`, animationDuration: `${cardRiseMs}ms` };
}

function useRevealedAfter(ms: number) {
  const [revealed, setRevealed] = useState(ms === 0);
  useEffect(() => {
    if (ms === 0) return;
    const timer = window.setTimeout(() => setRevealed(true), ms);
    return () => window.clearTimeout(timer);
  }, [ms]);
  return revealed;
}

function useFocusWhileShown(dialog: RefObject<HTMLDivElement | null>, emojiButton: RefObject<HTMLButtonElement | null>, backToTheEmojis: RefObject<boolean>) {
  const comeBackTo = useRef<Element | null>(null);
  useLayoutEffect(() => {
    comeBackTo.current = document.activeElement;
    dialog.current?.focus({ preventScroll: true });
  }, [dialog]);
  useEffect(
    () => () => {
      const before = comeBackTo.current;
      const target = !backToTheEmojis.current && before instanceof HTMLElement && before.isConnected ? before : emojiButton.current;
      target?.focus({ preventScroll: true });
    },
    [emojiButton, backToTheEmojis],
  );
}

function useEscapeTo(then: () => void) {
  const latest = useRef(then);
  latest.current = then;
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

async function flyAllInto(dialog: HTMLElement | null, target: HTMLElement | null) {
  const pictures = [...(dialog?.querySelectorAll<HTMLElement>("[data-flies]") ?? [])];
  await Promise.all(pictures.map((picture, index) => pause(index * emojiMomentTiming.flightStaggerMs).then(() => flyInto(picture, target))));
}

async function flyInto(element: HTMLElement, target: HTMLElement | null) {
  if (target === null || typeof element.animate !== "function") return pause(emojiMomentTiming.flightMs);
  const from = element.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const scale = from.width === 0 ? 0.2 : Math.max(0.12, to.height / from.width);
  const x = to.left + to.width / 2 - (from.left + from.width / 2);
  const y = to.top + to.height / 2 - (from.top + from.height / 2);
  const flight = element.animate([{ transform: "none" }, { transform: `translate(${x * 0.35}px, ${y * 0.35 - 60}px) scale(${(1 + scale) / 2}) rotate(-8deg)`, offset: 0.4 }, { transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity: 0.4 }], { duration: emojiMomentTiming.flightMs, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "forwards" });
  await flight.finished.catch(() => undefined);
  target.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 320, easing: "ease-out" });
}

function pause(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
