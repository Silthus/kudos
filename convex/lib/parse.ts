const MENTION = /<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Kudos each mentioned person receives, HeyTaco-style: every emoji gives one kudos to every
 * mention, so `@ana @ben :taco: :taco:` gives ana and ben 2 each. 0: not a kudos attempt.
 */
export function countEmoji(text: string, emojiName: string): number {
  const re = new RegExp(`:${escapeRegExp(emojiName)}:(?::skin-tone-\\d:)?`, "g");
  return text.match(re)?.length ?? 0;
}

/** Unique Slack user ids mentioned, in order of appearance. */
export function mentionedUsers(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(MENTION)) seen.add(m[1]);
  return [...seen];
}

/** Normalises `taco::skin-tone-2` (as sent in reaction events) to `taco`. */
export function baseEmojiName(reaction: string): string {
  return reaction.split("::")[0];
}

/** Human-readable preview of a Slack message: resolves mentions, trims length. */
export function previewText(
  text: string,
  nameFor: (slackUserId: string) => string | undefined,
  max = 280,
): string {
  const resolved = text
    .replace(MENTION, (_m, id: string) => `@${nameFor(id) ?? "someone"}`)
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
  return resolved.length > max ? `${resolved.slice(0, max - 1)}…` : resolved;
}

const NOTE_NOISE = [
  /<[@#!][^>]*>/g, // mentions, channel links, @here/@channel
  /<(?:https?|mailto):[^>]*>/g, // Slack-formatted links, label included
  /\bhttps?:\/\/\S+/g, // bare URLs (playground input)
  /:[a-z0-9_+'-]+:/gi, // every :shortcode:, skin tones included
  /&(?:amp|lt|gt);/g,
];
const NOTE_WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu; // marks stay inside their word

/**
 * Words in the Note of a kudos message: what's left after mentions, channel links,
 * URLs and emoji are removed. Quests only count kudos whose Note has a few words.
 */
export function countNoteWords(rawText: string, emojiName: string, emojiGlyph: string): number {
  let note = emojiGlyph ? rawText.split(emojiGlyph).join(" ") : rawText;
  note = note.split(`:${emojiName}:`).join(" ");
  for (const re of NOTE_NOISE) note = note.replace(re, " ");
  return note.match(NOTE_WORD)?.length ?? 0;
}
