import posthog from "posthog-js/dist/module.full.no-external";
import type { Capture, PostHogScript } from "./capture";
import { optionsFor } from "./options";

export const postHogScriptUrl = import.meta.url;

export const postHogScript: PostHogScript = {
  start: (capture: Capture, name: string) => posthog.init(capture.token, optionsFor(capture, name, postHogScriptUrl), name),
};
