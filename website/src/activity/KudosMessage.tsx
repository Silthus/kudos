import type { ReactNode } from "react";
import type { Message, Segment } from "../shell";

type Words = Extract<Message, { kind: "text" }>;

type Unavailable = Extract<Message, { kind: "unavailable" }>;

const unavailableLines: Record<Unavailable["reason"], string> = {
  deleted: "This message was deleted in Slack.",
  removed: "The words of this message were removed.",
  "not-captured": "The words of this kudos are from before HedgeHug kept them.",
};

export function KudosMessage({ message, clamped }: { message: Message; clamped: boolean }) {
  if (message.kind === "unavailable") return <p className="text-muted-foreground italic">{unavailableLines[message.reason]}</p>;
  return <WordsOf message={message} clamped={clamped} />;
}

function WordsOf({ message, clamped }: { message: Words; clamped: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p data-testid="kudos-message-words" className={`[overflow-wrap:anywhere] ${clamped ? "line-clamp-2" : ""}`}>
        {message.segments.map((segment, index) => (
          <SegmentOf key={index} segment={segment} linked={!clamped} />
        ))}
      </p>
      {message.edited && <span className="text-xs text-muted-foreground">Edited</span>}
    </div>
  );
}

function SegmentOf({ segment, linked }: { segment: Segment; linked: boolean }): ReactNode {
  switch (segment.kind) {
    case "text":
      return <StyledText segment={segment} />;
    case "person":
      return <Mention>{`@${segment.name}`}</Mention>;
    case "group":
      return <Mention>{`@${segment.handle}`}</Mention>;
    case "broadcast":
      return <Mention>{`@${segment.range}`}</Mention>;
    case "channel":
      return <span className="text-muted-foreground">#channel</span>;
    case "emoji":
      return segment.unicode ?? `:${segment.name}:`;
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

function Mention({ children }: { children: string }) {
  return <span className="font-medium">{children}</span>;
}

function LinkOf({ url, label, linked }: { url: string; label: string; linked: boolean }) {
  if (!linked || !isWebAddress(url)) return label;
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
