// PROTOTYPE (#625): the big moments: the loot burst of an opened pack, LEVEL UP and Quest Complete. Never merge to main.
import { useEffect, useRef, type CSSProperties } from "react";
import { HoggieArt } from "../art";
import { rarityColour, type Drop, type Quest } from "../world";
import { rarityLabel } from "./sheet";

export function LootBurst({ drop, onTake }: { drop: Drop; onTake: () => void }) {
  const take = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    take.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onTake();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTake]);
  const colour = rarityColour[drop.rarity];
  return (
    <div className="v4-burst-backdrop" role="dialog" aria-modal="true" aria-label={`You found ${drop.name}`} onClick={onTake}>
      <div className="v4-burst" style={{ "--loot": colour } as CSSProperties} onClick={(event) => event.stopPropagation()}>
        <span className="v4-burst-beam" aria-hidden="true" />
        <span className="v4-burst-rays" aria-hidden="true" />
        <div className="v4-burst-art">
          <HoggieArt slug={drop.hoggie} size={180} />
        </div>
        <p className="v4-burst-rarity" style={{ color: colour }}>
          {rarityLabel[drop.rarity]} hoggie
        </p>
        <p className="v4-burst-name" style={{ color: colour }}>
          {drop.name}
        </p>
        <p className="v4-burst-tag">{drop.isNew ? <span className="v4-item-new v4-burst-new">NEW</span> : `Copy #${drop.copy}`}</p>
        <p className="v4-burst-gains">
          <span>+{drop.xp} XP</span>
          {drop.coins > 0 && (
            <span>
              <span className="v4-coin" aria-hidden="true" /> +{drop.coins} coins
            </span>
          )}
        </p>
        {drop.levelAfter > drop.levelBefore && <p className="v4-burst-level">Level {drop.levelAfter} reached!</p>}
        <button ref={take} type="button" className="v4-button v4-button-gold" onClick={onTake}>
          Take it
        </button>
      </div>
    </div>
  );
}

export function LevelUp({ level }: { level: number }) {
  return (
    <div className="v4-levelup" role="status">
      <p className="v4-levelup-word">Level up</p>
      <p className="v4-levelup-level">You reached level {level}</p>
    </div>
  );
}

export function QuestComplete({ quest }: { quest: Quest }) {
  return (
    <div className="v4-questdone" role="status">
      <p className="v4-questdone-word">Quest complete</p>
      <p className="v4-questdone-goal">{quest.goal}</p>
      <p className="v4-questdone-pack">A pack dropped into your bag</p>
    </div>
  );
}
