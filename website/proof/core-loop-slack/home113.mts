import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import type { Command } from "../../../convex/commands/commands";
import { renderHome, type Choice, type HomeLine, type HomeView } from "../../../convex/feedback/home";
import { buttonOf, mrkdwn, plainText, urlButtonOf } from "../../../convex/slack/blocks";
import { customEmojiPickerOf } from "../../../convex/slack/customEmojiPicker";
import { slackTextOf } from "../../../convex/slack/delivery";
import { groupOptionsOf, groupSelectOf, optionListsOf } from "../../../convex/slack/groupPicker";
import { encodeHomeAction } from "../../../convex/slack/interactivity";

type Block = Record<string, any>;

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: home113.mts <proof json> <png>");
const proof = JSON.parse(readFileSync(input, "utf8"));
const { homeOf, shownHomeOf, frontDoorLinksOf } = proof.homeReads;
const shell = process.env.HEADLESS_SHELL ?? `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-linux/headless_shell`;
const title = "Silthus/personal#113 LP38: App Home's teaser line under the level line";
const label = "App Home rendered from different-dog-467's own App Home reads for a made-up member (Slack can't publish App Home to a made-up user), not a Slack client screenshot";

function homeView({ tabBar, title, groups }: HomeView) {
  const tabs = tabBar === undefined ? [] : [buttonsOf(tabBar)];
  const header = { type: "header", text: plainText(title) };
  const body = groups.flatMap((group, index) => [...(index > 0 ? [divider] : []), ...group.map(blockOf)]);
  return { type: "home", blocks: [...tabs, header, ...body] };
}

const divider = { type: "divider" };

const settingsPick = JSON.stringify({ type: "pickPrimaryGroup", surface: "settings" });

function blockOf(line: HomeLine): Block {
  if (line.kind === "fields") return { type: "section", fields: line.fields.map(mrkdwn) };
  if (line.kind === "choices") return buttonsOf(line.choices);
  if (line.kind === "lines") return { type: "section", text: mrkdwn(slackTextOf(line.lines)) };
  if (line.kind === "hint") return { type: "context", elements: [mrkdwn(line.text)] };
  if (line.kind === "action") return { type: "section", text: mrkdwn(line.text), accessory: buttonOf(line.action) };
  if (line.kind === "pick-channel") return { type: "section", text: mrkdwn(line.text), accessory: channelPickerOf(line) };
  if (line.kind === "pick") return { type: "section", text: mrkdwn(line.text), accessory: pickerOf(line) };
  if (line.kind === "pick-group") return { type: "section", text: mrkdwn(line.text), accessory: groupSelectOf(settingsPick, line.groups, line.picked) };
  if (line.kind === "pick-groups") return { type: "section", text: mrkdwn(line.text), accessory: groupPickerOf(line) };
  if (line.kind === "pick-custom-emoji") return { type: "section", text: mrkdwn(line.text), accessory: customEmojiPickerOf(line) };
  if (line.kind === "link") return { type: "section", text: mrkdwn(`<${line.url}|${line.label}>`) };
  if (line.kind === "links") return { type: "actions", elements: line.links.map(linkButtonOf) };
  return { type: "section", text: mrkdwn(line.text) };
}

function buttonsOf(choices: Choice[]) {
  return { type: "actions", elements: choices.map(({ selected, ...action }) => ({ ...buttonOf(action), ...(selected && { style: "primary" }) })) };
}

function linkButtonOf({ label, url }: { label: string; url: string }, index: number) {
  return urlButtonOf({ label, url, actionId: `website-link-${index}` });
}

function pickerOf({ id, placeholder, options }: Extract<HomeLine, { kind: "pick" }>) {
  const selectOptions = options.map(({ label, command }) => ({ text: plainText(label), value: encodeHomeAction(command) }));
  const initial = options.findIndex(({ selected }) => selected);
  return { type: "static_select", action_id: id, placeholder: plainText(placeholder), ...optionListsOf(selectOptions, "Options"), ...(initial >= 0 && { initial_option: selectOptions[initial] }) };
}

function channelPickerOf({ picks, picked }: Extract<HomeLine, { kind: "pick-channel" }>) {
  return { type: "channels_select", action_id: picks, placeholder: plainText("Pick a channel"), ...(picked !== null && { initial_channel: picked }) };
}

function groupPickerOf({ groups, picked }: Extract<HomeLine, { kind: "pick-groups" }>) {
  const options = groupOptionsOf(groups);
  const initial = options.filter(({ value }) => picked.includes(value));
  return { type: "multi_static_select", action_id: "setGroupMode" satisfies Command["type"], placeholder: plainText("Pick groups"), ...optionListsOf(options), ...(initial.length > 0 && { initial_options: initial }) };
}

const emoji: Record<string, string> = { tada: "🎉", trophy: "🏆", hedgehog: "🦔" };

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function inline(line: string) {
  return escapeHtml(line)
    .replace(/&lt;(https?:[^|&]+)\|([^&]+)&gt;/g, '<a href="$1">$2</a>')
    .replace(/&lt;@([A-Z0-9]+)&gt;/g, '<span class="mention">@$1</span>')
    .replace(/\*([^*]+)\*/g, "<b>$1</b>")
    .replace(/(^|\s)_([^_]+)_/g, "$1<i>$2</i>")
    .replace(/:([a-z0-9_+-]+):/g, (whole, name: string) => emoji[name] ?? whole);
}

function textOf(text: Block | undefined) {
  if (text === undefined) return "";
  return text.type === "plain_text" ? escapeHtml(text.text) : text.text.split("\n").map((line: string) => `<div>${inline(line) || "&nbsp;"}</div>`).join("");
}

function elementHtml(element: Block) {
  if (element.type === "button") return `<span class="button${element.style === "primary" ? " primary" : ""}">${escapeHtml(element.text.text)}</span>`;
  return `<span class="select">${escapeHtml(element.placeholder?.text ?? element.type)} ▾</span>`;
}

function blockHtml(block: Block) {
  if (block.type === "header") return `<div class="header">${escapeHtml(block.text.text)}</div>`;
  if (block.type === "divider") return `<hr>`;
  if (block.type === "actions") return `<div class="actions">${block.elements.map(elementHtml).join("")}</div>`;
  if (block.type === "context") return `<div class="context">${block.elements.map(textOf).join(" ")}</div>`;
  if (block.type === "section" && block.fields) return `<div class="fields">${block.fields.map((field: Block) => `<div>${textOf(field)}</div>`).join("")}</div>`;
  if (block.type === "section") return `<div class="section"><div class="text">${textOf(block.text)}</div>${block.accessory ? elementHtml(block.accessory) : ""}</div>`;
  return `<pre>${escapeHtml(JSON.stringify(block))}</pre>`;
}

const rendered = renderHome(homeOf, shownHomeOf, frontDoorLinksOf);
const view = homeView(rendered);
const teaser: string | null = shownHomeOf?.shown?.teaser ?? null;
const statusGroup = rendered.groups[0]!;
const levelIndex = statusGroup.findIndex((line) => "text" in line && /level/i.test(String(line.text)));
const underLevel = levelIndex >= 0 ? statusGroup[levelIndex + 1] ?? null : null;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#fff;font:15px/1.47 -apple-system,"Segoe UI",Lato,Arial,sans-serif;color:#1d1c1d}
.banner{background:#fff4d6;border-bottom:1px solid #e8d49a;padding:10px 20px;font-size:13px;color:#5c4a12}
.banner b{display:block;font-size:14px;color:#1d1c1d}
.home{padding:12px 24px 20px}
.header{font-size:20px;font-weight:900;margin:12px 0 8px}
hr{border:none;border-top:1px solid #e2e2e2;margin:12px 0}
.section{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0}
.text{flex:1}
.fields{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin:4px 0}
.context{font-size:13px;color:#616061;margin:4px 0}
.actions{margin:8px 0;display:flex;flex-wrap:wrap;gap:8px}
.button,.select{display:inline-block;border:1px solid #c7c7c7;border-radius:4px;padding:3px 12px;font-weight:700;font-size:13px;white-space:nowrap}
.button.primary{background:#007a5a;border-color:#007a5a;color:#fff}
.mention{background:#e8f5fa;color:#1264a3;border-radius:3px;padding:0 2px}
a{color:#1264a3;text-decoration:none}
</style></head><body><div class="banner"><b>${escapeHtml(title)}</b>${escapeHtml(label)}</div><div class="home">${view.blocks.map(blockHtml).join("")}</div></body></html>`;

const page = output.replace(/\.png$/, ".html");
writeFileSync(page, html);
writeFileSync(output.replace(/\.png$/, ".view.json"), `${JSON.stringify({ renderHome: rendered, slackView: view }, null, 2)}\n`);
const height = 140 + view.blocks.reduce((sum, block) => sum + (block.type === "divider" ? 26 : block.type === "header" ? 44 : 40), 0);
execFileSync(shell, ["--no-sandbox", "--hide-scrollbars", `--window-size=760,${height}`, `--screenshot=${output}`, `file://${page}`], { stdio: "inherit" });
console.log(JSON.stringify({ png: output, html: page, blocks: view.blocks.length, statusGroup, teaser, underLevel }, null, 2));
