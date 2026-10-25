import { useEffect, useState } from "react";

// PROTOTYPE: throwaway variant switcher, mounted only in builds with VITE_PROTOTYPE=1.

export type PrototypeVariant = { key: string; name: string };

export function useVariant(variants: readonly PrototypeVariant[]) {
  const [current, setCurrent] = useState(() => {
    const asked = new URLSearchParams(window.location.search).get("variant");
    return variants.find(({ key }) => key === asked)?.key ?? variants[0]!.key;
  });
  const choose = (key: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", key);
    window.history.replaceState(window.history.state, "", url);
    setCurrent(key);
  };
  return [current, choose] as const;
}

export function PrototypeSwitcher({ variants, current, onChoose }: { variants: readonly PrototypeVariant[]; current: string; onChoose: (key: string) => void }) {
  const index = Math.max(0, variants.findIndex(({ key }) => key === current));
  const step = (by: number) => onChoose(variants[(index + by + variants.length) % variants.length]!.key);

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

  const shown = variants[index]!;
  return (
    <div role="toolbar" aria-label="Prototype variants" style={switcherStyle}>
      <button type="button" onClick={() => step(-1)} style={arrowStyle} aria-label="Previous variant">
        ←
      </button>
      <span style={{ minWidth: "13rem", textAlign: "center", fontWeight: 700 }}>
        {shown.key} <span style={{ opacity: 0.7, fontWeight: 500 }}>({shown.name})</span> <span style={{ opacity: 0.5, fontWeight: 500 }}>{`${index + 1}/${variants.length}`}</span>
      </span>
      <button type="button" onClick={() => step(1)} style={arrowStyle} aria-label="Next variant">
        →
      </button>
    </div>
  );
}

const switcherStyle = {
  position: "fixed",
  bottom: "1.25rem",
  left: "50%",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  transform: "translateX(-50%)",
  border: "2px solid #f7a501",
  borderRadius: "999px",
  background: "#111",
  boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
  padding: "0.375rem",
  color: "#fff",
  fontFamily: "ui-monospace, monospace",
  fontSize: "0.8125rem",
} as const;

const arrowStyle = { width: "2rem", height: "2rem", border: 0, borderRadius: "999px", background: "#333", color: "#fff", cursor: "pointer", fontSize: "1rem" } as const;
