import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";
import { cast, nameOf, type Person } from "./cast.mts";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;

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

async function join(person: Person) {
  const name = nameOf(person);
  const user = { id: person.id, team_id: workspace, name: person.first.toLowerCase(), real_name: name, tz: "Europe/Berlin", profile: { display_name: name, real_name: name } };
  const event = { type: "team_join", user, event_ts: `${Date.now() / 1000}` };
  await post(JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof119x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event }));
}

for (const person of cast) await join(person);

console.log(JSON.stringify({ eventsSent: sent, joined: cast.map(({ id }) => id) }));
