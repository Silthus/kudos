export type RichElement =
  | { type: "user"; user_id: string; style?: Style }
  | { type: "usergroup"; usergroup_id: string }
  | { type: "broadcast"; range: "here" | "channel" | "everyone" }
  | { type: "emoji"; name: string; style?: Style }
  | { type: "text"; text: string; style?: Style }
  | { type: "link"; url: string; text?: string }
  | { type: "channel"; channel_id: string }
  | { type: "rich_text_section" | "rich_text_quote" | "rich_text_preformatted" | "rich_text_list"; elements: RichElement[] };

type Style = { strike?: boolean; code?: boolean; bold?: boolean };

export const mention = (user: string, style?: Style): RichElement => ({ type: "user", user_id: user, ...(style && { style }) });
export const userGroup = (id: string): RichElement => ({ type: "usergroup", usergroup_id: id });
export const broadcast = (range: "here" | "channel" | "everyone"): RichElement => ({ type: "broadcast", range });
export const emoji = (name: string, style?: Style): RichElement => ({ type: "emoji", name, ...(style && { style }) });
export const text = (value: string, style?: Style): RichElement => ({ type: "text", text: value, ...(style && { style }) });
export const link = (url: string, label?: string): RichElement => ({ type: "link", url, ...(label && { text: label }) });
export const channel = (id: string): RichElement => ({ type: "channel", channel_id: id });
export const section = (...elements: RichElement[]): RichElement => ({ type: "rich_text_section", elements });
export const list = (...items: RichElement[]): RichElement => ({ type: "rich_text_list", elements: items });
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

export type EditOptions = Omit<MessageOptions, "subtype" | "botId"> & { editedTs?: string | null };

export function messageChangedEvent(blocks: RichElement[], options: EditOptions = {}) {
  eventCounter += 1;
  const team = options.team ?? "T1";
  const ts = options.ts ?? "1760349600.000100";
  const editedTs = options.editedTs === undefined ? "1760349660.000100" : options.editedTs;
  return JSON.stringify({
    type: "event_callback",
    team_id: team,
    event_id: `Ev${eventCounter}`,
    event: {
      type: "message",
      subtype: "message_changed",
      hidden: true,
      channel: options.channel ?? "C1",
      channel_type: options.channelType ?? "channel",
      ts: editedTs ?? "1760349900.000200",
      message: {
        type: "message",
        user: options.user ?? "U_ALICE",
        ts,
        text: "thanks for the help, edited",
        team,
        blocks: [{ type: "rich_text", block_id: "b1", elements: blocks }],
        ...(editedTs && { edited: { user: options.user ?? "U_ALICE", ts: editedTs } }),
        ...(options.threadTs && { thread_ts: options.threadTs }),
        ...options.extra,
      },
      previous_message: { type: "message", user: options.user ?? "U_ALICE", ts, text: "thanks for the help" },
    },
  });
}

export function messageDeletedEvent(options: Pick<MessageOptions, "team" | "channel" | "ts"> = {}) {
  eventCounter += 1;
  const team = options.team ?? "T1";
  const ts = options.ts ?? "1760349600.000100";
  return JSON.stringify({
    type: "event_callback",
    team_id: team,
    event_id: `Ev${eventCounter}`,
    event: {
      type: "message",
      subtype: "message_deleted",
      hidden: true,
      channel: options.channel ?? "C1",
      channel_type: "channel",
      ts: "1760349999.000300",
      deleted_ts: ts,
      previous_message: { type: "message", user: "U_ALICE", ts, text: "thanks for the help" },
    },
  });
}

export function appHomeOpened(user: string, options: { team?: string; tab?: "home" | "messages"; eventTime?: Date } = {}) {
  eventCounter += 1;
  return JSON.stringify({
    type: "event_callback",
    team_id: options.team ?? "T1",
    event_id: `Ev${eventCounter}`,
    event_time: Math.floor((options.eventTime ?? new Date()).getTime() / 1000),
    event: { type: "app_home_opened", user, channel: "D_KUDOS", tab: options.tab ?? "home", event_ts: "1760349600.000200" },
  });
}

export function memberEvent(type: "team_join" | "user_change", user: Record<string, unknown>, options: { team?: string; eventTs?: string } = {}) {
  eventCounter += 1;
  const team = options.team ?? "T1";
  return JSON.stringify({
    type: "event_callback",
    team_id: team,
    event_id: `Ev${eventCounter}`,
    event: { type, user: { team_id: team, ...user }, cache_ts: 1760349600, event_ts: options.eventTs ?? `${Date.now() / 1000}` },
  });
}

export type Conversation = { channel_id: string; channel_name: string };

export type SlashCommandOptions = { command?: "/hedgehug" | "/kudos"; team?: string; user?: string; responseUrl?: string };

export const slashCommandResponseUrl = "https://hooks.slack.com/commands/T1/1/abc";

export function slashCommand(conversation: Conversation, options: SlashCommandOptions = {}) {
  return new URLSearchParams({
    token: "legacy-verification-token",
    team_id: options.team ?? "T1",
    team_domain: "acme",
    ...conversation,
    user_id: options.user ?? "U1",
    user_name: "ann",
    command: options.command ?? "/hedgehug",
    text: "",
    api_app_id: "A1",
    response_url: options.responseUrl ?? slashCommandResponseUrl,
    trigger_id: "1.2.3",
  }).toString();
}
