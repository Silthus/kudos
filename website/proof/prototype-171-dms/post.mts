// PROTOTYPE, throwaway (Silthus/personal#171). Posts every variant as a DM from the sandbox bot.
// PROTOTYPE_SLACK_USER=<sandbox member id> bun website/proof/prototype-171-dms/post.mts [post|validate|links]
// Reads the sandbox bot token from ~/.cache/proto171/token (convex env get SLACK_BOT_TOKEN on different-dog-467).
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { round2 } from "./round2.mts";
import { labelled, labelOf, messages as round1, type Variant } from "./variants.mts";

const round = process.env.ROUND ?? "2";
const messages = round === "1" ? round1 : round2;

const team = "T0C3US298SH";
const michael = process.env.PROTOTYPE_SLACK_USER ?? "";
const here = new URL(".", import.meta.url).pathname;
const mode = process.argv[2] ?? "links";

function builderLinkOf(variant: Variant) {
  return `https://app.slack.com/block-kit-builder/${team}#${encodeURIComponent(JSON.stringify({ blocks: variant.blocks }))}`;
}

async function slack(method: string, body: Record<string, unknown>) {
  const token = readFileSync(join(homedir(), ".cache/proto171/token"), "utf8").trim();
  const asForm = method === "chat.getPermalink";
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": asForm ? "application/x-www-form-urlencoded" : "application/json; charset=utf-8" },
    body: asForm ? new URLSearchParams(body as Record<string, string>).toString() : JSON.stringify(body),
  });
  const answer = (await response.json()) as Record<string, unknown>;
  if (answer.ok !== true) throw new Error(`${method}: ${JSON.stringify(answer)}`);
  return answer;
}

const manifest: { message: string; key: string; name: string; label: string; builder: string; permalink?: string }[] = [];
const dm = michael;
if (mode === "post") await slack("chat.postMessage", { channel: dm, text: round === "1" ? "🧪 Prototype #171, round 1: the new welcome, catch-up and Monday DMs. Three variants (A, B, C) of each message follow, labelled at the top. Buttons are dead in this round." : "🧪 Prototype #171, round 2: one combined version of each message follows. B's quest card is the core, A's warm copy opens it, and C's onboarding journey crosses off what's done. Buttons are dead in this round." });

for (const variants of messages) {
  for (const variant of variants) {
    const entry = { message: variant.message, key: variant.key, name: variant.name, label: labelOf(variant), builder: builderLinkOf(variant) };
    if (mode === "post") {
      const sent = await slack("chat.postMessage", { channel: dm, text: variant.fallback, blocks: labelled(variant), unfurl_links: false, unfurl_media: false });
      const permalink = (await slack("chat.getPermalink", { channel: sent.channel, message_ts: sent.ts })).permalink as string;
      manifest.push({ ...entry, permalink });
      console.log(`posted ${variant.message} ${variant.key}`);
    } else if (mode === "validate") {
      const sent = await slack("chat.postMessage", { channel: "C0C9N9A4SE4", text: variant.fallback, blocks: labelled(variant) });
      await slack("chat.delete", { channel: sent.channel, ts: sent.ts });
      console.log(`valid ${variant.message} ${variant.key}`);
      manifest.push(entry);
    } else manifest.push(entry);
  }
}

writeFileSync(join(homedir(), `.cache/proto171/manifest-round${round}.json`), JSON.stringify(manifest, null, 2));
console.log(`${manifest.length} variants → manifest.json`);
