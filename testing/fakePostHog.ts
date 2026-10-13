export const postHogHost = "https://posthog.test";
export const projectToken = "phc_test_project_token";

export type CapturedEvent = {
  event: string;
  distinct_id: string;
  uuid: string;
  timestamp: string;
  properties: Record<string, unknown>;
};

export type BatchRequest = {
  url: string;
  body: string;
  apiKey: unknown;
  events: CapturedEvent[];
  startedAt: number;
  endedAt?: number;
};

type Answer = (signal?: AbortSignal) => Response | Promise<Response>;

export const answersWith = (status: number): Answer => () => new Response(null, { status });

export const failsToConnect: Answer = () => {
  throw new TypeError("fetch failed");
};

export const neverAnswers: Answer = (signal) =>
  new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason)));

export function stallsUntilReleased() {
  let release: (response: Response) => void = () => {};
  const answer: Answer = () => new Promise<Response>((resolve) => (release = resolve));
  return { answer, release: () => release(new Response(null, { status: 200 })) };
}

export class FakePostHog {
  readonly requests: BatchRequest[] = [];
  private readonly scripted: Answer[] = [];

  answering(...answers: Answer[]) {
    this.scripted.push(...answers);
    return this;
  }

  events() {
    return this.requests.flatMap((request) => request.events);
  }

  owns(url: URL) {
    return url.origin === postHogHost;
  }

  readonly fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const body = String(init?.body ?? "");
    const parsed = JSON.parse(body) as { api_key: unknown; batch: CapturedEvent[] };
    const request: BatchRequest = { url: url.href, body, apiKey: parsed.api_key, events: parsed.batch, startedAt: Date.now() };
    this.requests.push(request);
    const answer = this.scripted.shift() ?? answersWith(200);
    try {
      return await answer(init?.signal ?? undefined);
    } finally {
      request.endedAt = Date.now();
    }
  };
}

export function routedFetch(postHog: FakePostHog, otherwise: typeof fetch) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    return postHog.owns(url) ? postHog.fetch(input, init) : otherwise(input, init);
  };
}
