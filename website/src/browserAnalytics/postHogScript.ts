import posthog from "posthog-js/dist/module.full.no-external";

export const postHogScriptUrl = import.meta.url;

export const postHogScript = { posthog, scriptUrl: postHogScriptUrl };
