import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const cast = required("KUDOS_CAST");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;
let sent = 0;

type Person = { id: string; name: string };

const newcomer: Person = { id: `U0PRF139FERN${cast}`, name: "Fern Newcomb" };
const author: Person = { id: `U0PRF139ADA${cast}`, name: "Ada Quill" };

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const nowTs = (secondsAgo = 0) => (Date.now() / 1000 - secondsAgo).toFixed(6);

async function post(event: Record<string, unknown>) {
  sent += 1;
  const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof139x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), authorizations: [{ team_id: workspace, user_id: "U_KUDOS_APP", is_bot: true }], event });
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  console.log(`event ${sent} (${event.type}) answered ${response.status}`);
}

async function join(person: Person) {
  const [given] = person.name.split(" ");
  const user = { id: person.id, team_id: workspace, name: given!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post({ type: "team_join", user, event_ts: nowTs() });
}

async function hug(giver: Person, messageAuthor: Person, messageTs: string) {
  await post({ type: "reaction_added", user: giver.id, reaction: "hedgehog", item_user: messageAuthor.id, item: { type: "message", channel, ts: messageTs }, event_ts: nowTs() });
  console.log(`  :hedgehog: by ${giver.name} (${giver.id}) on ${messageAuthor.name}'s message ${messageTs} in ${channel}`);
}

const step = process.argv[2];
if (step === "join") for (const person of [newcomer, author]) await join(person);
else if (step === "first-hug") await hug(newcomer, author, nowTs(600));
else if (step === "second-hug") await hug(newcomer, author, nowTs(300));
else throw new Error("usage: drive.mts join | first-hug | second-hug");
