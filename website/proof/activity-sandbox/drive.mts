import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const publicChannel = required("KUDOS_PUBLIC_CHANNEL");
const privateChannel = required("KUDOS_PRIVATE_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;
const dayMs = 86_400_000;

const avery = { id: "U0PRF251AVY", name: "Avery Hedge" };
const blake = { id: "U0PRF251BLK", name: "Blake Thorn" };
const casey = { id: "U0PRF251CSY", name: "Casey Moss" };
const drew = { id: "U0PRF251DRW", name: "Drew Bramble" };
type Person = typeof avery;

let sent = 0;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function post(body: string) {
  sent += 1;
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  if (!response.ok) throw new Error(`event ${sent} answered ${response.status}: ${await response.text()}`);
}

function envelope(event: Record<string, unknown>) {
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof251x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
}

async function join(person: Person) {
  const [given] = person.name.split(" ");
  const user = { id: person.id, team_id: workspace, name: given.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post(envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

const tsOf = (at: number) => (at / 1000).toFixed(6);

function blocksOf(recipients: Person[], words: string) {
  const elements = [...recipients.map((person) => ({ type: "user", user_id: person.id })), { type: "text", text: " " }, { type: "emoji", name: "hedgehog" }, ...(words ? [{ type: "text", text: ` ${words}` }] : [])];
  return [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }];
}

type Kudos = { from: Person; to: Person[]; words: string; daysAgo: number; minutes: number; channel?: "public" | "private" };

async function give({ from, to, words, daysAgo, minutes, channel = "public" }: Kudos) {
  const ts = tsOf(Date.now() - daysAgo * dayMs - minutes * 60_000 + Math.floor(Math.random() * 999));
  const conversation = channel === "public" ? publicChannel : privateChannel;
  const text = `${to.map((person) => `<@${person.id}>`).join(" ")} :hedgehog: ${words}`.trim();
  await post(envelope({ type: "message", channel: conversation, channel_type: channel === "public" ? "channel" : "group", user: from.id, ts, text, team: workspace, blocks: blocksOf(to, words) }));
  await pause(1500);
  return { ...{ from, to, channel: conversation }, ts };
}

async function edit(kudos: { from: Person; to: Person[]; channel: string; ts: string }, words: string) {
  const editedTs = tsOf(Date.now());
  const message = { type: "message", user: kudos.from.id, ts: kudos.ts, text: words, team: workspace, blocks: blocksOf(kudos.to, words), edited: { user: kudos.from.id, ts: editedTs } };
  await post(envelope({ type: "message", subtype: "message_changed", hidden: true, channel: kudos.channel, channel_type: kudos.channel === publicChannel ? "channel" : "group", ts: editedTs, message, previous_message: { type: "message", user: kudos.from.id, ts: kudos.ts } }));
}

async function remove(kudos: { from: Person; channel: string; ts: string }) {
  const now = tsOf(Date.now());
  await post(envelope({ type: "message", subtype: "message_deleted", hidden: true, channel: kudos.channel, ts: now, deleted_ts: kudos.ts, event_ts: now, previous_message: { type: "message", user: kudos.from.id, ts: kudos.ts } }));
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const reasons = [
  "for pairing on the flaky deploy until it was green",
  "for the calm review that caught the off-by-one",
  "for writing the onboarding notes I wish I'd had",
  "for staying late to get the release notes right",
  "for the clearest bug report this quarter",
  "for unblocking the design review with a quick prototype",
  "for taking the on-call swap without a second thought",
  "for the patient walkthrough of the billing flow",
  "for turning a vague ticket into three crisp ones",
];

for (const person of [avery, blake, casey, drew]) await join(person);
await pause(4000);

const history: Awaited<ReturnType<typeof give>>[] = [];
for (let daysAgo = 9; daysAgo >= 1; daysAgo -= 1) {
  const reason = reasons[daysAgo - 1];
  history.push(await give({ from: blake, to: [avery], words: reason, daysAgo, minutes: 300 }));
  if (daysAgo % 2 === 1) history.push(await give({ from: casey, to: [avery], words: daysAgo === 3 ? "" : `quietly, ${reason}`, daysAgo, minutes: 240, channel: "private" }));
  history.push(await give({ from: avery, to: daysAgo % 3 === 0 ? [blake, casey, drew] : [blake, casey], words: daysAgo === 4 ? "" : `right back at you ${reason}`, daysAgo, minutes: 180 }));
}

await edit(history[0], "for pairing on the flaky deploy until it was green, and for the follow-up runbook");
await remove(history[3]);

await give({ from: blake, to: [casey, drew], words: "for the live demo that made the roadmap click", daysAgo: 0, minutes: 30 });
await give({ from: drew, to: [avery], words: "for answering every question in the launch channel today", daysAgo: 0, minutes: 10 });

console.log(JSON.stringify({ run, eventsSent: sent, edited: history[0].ts, deleted: history[3].ts }));
