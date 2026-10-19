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

const marlowe: Person = { id: `U0PRF654MRL${cast}`, name: "Marlowe Tansy" };
const juniper: Person = { id: `U0PRF654JNP${cast}`, name: "Juniper Vale" };
const ottilie: Person = { id: `U0PRF654OTL${cast}`, name: "Ottilie Brack" };
const bram: Person = { id: `U0PRF654BRM${cast}`, name: "Bram Seton" };

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
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof654x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
}

async function join(person: Person) {
  const user = { id: person.id, team_id: workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post(envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

function tsOf(daysAgo: number) {
  return ((Date.now() - daysAgo * dayMs) / 1000).toFixed(6);
}

async function give(giver: Person, to: Person, words: string, daysAgo: number) {
  const ts = tsOf(daysAgo);
  const elements = [{ type: "user", user_id: to.id }, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: ` ${words}` }];
  const text = `<@${to.id}> :hedgehog: ${words}`;
  await post(envelope({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }));
  await pause(4000);
  return ts;
}

async function hug(giver: Person, author: Person, ts: string) {
  await post(envelope({ type: "reaction_added", user: giver.id, reaction: "hedgehog", item_user: author.id, item: { type: "message", channel, ts }, event_ts: (Date.now() / 1000).toFixed(6) }));
  await pause(4000);
}

for (const person of [marlowe, juniper, ottilie, bram]) await join(person);
await pause(5000);

const lastWeek = await give(marlowe, juniper, "for untangling the brittle invoice export over two long afternoons with me", 7);
const thisWeek = await give(marlowe, juniper, "for pairing on the cranky search reindex", 0);
const brief = await give(marlowe, juniper, "ty", 0);
const fromOttilie = await give(ottilie, marlowe, "for the calm handover notes before the holiday", 0);
await hug(bram, marlowe, thisWeek);
const marlowesPlain = tsOf(1 / 24);
await hug(bram, marlowe, marlowesPlain);
const junipersPlain = tsOf(1 / 48);
await hug(marlowe, juniper, junipersPlain);

console.log(JSON.stringify({ eventsSent: sent, member: marlowe.id, person: juniper.id, thankedBy: ottilie.id, hugger: bram.id, messages: { lastWeek, thisWeek, brief, fromOttilie, marlowesPlain, junipersPlain } }));
