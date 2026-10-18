import type { CapturedNetworkRequest, CaptureResult } from "posthog-js/dist/module.full.no-external";

export function withoutSignInCode(event: CaptureResult | null): CaptureResult | null {
  return event === null ? null : scrubbed(event);
}

export function replayRequestWithoutSignInCode(request: CapturedNetworkRequest): CapturedNetworkRequest {
  return request.name === undefined ? request : { ...request, name: urlWithoutSignInCode(request.name) };
}

export function urlWithoutSignInCode(text: string): string {
  if (!/^https?:\/\//i.test(text)) return text;
  try {
    const url = new URL(text);
    if (!url.searchParams.has("code")) return text;
    url.searchParams.delete("code");
    return url.toString();
  } catch {
    return text;
  }
}

function scrubbed<Value>(value: Value): Value {
  if (typeof value === "string") return urlWithoutSignInCode(value) as Value;
  if (Array.isArray(value)) return value.map(scrubbed) as Value;
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, scrubbed(inner)])) as Value;
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
