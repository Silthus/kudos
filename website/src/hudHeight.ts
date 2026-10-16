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
    const observer = observing(element, publish);
    return () => {
      observer?.disconnect();
      document.documentElement.style.removeProperty(hudHeightVariable);
    };
  }, []);
  return hud;
}

function observing(element: HTMLElement, onResize: () => void) {
  if (typeof ResizeObserver === "undefined") return null;
  const observer = new ResizeObserver(onResize);
  observer.observe(element);
  return observer;
}
