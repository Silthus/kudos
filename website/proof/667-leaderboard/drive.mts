import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;
const cast = process.env.KUDOS_CAST ?? "";

type Person = { id: string; name: string };

const aster: Person = { id: `U0PRF667AST${cast}`, name: "Aster Vey" };
const briar: Person = { id: `U0PRF667BRR${cast}`, name: "Briar Holm" };
const corin: Person = { id: `U0PRF667CRN${cast}`, name: "Corin Lusk" };
const dune: Person = { id: `U0PRF667DNE${cast}`, name: "Dune Pellow" };
const ember: Person = { id: `U0PRF667EMB${cast}`, name: "Ember Quist" };

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
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof667x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
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

for (const person of [aster, briar, corin, dune, ember]) await join(person);
await pause(5000);

const messages = {
  asterToThree: await give(aster, [briar, corin, dune], "for walking me through the rollout plan line by line"),
  briarToTwo: await give(briar, [aster, ember], "for catching the edge case in the billing export before it shipped"),
  corinToTwo: await give(corin, [aster, dune], "for pairing on the flaky search test until we found the race"),
  duneToOne: await give(dune, [ember], "for rewriting the onboarding doc so new joiners stop getting stuck"),
  emberToOne: await give(ember, [corin], "for covering my on-call shift when my train was cancelled"),
  emberShort: await give(ember, [aster], "ty"),
};

console.log(JSON.stringify({ eventsSent: sent, givers: { aster: aster.id, briar: briar.id, corin: corin.id, dune: dune.id, ember: ember.id }, messages }));
