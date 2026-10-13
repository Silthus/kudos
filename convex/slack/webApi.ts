export type SlackFailure = { ok: false; error: string; retryAfterMs?: number };

export type SlackAnswer<Data = object> = ({ ok: true; warning?: string } & Data) | SlackFailure;

const tooManyRequests = 429;
const answerTimeoutMs = 10_000;

export async function callSlack<Data = object>(method: string, args: Record<string, unknown>): Promise<SlackAnswer<Data>> {
  const response = await fetch(`${slackApiUrl()}/${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${botToken()}`, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(answerTimeoutMs),
  });
  return answerOf(method, response);
}

export async function readSlack<Data>(method: string, args: Record<string, string>): Promise<({ ok: true } & Data) | SlackFailure> {
  const response = await fetch(`${slackApiUrl()}/${method}?${new URLSearchParams(args)}`, {
    headers: { authorization: `Bearer ${botToken()}` },
    signal: AbortSignal.timeout(answerTimeoutMs),
  });
  return answerOf(method, response);
}

async function answerOf<Answer>(method: string, response: Response): Promise<Answer | SlackFailure> {
  if (response.status === tooManyRequests) return { ok: false, error: "ratelimited", retryAfterMs: retryAfterMsOf(response) };
  if (!response.ok) throw new Error(`Slack ${method} answered HTTP ${response.status}`);
  return (await response.json()) as Answer;
}

function retryAfterMsOf(response: Response) {
  const seconds = Number(response.headers.get("retry-after") ?? 1);
  return (Number.isFinite(seconds) ? seconds : 1) * 1000;
}

function slackApiUrl() {
  return process.env.SLACK_API_URL ?? "https://slack.com/api";
}

function botToken() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  return token;
}
