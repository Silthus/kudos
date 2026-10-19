import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";
import { giver, nameOf, teammates, type Person } from "./cast.mts";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;

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
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof661x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
}

async function join(person: Person) {
  const name = nameOf(person);
  const user = { id: person.id, team_id: workspace, name: person.first.toLowerCase(), real_name: name, tz: "Europe/Berlin", profile: { display_name: name, real_name: name } };
  await post(envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

async function give(from: Person, to: Person[], words: string) {
  const ts = (Date.now() / 1000).toFixed(6);
  const mentions = to.flatMap((person, index) => [...(index > 0 ? [{ type: "text", text: " " }] : []), { type: "user", user_id: person.id }]);
  const elements = [...mentions, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: ` ${words}` }];
  const text = `${to.map((person) => `<@${person.id}>`).join(" ")} :hedgehog: ${words}`;
  await post(envelope({ type: "message", channel, channel_type: "channel", user: from.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }));
  await pause(4000);
  return ts;
}

async function hug(from: Person, on: { ts: string; author: Person }) {
  await post(envelope({ type: "reaction_added", user: from.id, reaction: "hedgehog", item_user: on.author.id, item: { type: "message", channel, ts: on.ts }, event_ts: `${(Date.now() / 1000).toFixed(6)}` }));
  await pause(3000);
}

for (const person of [giver, ...teammates]) await join(person);
await pause(5000);

const thoughtful = await give(giver, teammates, "for carrying the lantern rota through the whole winter outage, nobody else could have kept every shift covered and calm");
const back = await give(teammates[0]!, [giver], "ta");
await hug(teammates[0]!, { ts: thoughtful, author: giver });
await hug(giver, { ts: back, author: teammates[0]! });

console.log(JSON.stringify({ eventsSent: sent, giver: giver.id, teammates: teammates.map(({ id }) => id), thoughtful, back }));
