import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const botToken = readFileSync(required("SLACK_BOT_TOKEN_FILE"), "utf8").trim();
const step = process.argv[2] ?? "join";
const run = `${Date.now()}`;
const cast = process.env.KUDOS_CAST ?? "";

type Person = { id: string; name: string };

const giver: Person = { id: `U0PRF656GVR${cast}`, name: "Odile Farrow" };
const newcomer: Person = { id: `U0PRF656WRN${cast}`, name: "Wren Halloway" };
const held: Person = { id: `U0PRF656TMS${cast}`, name: "Tamsin Reed" };

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

async function slack(method: string, args: Record<string, string>) {
  const response = await fetch(`https://slack.com/api/${method}?${new URLSearchParams(args)}`, { headers: { authorization: `Bearer ${botToken}` } });
  return (await response.json()) as { ok: boolean; error?: string; ts?: string; messages?: Array<Record<string, unknown>> };
}

function envelope(event: Record<string, unknown>) {
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof656x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
}

async function join(person: Person) {
  const user = { id: person.id, team_id: workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post(envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

async function standInFor(words: string) {
  const parent = await slack("chat.postMessage", { channel, text: `#656 proof: a stand-in for ${giver.name}'s signed kudos "${words}"` });
  if (!parent.ok || parent.ts === undefined) throw new Error(`the stand-in post answered ${parent.error}`);
  return parent.ts;
}

async function give(to: Person[], words: string) {
  const ts = await standInFor(words);
  const mentions = to.flatMap((person, index) => [...(index > 0 ? [{ type: "text", text: " " }] : []), { type: "user", user_id: person.id }]);
  const elements = [...mentions, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: ` ${words}` }];
  const text = `${to.map((person) => `<@${person.id}>`).join(" ")} :hedgehog: ${words}`;
  await post(envelope({ type: "message", channel, channel_type: "channel", user: giver.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }));
  await pause(12_000);
  return { ts, thread: await threadOf(ts) };
}

async function threadOf(ts: string) {
  const replies = await slack("conversations.replies", { channel, ts });
  return { ok: replies.ok, error: replies.error, replies: (replies.messages ?? []).filter((message) => message.ts !== ts).map(({ ts, text, bot_id, blocks }) => ({ ts, bot_id, text, blocks })) };
}

if (step === "join") {
  for (const person of [giver, newcomer, held]) await join(person);
  console.log(JSON.stringify({ step, eventsSent: sent, people: { giver: giver.id, newcomer: newcomer.id, held: held.id } }));
} else if (step === "on") {
  const thoughtful = await give([newcomer, held], "for walking me through the on-call handover so patiently");
  const short = await give([newcomer], "ty");
  console.log(JSON.stringify({ step, eventsSent: sent, thoughtful, short }, null, 2));
} else if (step === "off") {
  const thoughtful = await give([held], "for reviewing the rollout checklist line by line");
  console.log(JSON.stringify({ step, eventsSent: sent, thoughtful }, null, 2));
} else {
  throw new Error(`unknown step ${step}: join, on or off`);
}
