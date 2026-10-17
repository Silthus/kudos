// PROTOTYPE (#625): ARPG item tooltips for the character sheet. Never merge to main.
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from "react";

export type Tip = { name: string; colour: string; kind: string; flavour?: string; stats?: string[]; action?: { label: string; run: () => void } };

type Shown = { tip: Tip; rect: DOMRect };

type TipControls = { show(tip: Tip, element: HTMLElement): void; hideSoon(): void; hold(): void; clear(): void };

const TipContext = createContext<TipControls | null>(null);

const tipWidth = 288;

export function TipProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const hold = useCallback(() => window.clearTimeout(timer.current), []);
  const clear = useCallback(() => {
    hold();
    setShown(null);
  }, [hold]);
  const show = useCallback(
    (tip: Tip, element: HTMLElement) => {
      hold();
      setShown({ tip, rect: element.getBoundingClientRect() });
    },
    [hold],
  );
  const hideSoon = useCallback(() => {
    hold();
    timer.current = window.setTimeout(() => setShown(null), 160);
  }, [hold]);
  const controls = useMemo(() => ({ show, hideSoon, hold, clear }), [show, hideSoon, hold, clear]);
  return (
    <TipContext.Provider value={controls}>
      {children}
      {shown !== null && <TipCard shown={shown} controls={controls} />}
    </TipContext.Provider>
  );
}

export function useTipControls() {
  const controls = useContext(TipContext);
  if (controls === null) throw new Error("Tooltips need a TipProvider.");
  return controls;
}

export function useTip() {
  const controls = useTipControls();
  return (tip: Tip) => ({
    onMouseEnter: (event: MouseEvent<HTMLElement>) => controls.show(tip, event.currentTarget),
    onMouseLeave: controls.hideSoon,
    onFocus: (event: FocusEvent<HTMLElement>) => controls.show(tip, event.currentTarget),
    onBlur: controls.hideSoon,
  });
}

function TipCard({ shown: { tip, rect }, controls }: { shown: Shown; controls: TipControls }) {
  const card = useRef<HTMLDivElement>(null);
  const left = rect.right + 12 + tipWidth < window.innerWidth ? rect.right + 12 : Math.max(8, rect.left - 12 - tipWidth);
  useLayoutEffect(() => {
    const element = card.current;
    if (element === null) return;
    const top = Math.min(Math.max(8, rect.top), window.innerHeight - element.offsetHeight - 8);
    element.style.top = `${top}px`;
  }, [rect, tip]);
  return (
    <div ref={card} role="tooltip" className="v4-tip" style={{ left, top: rect.top, width: tipWidth }} onMouseEnter={controls.hold} onMouseLeave={controls.hideSoon}>
      <p className="v4-tip-name" style={{ color: tip.colour }}>
        {tip.name}
      </p>
      <p className="v4-tip-kind">{tip.kind}</p>
      {tip.stats !== undefined && tip.stats.length > 0 && (
        <ul className="v4-tip-stats">
          {tip.stats.map((stat) => (
            <li key={stat}>{stat}</li>
          ))}
        </ul>
      )}
      {tip.flavour !== undefined && <p className="v4-tip-flavour">“{tip.flavour}”</p>}
      {tip.action !== undefined && (
        <button
          type="button"
          className="v4-tip-action"
          onClick={() => {
            controls.clear();
            tip.action?.run();
          }}
        >
          {tip.action.label}
        </button>
      )}
    </div>
  );
}
