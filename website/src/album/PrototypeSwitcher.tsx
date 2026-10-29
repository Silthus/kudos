// PROTOTYPE (throwaway, branch prototype/activity-never-empty, never merged).
import { useCallback, useEffect, useState } from "react";
import "./prototypeSwitcher.css";

export const isPrototypeBuild = import.meta.env.VITE_PROTOTYPE === "1";

export type Choice = { key: string; label: string };

export function usePrototypeParam(name: string, choices: Choice[]) {
  const [key, setKey] = useState(() => keyFromAddress(name, choices));
  const choose = useCallback(
    (next: string) => {
      const address = new URL(window.location.href);
      address.searchParams.set(name, next);
      window.history.replaceState(window.history.state, "", address.pathname + address.search + address.hash);
      setKey(next);
    },
    [name],
  );
  return [key, choose] as const;
}

function keyFromAddress(name: string, choices: Choice[]) {
  const asked = new URLSearchParams(window.location.search).get(name);
  return choices.some(({ key }) => key === asked) ? asked! : choices[0]!.key;
}

type SwitcherProps = { variants: Choice[]; variant: string; onVariant: (key: string) => void; states: Choice[]; state: string; onState: (key: string) => void; readout: string };

export function PrototypeSwitcher({ variants, variant, onVariant, states, state, onState, readout }: SwitcherProps) {
  const at = variants.findIndex(({ key }) => key === variant);
  const step = useCallback((by: number) => onVariant(variants[(at + by + variants.length) % variants.length]!.key), [at, onVariant, variants]);
  useArrowKeys(step);
  const current = variants[at]!;
  return (
    <div className="proto-bar" role="toolbar" aria-label="Prototype switcher">
      <div className="proto-bar-row">
        <button type="button" className="proto-bar-arrow" aria-label="Previous variant" onClick={() => step(-1)}>
          ←
        </button>
        <span className="proto-bar-label">
          <strong>{current.key}</strong> {current.label}
        </span>
        <button type="button" className="proto-bar-arrow" aria-label="Next variant" onClick={() => step(1)}>
          →
        </button>
        <span className="proto-bar-states" role="group" aria-label="State">
          {states.map(({ key, label }) => (
            <button key={key} type="button" className="proto-bar-state" aria-pressed={key === state} onClick={() => onState(key)}>
              {label}
            </button>
          ))}
        </span>
      </div>
      <p className="proto-bar-readout">{readout}</p>
    </div>
  );
}

function useArrowKeys(step: (by: number) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.getAttribute("role") === "tab");
}
