export const postHogHost = "https://posthog.test";
export const projectToken = "phc_test_project_token";

export type CapturedEvent = {
  event: string;
  distinct_id: string;
  uuid: string;
  timestamp: string;
  properties: Record<string, unknown>;
};

export type BatchRequest = { url: string; body: string; apiKey: unknown; events: CapturedEvent[] };

type Answer = () => Response;

export const answersWith = (status: number): Answer => () => new Response(null, { status });

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
    this.requests.push({ url: url.href, body, apiKey: parsed.api_key, events: parsed.batch });
    const answer = this.scripted.shift() ?? answersWith(200);
    return answer();
  };
}

export function routedFetch(postHog: FakePostHog, otherwise: typeof fetch) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    return postHog.owns(url) ? postHog.fetch(input, init) : otherwise(input, init);
  };
}
