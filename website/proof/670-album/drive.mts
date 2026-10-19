import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const appId = readFileSync(required("SLACK_APP_ID_FILE"), "utf8").trim();
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const step = process.argv[2] ?? "join";
const tab = process.argv[3] ?? "profile";
const run = `${Date.now()}`;
const cast = process.env.KUDOS_CAST ?? "";

type Person = { id: string; name: string };

const ava: Person = { id: `U0PRF670AVA${cast}`, name: "Ava Lindgren" };
const ben: Person = { id: `U0PRF670BEN${cast}`, name: "Ben Achterberg" };
const cyd: Person = { id: `U0PRF670CYD${cast}`, name: "Cyd Moreno" };
const everyone = [ava, ben, cyd];

let sent = 0;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function signed(path: string, body: string, contentType?: string) {
  sent += 1;
  const response = await fetch(`${site}${path}`, await signedRequest(body, { secret, ...(contentType && { contentType }) }));
  if (!response.ok) throw new Error(`request ${sent} answered ${response.status}: ${await response.text()}`);
}

function envelope(event: Record<string, unknown>, at = Date.now()) {
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof670x${run}x${sent}`, event_time: Math.floor(at / 1000), event });
}

async function join(person: Person) {
  const user = { id: person.id, team_id: workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "UTC", profile: { display_name: person.name, real_name: person.name } };
  await signed("/slack/events", envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

async function opensAppHome(person: Person) {
  await signed("/slack/events", envelope({ type: "app_home_opened", user: person.id, channel: `D0PRF670${person.id.slice(-3)}`, tab: "home", event_ts: `${Date.now() / 1000}` }));
  await pause(3_000);
}

async function message(author: Person, elements: Array<Record<string, unknown>>) {
  const ts = (Date.now() / 1000).toFixed(6);
  const text = elements.map((element) => (element.type === "user" ? `<@${element.user_id}>` : element.type === "emoji" ? `:${element.name}:` : String(element.text))).join("");
  await signed("/slack/events", envelope({ type: "message", channel, channel_type: "channel", user: author.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }));
  await pause(5_000);
  return { channel, ts, author };
}

function thanks(giver: Person, to: Person[], words: string) {
  const mentions = to.flatMap((person) => [{ type: "user", user_id: person.id }, { type: "text", text: " " }]);
  return message(giver, [{ type: "text", text: `${words} ` }, ...mentions, { type: "emoji", name: "hedgehog", unicode: "1f994" }]);
}

async function hug(hugger: Person, { ts, author }: { ts: string; author: Person }) {
  const event = { type: "reaction_added", user: hugger.id, reaction: "hedgehog", item_user: author.id, item: { type: "message", channel, ts }, event_ts: (Date.now() / 1000).toFixed(6) };
  await signed("/slack/events", envelope(event));
  await pause(3_000);
}

async function click(person: Person, command: Record<string, unknown>) {
  const encoded = JSON.stringify(command);
  const payload = {
    type: "block_actions",
    team: { id: workspace, domain: "sandbox" },
    user: { id: person.id, team_id: workspace },
    api_app_id: appId,
    trigger_id: `670.${run}.${sent}.trigger`,
    container: { type: "view", view_id: "V_HOME" },
    view: { id: "V_HOME", type: "home" },
    actions: [{ block_id: "b1", type: "button", action_id: encoded, value: encoded, action_ts: `${Date.now() / 1000}` }],
  };
  await signed("/slack/interactivity", new URLSearchParams({ payload: JSON.stringify(payload) }).toString(), "application/x-www-form-urlencoded");
  await pause(3_000);
}

if (step === "join") {
  for (const person of everyone) await join(person);
  await pause(5_000);
  for (const person of everyone) await opensAppHome(person);
  console.log(JSON.stringify({ step, eventsSent: sent, people: everyone.map(({ id, name }) => ({ id, name })) }, null, 2));
} else if (step === "kudos") {
  const avasThanks = await thanks(ava, [ben, cyd], "Thanks for untangling the release checklist with me this afternoon");
  const bensThanks = await thanks(ben, [ava], "Thanks for reviewing the incident write-up so quickly and kindly");
  const short = await thanks(cyd, [ben], "ty");
  await hug(ben, avasThanks);
  console.log(JSON.stringify({ step, eventsSent: sent, avasThanks, bensThanks, short }, null, 2));
} else if (step === "tab") {
  for (const person of everyone) await click(person, { type: "showHomeTab", tab });
  console.log(JSON.stringify({ step, tab, eventsSent: sent }));
} else {
  throw new Error(`unknown step ${step}: join, kudos or tab <name>`);
}
