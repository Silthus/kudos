import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { LoopLesson } from "../../../convex/website/album";
import type { Climb } from "../../../convex/website/xpMoment";
import { NamedEmoji } from "../Emoji";
import type { AlbumEmoji } from "./answer";
import { EmojiPicture } from "./EmojiPicture";
import { flyACopyIntoTheEmojiButton } from "./emojiFlight";
import type { EmojisOnTheirWay } from "./emojisOnTheirWay";
import { ItemBack } from "./ItemBoard";
import type { LevelUnlocks } from "./levelUnlocks";
import { Confetti } from "./PackCards";
import { centreOf, sparksOff } from "./xpMomentParticles";
import "./opening.css";
import "./levelUpTakeover.css";

const discHeightShare = 0.36;

const unlockEmojiSize = 32;

export const takeoverTiming = { unlocksAfterMs: 1100, unlockStaggerMs: 260, unlockRiseMs: 520, emojiHoldMs: 600 };

type TakeoverProps = { climb: Climb; unlocks: LevelUnlocks; onTheirWay: EmojisOnTheirWay; onDone: () => void };

export function LevelUpTakeover({ climb: { to }, unlocks, onTheirWay, onDone }: TakeoverProps) {
  const [from] = useState(dropFromThePill);
  useSparksOffThePill();
  useEscapeTo(onDone);
  return (
    <div className="xpm-lvl" role="group" aria-label={`You reached level ${to.level}`} onClick={onDone}>
      <span className="xpm-lvl-rays" aria-hidden="true" />
      <span className="xpm-lvl-shock" aria-hidden="true" />
      <span className="xpm-lvl-confetti">
        <Confetti size="gold" seed={to.level * 31} />
      </span>
      <div className="xpm-lvl-disc" style={from} aria-hidden="true">
        <small>Level</small>
        <strong>{to.level}</strong>
      </div>
      <h2 className="xpm-lvl-title">You reached level {to.level}!</h2>
      <Unlocks unlocks={unlocks} onTheirWay={onTheirWay} />
      <p className="xpm-lvl-next">
        Level {to.level + 1} is {to.nextAt - to.xp} XP away
      </p>
      <button type="button" autoFocus className="xpm-lvl-continue" onClick={(event) => (event.stopPropagation(), onDone())}>
        Continue
      </button>
    </div>
  );
}

function Unlocks({ unlocks: { items, emojis, howTo }, onTheirWay }: { unlocks: LevelUnlocks; onTheirWay: EmojisOnTheirWay }) {
  const list = useRef<HTMLUListElement>(null);
  const itemsShown = items > 0 ? 1 : 0;
  useSentUpToTheEmojis(list, emojis, itemsShown, onTheirWay);
  if (items === 0 && emojis.length === 0) return null;
  return (
    <ul ref={list} className="xpm-lvl-unlocks">
      {items > 0 && <ItemsUnlocked count={items} />}
      {emojis.map((emoji, index) => (
        <EmojiUnlocked key={emoji.id} emoji={emoji} howTo={howTo} order={itemsShown + index} />
      ))}
    </ul>
  );
}

function useSentUpToTheEmojis(list: RefObject<HTMLUListElement | null>, emojis: AlbumEmoji[], firstOrder: number, { leave, home }: EmojisOnTheirWay) {
  const ids = emojis.map(({ id }) => id).join(" ");
  useLayoutEffect(() => {
    const sent = ids === "" ? [] : ids.split(" ");
    const takenAway = new AbortController();
    const sendUpAndHome = async (id: string) => {
      await sendUp(list.current, id, takenAway.signal);
      if (!takenAway.signal.aborted) home([id]);
    };
    leave(sent);
    const timers = sent.map((id, index) => window.setTimeout(() => void sendUpAndHome(id), sentUpAtOf(firstOrder + index)));
    return () => {
      takenAway.abort();
      timers.forEach((timer) => window.clearTimeout(timer));
      home(sent);
    };
  }, [list, ids, firstOrder, leave, home]);
}

async function sendUp(list: HTMLElement | null, id: string, signal: AbortSignal) {
  const picture = list?.querySelector<HTMLElement>(`[data-emoji="${CSS.escape(id)}"] .al-emoji-art`);
  if (picture !== null && picture !== undefined) await flyACopyIntoTheEmojiButton(picture, signal);
}

function risesAtOf(order: number) {
  return takeoverTiming.unlocksAfterMs + order * takeoverTiming.unlockStaggerMs;
}

function sentUpAtOf(order: number) {
  return risesAtOf(order) + takeoverTiming.unlockRiseMs + takeoverTiming.emojiHoldMs;
}

function ItemsUnlocked({ count }: { count: number }) {
  const words = count === 1 ? "1 new item unlocked" : `${count} new items unlocked`;
  return (
    <li aria-label={words} style={orderOf(0)}>
      <span className="xpm-lvl-backs" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className="xpm-lvl-back">
            <ItemBack />
          </span>
        ))}
      </span>
      <span>
        <strong>{words}</strong>
        <small>waiting face down</small>
      </span>
    </li>
  );
}

function EmojiUnlocked({ emoji, howTo, order }: { emoji: AlbumEmoji; howTo: LoopLesson | null; order: number }) {
  const usable = howTo !== null && emoji.inSlack;
  return (
    <li aria-label={usable ? `:${emoji.name}: unlocked` : `New emoji :${emoji.name}:`} data-emoji={emoji.id} style={{ ...orderOf(order), ...hopOf(order) }}>
      <EmojiPicture emoji={emoji} size={unlockEmojiSize} />
      {usable ? <HowToUseWords name={emoji.name} howTo={howTo} /> : <NewEmojiWords name={emoji.name} />}
    </li>
  );
}

function NewEmojiWords({ name }: { name: string }) {
  return (
    <span>
      <strong className="ph-no-capture">:{name}:</strong>
      <small>New emoji unlocked</small>
    </span>
  );
}

function HowToUseWords({ name, howTo: { kudosEmoji, kudosEmojiImage } }: { name: string; howTo: LoopLesson }) {
  return (
    <span>
      <strong>
        <span className="ph-no-capture">:{name}:</span> unlocked
      </strong>
      <small>
        React or thank with it. It counts like <NamedEmoji name={kudosEmoji} image={kudosEmojiImage ?? undefined} />.
      </small>
    </span>
  );
}

function hopOf(order: number) {
  return { "--hop-at": `${risesAtOf(order) + takeoverTiming.unlockRiseMs}ms`, "--hop-ms": `${takeoverTiming.emojiHoldMs}ms` } as CSSProperties;
}

function orderOf(order: number) {
  return { animationDelay: `${risesAtOf(order)}ms`, animationDuration: `${takeoverTiming.unlockRiseMs}ms` };
}

function thePill() {
  return document.querySelector(".al-level");
}

function dropFromThePill(): CSSProperties {
  const pill = thePill();
  if (pill === null) return {};
  const { x, y } = centreOf(pill);
  return { "--from-x": `${x - window.innerWidth / 2}px`, "--from-y": `${y - window.innerHeight * discHeightShare}px` } as CSSProperties;
}

function useSparksOffThePill() {
  useEffect(() => sparksOff(thePill()), []);
}

function useEscapeTo(onDone: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDone();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDone]);
}
