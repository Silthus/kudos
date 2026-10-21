import { useEffect } from "react";
import type { Climb } from "../../../convex/website/xpMoment";

export function LevelUpTakeover({ onDone }: { climb: Climb; onDone: () => void }) {
  useEffect(() => onDone(), [onDone]);
  return null;
}
