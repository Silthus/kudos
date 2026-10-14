import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

export const site = required("KUDOS_SITE");
export const workspace = required("KUDOS_WORKSPACE");
export const publicChannel = required("KUDOS_PUBLIC_CHANNEL");
export const privateChannel = required("KUDOS_PRIVATE_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;
const dayMs = 86_400_000;

export type Person = { id: string; name: string };
export type Sent = { from: Person; to: Person[]; channel: string; ts: string };
export type Kudos = { from: Person; to: Person[]; words: string; daysAgo: number; minutes: number; channel?: "public" | "private" };

let sent = 0;

export const eventsSent = () => sent;

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

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const tsOf = (at: number) => (at / 1000).toFixed(6);

const channelTypeOf = (channel: string) => (channel === publicChannel ? "channel" : "group");

function blocksOf(recipients: Person[], words: string) {
  const mentions = recipients.flatMap((person, index) => [...(index > 0 ? [{ type: "text", text: " " }] : []), { type: "user", user_id: person.id }]);
  const elements = [...mentions, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, ...(words ? [{ type: "text", text: ` ${words}` }] : [])];
  return [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }];
}

export async function join(person: Person) {
  const [given] = person.name.split(" ");
  const user = { id: person.id, team_id: workspace, name: given.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post(envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

export async function give({ from, to, words, daysAgo, minutes, channel = "public" }: Kudos): Promise<Sent> {
  const ts = tsOf(Date.now() - daysAgo * dayMs - minutes * 60_000 + Math.floor(Math.random() * 999));
  const conversation = channel === "public" ? publicChannel : privateChannel;
  const text = `${to.map((person) => `<@${person.id}>`).join(" ")} :hedgehog: ${words}`.trim();
  await post(envelope({ type: "message", channel: conversation, channel_type: channelTypeOf(conversation), user: from.id, ts, text, team: workspace, blocks: blocksOf(to, words) }));
  await pause(1500);
  return { from, to, channel: conversation, ts };
}

export async function edit(kudos: Sent, words: string) {
  const editedTs = tsOf(Date.now());
  const message = { type: "message", user: kudos.from.id, ts: kudos.ts, text: words, team: workspace, blocks: blocksOf(kudos.to, words), edited: { user: kudos.from.id, ts: editedTs } };
  await post(envelope({ type: "message", subtype: "message_changed", hidden: true, channel: kudos.channel, channel_type: channelTypeOf(kudos.channel), ts: editedTs, message, previous_message: { type: "message", user: kudos.from.id, ts: kudos.ts } }));
}

export async function remove(kudos: Sent) {
  const now = tsOf(Date.now());
  await post(envelope({ type: "message", subtype: "message_deleted", hidden: true, channel: kudos.channel, channel_type: channelTypeOf(kudos.channel), ts: now, deleted_ts: kudos.ts, event_ts: now, previous_message: { type: "message", user: kudos.from.id, ts: kudos.ts } }));
}

export const avery: Person = { id: "U0PRF251AVY", name: "Avery Hedge" };
export const blake: Person = { id: "U0PRF251BLK", name: "Blake Thorn" };
export const casey: Person = { id: "U0PRF251CSY", name: "Casey Moss" };
export const drew: Person = { id: "U0PRF251DRW", name: "Drew Bramble" };
