import type { ReactNode } from "react";
import type { Message, Segment } from "../shell";
import { AppLink } from "../AppLink";
import { hrefOf } from "../album/place";
import { CustomEmoji, EmojiName } from "../CustomEmoji";
import { emojiCharacterOf, skinTonedCharacterOf } from "./emoji";

type Words = Extract<Message, { kind: "text" }>;

type Unavailable = Extract<Message, { kind: "unavailable" }>;

export type MessageLook = "album" | "slack";

type Looks = { look: MessageLook; me: string | undefined };

const unavailableLines: Record<Unavailable["reason"], string> = {
  deleted: "This message was deleted in Slack.",
  removed: "The words of this message were removed.",
  "not-captured": "The words of this kudos are from before HedgeHug kept them.",
};

export function KudosMessage({ message, look = "album", me }: { message: Message; look?: MessageLook; me?: string }) {
  if (message.kind === "unavailable") return <p className="text-muted-foreground italic">{unavailableLines[message.reason]}</p>;
  return <WordsOf message={message} looks={{ look, me }} />;
}

function WordsOf({ message, looks }: { message: Words; looks: Looks }) {
  return (
    <p data-testid="kudos-message-words" className="ph-no-capture [overflow-wrap:anywhere]">
      {message.segments.map((segment, index) => (
        <SegmentOf key={index} segment={segment} looks={looks} />
      ))}
      {message.edited && <EditedMark look={looks.look} />}
    </p>
  );
}

function EditedMark({ look }: { look: MessageLook }) {
  if (look === "slack") return <span data-edited=""> (edited)</span>;
  return <span className="ml-1 text-xs text-muted-foreground">Edited</span>;
}

function SegmentOf({ segment, looks }: { segment: Segment; looks: Looks }): ReactNode {
  const linked = looks.look === "album";
  switch (segment.kind) {
    case "text":
      return <StyledText segment={segment} />;
    case "person":
      return <PersonMention segment={segment} linked={linked} loud={segment.person !== undefined && segment.person === looks.me} />;
    case "group":
      return <Mention>{`@${segment.handle}`}</Mention>;
    case "broadcast":
      return <Mention loud>{`@${segment.range}`}</Mention>;
    case "channel":
      return (
        <span data-mention="plain" className="text-muted-foreground">
          #channel
        </span>
      );
    case "emoji":
      return <EmojiOf segment={segment} />;
    case "link":
      return <LinkOf url={segment.url} label={segment.label ?? segment.url} linked={linked} />;
    case "break":
      return <br />;
    default:
      return null;
  }
}

function StyledText({ segment }: { segment: Extract<Segment, { kind: "text" }> }) {
  let styled: ReactNode = segment.text;
  if (segment.code) styled = <code className="rounded bg-muted px-1 font-mono text-[0.9em]">{styled}</code>;
  if (segment.strike) styled = <s>{styled}</s>;
  if (segment.italic) styled = <em>{styled}</em>;
  if (segment.bold) styled = <strong>{styled}</strong>;
  return styled;
}

type Emoji = Extract<Segment, { kind: "emoji" }>;

function EmojiOf({ segment }: { segment: Emoji }) {
  const tonedCharacter = skinTonedCharacterOf(segment.name);
  if (tonedCharacter !== undefined) return tonedCharacter;
  if (segment.unicode !== undefined) return segment.unicode;
  if (segment.image !== undefined) return <CustomEmoji key={segment.image} label={`:${segment.name}:`} image={segment.image} className="inline h-[1.2em] w-auto align-[-0.25em]" />;
  return emojiCharacterOf(segment.name) ?? <EmojiName label={`:${segment.name}:`} />;
}

function Mention({ children, loud = false }: { children: string; loud?: boolean }) {
  return (
    <span data-mention={loud ? "loud" : "plain"} className="font-medium">
      {children}
    </span>
  );
}

function PersonMention({ segment, linked, loud }: { segment: Extract<Segment, { kind: "person" }>; linked: boolean; loud: boolean }) {
  const name = `@${segment.name}`;
  if (!linked || segment.person === undefined) return <Mention loud={loud}>{name}</Mention>;
  return (
    <AppLink href={hrefOf({ kind: "person", person: segment.person })} className="font-medium underline underline-offset-4">
      {name}
    </AppLink>
  );
}

function LinkOf({ url, label, linked }: { url: string; label: string; linked: boolean }) {
  if (!linked) return <span data-link="">{label}</span>;
  if (!isWebAddress(url)) return label;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">
      {label} <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function isWebAddress(url: string) {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
