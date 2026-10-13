export type SlackAnswer = { ok: true; warning?: string } | { ok: false; error: string };

export async function callSlack(method: string, args: Record<string, unknown>): Promise<SlackAnswer> {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${botToken()}`, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`Slack ${method} answered HTTP ${response.status}`);
  return (await response.json()) as SlackAnswer;
}

function botToken() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  return token;
}
