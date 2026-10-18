import type { PostHog, PostHogConfig } from "posthog-js/dist/module.full.no-external";
import type { BrowserAnalytics } from "../../../convex/website/browserAnalytics";
import { captureEveryPageview, pagePropertiesOf } from "./pageviews";
import { reportableException } from "./reportableException";
import { withoutSignInCode } from "./withoutSignInCode";

export type Capture = Extract<BrowserAnalytics, { kind: "capture" }>;

export type PostHogScript = { posthog: PostHog; scriptUrl: string };

export type PostHogLoader = () => Promise<PostHogScript>;

type Running = { capture: string; posthog?: PostHog; stopPageviews?: () => void };

type Caught = { error: unknown; page: string };

let instances = 0;

export function browserAnalytics(load: PostHogLoader) {
  let running: Running | null = null;
  let answered = false;
  let held: Caught[] = [];

  const stop = () => {
    held = [];
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
      ({ posthog: sdk, scriptUrl }) => {
        if (running !== starting) return;
        const posthog = sdk.init(capture.token, optionsFor(capture, scriptUrl), `hedgehug-${++instances}`);
        posthog.opt_in_capturing({ captureEventName: false });
        posthog.register({ environment: capture.environment });
        starting.posthog = posthog;
        starting.stopPageviews = captureEveryPageview(posthog);
        for (const caught of held.splice(0)) report(posthog, caught);
      },
      () => {
        if (running === starting) stop();
      },
    );
  };

  return {
    follow(answer: BrowserAnalytics | { kind: string } | Error | undefined) {
      if (answer === undefined) return;
      const capture = answer instanceof Error || answer.kind !== "capture" ? null : (answer as Capture);
      if (capture !== null && running?.capture === keyOf(capture)) return;
      if (answered || capture === null) stop();
      answered = true;
      if (capture !== null) start(capture);
    },
    report(error: unknown) {
      const caught = { error, page: pagePropertiesOf(window.location).page };
      if (running?.posthog !== undefined) report(running.posthog, caught);
      else if (running !== null || !answered) held.push(caught);
    },
    stop,
  };
}

function report(posthog: PostHog, { error, page }: Caught) {
  posthog.captureException(error, { page });
}

function silence(posthog: PostHog) {
  posthog.stopSessionRecording();
  posthog.stopExceptionAutocapture();
  posthog.opt_out_capturing();
  posthog.reset();
  posthog.opt_out_capturing();
}

function keyOf({ token, host, distinctId, environment }: Capture) {
  return JSON.stringify([token, host, distinctId, environment]);
}

export function optionsFor({ host, distinctId }: Capture, postHogScriptUrl: string): Partial<PostHogConfig> {
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
    capture_exceptions: { capture_unhandled_errors: true, capture_unhandled_rejections: true, capture_console_errors: false },
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    enable_heatmaps: true,
    capture_dead_clicks: true,
    rageclick: true,
    capture_performance: { web_vitals: true, network_timing: false },
    before_send: (event) => reportableException(withoutSignInCode(event), postHogScriptUrl),
  };
}
