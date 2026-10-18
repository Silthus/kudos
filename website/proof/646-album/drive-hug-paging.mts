import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;

type Person = { id: string; name: string };

const wren: Person = { id: "U0PRF646WRN", name: "Wren Alder" };
const tamsin: Person = { id: "U0PRF646TMS", name: "Tamsin Reed" };
const crowd: Person[] = Array.from({ length: 55 }, (_, index) => ({ id: `U0PRF646C${String(index).padStart(2, "0")}`, name: `Proof Crowd ${index}` }));

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
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof646Bx${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
}

async function join(person: Person) {
  const user = { id: person.id, team_id: workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post(envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

for (const person of [wren, tamsin, ...crowd]) await join(person);
await pause(8000);

const ts = ((Date.now() - 10 * 60_000) / 1000).toFixed(6);
const words = "for staying late to walk everyone through the incident review";
const mentions = crowd.flatMap((person, index) => [...(index > 0 ? [{ type: "text", text: " " }] : []), { type: "user", user_id: person.id }]);
const elements = [...mentions, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: ` ${words}` }];
const text = `${crowd.map((person) => `<@${person.id}>`).join(" ")} :hedgehog: ${words}`;
await post(envelope({ type: "message", channel, channel_type: "channel", user: wren.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }));
await pause(8000);
await post(envelope({ type: "reaction_added", user: tamsin.id, reaction: "hedgehog", item_user: wren.id, item: { type: "message", channel, ts }, event_ts: (Date.now() / 1000).toFixed(6) }));
await pause(6000);

console.log(JSON.stringify({ eventsSent: sent, workspace, giver: wren.id, hugger: tamsin.id, recipients: crowd.length, message: ts }));
