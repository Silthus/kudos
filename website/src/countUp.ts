import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./reducedMotion";

const ticks = 15;

const tickMs = 40;

export function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  const shownNow = useRef(shown);
  shownNow.current = shown;

  useEffect(() => {
    const from = shownNow.current;
    if (value <= from || prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let tick = 0;
    const counting = setInterval(() => {
      tick += 1;
      setShown(Math.round(from + (value - from) * easeOut(tick / ticks)));
      if (tick === ticks) clearInterval(counting);
    }, tickMs);
    return () => clearInterval(counting);
  }, [value]);

  return shown;
}

function easeOut(progress: number) {
  return 1 - (1 - progress) ** 3;
}
