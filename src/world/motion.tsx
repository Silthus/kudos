import { MotionConfig } from "motion/react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * The Motion setting (#134): "on" or "reduced", chosen in the settings menu and kept in this
 * browser. Unset, the system's reduced-motion preference decides. It maps onto `MotionConfig`, so
 * every motion component and every `useReducedMotionConfig()` (the world's `still`) follows it; the
 * page is marked `data-motion` for the few CSS transitions.
 */

export type MotionChoice = "on" | "reduced";

export const MOTION_KEY = "kudos.motion";

export function reducedMotionFor(choice: MotionChoice | null): "never" | "always" | "user" {
  return choice === "on" ? "never" : choice === "reduced" ? "always" : "user";
}

export function storedMotion(): MotionChoice | null {
  try {
    const v = localStorage.getItem(MOTION_KEY);
    return v === "on" || v === "reduced" ? v : null;
  } catch {
    return null;
  }
}

const MotionContext = createContext<{ choice: MotionChoice | null; set: (choice: MotionChoice) => void }>({ choice: null, set: () => {} });

export function useMotion() {
  return useContext(MotionContext);
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<MotionChoice | null>(storedMotion);
  const set = (next: MotionChoice) => {
    setChoice(next);
    try {
      localStorage.setItem(MOTION_KEY, next);
    } catch {
      // A browser that keeps nothing still switches for this visit.
    }
  };
  useEffect(() => {
    const root = document.documentElement;
    if (choice) root.dataset.motion = choice;
    else delete root.dataset.motion;
  }, [choice]);
  return (
    <MotionContext.Provider value={{ choice, set }}>
      <MotionConfig reducedMotion={reducedMotionFor(choice)}>{children}</MotionConfig>
    </MotionContext.Provider>
  );
}
