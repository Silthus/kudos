// PROTOTYPE bar: only in the person-page fixture build.
import { useEffect } from "react";
import { IconChevronLeft, IconChevronRight } from "@posthog/icons";
import { isMix, members, pages, prototypeMember, setMember, setPrototypePage, setVariant, usePrototypePage, useVariant, variantKeys, variants, type PrototypeMember, type PrototypePage } from "./personPagePrototype";

export function PrototypeBar() {
  const variant = useVariant();
  const page = usePrototypePage();
  const at = variantKeys.indexOf(variant);
  const step = (by: number) => setVariant(variantKeys[(at + by + variantKeys.length) % variantKeys.length]!);
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
    <div role="toolbar" aria-label="Prototype controls" className="pp-bar">
      <div className="pp-bar-pill">
        <button type="button" aria-label="Previous variant" onClick={() => step(-1)} className="pp-bar-arrow">
          <IconChevronLeft />
        </button>
        <span className="pp-bar-label">
          <span className="pp-bar-key">{variant === "now" ? "now" : variant.toUpperCase()}</span> <span className="pp-bar-name">{variants[variant]}</span>
        </span>
        <button type="button" aria-label="Next variant" onClick={() => step(1)} className="pp-bar-arrow">
          <IconChevronRight />
        </button>
        <span className="pp-bar-rule" />
        <select aria-label="Member" value={prototypeMember} onChange={(event) => setMember(event.target.value as PrototypeMember)} className="pp-bar-select">
          {(Object.keys(members) as PrototypeMember[]).map((key) => (
            <option key={key} value={key}>
              {members[key]}
            </option>
          ))}
        </select>
        {isMix(variant) && (
          <select aria-label="Whose page" value={page} onChange={(event) => setPrototypePage(event.target.value as PrototypePage)} className="pp-bar-select">
            {(Object.keys(pages) as PrototypePage[]).map((key) => (
              <option key={key} value={key}>
                {pages[key].label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
