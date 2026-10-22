// PROTOTYPE bar: only in the arcade fixture build.
import { useEffect } from "react";
import { IconChevronLeft, IconChevronRight } from "@posthog/icons";
import { arrives, lookKeys, looks, playTheArrival, setLook, useLook } from "./look";
import "./prototypeBar.css";

export function PrototypeBar() {
  const look = useLook();
  const at = lookKeys.indexOf(look);
  const step = (by: number) => setLook(lookKeys[(at + by + lookKeys.length) % lookKeys.length]!);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div role="toolbar" aria-label="Prototype controls" className="proto-bar">
      <button type="button" aria-label="Previous variant" onClick={() => step(-1)} className="proto-bar-arrow">
        <IconChevronLeft />
      </button>
      <span className="proto-bar-label">
        <span className="proto-bar-key">{look}</span> <span className="proto-bar-name">{looks[look]}</span>
      </span>
      <button type="button" aria-label="Next variant" onClick={() => step(1)} className="proto-bar-arrow">
        <IconChevronRight />
      </button>
      <span className="proto-bar-rule" />
      <button type="button" className="proto-bar-play" onClick={() => playTheArrival(!arrives())}>
        {arrives() ? "Calm landing" : "Play arrival"}
      </button>
    </div>
  );
}
