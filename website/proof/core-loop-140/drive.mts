import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const channel = "C0PRF140HOW";
const run = `${Date.now()}`;
let sent = 0;

type Person = { id: string; name: string };

const newcomer: Person = { id: "U0PRF140NEWB", name: "Pia Newleaf" };
const teammate: Person = { id: "U0PRF140MATE", name: "Tam Oakes" };
const stillNewcomer: Person = { id: "U0PRF140STILL", name: "Ravi Firstlight" };

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const nowTs = (secondsAgo = 0) => (Date.now() / 1000 - secondsAgo).toFixed(6);

async function post(event: Record<string, unknown>) {
  sent += 1;
  const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof140x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), authorizations: [{ team_id: workspace, user_id: "U_KUDOS_APP", is_bot: true }], event });
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  console.log(`event ${sent} (${event.type}) answered ${response.status}`);
}

async function join(person: Person) {
  const [given] = person.name.split(" ");
  const user = { id: person.id, team_id: workspace, name: given!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post({ type: "team_join", user, event_ts: nowTs() });
}

async function hug(giver: Person, author: Person, reaction: string) {
  const messageTs = nowTs(120);
  await post({ type: "reaction_added", user: giver.id, reaction, item_user: author.id, item: { type: "message", channel, ts: messageTs }, event_ts: nowTs() });
  console.log(`  reaction :${reaction}: by ${giver.name} on ${author.name}'s message ${messageTs}`);
}

const step = process.argv[2];
if (step === "join") {
  for (const person of [newcomer, teammate]) await join(person);
} else if (step === "join-still") {
  await join(stillNewcomer);
} else if (step === "hug") {
  await hug(newcomer, teammate, "hedgehog");
}
