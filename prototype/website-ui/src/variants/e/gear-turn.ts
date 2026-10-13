// Variant E gear turns: one hook that turns a card face out, swaps what it shows at the edge, and turns it back in, for the panel's two sides and the stage's picker.
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./hud";

const turnOut = 200;
const turnIn = 250;

export function useTurn<Face extends string>(initial: Face) {
  const reduced = useReducedMotion();
  const [face, setFace] = useState(initial);
  const [turn, setTurn] = useState<{ phase: "out" | "in"; to: Face }>();
  const timer = useRef<number>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const turnTo = (to: Face, onLanded?: () => void) => {
    clearTimeout(timer.current);
    if (reduced) {
      setFace(to);
      onLanded?.();
      return;
    }
    setTurn({ phase: "out", to });
    timer.current = window.setTimeout(() => {
      setFace(to);
      onLanded?.();
      setTurn({ phase: "in", to });
      timer.current = window.setTimeout(() => setTurn(undefined), turnIn);
    }, turnOut);
  };

  return { face, toward: turn?.to ?? face, turnClass: (prefix: string) => (turn ? `${prefix}-${turn.phase}-${turn.to}` : ""), turnTo };
}
