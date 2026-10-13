export type RichElement =
  | { type: "user"; user_id: string; style?: Style }
  | { type: "usergroup"; usergroup_id: string }
  | { type: "broadcast"; range: "here" | "channel" | "everyone" }
  | { type: "emoji"; name: string; style?: Style }
  | { type: "text"; text: string; style?: Style }
  | { type: "rich_text_section" | "rich_text_quote" | "rich_text_preformatted"; elements: RichElement[] };

type Style = { strike?: boolean; code?: boolean; bold?: boolean };

export const mention = (user: string, style?: Style): RichElement => ({ type: "user", user_id: user, ...(style && { style }) });
export const userGroup = (id: string): RichElement => ({ type: "usergroup", usergroup_id: id });
export const broadcast = (range: "here" | "channel" | "everyone"): RichElement => ({ type: "broadcast", range });
export const emoji = (name: string, style?: Style): RichElement => ({ type: "emoji", name, ...(style && { style }) });
export const text = (value: string, style?: Style): RichElement => ({ type: "text", text: value, ...(style && { style }) });
export const section = (...elements: RichElement[]): RichElement => ({ type: "rich_text_section", elements });
export const quote = (...elements: RichElement[]): RichElement => ({ type: "rich_text_quote", elements });
export const codeBlock = (...elements: RichElement[]): RichElement => ({ type: "rich_text_preformatted", elements });

export type MessageOptions = {
  team?: string;
  channel?: string;
  channelType?: "channel" | "group" | "im" | "mpim";
  user?: string;
  ts?: string;
  threadTs?: string;
  subtype?: string;
  botId?: string;
  extra?: Record<string, unknown>;
};

let eventCounter = 0;

export function messageEvent(blocks: RichElement[], options: MessageOptions = {}) {
  eventCounter += 1;
  const team = options.team ?? "T1";
  return JSON.stringify({
    type: "event_callback",
    team_id: team,
    event_id: `Ev${eventCounter}`,
    event: {
      type: "message",
      channel: options.channel ?? "C1",
      channel_type: options.channelType ?? "channel",
      user: options.user ?? "U_ALICE",
      ts: options.ts ?? "1760349600.000100",
      text: "thanks for the help",
      team,
      blocks: [{ type: "rich_text", block_id: "b1", elements: blocks }],
      ...(options.threadTs && { thread_ts: options.threadTs }),
      ...(options.subtype && { subtype: options.subtype }),
      ...(options.botId && { bot_id: options.botId }),
      ...options.extra,
    },
  });
}
