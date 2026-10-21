import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

type Block = { type: string; text?: { text: string }; elements?: Array<Record<string, unknown>> };
type Message = { ts: string; text: string; blocks?: Block[] };

const [input, output, title, readWith = "conversations.replies"] = process.argv.slice(2);
if (!input || !output || !title) throw new Error("usage: render.mts <proof json> <png> <title> [Slack read method]");
const proof = JSON.parse(readFileSync(input, "utf8")) as { botPosts?: Message[]; newest?: Message[] };
const messages = proof.botPosts ?? proof.newest ?? [];
const shell = process.env.HEADLESS_SHELL ?? `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-linux/headless_shell`;
const label = `Rendered from Slack's stored message (${readWith}), not a Slack client screenshot`;

const emoji: Record<string, string> = { tada: "🎉", trophy: "🏆", hedgehog: "🦔" };

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function inline(line: string) {
  return escapeHtml(line)
    .replace(/&lt;(https?:[^|&]+)\|([^&]+)&gt;/g, '<a href="$1">$2</a>')
    .replace(/&lt;@([A-Z0-9]+)&gt;/g, '<span class="mention">@$1</span>')
    .replace(/\*([^*]+)\*/g, "<b>$1</b>")
    .replace(/_([^_]+)_/g, "<i>$1</i>")
    .replace(/:([a-z0-9_+-]+):/g, (whole, name: string) => emoji[name] ?? whole);
}

function mrkdwn(text: string) {
  return text
    .split("\n")
    .map((line) => (line.startsWith("&gt;") || line.startsWith(">") ? `<blockquote>${inline(line.replace(/^(&gt;|>)/, ""))}</blockquote>` : `<div>${inline(line) || "&nbsp;"}</div>`))
    .join("");
}

function richText(block: Block) {
  const parts = (block.elements ?? []).flatMap((section) => (section.elements as Array<Record<string, unknown>>) ?? []);
  return `<div class="section">${parts
    .map((part) => {
      if (part.type === "emoji") return emoji[String(part.name)] ?? `:${part.name}:`;
      if (part.type === "user") return `<span class="mention">@${part.user_id}</span>`;
      return escapeHtml(String(part.text ?? ""));
    })
    .join("")}</div>`;
}

function blockHtml(block: Block) {
  if (block.type === "section") return `<div class="section">${mrkdwn(block.text?.text ?? "")}</div>`;
  if (block.type === "context") return `<div class="context">${(block.elements ?? []).map((element) => (element.type === "image" ? `<img src="${element.image_url}" alt="${element.alt_text}">` : `<span>${inline(String(element.text ?? ""))}</span>`)).join(" ")}</div>`;
  if (block.type === "actions") return `<div class="actions">${(block.elements ?? []).map((element) => `<span class="button" title="${element.url ?? ""}">${escapeHtml(String((element.text as { text: string }).text))}</span><span class="url">${escapeHtml(String(element.url ?? ""))}</span>`).join("")}</div>`;
  if (block.type === "rich_text") return richText(block);
  return `<pre>${escapeHtml(JSON.stringify(block))}</pre>`;
}

function messageHtml(message: Message) {
  const at = new Date(Number(message.ts.split(".")[0]) * 1000).toISOString().slice(11, 16);
  const body = message.blocks?.length ? message.blocks.map(blockHtml).join("") : `<div class="section">${mrkdwn(message.text)}</div>`;
  return `<div class="message"><div class="avatar">🦔</div><div class="content"><div class="who"><b>HedgeHug</b> <span class="app">APP</span> <span class="time">${at} UTC · ts ${message.ts}</span></div>${body}</div></div>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#fff;font:15px/1.47 -apple-system,"Segoe UI",Lato,Arial,sans-serif;color:#1d1c1d}
.banner{background:#fff4d6;border-bottom:1px solid #e8d49a;padding:10px 20px;font-size:13px;color:#5c4a12}
.banner b{display:block;font-size:14px;color:#1d1c1d}
.message{display:flex;gap:10px;padding:10px 20px}
.message+.message{border-top:1px solid #f0f0f0}
.avatar{width:36px;height:36px;border-radius:6px;background:#f2e6d9;display:flex;align-items:center;justify-content:center;font-size:22px;flex:none}
.content{flex:1;min-width:0}
.who{margin-bottom:2px}.app{font-size:10px;background:#e8e8e8;color:#616061;border-radius:3px;padding:1px 3px;font-weight:700}.time{font-size:12px;color:#616061}
.section{margin:2px 0 6px}
.context{font-size:13px;color:#616061;margin:2px 0 6px;display:flex;align-items:center;gap:6px}
.context img{width:20px;height:20px;border-radius:4px}
blockquote{margin:2px 0;padding-left:10px;border-left:4px solid #ddd}
.actions{margin:6px 0 8px;display:flex;align-items:center;gap:10px}
.button{display:inline-block;border:1px solid #c7c7c7;border-radius:4px;padding:3px 12px;font-weight:700;font-size:13px}
.url{font-size:11px;color:#8a8a8a}
.mention{background:#e8f5fa;color:#1264a3;border-radius:3px;padding:0 2px}
a{color:#1264a3;text-decoration:none}
</style></head><body><div class="banner"><b>${escapeHtml(title)}</b>${escapeHtml(label)}</div>${messages.map(messageHtml).join("")}</body></html>`;

const page = output.replace(/\.png$/, ".html");
writeFileSync(page, html);
const blocks = messages.reduce((count, { blocks }) => count + (blocks?.length ?? 1), 0);
const lines = messages.reduce((count, { blocks }) => count + (blocks ?? []).reduce((inBlock, block) => inBlock + Math.ceil((block.text?.text.length ?? 0) / 75), 0), 0);
const height = 100 + messages.length * 50 + blocks * 34 + lines * 22;
execFileSync(shell, ["--no-sandbox", "--hide-scrollbars", `--window-size=760,${height}`, `--screenshot=${output}`, `file://${page}`], { stdio: "inherit" });
console.log(`${output} (${messages.length} messages, ${blocks} blocks, 760x${height})`);
