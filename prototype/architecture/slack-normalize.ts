// PROTOTYPE (throwaway, never merged): how the Slack adapter turns an Events API envelope
// into a receipt key plus a platform-neutral MessageEvent. Only this side of the seam knows Slack.

import type { ChatUserId, Mention, MessageEvent, WorkspaceId } from "./contracts.ts";

type RichElement = {
  type: string;
  elements?: RichElement[];
  user_id?: string;
  name?: string;
  style?: { strike?: boolean; code?: boolean };
};

type SlackMessage = {
  user?: string;
  bot_id?: string;
  subtype?: string;
  ts: string;
  thread_ts?: string;
  edited?: { ts: string };
  blocks?: Array<{ type: string; elements?: RichElement[] }>;
};

export type SlackEnvelope = {
  type: "event_callback";
  event_id: string;
  team_id: string;
  event: SlackMessage & {
    type: string;
    channel: string;
    channel_type?: string;
    message?: SlackMessage;
  };
};

export type Normalized = { receiptKey: string; event: MessageEvent | null };

const UNCOUNTED_CONTAINERS = new Set(["rich_text_quote", "rich_text_preformatted"]);

export function normalize(envelope: SlackEnvelope): Normalized {
  const receiptKey = `${envelope.team_id}/${envelope.event_id}`;
  const outer = envelope.event;
  if (outer.type !== "message" || !isChannel(outer.channel_type)) return { receiptKey, event: null };

  const edited = outer.subtype === "message_changed";
  const message = edited ? outer.message : outer;
  if (!message || !isHumanAuthored(message)) return { receiptKey, event: null };
  if (!edited && outer.subtype !== undefined && outer.subtype !== "thread_broadcast") return { receiptKey, event: null };

  const revisionTs = message.edited?.ts ?? (edited ? outer.ts : message.ts);
  return {
    receiptKey,
    event: {
      kind: edited ? "edited" : "posted",
      ref: { workspace: envelope.team_id as WorkspaceId, conversation: outer.channel, message: message.ts },
      threadRoot: message.thread_ts !== undefined && message.thread_ts !== message.ts ? message.thread_ts : undefined,
      author: message.user as ChatUserId,
      revision: toRevision(revisionTs),
      at: Number(toRevision(revisionTs) / 1000n),
      content: countableContent(message),
    },
  };
}

function isChannel(channelType: string | undefined) {
  return channelType === "channel" || channelType === "group";
}

function isHumanAuthored(message: SlackMessage) {
  return message.user !== undefined && message.bot_id === undefined && message.subtype !== "bot_message";
}

export function toRevision(ts: string): bigint {
  const [seconds = "0", fraction = ""] = ts.split(".");
  return BigInt(seconds) * 1_000_000n + BigInt(fraction.padEnd(6, "0").slice(0, 6));
}

function countableContent(message: SlackMessage) {
  const mentions: Mention[] = [];
  const emoji: string[] = [];
  const visit = (element: RichElement) => {
    if (UNCOUNTED_CONTAINERS.has(element.type) || isStruckOrCode(element)) return;
    if (element.type === "user") mentions.push({ kind: "person", user: element.user_id as ChatUserId });
    else if (element.type === "usergroup") mentions.push({ kind: "group" });
    else if (element.type === "broadcast") mentions.push({ kind: "broadcast" });
    else if (element.type === "emoji") emoji.push(withoutSkinTone(element.name ?? ""));
    for (const child of element.elements ?? []) visit(child);
  };
  for (const block of message.blocks ?? []) if (block.type === "rich_text") for (const element of block.elements ?? []) visit(element);
  return { mentions, emoji };
}

function isStruckOrCode(element: RichElement) {
  return element.style?.strike === true || element.style?.code === true;
}

function withoutSkinTone(name: string) {
  return name.replace(/::skin-tone-\d$/, "");
}
