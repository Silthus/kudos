export type SlackResult = { ok: boolean; error?: string; [field: string]: unknown };

export async function callSlack(method: string, args: Record<string, string>): Promise<SlackResult> {
  const response = await fetch(`${apiUrl()}/${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${botToken()}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(args).toString(),
  });
  return (await response.json()) as SlackResult;
}

function apiUrl() {
  return process.env.SLACK_API_URL ?? "https://slack.com/api";
}

function botToken() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  return token;
}
