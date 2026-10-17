// PROTOTYPE (#625): motion helpers for the desk: reduced-motion preference and the desk's scale.
import { useEffect, useState } from "react";

const reducedQuery = "(prefers-reduced-motion: reduce)";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia(reducedQuery).matches);
  useEffect(() => {
    const query = window.matchMedia(reducedQuery);
    const follow = () => setReduced(query.matches);
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);
  return reduced;
}

export const deskSize = { width: 1440, height: 900 };

const stackedBelow = 760;

export function useDeskFit() {
  const measure = () => ({ scale: Math.min(window.innerWidth / deskSize.width, window.innerHeight / deskSize.height), stacked: window.innerWidth < stackedBelow });
  const [fit, setFit] = useState(measure);
  useEffect(() => {
    const follow = () => setFit(measure());
    window.addEventListener("resize", follow);
    return () => window.removeEventListener("resize", follow);
  }, []);
  return fit;
}
