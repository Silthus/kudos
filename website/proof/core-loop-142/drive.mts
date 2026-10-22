import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const channel = "C0PRF142USE";
const run = `${Date.now()}`;
let sent = 0;

type Person = { id: string; name: string };

const toLevelTwo: Person = { id: "U0PRF142LVTWO", name: "Juno Twostep" };
const toLevelFive: Person = { id: "U0PRF142LVFIVE", name: "Odile Fivefold" };
const teammate: Person = { id: "U0PRF142MATE", name: "Rafe Helper" };

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nowTs = () => (Date.now() / 1000).toFixed(6);

async function post(event: Record<string, unknown>) {
  sent += 1;
  const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof142x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), authorizations: [{ team_id: workspace, user_id: "U_KUDOS_APP", is_bot: true }], event });
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  console.log(`event ${sent} (${event.type}) answered ${response.status}`);
}

async function join(person: Person) {
  const [given] = person.name.split(" ");
  const user = { id: person.id, team_id: workspace, name: given!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post({ type: "team_join", user, event_ts: nowTs() });
}

async function kudos(giver: Person, recipient: Person, words: string) {
  const ts = nowTs();
  const blocks = [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements: [{ type: "user", user_id: recipient.id }, { type: "text", text: ` ${words} ` }, { type: "emoji", name: "hedgehog", unicode: "1f994" }] }] }];
  await post({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text: `<@${recipient.id}> ${words} :hedgehog:`, team: workspace, blocks });
  console.log(`  kudos ${giver.name} -> ${recipient.name} at ts ${ts}`);
}

async function climb(giver: Person) {
  await kudos(giver, teammate, "thank you for walking me through the release checklist");
  await pause(1500);
  await kudos(giver, teammate, "thank you for pairing on the flaky test this morning");
}

const step = process.argv[2];
if (step === "join") {
  for (const person of [toLevelTwo, toLevelFive, teammate]) await join(person);
} else if (step === "climb") {
  await climb(toLevelTwo);
  await pause(1500);
  await climb(toLevelFive);
} else {
  throw new Error(`unknown step ${step}`);
}
