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

const wren: Person = { id: `U0PRF103WRN${cast}`, name: "Wren Halloway" };
const odile: Person = { id: `U0PRF103ODL${cast}`, name: "Odile Marsh" };

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(event: Record<string, unknown>) {
  sent += 1;
  const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof103x${cast}x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  if (!response.ok) throw new Error(`event ${sent} answered ${response.status}: ${await response.text()}`);
  console.log(`event ${sent} (${event.type}) answered ${response.status}`);
}

async function join(person: Person) {
  const [given] = person.name.split(" ");
  const user = { id: person.id, team_id: workspace, name: given!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post({ type: "team_join", user, event_ts: `${Date.now() / 1000}` });
}

async function thoughtfulThanks(giver: Person, recipient: Person) {
  const ts = (Date.now() / 1000).toFixed(6);
  const why = " thank you for untangling the release checklist and walking me through every step";
  const elements = [{ type: "user", user_id: recipient.id }, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: why }];
  const text = `<@${recipient.id}> :hedgehog:${why}`;
  await post({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] });
  console.log(`thoughtful kudos from ${giver.name} (${giver.id}) to ${recipient.name} at ts ${ts}`);
}

for (const person of [wren, odile]) await join(person);
await pause(8000);
await thoughtfulThanks(wren, odile);
