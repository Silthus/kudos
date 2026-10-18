import posthog from "posthog-js/dist/module.full.no-external";
import { sendableFrom } from "./sendable";

export const postHogScriptUrl = import.meta.url;

export const postHogScript = { posthog, sendable: sendableFrom(postHogScriptUrl) };
