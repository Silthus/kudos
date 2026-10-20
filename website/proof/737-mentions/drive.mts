import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const group = required("KUDOS_GROUP");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;
let sent = 0;

type Person = { id: string; name: string };

const juniper: Person = { id: "U0PRF737JNP", name: "Juniper Vale" };
const tobin: Person = { id: "U0PRF737TBN", name: "Tobin Reyes" };
const mira: Person = { id: "U0PRF737MRA", name: "Mira Castell" };
const stranger = "U0PRF737NONE";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(event: Record<string, unknown>) {
  sent += 1;
  const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof737x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  if (!response.ok) throw new Error(`event ${sent} answered ${response.status}: ${await response.text()}`);
  console.log(`event ${sent} (${event.type}) answered ${response.status}`);
}

async function join(person: Person, team = workspace) {
  const [given] = person.name.split(" ");
  const user = { id: person.id, team_id: team, name: given!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post({ type: "team_join", user, event_ts: `${Date.now() / 1000}` });
}

const words = (text: string) => ({ type: "text", text });
const mention = (user: string) => ({ type: "user", user_id: user });

async function thanksWithEveryKindOfMention() {
  const ts = (Date.now() / 1000).toFixed(6);
  const elements = [
    mention(tobin.id),
    words(" "),
    { type: "emoji", name: "hedgehog", unicode: "1f994" },
    words(" thank you for pairing with "),
    mention(mira.id),
    words(" and "),
    mention(stranger),
    words(" on the rollout plan, and for walking "),
    { type: "usergroup", usergroup_id: group },
    words(" through it in "),
    { type: "channel", channel_id: channel },
    words(" so calmly"),
  ];
  const text = `<@${tobin.id}> :hedgehog: thank you for pairing with <@${mira.id}> and <@${stranger}> on the rollout plan, and for walking <!subteam^${group}> through it in <#${channel}> so calmly`;
  await post({ type: "message", channel, channel_type: "channel", user: juniper.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] });
  console.log(`kudos from ${juniper.name} to ${tobin.name} at ts ${ts}`);
}

if (process.argv[2] === "stranger") {
  await join({ id: stranger, name: "Someone Elsewhere" }, "T0PRF737OTHER");
} else {
  for (const person of [juniper, tobin, mira]) await join(person);
  await pause(8000);
  await thanksWithEveryKindOfMention();
}
