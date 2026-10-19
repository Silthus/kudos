import type { EmojiMappingsAnswer } from "./shell";

export type EmojiMappingsShown = EmojiMappingsAnswer | { kind: "connecting" } | { kind: "broken" };

export type EmojiMappingsRead = (asking: boolean) => EmojiMappingsShown | undefined;
