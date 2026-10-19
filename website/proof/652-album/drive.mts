import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";
import { giver, hyped, nameOf, type Person } from "./cast.mts";

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
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof652x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
}

async function join(person: Person) {
  const profile = { display_name: nameOf(person), real_name: nameOf(person), ...(person.picture && { image_192: person.picture }) };
  const user = { id: person.id, team_id: workspace, name: person.first.toLowerCase(), real_name: nameOf(person), tz: "Europe/Berlin", profile };
  await post(envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

async function give(to: Person, words: string) {
  const ts = (Date.now() / 1000).toFixed(6);
  const elements = [{ type: "user", user_id: to.id }, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: ` ${words}` }];
  const text = `<@${to.id}> :hedgehog: ${words}`;
  await post(envelope({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }));
  await pause(4000);
  return ts;
}

for (const person of [giver, hyped]) await join(person);
await pause(5000);

const thanked = await give(hyped, "for pairing with me on the flaky export job until it finally held");

console.log(JSON.stringify({ eventsSent: sent, giver: giver.id, person: hyped.id, thanked }));
