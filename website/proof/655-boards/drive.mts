import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;
const cast = process.env.KUDOS_CAST ?? "";

type Person = { id: string; name: string };

const marlo: Person = { id: `U0PRF655MRL${cast}`, name: "Marlo Penhallow" };
const tamsin: Person = { id: `U0PRF655TMS${cast}`, name: "Tamsin Okoro" };
const bramble: Person = { id: `U0PRF655BRM${cast}`, name: "Bramble Achterberg" };
const quill: Person = { id: `U0PRF655QLL${cast}`, name: "Quill Ferreira" };

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
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof655x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
}

async function join(person: Person) {
  const user = { id: person.id, team_id: workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post(envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

async function give(giver: Person, to: Person[], words: string) {
  const ts = (Date.now() / 1000).toFixed(6);
  const mentions = to.flatMap((person, index) => [...(index > 0 ? [{ type: "text", text: " " }] : []), { type: "user", user_id: person.id }]);
  const elements = [...mentions, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: ` ${words}` }];
  const text = `${to.map((person) => `<@${person.id}>`).join(" ")} :hedgehog: ${words}`;
  await post(envelope({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }], event_ts: ts }));
  await pause(4000);
  return ts;
}

for (const person of [marlo, tamsin, bramble, quill]) await join(person);
await pause(5000);

const messages = {
  marloToThree: await give(marlo, [tamsin, bramble, quill], "for untangling the release checklist with me this week"),
  tamsinToTwo: await give(tamsin, [marlo, quill], "for the second pair of eyes on the migration plan"),
  brambleToOne: await give(bramble, [quill], "for sitting with me through the flaky deploy until it was green"),
  brambleShort: await give(bramble, [marlo], "ty"),
};

console.log(JSON.stringify({ eventsSent: sent, givers: { marlo: marlo.id, tamsin: tamsin.id, bramble: bramble.id }, recipient: quill.id, messages }));
