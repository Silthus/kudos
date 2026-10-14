import type { WordSegment } from "../engine/messageEvent";

type Style = { bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean };

export type RichElement = {
  type: string;
  elements?: RichElement[];
  user_id?: string;
  usergroup_id?: string;
  range?: string;
  name?: string;
  unicode?: string;
  text?: string;
  url?: string;
  style?: Style;
};

export type RichTextMessage = { blocks?: Array<{ type: string; elements?: RichElement[] }> };

type TextSegment = Extract<WordSegment, { kind: "text" }>;

const styleFlags = ["bold", "italic", "strike", "code"] as const;
const lineBreak: WordSegment = { kind: "break" };
const codeContainers = new Set(["rich_text_preformatted"]);

export const segmentsKeptAtMost = 2_000;

export function isText(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

export function segmentsOf(message: RichTextMessage): WordSegment[] {
  const segments = richTextBlocksOf(message).flatMap((elements) => elements.flatMap((element) => segmentsOfElement(element, {})));
  return withoutTrailingBreaks(segments.slice(0, segmentsKeptAtMost));
}

function richTextBlocksOf(message: RichTextMessage) {
  return (message.blocks ?? []).flatMap((block) => (block.type === "rich_text" && block.elements ? [block.elements] : []));
}

function segmentsOfElement(element: RichElement, inherited: Style): WordSegment[] {
  if (element.elements !== undefined) {
    const style = codeContainers.has(element.type) ? { ...inherited, code: true } : inherited;
    const children = element.elements.flatMap((child) => segmentsOfElement(child, style));
    return children.at(-1)?.kind === "break" ? children : [...children, lineBreak];
  }
  return leafSegmentsOf(element, { ...inherited, ...element.style });
}

function leafSegmentsOf(element: RichElement, style: Style): WordSegment[] {
  switch (element.type) {
    case "text":
      return isText(element.text) ? textSegmentsOf(element.text, style) : [];
    case "user":
      return isText(element.user_id) ? [{ kind: "person", user: element.user_id }] : [];
    case "usergroup":
      return isText(element.usergroup_id) ? [{ kind: "group", group: element.usergroup_id }] : [];
    case "channel":
      return [{ kind: "channel" }];
    case "broadcast":
      return isText(element.range) ? [{ kind: "broadcast", range: element.range }] : [];
    case "emoji":
      return isText(element.name) ? [emojiSegmentOf(element.name, element.unicode)] : [];
    case "link":
      return isText(element.url) ? [{ kind: "link", url: element.url, ...(isText(element.text) && { label: element.text }) }] : [];
    default:
      return [];
  }
}

function textSegmentsOf(text: string, style: Style): WordSegment[] {
  return text.split("\n").flatMap((line, index) => [...(index > 0 ? [lineBreak] : []), ...(line === "" ? [] : [styled(line, style)])]);
}

function styled(text: string, style: Style): TextSegment {
  const segment: TextSegment = { kind: "text", text };
  for (const flag of styleFlags) if (style[flag] === true) segment[flag] = true;
  return segment;
}

function emojiSegmentOf(name: string, unicode: string | undefined): WordSegment {
  const character = characterOf(unicode);
  return { kind: "emoji", name, ...(character && { unicode: character }) };
}

function characterOf(unicode: string | undefined) {
  if (!isText(unicode)) return undefined;
  const codePoints = unicode.split("-").map((hex) => Number.parseInt(hex, 16));
  if (codePoints.some((point) => !Number.isInteger(point) || point < 0 || point > 0x10ffff)) return undefined;
  return String.fromCodePoint(...codePoints);
}

function withoutTrailingBreaks(segments: WordSegment[]) {
  let end = segments.length;
  while (end > 0 && segments[end - 1]!.kind === "break") end -= 1;
  return segments.slice(0, end);
}
