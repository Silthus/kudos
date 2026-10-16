import { useEffect, useRef } from "react";

export const hudHeightVariable = "--hud-height";

export const belowTheHud = `calc(var(${hudHeightVariable}, 96px) + 1rem)`;

export function useMeasuredHudHeight() {
  const hud = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = hud.current;
    if (element === null) return;
    const publish = () => document.documentElement.style.setProperty(hudHeightVariable, `${element.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return hud;
}
