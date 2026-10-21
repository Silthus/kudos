import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";

const [text, output] = process.argv.slice(2);
if (!text || !output) throw new Error("usage: render.mts <ephemeral text Slack accepted> <png>");
const shell = process.env.HEADLESS_SHELL ?? `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-linux/headless_shell`;
const label = "Rendered from the chat.postEphemeral Slack answered ok: true in the sandbox, not a Slack client screenshot";

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body { margin: 0; font: 15px/1.47 -apple-system, "Segoe UI", Lato, sans-serif; color: #1d1c1d; background: #fff; }
.channel { padding: 10px 20px; border-bottom: 1px solid #e8e8e8; font-weight: 900; }
.message { display: flex; gap: 8px; padding: 16px 20px; background: #f8f8f8; }
.avatar { width: 36px; height: 36px; border-radius: 6px; background: #f5d38a; display: grid; place-items: center; font-size: 22px; }
.only { color: #616061; font-size: 13px; margin-bottom: 2px; }
.name { font-weight: 900; } .app { font-size: 10px; background: #e8e8e8; color: #616061; border-radius: 2px; padding: 0 3px; margin-left: 4px; }
.time { color: #616061; font-size: 12px; margin-left: 6px; }
.label { padding: 8px 20px; color: #616061; font-size: 12px; border-top: 1px solid #e8e8e8; }
</style></head><body>
<div class="channel"># the hugged message's channel</div>
<div class="message"><div class="avatar">🦔</div><div>
<div class="only">👁 Only visible to you</div>
<div><span class="name">HedgeHug</span><span class="app">APP</span><span class="time">just now</span></div>
<div>${escapeHtml(text)}</div>
</div></div>
<div class="label">${escapeHtml(label)}</div>
</body></html>`;

const page = "/tmp/core-loop-139-ephemeral.html";
writeFileSync(page, html);
execFileSync(shell, ["--no-sandbox", "--hide-scrollbars", "--window-size=760,200", `--screenshot=${output}`, `file://${page}`], { stdio: "ignore" });
console.log(`wrote ${output}`);
