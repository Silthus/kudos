import type { CaptureResult } from "posthog-js/dist/module.full.no-external";
import { reportableException } from "./reportableException";
import { withoutSignInCode } from "./withoutSignInCode";

export function sendableFrom(postHogScriptUrl: string) {
  return (event: CaptureResult | null): CaptureResult | null => reportableException(withoutSignInCode(withoutPersonSet(event)), postHogScriptUrl);
}

function withoutPersonSet(event: CaptureResult | null): CaptureResult | null {
  if (event === null) return null;
  const { $set: _surveySeenState, ...sendable } = event;
  return sendable;
}
