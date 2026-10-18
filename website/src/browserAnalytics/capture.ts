import type { PostHog, PostHogConfig } from "posthog-js/dist/module.full.no-external";
import type { BrowserAnalytics } from "../../../convex/website/browserAnalytics";
import { captureEveryPageview } from "./pageviews";
import { withoutSignInCode } from "./withoutSignInCode";

export type Capture = Extract<BrowserAnalytics, { kind: "capture" }>;

export type PostHogLoader = () => Promise<PostHog>;

type Running = { capture: string; posthog?: PostHog; stopPageviews?: () => void };

let instances = 0;

export function browserAnalytics(load: PostHogLoader) {
  let running: Running | null = null;

  const stop = () => {
    if (running === null) return;
    const { posthog, stopPageviews } = running;
    running = null;
    stopPageviews?.();
    if (posthog !== undefined) silence(posthog);
  };

  const start = (capture: Capture) => {
    const starting: Running = { capture: keyOf(capture) };
    running = starting;
    void load().then(
      (module) => {
        if (running !== starting) return;
        const posthog = module.init(capture.token, optionsFor(capture), `hedgehug-${++instances}`);
        posthog.opt_in_capturing({ captureEventName: false });
        posthog.register({ environment: capture.environment });
        starting.posthog = posthog;
        starting.stopPageviews = captureEveryPageview(posthog);
      },
      () => {
        if (running === starting) running = null;
      },
    );
  };

  return {
    follow(answer: BrowserAnalytics | { kind: string } | Error | undefined) {
      if (answer === undefined) return;
      const capture = answer instanceof Error || answer.kind !== "capture" ? null : (answer as Capture);
      if (capture !== null && running?.capture === keyOf(capture)) return;
      stop();
      if (capture !== null) start(capture);
    },
    stop,
  };
}

function silence(posthog: PostHog) {
  posthog.stopSessionRecording();
  posthog.opt_out_capturing();
  posthog.reset();
  posthog.opt_out_capturing();
}

function keyOf({ token, host, distinctId, environment }: Capture) {
  return JSON.stringify([token, host, distinctId, environment]);
}

export function optionsFor({ host, distinctId }: Capture): Partial<PostHogConfig> {
  return {
    api_host: host,
    bootstrap: { distinctID: distinctId, isIdentifiedID: true },
    person_profiles: "identified_only",
    persistence: "localStorage",
    persistence_name: `hedgehug-${distinctId}`,
    opt_out_persistence_by_default: true,
    advanced_disable_feature_flags: true,
    disable_surveys: true,
    disable_session_recording: true,
    disable_external_dependency_loading: true,
    capture_exceptions: false,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    enable_heatmaps: true,
    capture_dead_clicks: true,
    rageclick: true,
    capture_performance: { web_vitals: true, network_timing: false },
    before_send: withoutSignInCode,
  };
}
