import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = "C0PRFPICKS1";
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const kudosEmoji = process.env.KUDOS_EMOJI_NAME ?? "hedgehug";
const run = `${Date.now()}`;
const why = "thanks for pairing on the release checklist and catching the missing step";

const drew = { id: "U0PRFPK1DRW", name: "Drew Bramble" };
const avery = { id: "U0PRFPK1AVY", name: "Avery Hedge" };
const blake = { id: "U0PRFPK1BLK", name: "Blake Thorn" };

let sent = 0;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function post(event: Record<string, unknown>, label: string) {
  sent += 1;
  const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProofPicks${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  console.log(`${label}: HTTP ${response.status}`);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const messageTs = (offsetMinutes: number) => ((Date.now() - offsetMinutes * 60_000) / 1000).toFixed(6);

type Part = { user: string } | { emoji: string } | { text: string };

async function say(giver: { id: string }, parts: Part[], ts: string, label: string) {
  const elements = parts.map((part) => ("user" in part ? { type: "user", user_id: part.user } : "emoji" in part ? { type: "emoji", name: part.emoji } : { type: "text", text: part.text }));
  const text = parts.map((part) => ("user" in part ? `<@${part.user}>` : "emoji" in part ? `:${part.emoji}:` : part.text)).join("");
  await post({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }, `${label} (ts ${ts})`);
}

async function react(giver: { id: string }, author: { id: string }, reaction: string, ts: string, label: string) {
  await post({ type: "reaction_added", user: giver.id, reaction, item_user: author.id, item: { type: "message", channel, ts }, event_ts: `${Date.now() / 1000}` }, `${label} (ts ${ts})`);
}

async function join(person: { id: string; name: string }) {
  const user = { id: person.id, team_id: workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }, `team_join ${person.name}`);
}

const [phase, earned = "", hype = "", firstThankYou = ""] = process.argv.slice(2);

const sayHey = (offset: number, label: string) => say(drew, [{ text: "hey " }, { user: avery.id }, { text: " " }, { emoji: earned }], messageTs(offset), `${label}: Drew says hey to Avery with :${earned}:`);

if (phase === "setup") {
  for (const person of [drew, avery, blake]) await join(person);
  await pause(4000);
  await say(drew, [{ user: blake.id }, { text: " " }, { emoji: kudosEmoji }, { text: ` ${why}` }], messageTs(90), `setup: Drew thanks Blake with :${kudosEmoji}: and says why`);
} else if (phase === "unpicked") {
  await sayHey(55, "unpicked");
  await react(drew, avery, earned, messageTs(54), `hug: Drew reacts :${earned}: on a message of Avery's`);
  await say(drew, [{ text: "hey " }, { user: avery.id }, { text: " " }, { emoji: hype }], messageTs(50), `unmentioned: Drew says hey to Avery with Blake's hype :${hype}:`);
  await say(drew, [{ user: blake.id }, { text: " " }, { emoji: hype }, { text: ` ${why}` }], messageTs(45), `mentioned: Drew thanks Blake with Blake's own hype :${hype}:`);
  await say(drew, [{ user: avery.id }, { text: " " }, { emoji: firstThankYou }, { text: ` ${why}` }], messageTs(40), `always: Drew thanks Avery with First thank-you :${firstThankYou}:`);
  await say(drew, [{ user: blake.id }, { text: " " }, { emoji: "hog-offers-heart" }, { text: ` ${why}` }], messageTs(35), "always: Drew thanks Blake with First thank-you's second name :hog-offers-heart:");
} else if (phase === "picked") {
  await sayHey(30, "picked");
} else if (phase === "unpicked-again") {
  await sayHey(25, "unpicked again");
} else if (phase === "hype") {
  await say(drew, [{ text: "hey " }, { user: avery.id }, { text: " " }, { emoji: hype }], messageTs(20), `unmentioned: Drew says hey to Avery with Blake's hype :${hype}:`);
  await say(drew, [{ user: blake.id }, { text: " " }, { emoji: hype }, { text: ` ${why}` }], messageTs(15), `mentioned: Drew thanks Blake with Blake's own hype :${hype}:`);
} else throw new Error("phase is setup, unpicked, picked, unpicked-again or hype");
