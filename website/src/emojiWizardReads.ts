import type { AppEmojisAnswer, SlackEmojiMatchesAnswer } from "./shell";

export type SlackEmojiMatchesShown = SlackEmojiMatchesAnswer | { kind: "connecting" } | { kind: "broken" };

export type SlackEmojiMatchesRead = (near: string, search: string) => SlackEmojiMatchesShown | undefined;

export type AppEmojisShown = AppEmojisAnswer | { kind: "connecting" } | { kind: "broken" };

export type AppEmojisRead = (asking: boolean) => AppEmojisShown | undefined;
