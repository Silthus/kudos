import type { ItemBoard } from "../../../convex/website/album";
import { itemsWaitWordsOf } from "./ItemBoard";
import "./xpMoment.css";

type MomentGlowProps = { xpWaits: boolean; board: ItemBoard | null; focused: boolean; onPress: () => void };

export function MomentGlow({ xpWaits, board, focused, onPress }: MomentGlowProps) {
  return (
    <button type="button" className="xpm-glow" autoFocus={focused} onClick={onPress}>
      <span className="xpm-glow-orb" aria-hidden="true">
        ?
      </span>
      {xpWaits || board === null ? "Collect XP" : itemsWaitWordsOf(board)}
    </button>
  );
}
