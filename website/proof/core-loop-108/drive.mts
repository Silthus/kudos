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

const visitor: Person = { id: `U0PRF108VST${cast}`, name: "Maren Ostby" };
const teammate: Person = { id: `U0PRF108TMT${cast}`, name: "Joss Kerrigan" };

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function post(event: Record<string, unknown>) {
  sent += 1;
  const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof108x${cast}x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  if (!response.ok) throw new Error(`event ${sent} answered ${response.status}: ${await response.text()}`);
  console.log(`event ${sent} (${event.type}) answered ${response.status}`);
}

async function join(person: Person) {
  const [given] = person.name.split(" ");
  const user = { id: person.id, team_id: workspace, name: given!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post({ type: "team_join", user, event_ts: `${Date.now() / 1000}` });
}

async function plainKudos(giver: Person, recipient: Person, count: number) {
  const ts = (Date.now() / 1000).toFixed(6);
  const hedgehogs = Array.from({ length: count }, () => ({ type: "emoji", name: "hedgehog", unicode: "1f994" }));
  const elements = [{ type: "user", user_id: recipient.id }, { type: "text", text: " " }, ...hedgehogs];
  const text = `<@${recipient.id}> ${":hedgehog:".repeat(count)}`;
  await post({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] });
  console.log(`${count} kudos from ${giver.name} (${giver.id}) to ${recipient.name} at ts ${ts}`);
}

const steps: Record<string, () => Promise<void>> = {
  join: async () => {
    for (const person of [visitor, teammate]) await join(person);
  },
  thanked: () => plainKudos(teammate, visitor, 1),
  level: () => plainKudos(visitor, teammate, 2),
};

const step = process.argv[2] ?? "";
const run108 = steps[step];
if (!run108) throw new Error(`step must be one of ${Object.keys(steps).join(", ")}`);
await run108();
