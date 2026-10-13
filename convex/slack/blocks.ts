import type { Intent } from "../bus/commands";

export type Button = { label: string; intent: Intent };

export function buttonOf({ label, intent }: Button) {
  return { type: "button", action_id: actionIdOf(intent), text: plainText(label), value: JSON.stringify(intent) };
}

export function mrkdwn(text: string) {
  return { type: "mrkdwn", text };
}

export function plainText(text: string) {
  return { type: "plain_text", text };
}

function actionIdOf(intent: Intent) {
  return Object.entries(intent)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}
