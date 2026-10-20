import type { Command } from "../commands/commands";
import type { HomeLine } from "../feedback/home";
import { customKudosEmojiPerWorkspace } from "../store/customKudosEmoji";
import { plainText, shortened } from "./blocks";

const optionTextLimit = 75;

export const customEmojiPickerAction = "setCustomKudosEmoji" satisfies Command["type"];

export function customEmojiPickerOf({ placeholder, picked }: Extract<HomeLine, { kind: "pick-custom-emoji" }>) {
  const initial = picked.map(customEmojiOptionOf);
  return {
    type: "multi_external_select",
    action_id: customEmojiPickerAction,
    placeholder: plainText(placeholder),
    min_query_length: 1,
    max_selected_items: customKudosEmojiPerWorkspace,
    ...(initial.length > 0 && { initial_options: initial }),
  };
}

export function customEmojiOptionOf(name: string) {
  return { text: plainText(shortened(`:${name}:`, optionTextLimit)), value: name };
}
