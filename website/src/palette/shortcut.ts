import { useEffect } from "react";

export function paletteShortcut() {
  return onApplePlatform() ? "⌘K" : "Ctrl K";
}

export function usePaletteShortcut(toggle: () => void, { enabled, palette }: { enabled: boolean; palette: () => Element | null }) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isTheShortcut(event) || typingElsewhere(event.target, palette())) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, enabled, palette]);
}

function isTheShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k";
}

function typingElsewhere(target: EventTarget | null, palette: Element | null) {
  if (!(target instanceof HTMLElement) || palette?.contains(target)) return false;
  return target.isContentEditable || target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && !nonTextInputs.has(target.type)) || target instanceof HTMLSelectElement;
}

const nonTextInputs = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);

function onApplePlatform() {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}
