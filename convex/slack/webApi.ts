export type SlackAnswer = { ok: true; warning?: string } | SlackRefusal;
export type SlackRefusal = { ok: false; error: string; retryAfterMs?: number };

const answerTimeoutMs = 10_000;

export async function callSlack(method: string, args: Record<string, unknown>): Promise<SlackAnswer> {
  const response = await fetch(`${slackApiUrl()}/${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${botToken()}`, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(answerTimeoutMs),
  });
  return answerOf(method, response);
}

export async function readSlack<Data>(method: string, args: Record<string, string>): Promise<({ ok: true } & Data) | SlackRefusal> {
  const response = await fetch(`${slackApiUrl()}/${method}?${new URLSearchParams(args)}`, {
    headers: { authorization: `Bearer ${botToken()}` },
    signal: AbortSignal.timeout(answerTimeoutMs),
  });
  return answerOf(method, response);
}

async function answerOf<Answer>(method: string, response: Response): Promise<Answer> {
  if (response.status === 429) return rateLimited(response) as Answer;
  if (!response.ok) throw new Error(`Slack ${method} answered HTTP ${response.status}`);
  return (await response.json()) as Answer;
}

function rateLimited(response: Response): SlackRefusal {
  const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "1");
  return { ok: false, error: "ratelimited", retryAfterMs: (Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 1) * 1000 };
}

function slackApiUrl() {
  return process.env.SLACK_API_URL ?? "https://slack.com/api";
}

function botToken() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  return token;
}
