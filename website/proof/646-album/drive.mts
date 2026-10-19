import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;
const dayMs = 86_400_000;

type Person = { id: string; name: string };

const odile: Person = { id: "U0PRF646ODL", name: "Odile Marsh" };
const pim: Person = { id: "U0PRF646PIM", name: "Pim Larch" };
const quill: Person = { id: "U0PRF646QLL", name: "Quill Fen" };
const sorrel: Person = { id: "U0PRF646SRL", name: "Sorrel Wick" };

let sent = 0;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(body: string) {
  sent += 1;
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  if (!response.ok) throw new Error(`event ${sent} answered ${response.status}: ${await response.text()}`);
}

function envelope(event: Record<string, unknown>) {
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof646x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
}

async function join(person: Person) {
  const user = { id: person.id, team_id: workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post(envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

async function give(giver: Person, to: Person, words: string, daysAgo: number) {
  const ts = ((Date.now() - daysAgo * dayMs) / 1000).toFixed(6);
  const elements = [{ type: "user", user_id: to.id }, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: ` ${words}` }];
  const text = `<@${to.id}> :hedgehog: ${words}`;
  await post(envelope({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }));
  await pause(4000);
  return ts;
}

async function hug(giver: Person, author: Person, ts: string) {
  await post(envelope({ type: "reaction_added", user: giver.id, reaction: "hedgehog", item_user: author.id, item: { type: "message", channel, ts }, event_ts: (Date.now() / 1000).toFixed(6) }));
  await pause(4000);
}

for (const person of [odile, pim, quill, sorrel]) await join(person);
await pause(5000);

const toPim = await give(odile, pim, "for walking the new joiners through the deploy pipeline so patiently", 3);
const toQuill = await give(odile, quill, "ty", 2);
const fromSorrel = await give(sorrel, odile, "for catching the off-by-one in the export before the release went out", 1);
const plain = ((Date.now() - 60_000) / 1000).toFixed(6);
await hug(pim, odile, plain);

console.log(JSON.stringify({ eventsSent: sent, member: odile.id, gaveTo: [pim.id, quill.id], thankedBy: sorrel.id, messages: { toPim, toQuill, fromSorrel, huggedPlain: plain } }));
