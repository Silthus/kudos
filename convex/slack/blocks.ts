import type { HomeAction, LinkAction } from "../feedback/home";
import { encodeHomeAction } from "./interactivity";

export function buttonOf(action: HomeAction) {
  if ("url" in action) return linkButtonOf(action);
  const encoded = encodeHomeAction(action.command);
  return { type: "button", text: plainText(action.label), action_id: encoded, value: encoded };
}

function linkButtonOf({ label, url, accessibilityLabel, id }: LinkAction) {
  return { type: "button", text: plainText(label), url, action_id: `website-link:${id}`, accessibility_label: accessibilityLabel };
}

export function mrkdwn(text: string) {
  return { type: "mrkdwn", text };
}

export function plainText(text: string) {
  return { type: "plain_text", text };
}
