import type { Confirmation, HomeAction } from "../feedback/home";
import { encodeHomeAction } from "./interactivity";

export function buttonOf({ label, command, accessibilityLabel, confirm }: HomeAction) {
  const action = encodeHomeAction(command);
  return {
    type: "button",
    text: plainText(label),
    action_id: action,
    value: action,
    ...(accessibilityLabel !== undefined && { accessibility_label: accessibilityLabel }),
    ...(confirm !== undefined && { confirm: confirmationOf(confirm) }),
  };
}

function confirmationOf({ title, text, confirm, deny }: Confirmation) {
  return { title: plainText(title), text: plainText(text), confirm: plainText(confirm), deny: plainText(deny) };
}

export function mrkdwn(text: string) {
  return { type: "mrkdwn", text };
}

export function plainText(text: string) {
  return { type: "plain_text", text };
}
