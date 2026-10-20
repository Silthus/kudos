import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;
const cast = process.env.KUDOS_CAST ?? "";
const dayMs = 86_400_000;

type Person = { id: string; name: string };

const existingGiver = process.env.KUDOS_GIVER;
const existingRecipient = process.env.KUDOS_RECIPIENT;
const times = Number(process.env.KUDOS_TIMES ?? "2");

const giver: Person = { id: existingGiver ?? `U0PRFLU1GVR${cast}`, name: "Odile Fernsby" };
const tamsin: Person = { id: existingRecipient ?? `U0PRFLU1TAM${cast}`, name: "Tamsin Holloway" };

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
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProofLU1x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
}

async function join(person: Person) {
  const user = { id: person.id, team_id: workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post(envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

async function give(to: Person[], words: string, daysAgo: number) {
  const ts = ((Date.now() - daysAgo * dayMs) / 1000).toFixed(6);
  const mentions = to.flatMap((person, index) => [...(index > 0 ? [{ type: "text", text: " " }] : []), { type: "user", user_id: person.id }]);
  const elements = [...mentions, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: ` ${words}` }];
  const text = `${to.map((person) => `<@${person.id}>`).join(" ")} :hedgehog: ${words}`;
  await post(envelope({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }));
  await pause(4000);
  return ts;
}

const fresh = [existingGiver ? null : giver, existingRecipient ? null : tamsin].filter((person) => person !== null);
for (const person of fresh) await join(person);
if (fresh.length > 0) await pause(5000);

const reasons = ["for pairing on the flaky deploy until it finally went green", "for the patient walkthrough of the new billing export", "for untangling the release notes before the launch call"];
const thanked = [];
for (const words of reasons.slice(0, times)) thanked.push(await give([tamsin], words, 0));

console.log(JSON.stringify({ eventsSent: sent, giver: giver.id, person: tamsin.id, thanked }));
