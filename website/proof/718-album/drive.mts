import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;
const cast = process.env.KUDOS_CAST ?? "";
const gravatarDocsExample = "https://secure.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50.jpg?s=192";

type Person = { id: string; name: string; picture?: string };

const giver: Person = { id: `U0PRF718GVR${cast}`, name: "Tamsin Vale" };
const longNamed: Person = { id: `U0PRF718MAX${cast}`, name: "Maximiliane Aurelia Konstantinopoulou-Wetherington", picture: gravatarDocsExample };
const pictureless: Person = { id: `U0PRF718PIM${cast}`, name: "Pim Lark" };

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
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof718x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
}

async function join(person: Person) {
  const profile = { display_name: person.name, real_name: person.name, ...(person.picture === undefined ? {} : { image_192: person.picture }) };
  const user = { id: person.id, team_id: workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile };
  await post(envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

async function give(to: Person[], words: string) {
  const ts = (Date.now() / 1000).toFixed(6);
  const mentions = to.flatMap((person, index) => [...(index > 0 ? [{ type: "text", text: " " }] : []), { type: "user", user_id: person.id }]);
  const elements = [...mentions, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: ` ${words}` }];
  const text = `${to.map((person) => `<@${person.id}>`).join(" ")} :hedgehog: ${words}`;
  await post(envelope({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }));
  await pause(4000);
  return ts;
}

for (const person of [giver, longNamed, pictureless]) await join(person);
await pause(5000);

const thoughtfulToTwo = await give([longNamed, pictureless], "for untangling the release checklist with me until every step was clear");

console.log(JSON.stringify({ eventsSent: sent, giver: giver.id, thanked: [longNamed.id, pictureless.id], messages: { thoughtfulToTwo } }));
