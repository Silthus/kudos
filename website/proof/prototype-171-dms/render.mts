// PROTOTYPE, throwaway (Silthus/personal#171). Renders every variant as a Slack-like HTML page for screenshots.
// Real Slack is the truth (the DMs in the sandbox); this page is an approximation for the ticket's stills.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { labelled, messages, type Variant } from "./variants.mts";

type Block = Record<string, any>;

const emoji: Record<string, string> = {
  wave: "👋",
  point_right: "👉",
  hedgehug: "🦔",
  white_check_mark: "✅",
  sweat_smile: "😅",
  slightly_smiling_face: "🙂",
  sun_with_face: "🌞",
  tada: "🎉",
  white_circle: "⚪",
  "skin-tone-2": "🏻",
};

const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function mrkdwn(source: string) {
  const lines = source.split("\n").map((line) => {
    const quoted = line.startsWith("> ");
    let html = escape(quoted ? line.slice(2) : line)
      .replace(/&lt;@U[A-Z0-9]+&gt;/g, '<span class="mention">@Michael Reichenbach</span>')
      .replace(/&lt;(.+?)\|(.+?)&gt;/g, '<a href="$1">$2</a>')
      .replace(/(^|[\s(])\*([^*]+)\*/g, "$1<b>$2</b>")
      .replace(/(^|[\s(])_([^_]+)_/g, "$1<i>$2</i>")
      .replace(/:([a-z0-9_+-]+):/g, (whole, name) => emoji[name] ?? whole);
    return quoted ? `<blockquote>${html}</blockquote>` : html;
  });
  return lines.join("<br>").replaceAll("</blockquote><br><blockquote>", "<br>");
}

function textOf(text: Block) {
  return text.type === "mrkdwn" ? mrkdwn(text.text) : escape(text.text);
}

function element(item: Block): string {
  if (item.type === "button") return `<span class="button ${item.style ?? ""}">${escape(item.text.text)}</span>`;
  if (item.type === "overflow") return `<span class="button overflow">⋮</span>`;
  return "";
}

function richText(block: Block) {
  return block.elements
    .map((list: Block) => {
      const rows = list.elements.map((row: Block) => {
        const parts = row.elements.map((part: Block) => {
          if (part.type === "emoji") return `${emoji[part.name] ?? ""}${part.skin_tone ? "🏻" : ""}`;
          const text = escape(part.text);
          const bold = part.style?.bold ? `<b>${text}</b>` : text;
          return part.style?.strike ? `<s>${bold}</s>` : bold;
        });
        return `<li>${parts.join("")}</li>`;
      });
      return `<ul>${rows.join("")}</ul>`;
    })
    .join("");
}

function blockHtml(block: Block): string {
  switch (block.type) {
    case "header":
      return `<div class="header">${escape(block.text.text)}</div>`;
    case "section":
      return `<div class="section"><div class="text">${textOf(block.text)}</div>${block.accessory ? `<div class="accessory">${element(block.accessory)}</div>` : ""}</div>`;
    case "context":
      return `<div class="context">${block.elements.map(textOf).join("  ")}</div>`;
    case "actions":
      return `<div class="actions">${block.elements.map(element).join("")}</div>`;
    case "divider":
      return `<hr>`;
    case "rich_text":
      return `<div class="rich">${richText(block)}</div>`;
    default:
      return "";
  }
}

const slugOf = (variant: Variant) => `${messages.findIndex((variants) => variants.includes(variant)) + 1}${variant.key}`;

function messageHtml(variant: Variant) {
  return `<div class="message" id="v${slugOf(variant)}"><div class="avatar">🦔</div><div class="body"><div class="who"><b>HedgeHug</b> <span class="app">APP</span> <span class="time">9:00 AM</span></div>${labelled(variant).map(blockHtml).join("")}</div></div>`;
}

const style = `
body { margin: 0; background: #fff; font-family: Lato, "Helvetica Neue", Arial, sans-serif, "Noto Color Emoji"; font-size: 15px; color: #1d1c1d; line-height: 1.46668; }
.message { display: flex; gap: 8px; padding: 16px 20px; width: 640px; box-sizing: border-box; }
.avatar { width: 36px; height: 36px; border-radius: 6px; background: #f4e3c3; display: flex; align-items: center; justify-content: center; font-size: 22px; flex: none; }
.body { flex: 1; min-width: 0; }
.who b { font-weight: 900; }
.app { font-size: 10px; background: #e8e8e8; color: #616061; padding: 1px 3px; border-radius: 2px; font-weight: 700; }
.time { color: #616061; font-size: 12px; }
.header { font-size: 18px; font-weight: 900; margin: 8px 0 4px; }
.section { display: flex; gap: 12px; margin: 6px 0; align-items: flex-start; }
.section .text { flex: 1; }
.context { font-size: 13px; color: #616061; margin: 6px 0; }
.actions { display: flex; gap: 8px; margin: 10px 0 4px; flex-wrap: wrap; }
.button { display: inline-block; border: 1px solid #c4c4c4; border-radius: 4px; padding: 3px 12px; font-size: 15px; font-weight: 700; white-space: nowrap; }
.button.primary { background: #007a5a; color: #fff; border-color: #007a5a; }
.button.overflow { padding: 3px 9px; }
hr { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
a { color: #1264a3; text-decoration: none; }
.mention { background: #e8f5fa; color: #1264a3; padding: 0 2px; border-radius: 3px; }
blockquote { margin: 4px 0; padding-left: 12px; border-left: 4px solid #ddd; }
ul { margin: 4px 0; padding-left: 22px; }
.rich { margin: 6px 0; }
`;

const page = `<!doctype html><meta charset="utf-8"><title>Prototype #171</title><style>${style}</style>${messages.flat().map(messageHtml).join("\n")}<script>const only = location.hash.slice(1); if (only) for (const node of document.querySelectorAll(".message")) if (node.id !== "v" + only) node.style.display = "none";</script>`;
writeFileSync(join(new URL(".", import.meta.url).pathname, "render.html"), page);
console.log(messages.flat().map(slugOf).join(" "));
