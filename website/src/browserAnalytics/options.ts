import type { PostHogConfig } from "posthog-js/dist/module.full.no-external";
import type { Capture } from "./capture";
import { sendableFrom } from "./sendable";
import { replayRequestWithoutSignInCode } from "./withoutSignInCode";

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
    disable_session_recording: false,
    enable_recording_console_log: false,
    session_recording: {
      blockClass: "ph-no-capture",
      maskAllInputs: true,
      recordHeaders: false,
      recordBody: false,
      captureCanvas: { recordCanvas: false },
      recordCrossOriginIframes: false,
      maskCapturedNetworkRequestFn: replayRequestWithoutSignInCode,
    },
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
    before_send: sendableFrom(postHogScriptUrl),
  };
}
