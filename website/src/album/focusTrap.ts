import type { KeyboardEvent } from "react";

const buttonsAndFields = "button:not(:disabled), input:not(:disabled)";

export function keepFocusIn(dialog: HTMLElement | null, event: KeyboardEvent<HTMLElement>, focusable = buttonsAndFields) {
  const controls = [...(dialog?.querySelectorAll<HTMLElement>(focusable) ?? [])];
  const focused = document.activeElement as HTMLElement | null;
  const atTheEdge = event.shiftKey ? focused === controls[0] : focused === controls.at(-1);
  if (controls.length > 0 && focused !== null && controls.includes(focused) && !atTheEdge) return;
  event.preventDefault();
  (controls.length === 0 ? dialog : event.shiftKey ? controls.at(-1) : controls[0])?.focus();
}
