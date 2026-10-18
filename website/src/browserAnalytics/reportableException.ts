import type { CaptureResult } from "posthog-js/dist/module.full.no-external";

type SentException = { type?: unknown; value?: unknown; stacktrace?: { frames?: { filename?: unknown }[] } };

export function reportableException(event: CaptureResult | null, postHogScriptUrl: string): CaptureResult | null {
  if (event === null || event.event !== "$exception") return event;
  const exceptions: unknown = event.properties.$exception_list;
  if (!Array.isArray(exceptions) || thrownInside(exceptions, postHogScriptUrl)) return null;
  return { ...event, properties: { ...event.properties, $exception_list: exceptions.map(withItsTypeForMessage) } };
}

function thrownInside([thrown]: SentException[], scriptUrl: string) {
  return thrown?.stacktrace?.frames?.at(-1)?.filename === scriptUrl;
}

function withItsTypeForMessage(exception: SentException): SentException {
  return { ...exception, value: typeNameOf(exception) };
}

function typeNameOf({ type }: SentException) {
  return typeof type === "string" && type.length > 0 ? type : "Error";
}
