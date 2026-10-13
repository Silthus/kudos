// PROTOTYPE (throwaway, never merged): the kudos parser turns a platform-neutral chat message
// into a kudos message. Parse hooks decide which emoji give kudos and how many, and attach
// annotations (facts about the note) that travel with the kudosGiven event. Text is read here, never stored.

import type { KudosEmojiValue, KudosParser, MessageContent, ParseContext, ParseHook, Settings } from "./contracts.ts";

export function workspaceEmojiHook(settings: Settings): ParseHook {
  return {
    name: "workspace emoji",
    kudosEmoji: ({ workspace }) => [{ name: settings.of(workspace).kudosEmoji, kudos: 1 }],
  };
}

export function createKudosParser(hooks: ParseHook[]): KudosParser {
  return {
    parse(content, context) {
      const values = kudosEmojiValues(hooks, context);
      const kudosEmoji = content.emoji.flatMap((name) => {
        const kudos = values.get(name);
        return kudos === undefined ? [] : [{ name, kudos }];
      });
      if (content.mentions.length === 0 || kudosEmoji.length === 0) return null;
      return {
        mentions: content.mentions,
        kudosEmoji,
        perRecipient: kudosEmoji.reduce((sum, emoji) => sum + emoji.kudos, 0),
        annotations: annotations(hooks, content, context),
      };
    },
  };
}

function kudosEmojiValues(hooks: ParseHook[], context: ParseContext) {
  const values = new Map<string, number>();
  const claims: KudosEmojiValue[] = hooks.flatMap((hook) => hook.kudosEmoji?.(context) ?? []);
  for (const { name, kudos } of claims) values.set(name, Math.max(kudos, values.get(name) ?? 0));
  return values;
}

function annotations(hooks: ParseHook[], content: MessageContent, context: ParseContext) {
  return Object.assign({}, ...hooks.map((hook) => hook.annotate?.(content, context) ?? {}));
}
