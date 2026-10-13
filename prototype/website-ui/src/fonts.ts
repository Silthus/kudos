// Loads PostHog's RoundHog display face from @posthog/brand on demand.
import { roundHogFontFaceCss } from "@posthog/brand/fonts/css";

let loaded = false;

export function useRoundHog() {
  if (loaded) return;
  loaded = true;
  const style = document.createElement("style");
  style.textContent = roundHogFontFaceCss;
  document.head.appendChild(style);
}
