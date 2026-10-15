import type { Command } from "../commands/commands";
import type { HomeLine } from "../feedback/home";
import { plainText } from "./blocks";

export const customEmojiPickerAction = "setCustomKudosEmoji" satisfies Command["type"];

export function customEmojiPickerOf({ picked }: Extract<HomeLine, { kind: "pick-custom-emoji" }>) {
  const initial = picked.map(customEmojiOptionOf);
  return {
    type: "multi_external_select",
    action_id: customEmojiPickerAction,
    placeholder: plainText("Search custom emoji"),
    min_query_length: 1,
    ...(initial.length > 0 && { initial_options: initial }),
  };
}

export function customEmojiOptionOf(name: string) {
  return { text: plainText(`:${name}:`), value: name };
}
