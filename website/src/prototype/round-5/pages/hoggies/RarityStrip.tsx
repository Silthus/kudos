// PROTOTYPE (#625, round 6): found by rarity, common to legendary, inside the sticky collection bar. The group you're scrolled into is lit, and a click jumps there. Never merge to main.
import type { CSSProperties } from "react";
import { ProgressBar } from "./HoggieDetail";
import { rarityTint, rarityWords, type Rarity, type Shelf } from "./shelf";

type Props = { shelves: Shelf[]; current: Rarity | null; onJump: (rarity: Rarity) => void };

export function RarityStrip({ shelves, current, onJump }: Props) {
  return (
    <nav className="r5h-strip" aria-label="Found by rarity">
      {shelves.map((shelf) => (
        <StripPart key={shelf.rarity} shelf={shelf} current={shelf.rarity === current} onJump={onJump} />
      ))}
    </nav>
  );
}

function partStyle(shelf: Shelf) {
  return { ...rarityTint(shelf.rarity), "--r5h-share": shelf.hoggies.length } as CSSProperties;
}

function StripPart({ shelf, current, onJump }: { shelf: Shelf; current: boolean; onJump: (rarity: Rarity) => void }) {
  const words = rarityWords[shelf.rarity];
  return (
    <button
      type="button"
      className="r5h-strip-part"
      style={partStyle(shelf)}
      aria-current={current ? "location" : undefined}
      aria-label={`${words}: ${shelf.found} of ${shelf.hoggies.length} found. Jump there`}
      onClick={() => onJump(shelf.rarity)}
    >
      <span className="r5h-strip-words">
        <strong>{words}</strong>
        <span>
          {shelf.found}/{shelf.hoggies.length}
        </span>
      </span>
      <ProgressBar part={shelf.found} whole={shelf.hoggies.length} />
    </button>
  );
}
