import type { Mention, MessageContent, MessageEvent } from "../engine/messageEvent";

type Style = { strike?: boolean; code?: boolean };

type RichElement = {
  type: string;
  elements?: RichElement[];
  user_id?: string;
  name?: string;
  text?: string;
  style?: Style;
};

export type SlackMessage = {
  type: string;
  subtype?: string;
  channel: string;
  channel_type?: string;
  user?: string;
  bot_id?: string;
  ts: string;
  thread_ts?: string;
  blocks?: Array<{ type: string; elements?: RichElement[] }>;
};

export type EventCallback = { type: "event_callback"; team_id: string; event_id: string; event: { type: string } };

const countedSubtypes = new Set([undefined, "thread_broadcast", "file_share"]);
const channelTypes = new Set(["channel", "group"]);
const uncountedContainers = new Set(["rich_text_quote", "rich_text_preformatted"]);

export function isMessage(event: { type: string }): event is SlackMessage {
  return event.type === "message";
}

export function messageEventOf(envelope: EventCallback): MessageEvent | null {
  const message = envelope.event;
  if (!isMessage(message) || !isPostedByAPerson(message) || !channelTypes.has(message.channel_type ?? "")) return null;
  if (!countedSubtypes.has(message.subtype)) return null;
  const revision = revisionOf(message.ts);
  return {
    kind: "posted",
    ref: { workspace: envelope.team_id, conversation: message.channel, message: message.ts },
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

function isPostedByAPerson(message: SlackMessage): message is SlackMessage & { user: string } {
  return message.user !== undefined && message.bot_id === undefined;
}

function isThreadReply(message: SlackMessage) {
  return message.thread_ts !== undefined && message.thread_ts !== message.ts;
}

function revisionOf(ts: string): bigint {
  const [seconds = "0", fraction = ""] = ts.split(".");
  return BigInt(seconds) * 1_000_000n + BigInt(fraction.padEnd(6, "0").slice(0, 6));
}

function countableContent(message: SlackMessage): MessageContent {
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
  if (element.type === "usergroup") return { kind: "group" };
  if (element.type === "broadcast") return { kind: "broadcast" };
  return undefined;
}

function isStruckOrCode(style: Style | undefined) {
  return style?.strike === true || style?.code === true;
}
