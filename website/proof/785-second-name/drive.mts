import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = "https://different-dog-467.convex.site";
const workspace = "T0C3US298SH";
const channel = "C0PRF785CHN";
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;
const secondName = "hog-offers-heart";
const firstName = "first-thank-you";

const drew = { id: "U0PRF251DRW", name: "Drew Bramble" };
const avery = { id: "U0PRF251AVY", name: "Avery Hedge" };
const blake = { id: "U0PRF251BLK", name: "Blake Thorn" };
const noor = { id: "U0PRF785NOR", name: "Noor Haldane" };

let sent = 0;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function post(event: Record<string, unknown>, label: string) {
  sent += 1;
  const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof785x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  console.log(`${label}: HTTP ${response.status}`);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const messageTs = (offsetMinutes: number) => ((Date.now() - offsetMinutes * 60_000) / 1000).toFixed(6);

async function react(giver: { id: string }, author: { id: string }, reaction: string, ts: string, label: string) {
  await post({ type: "reaction_added", user: giver.id, reaction, item_user: author.id, item: { type: "message", channel, ts }, event_ts: `${Date.now() / 1000}` }, `${label} (ts ${ts})`);
}

async function thank(giver: { id: string }, recipient: { id: string }, emoji: string, ts: string, label: string) {
  const words = "thanks for pairing on the release checklist and catching the missing step";
  const elements = [{ type: "user", user_id: recipient.id }, { type: "text", text: " " }, { type: "emoji", name: emoji }, { type: "text", text: ` ${words}` }];
  await post({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text: `<@${recipient.id}> :${emoji}: ${words}`, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }, `${label} (ts ${ts})`);
}

async function join(person: { id: string; name: string }) {
  const user = { id: person.id, team_id: workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }, `team_join ${person.name}`);
}

const phase = process.argv[2];

if (phase === "before") {
  await join(noor);
  await pause(3000);
  await react(drew, avery, secondName, messageTs(50), `before: Drew reacts :${secondName}: on Avery's message`);
} else if (phase === "after") {
  await react(drew, avery, secondName, messageTs(40), `after: Drew (holds First thank-you) reacts :${secondName}: on Avery's message`);
  await react(drew, avery, firstName, messageTs(35), `after: Drew reacts the first name :${firstName}: on Avery's message`);
  await react(noor, avery, secondName, messageTs(30), `after: Noor (holds nothing) reacts :${secondName}: on Avery's message`);
  await thank(drew, blake, secondName, messageTs(25), `after: Drew thanks Blake with :${secondName}:`);
  await thank(noor, blake, secondName, messageTs(20), `after: Noor thanks Blake with :${secondName}:`);
} else throw new Error("phase is before or after");
