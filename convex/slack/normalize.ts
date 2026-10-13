import type { Mention, MessageContent, MessageEvent } from "../engine/messageEvent";

type Style = { strike?: boolean; code?: boolean };

type RichElement = {
  type: string;
  elements?: RichElement[];
  user_id?: string;
  usergroup_id?: string;
  range?: string;
  name?: string;
  text?: string;
  style?: Style;
};

type ChatMessage = {
  subtype?: string;
  user?: string;
  bot_id?: string;
  ts: string;
  thread_ts?: string;
  edited?: { ts: string };
  blocks?: Array<{ type: string; elements?: RichElement[] }>;
};

export type SlackMessage = ChatMessage & {
  type: string;
  channel: string;
  channel_type?: string;
  message?: ChatMessage;
};

export type EventCallback = { type: "event_callback"; team_id: string; event_id: string; event: { type: string } };

const countedSubtypes = new Set([undefined, "thread_broadcast", "file_share"]);
const channelTypes = new Set(["channel", "group"]);
const uncountedContainers = new Set(["rich_text_quote", "rich_text_preformatted"]);

export function isMessage(event: { type: string }): event is SlackMessage {
  return event.type === "message";
}

export function messageEventOf(envelope: EventCallback): MessageEvent | null {
  const event = envelope.event;
  if (!isMessage(event) || !channelTypes.has(event.channel_type ?? "")) return null;
  if (event.subtype === "message_changed") return editOf(envelope.team_id, event);
  if (!countedSubtypes.has(event.subtype)) return null;
  return messageEventFrom({ kind: "posted", workspace: envelope.team_id, channel: event.channel, message: event, revisionTs: event.ts });
}

function editOf(workspace: string, event: SlackMessage): MessageEvent | null {
  const message = event.message;
  if (message?.edited === undefined) return null;
  return messageEventFrom({ kind: "edited", workspace, channel: event.channel, message, revisionTs: message.edited.ts });
}

type Source = { kind: MessageEvent["kind"]; workspace: string; channel: string; message: ChatMessage; revisionTs: string };

function messageEventFrom({ kind, workspace, channel, message, revisionTs }: Source): MessageEvent | null {
  if (!isPostedByAPerson(message)) return null;
  const revision = revisionOf(revisionTs);
  return {
    kind,
    ref: { workspace, conversation: channel, message: message.ts },
    ...(isThreadReply(message) && { threadRoot: message.thread_ts }),
    author: message.user,
    revision,
    at: Number(revision / 1000n),
    content: countableContent(message),
  };
}

export function mayGiveKudos(event: MessageEvent | null): event is MessageEvent {
  if (event === null) return false;
  return event.kind === "edited" || (event.content.mentions.length > 0 && event.content.emoji.length > 0);
}

function isPostedByAPerson(message: ChatMessage): message is ChatMessage & { user: string } {
  return message.user !== undefined && message.bot_id === undefined;
}

function isThreadReply(message: ChatMessage) {
  return message.thread_ts !== undefined && message.thread_ts !== message.ts;
}

function revisionOf(ts: string): bigint {
  const [seconds = "0", fraction = ""] = ts.split(".");
  return BigInt(seconds) * 1_000_000n + BigInt(fraction.padEnd(6, "0").slice(0, 6));
}

function countableContent(message: ChatMessage): MessageContent {
  const content: MessageContent = { mentions: [], emoji: [], text: "" };
  const visit = (element: RichElement) => {
    if (uncountedContainers.has(element.type) || isStruckOrCode(element.style)) return;
    const mention = mentionOf(element);
    if (mention) content.mentions.push(mention);
    else if (element.type === "emoji" && element.name) content.emoji.push(element.name);
    else if (element.type === "text") content.text += element.text ?? "";
    element.elements?.forEach(visit);
  };
  for (const block of message.blocks ?? []) if (block.type === "rich_text") block.elements?.forEach(visit);
  return content;
}

function mentionOf(element: RichElement): Mention | undefined {
  if (element.type === "user" && element.user_id) return { kind: "person", user: element.user_id };
  if (element.type === "usergroup" && element.usergroup_id) return { kind: "group", group: element.usergroup_id };
  if (element.type === "broadcast" && element.range) return { kind: "broadcast", range: element.range };
  return undefined;
}

function isStruckOrCode(style: Style | undefined) {
  return style?.strike === true || style?.code === true;
}
