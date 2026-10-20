import type { ListedEmoji } from "./customEmoji";
import { standardEmojiRows } from "./standardEmojiRows";

const pictureHost = "https://a.slack-edge.com/production-standard-emoji-assets/17.0/apple-large/";

const named = standardEmojiRows.map(([name, picture, ...aliases]) => ({ emoji: { name, image: `${pictureHost}${picture}.png` }, aliases }));

const listed: readonly ListedEmoji[] = named.map(({ emoji }) => emoji);

const emojiByName: ReadonlyMap<string, ListedEmoji> = new Map(named.flatMap(({ emoji, aliases }) => [emoji.name, ...aliases].map((name) => [name, emoji] as const)));

const namesInOrder: readonly string[] = [...emojiByName.keys()].sort();

export function isStandardEmojiName(name: string): boolean {
  return emojiByName.has(name);
}

export function standardEmojiNamed(name: string): ListedEmoji | null {
  return emojiByName.get(name) ?? null;
}

export function standardEmojiStartingWith(typed: string, limit: number): ListedEmoji[] {
  const found = new Map<string, ListedEmoji>();
  for (const name of namesInOrder) {
    if (found.size === limit) break;
    const emoji = name.startsWith(typed) ? emojiByName.get(name) : undefined;
    if (emoji !== undefined) found.set(emoji.name, emoji);
  }
  return [...found.values()];
}

export function standardEmojiListed(): readonly ListedEmoji[] {
  return listed;
}
