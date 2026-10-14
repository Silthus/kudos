import type { HomeAction } from "../feedback/home";
import { encodeHomeAction } from "./interactivity";

export function buttonOf({ label, command }: HomeAction) {
  const action = encodeHomeAction(command);
  return { type: "button", text: plainText(label), action_id: action, value: action };
}

export function mrkdwn(text: string) {
  return { type: "mrkdwn", text };
}

export function plainText(text: string) {
  return { type: "plain_text", text };
}
