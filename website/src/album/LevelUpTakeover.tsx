import { useEffect, useState, type CSSProperties } from "react";
import type { Climb } from "../../../convex/website/xpMoment";
import type { AlbumEmoji } from "./answer";
import { EmojiPicture } from "./EmojiPicture";
import { ItemBack } from "./ItemBoard";
import type { LevelUnlocks } from "./levelUnlocks";
import { Confetti } from "./PackCards";
import { centreOf, sparksOff } from "./xpMomentParticles";
import "./opening.css";
import "./levelUpTakeover.css";

const discHeightShare = 0.36;

const unlockEmojiSize = 32;

export function LevelUpTakeover({ climb: { to }, unlocks, onDone }: { climb: Climb; unlocks: LevelUnlocks; onDone: () => void }) {
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
      <Unlocks unlocks={unlocks} />
      <p className="xpm-lvl-next">
        Level {to.level + 1} is {to.nextAt - to.xp} XP away
      </p>
      <button type="button" autoFocus className="xpm-lvl-continue" onClick={(event) => (event.stopPropagation(), onDone())}>
        Continue
      </button>
    </div>
  );
}

function Unlocks({ unlocks: { items, emojis } }: { unlocks: LevelUnlocks }) {
  if (items === 0 && emojis.length === 0) return null;
  const itemsShown = items > 0 ? 1 : 0;
  return (
    <ul className="xpm-lvl-unlocks">
      {items > 0 && <ItemsUnlocked count={items} />}
      {emojis.map((emoji, index) => (
        <EmojiUnlocked key={emoji.id} emoji={emoji} order={itemsShown + index} />
      ))}
    </ul>
  );
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

function EmojiUnlocked({ emoji, order }: { emoji: AlbumEmoji; order: number }) {
  return (
    <li aria-label={`New emoji :${emoji.name}:`} style={orderOf(order)}>
      <EmojiPicture emoji={emoji} size={unlockEmojiSize} />
      <span>
        <strong className="ph-no-capture">:{emoji.name}:</strong>
        <small>New emoji unlocked</small>
      </span>
    </li>
  );
}

function orderOf(order: number) {
  return { "--i": order } as CSSProperties;
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
