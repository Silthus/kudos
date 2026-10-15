import type { CommandAction, Confirmation, HomeAction, LinkAction, MenuOption } from "../feedback/home";
import { encodeHomeAction } from "./interactivity";

export function buttonOf(action: HomeAction) {
  return "url" in action ? linkButtonOf(action) : commandButtonOf(action);
}

function commandButtonOf({ label, command, accessibilityLabel, confirm }: CommandAction) {
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

export function menuOf({ id, placeholder, options }: { id: string; placeholder: string; options: MenuOption[] }) {
  return { type: "static_select", action_id: id, placeholder: plainText(placeholder), options: options.map(({ label, command }) => ({ text: plainText(label), value: encodeHomeAction(command) })) };
}

function linkButtonOf({ label, url, accessibilityLabel, id }: LinkAction) {
  return urlButtonOf({ label, url, actionId: `website-link:${id}`, accessibilityLabel });
}

export function urlButtonOf({ label, url, actionId, accessibilityLabel }: { label: string; url: string; actionId: string; accessibilityLabel?: string }) {
  return { type: "button", text: plainText(label), url, action_id: actionId, ...(accessibilityLabel !== undefined && { accessibility_label: accessibilityLabel }) };
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
