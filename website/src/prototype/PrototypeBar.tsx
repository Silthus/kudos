// PROTOTYPE (#625): the floating variant switcher. Shown only in fixture builds. Never merge to main.
import { useEffect, useReducer } from "react";
import { prototypeOn, prototypeRounds, prototypeVariants, variantIn, type VariantKey } from "./variants";

function goTo(key: VariantKey | null) {
  const address = new URL(window.location.href);
  if (key === null) address.searchParams.delete("variant");
  else address.searchParams.set("variant", key);
  window.history.replaceState(null, "", address.pathname + address.search + address.hash);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function stepped(current: VariantKey | null, by: number): VariantKey {
  const index = prototypeVariants.findIndex(({ key }) => key === current);
  const next = (index + by + prototypeVariants.length) % prototypeVariants.length;
  return prototypeVariants[index === -1 && by < 0 ? prototypeVariants.length - 1 : index === -1 ? 0 : next]!.key;
}

function shortKey(key: VariantKey) {
  if (key === "slack") return "S";
  if (/^4[a-c]$/.test(key)) return key.slice(1).toUpperCase();
  return key.replace(/^r\d-/, "");
}

function typingIn(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
}

export function PrototypeBar() {
  const current = variantIn(window.location.search);
  const [, follow] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    window.addEventListener("popstate", follow);
    return () => window.removeEventListener("popstate", follow);
  }, []);

  useEffect(() => {
    const cycle = (event: KeyboardEvent) => {
      if (typingIn(event.target) || event.metaKey || event.ctrlKey || event.altKey || !event.shiftKey) return;
      if (event.key === "ArrowLeft") goTo(stepped(variantIn(window.location.search), -1));
      if (event.key === "ArrowRight") goTo(stepped(variantIn(window.location.search), 1));
    };
    window.addEventListener("keydown", cycle);
    return () => window.removeEventListener("keydown", cycle);
  }, []);

  if (!prototypeOn) return null;
  const name = prototypeVariants.find(({ key }) => key === current)?.name ?? "Today's site";
  const round = prototypeRounds.find(({ variants }) => variants.some(({ key }) => key === current))?.round;
  return (
    <div data-prototype-bar style={{ position: "fixed", left: "50%", bottom: 14, transform: "translateX(-50%)", zIndex: 2147483000, display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: "#111", color: "#fff", font: "600 13px/1 system-ui, sans-serif", boxShadow: "0 8px 24px rgb(0 0 0 / 35%)", border: "2px solid #f54e00", maxWidth: "calc(100vw - 16px)", flexWrap: "wrap", justifyContent: "center", borderRadius: 22 }}>
      <BarButton label="Previous variant" onClick={() => goTo(stepped(current, -1))}>
        ←
      </BarButton>
      {prototypeRounds.map(({ round, variants }) => (
        <span key={round} style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 6, borderLeft: "1px solid #444" }}>
          <span style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase" }}>{round.replace("Round ", "R")}</span>
          {variants.map(({ key, name: variantName }) => (
            <BarButton key={key} label={`${round}, variant ${key}: ${variantName}`} pressed={key === current} onClick={() => goTo(key)}>
              {shortKey(key)}
            </BarButton>
          ))}
        </span>
      ))}
      <span style={{ minWidth: 150, textAlign: "center", padding: "0 6px", display: window.innerWidth < 560 ? "none" : undefined }}>{current === null ? name : `${round} · ${shortKey(current)} · ${name}`}</span>
      <BarButton label="Today's site" pressed={current === null} onClick={() => goTo(null)}>
        0
      </BarButton>
      <BarButton label="Next variant" onClick={() => goTo(stepped(current, 1))}>
        →
      </BarButton>
    </div>
  );
}

function BarButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} onClick={onClick} style={{ minWidth: 28, height: 28, borderRadius: 999, border: 0, cursor: "pointer", background: pressed ? "#f54e00" : "#2a2a2a", color: "#fff", font: "inherit" }}>
      {children}
    </button>
  );
}
