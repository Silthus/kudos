import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const channel = "C0PRF137RHS";
const run = `${Date.now()}`;
let sent = 0;

type Person = { id: string; name: string };

const climber: Person = { id: "U0PRF137LVTWO", name: "Wren Twofold" };
const newcomer: Person = { id: "U0PRF137LVONE", name: "Oli Firstday" };
const teammate: Person = { id: "U0PRF137MATE", name: "Kit Helper" };

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nowTs = (secondsAgo = 0) => (Date.now() / 1000 - secondsAgo).toFixed(6);

async function post(event: Record<string, unknown>) {
  sent += 1;
  const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof137x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), authorizations: [{ team_id: workspace, user_id: "U_KUDOS_APP", is_bot: true }], event });
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  console.log(`event ${sent} (${event.type}${event.reaction ? ` :${event.reaction}:` : ""} by ${event.user ?? (event.user as { id?: string } | undefined)}) answered ${response.status}`);
}

async function join(person: Person) {
  const [given] = person.name.split(" ");
  const user = { id: person.id, team_id: workspace, name: given!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post({ type: "team_join", user, event_ts: nowTs() });
}

type Emoji = { name: string; unicode: string; skin_tone?: number };
const hedgehog: Emoji = { name: "hedgehog", unicode: "1f994" };
const raisedHands: Emoji = { name: "raised_hands", unicode: "1f64c" };

async function kudos(giver: Person, recipient: Person, words: string, emoji: Emoji) {
  const ts = nowTs();
  const blocks = [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements: [{ type: "user", user_id: recipient.id }, { type: "text", text: ` ${words} ` }, { type: "emoji", ...emoji }] }] }];
  await post({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text: `<@${recipient.id}> ${words} :${emoji.name}:`, team: workspace, blocks });
  console.log(`  kudos ${giver.name} -> ${recipient.name} with :${emoji.name}: at ts ${ts}`);
  return ts;
}

async function react(giver: Person, author: Person, reaction: string, messageTs: string) {
  await post({ type: "reaction_added", user: giver.id, reaction, item_user: author.id, item: { type: "message", channel, ts: messageTs }, event_ts: nowTs() });
  console.log(`  reaction :${reaction}: by ${giver.name} on ${author.name}'s message ${messageTs}`);
}

const step = process.argv[2];
if (step === "join") {
  for (const person of [climber, newcomer, teammate]) await join(person);
} else if (step === "climb") {
  await kudos(climber, teammate, "thank you for walking me through the deploy checklist", hedgehog);
  await pause(1500);
  await kudos(climber, teammate, "thank you for pairing on the flaky test this morning", hedgehog);
} else if (step === "raised-hands") {
  await kudos(climber, teammate, "thank you for reviewing my first pull request so carefully", raisedHands);
  await kudos(newcomer, teammate, "thank you for reviewing my first pull request so carefully", raisedHands);
  await react(climber, teammate, "raised_hands", nowTs(300));
  await react(climber, teammate, "raised_hands::skin-tone-3", nowTs(290));
  await react(newcomer, teammate, "raised_hands", nowTs(280));
  await react(newcomer, teammate, "raised_hands::skin-tone-3", nowTs(270));
}
