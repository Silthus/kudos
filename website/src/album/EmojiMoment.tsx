import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { prefersReducedMotion } from "../reducedMotion";
import type { Album, AlbumEmoji, SeenReply } from "./answer";
import { EmojiPicture } from "./EmojiPicture";
import { addItToSlackWords, findItInSlackWords, momentsOwedOf, useItInSlackWords, whyWords } from "./emojiShelf";
import { FindInSlackWhileOn, useEmojiWizardOn } from "./findInSlack";
import { keepFocusIn } from "./focusTrap";
import "./emoji.css";

export const emojiMomentTiming = { settleMs: 700, flightMs: 850 };

const momentPictureSize = 128;

export type EmojiMoments = { playing: AlbumEmoji | null; position: number; inThisBatch: number; take: () => void; skipTheRest: () => void; shownElsewhere: (ids: string[]) => void };

export function useEmojiMoments(album: Album, waits: boolean, markEmojisSeen: (ids: string[]) => Promise<SeenReply>): EmojiMoments {
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  const [playing, setPlaying] = useState<AlbumEmoji | null>(null);
  const [takenInThisBatch, setTakenInThisBatch] = useState(0);
  const owed = momentsOwedOf(album, shown);
  const next = owed[0] ?? null;
  const batchOver = playing === null && next === null;
  useEffect(() => {
    if (batchOver) setTakenInThisBatch(0);
  }, [batchOver]);
  useEffect(() => {
    if (waits || playing !== null || next === null) return;
    const timer = window.setTimeout(() => setPlaying(next), emojiMomentTiming.settleMs);
    return () => window.clearTimeout(timer);
  }, [waits, playing, next]);
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
      setPlaying(null);
    },
    [shownElsewhere],
  );
  const take = useCallback(() => {
    if (playing === null) return;
    setTakenInThisBatch((taken) => taken + 1);
    markShown([playing.id]);
  }, [playing, markShown]);
  const skipTheRest = useCallback(() => markShown(owed.map(({ id }) => id)), [owed, markShown]);
  const stillOwed = owed.filter(({ id }) => id !== playing?.id).length;
  return { playing, position: takenInThisBatch + 1, inThisBatch: takenInThisBatch + (playing === null ? 0 : 1) + stillOwed, take, skipTheRest, shownElsewhere };
}

type EmojiMomentProps = { moments: EmojiMoments; emojiButton: RefObject<HTMLButtonElement | null> };

export function EmojiMoment({ moments, emojiButton }: EmojiMomentProps) {
  const { playing: emoji, position, inThisBatch, take, skipTheRest } = moments;
  const described = useId();
  const wizardOn = useEmojiWizardOn();
  const [flying, setFlying] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  const dialog = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLSpanElement>(null);
  useFocusWhileShown(dialog, emojiButton);

  const flyIn = useCallback(() => {
    if (flying) return;
    if (reduced) return take();
    setFlying(true);
    void flyInto(picture.current, emojiButton.current).then(take);
  }, [flying, reduced, take, emojiButton]);

  useEscapeTo(flyIn);

  if (emoji === null) return null;
  return (
    <div ref={dialog} tabIndex={-1} className="al-emoji-moment" role="dialog" aria-modal="true" aria-label="New emoji unlocked" aria-describedby={`${described}-name ${described}-why ${described}-use`} data-flying={flying ? "" : undefined} data-reduced={reduced ? "" : undefined} onClick={(event) => event.target === event.currentTarget && flyIn()} onKeyDown={(event) => event.key === "Tab" && keepFocusIn(dialog.current, event)}>
      <div className="al-emoji-moment-card">
        <p className="al-emoji-moment-kicker">
          New emoji unlocked
          {inThisBatch > 1 && (
            <span className="al-quiet">
              {" "}
              · {position} of {inThisBatch} new
            </span>
          )}
        </p>
        <span ref={picture} className="al-emoji-moment-picture">
          {!reduced && <span className="al-emoji-moment-rays" aria-hidden="true" />}
          <EmojiPicture emoji={emoji} size={momentPictureSize} />
        </span>
        <h2 id={`${described}-name`} className="al-emoji-moment-name ph-no-capture">
          :{emoji.name}:
        </h2>
        <p id={`${described}-why`} className="al-emoji-moment-why ph-no-capture">
          {whyWords(emoji)}
        </p>
        <p id={`${described}-use`} className="al-emoji-moment-use">
          {emoji.inSlack ? useItInSlackWords : wizardOn ? findItInSlackWords : addItToSlackWords}
        </p>
        <div className="al-emoji-moment-actions">
          <button type="button" className="al-emoji-moment-take" onClick={flyIn}>
            Add to my emojis
          </button>
          <FindInSlackWhileOn emoji={emoji} />
          {position < inThisBatch && (
            <button type="button" className="al-emoji-moment-skip" onClick={skipTheRest} disabled={flying}>
              Skip the rest
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function useFocusWhileShown(dialog: RefObject<HTMLDivElement | null>, emojiButton: RefObject<HTMLButtonElement | null>) {
  const comeBackTo = useRef<Element | null>(null);
  useLayoutEffect(() => {
    comeBackTo.current = document.activeElement;
    dialog.current?.focus({ preventScroll: true });
  }, [dialog]);
  useEffect(() => () => (comeBackTo.current instanceof HTMLElement && comeBackTo.current.isConnected ? comeBackTo.current : emojiButton.current)?.focus({ preventScroll: true }), [emojiButton]);
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

async function flyInto(element: HTMLElement | null, target: HTMLElement | null) {
  if (element === null || target === null || typeof element.animate !== "function") return pause(emojiMomentTiming.flightMs);
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
