export const postHogHost = "https://posthog.test";
export const projectToken = "phc_test_project_token";
export const flagsKey = "phs_test_flags_key";

export type CapturedEvent = {
  event: string;
  distinct_id: string;
  uuid: string;
  timestamp: string;
  properties: Record<string, unknown>;
};

export type BatchRequest = { url: string; body: string; apiKey: unknown; events: CapturedEvent[] };

export type FlagDefinition = {
  key: string;
  active?: boolean;
  filters: {
    groups: Array<{ properties?: Array<Record<string, unknown>>; rollout_percentage?: number; variant?: string | null }>;
    multivariate?: { variants: Array<{ key: string; rollout_percentage: number }> } | null;
  };
};

type Answer = () => Response;

export const answersWith = (status: number): Answer => () => new Response(null, { status });

export class FakePostHog {
  readonly requests: BatchRequest[] = [];
  private readonly scripted: Answer[] = [];
  private definitions: FlagDefinition[] = [];

  answering(...answers: Answer[]) {
    this.scripted.push(...answers);
    return this;
  }

  withFlags(...definitions: FlagDefinition[]) {
    this.definitions = definitions;
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
    if (url.pathname === "/flags/definitions") return this.flagDefinitions(url, new Headers(init?.headers));
    const body = String(init?.body ?? "");
    const parsed = JSON.parse(body) as { api_key: unknown; batch: CapturedEvent[] };
    this.requests.push({ url: url.href, body, apiKey: parsed.api_key, events: parsed.batch });
    const answer = this.scripted.shift() ?? answersWith(200);
    return answer();
  };

  private flagDefinitions(url: URL, headers: Headers) {
    const authorized = url.searchParams.get("token") === projectToken && headers.get("authorization") === `Bearer ${flagsKey}`;
    if (!authorized) return answersWith(401)();
    const flags = this.definitions.map((definition, index) => ({
      id: index + 1,
      name: definition.key,
      deleted: false,
      active: true,
      ensure_experience_continuity: false,
      ...definition,
    }));
    return Response.json({ flags, group_type_mapping: {}, cohorts: {} });
  }
}

export function routedFetch(postHog: FakePostHog, otherwise: typeof fetch) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    return postHog.owns(url) ? postHog.fetch(input, init) : otherwise(input, init);
  };
}
