import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";
import { cast, giver, nameOf, thanked, type Person } from "./cast.mts";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const step = process.argv[2];
const run = `${Date.now()}`;

let sent = 0;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function post(event: Record<string, unknown>) {
  sent += 1;
  const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof130x${step}x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  if (!response.ok) throw new Error(`event ${sent} answered ${response.status}: ${await response.text()}`);
}

async function join(person: Person) {
  const name = nameOf(person);
  const user = { id: person.id, team_id: workspace, name: person.first.toLowerCase(), real_name: name, tz: "Europe/Berlin", profile: { display_name: name, real_name: name } };
  await post({ type: "team_join", user, event_ts: `${Date.now() / 1000}` });
}

async function thoughtfulThanks(from: Person, recipient: Person) {
  const ts = (Date.now() / 1000).toFixed(6);
  const why = " thank you for rewiring the lantern rig and staying late to test every bulb with me";
  const elements = [{ type: "user", user_id: recipient.id }, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: why }];
  await post({ type: "message", channel, channel_type: "channel", user: from.id, ts, text: `<@${recipient.id}> :hedgehog:${why}`, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] });
  return ts;
}

if (step === "join") for (const person of cast) await join(person);
else if (step === "thanks") console.log(JSON.stringify({ thanked: await thoughtfulThanks(giver, thanked) }));
else throw new Error("step is join or thanks");

console.log(JSON.stringify({ step, eventsSent: sent }));
