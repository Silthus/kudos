// PROTOTYPE (#625): the moments laid on the open book: tearing a pack open and the stamp for a finished quest. Never merge to main.
import { useEffect, useState, type CSSProperties } from "react";
import { HoggieArt } from "../art";
import { rarityColour, type Drop, type Pack, type Quest } from "../world";
import { LevelSeal } from "./Cover";
import { packLabel, rarityName } from "./text";

export function PackReveal({ pack, onTear, onStick, onClose }: { pack: Pack; onTear: () => Drop | null; onStick: (drop: Drop) => void; onClose: () => void }) {
  const [drop, setDrop] = useState<Drop | null>(null);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (drop === null) onClose();
      else onStick(drop);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [drop, onClose, onStick]);
  return (
    <div className="v2-moment" role="dialog" aria-modal="true" aria-label={drop === null ? packLabel[pack.kind] : `You found ${drop.name}`}>
      <div className="v2-reveal" data-phase={drop === null ? "sealed" : "torn"} style={drop === null ? undefined : ({ "--rarity": rarityColour[drop.rarity] } as CSSProperties)}>
        {drop === null ? <Sealed pack={pack} onTear={() => setDrop(onTear())} onClose={onClose} /> : <Torn drop={drop} onStick={() => onStick(drop)} />}
      </div>
    </div>
  );
}

function Sealed({ pack, onTear, onClose }: { pack: Pack; onTear: () => void; onClose: () => void }) {
  return (
    <>
      <p className="v2-kicker">{packLabel[pack.kind]}</p>
      <button type="button" className="v2-big-envelope" onClick={onTear} autoFocus>
        <span className="v2-big-envelope-tear" aria-hidden="true" />
        <span className="v2-envelope-seal" aria-hidden="true">
          H
        </span>
        <span className="v2-big-envelope-from">From: {pack.from}</span>
      </button>
      <div className="v2-reveal-actions">
        <button type="button" className="v2-ink-button" onClick={onTear}>
          Tear it open
        </button>
        <button type="button" className="v2-quiet-button" onClick={onClose}>
          Keep it sealed
        </button>
      </div>
    </>
  );
}

function Torn({ drop, onStick }: { drop: Drop; onStick: () => void }) {
  const levelledUp = drop.levelAfter > drop.levelBefore;
  return (
    <>
      <div className="v2-drop-sticker">
        <HoggieArt slug={drop.hoggie} size={150} />
      </div>
      <div className="v2-torn-envelope" aria-hidden="true">
        <span className="v2-torn-strip" />
      </div>
      <p className="v2-drop-rarity">{rarityName[drop.rarity]}</p>
      <h2 className="v2-drop-name">{drop.name}</h2>
      <p className="v2-drop-mark" data-new={drop.isNew}>
        {drop.isNew ? "New for your book" : `Copy #${drop.copy}`}
      </p>
      <p className="v2-drop-gains">
        <span>+{drop.xp} XP</span>
        {drop.coins > 0 && <span>+{drop.coins} coins</span>}
      </p>
      {levelledUp && (
        <div className="v2-level-up">
          <LevelSeal level={drop.levelAfter} className="v2-level-up-seal" />
          <p>Level up! You reached level {drop.levelAfter}.</p>
        </div>
      )}
      <div className="v2-reveal-actions">
        <button type="button" className="v2-ink-button" onClick={onStick} autoFocus>
          Stick it in the book
        </button>
      </div>
    </>
  );
}

export function QuestStamp({ quest, onDone }: { quest: Quest; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2800);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <button type="button" className="v2-moment v2-moment-light" onClick={onDone} aria-label="Quest complete. Dismiss.">
      <span className="v2-quest-stamp">
        <span className="v2-quest-stamp-word">Quest complete</span>
        <span className="v2-quest-stamp-goal">{quest.goal}</span>
      </span>
      <span className="v2-quest-stamp-note">A pack is tucked into the book's edge →</span>
    </button>
  );
}
