import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const sandbox = required("KUDOS_WORKSPACE");
const appId = required("SLACK_APP_ID");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const botToken = readFileSync(required("SLACK_BOT_TOKEN_FILE"), "utf8").trim();
const step = process.argv[2] ?? "join";
const run = `${Date.now()}`;
const madeUp = "T0PRF741WKS";
const madeUpChannel = "C0PRF741KUD";
const pickedChannel = "C0C9N9A4SE4";
const lastWednesday = Date.parse("2026-10-14T09:00:00Z");

type Person = { id: string; name: string; workspace: string; admin?: boolean };

const maintainer: Person = { id: "U0PRF741MNT", name: "Mae Proof", workspace: sandbox };
const admin: Person = { id: "U0PRF741ADM", name: "Ada Proof", workspace: madeUp, admin: true };
const giver: Person = { id: "U0PRF741GIV", name: "Gil Proof", workspace: madeUp };
const recipient: Person = { id: "U0PRF741RCP", name: "Rae Proof", workspace: madeUp };

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

function envelope(workspace: string, event: Record<string, unknown>, at = Date.now()) {
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof741x${run}x${sent}`, event_time: Math.floor(at / 1000), event });
}

async function join(person: Person) {
  const user = { id: person.id, team_id: person.workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", is_admin: person.admin === true, profile: { display_name: person.name, real_name: person.name } };
  await signed("/slack/events", envelope(person.workspace, { type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
  await pause(2_000);
}

async function thanks(from: Person, to: Person, words: string, at: number) {
  const ts = `${Math.floor(at / 1000)}.${String(sent + 1).padStart(6, "0")}`;
  const elements = [{ type: "text", text: `${words} ` }, { type: "user", user_id: to.id }, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }];
  const text = `${words} <@${to.id}> :hedgehog:`;
  await signed("/slack/events", envelope(from.workspace, { type: "message", channel: madeUpChannel, channel_type: "channel", user: from.id, ts, text, team: from.workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }, at));
  await pause(4_000);
  return { channel: madeUpChannel, ts };
}

async function click(person: Person, command: Record<string, unknown>) {
  const encoded = JSON.stringify(command);
  const payload = {
    type: "block_actions",
    team: { id: person.workspace, domain: "proof" },
    user: { id: person.id, team_id: person.workspace },
    api_app_id: appId,
    trigger_id: `741.${run}.${sent}.trigger`,
    container: { type: "view", view_id: "V_HOME" },
    view: { id: "V_HOME", type: "home" },
    actions: [{ block_id: "b1", type: "button", action_id: encoded, value: encoded, action_ts: `${Date.now() / 1000}` }],
  };
  await signed("/slack/interactivity", new URLSearchParams({ payload: JSON.stringify(payload) }).toString(), "application/x-www-form-urlencoded");
  await pause(4_000);
}

async function newestAppPostIn(channel: string) {
  const response = await fetch(`https://slack.com/api/conversations.history?${new URLSearchParams({ channel, limit: "5" })}`, { headers: { authorization: `Bearer ${botToken}` } });
  const history = (await response.json()) as { ok: boolean; error?: string; messages?: Array<Record<string, unknown>> };
  return { ok: history.ok, error: history.error, newest: (history.messages ?? []).filter(({ bot_id }) => bot_id !== undefined).slice(0, 1).map(({ ts, text, blocks }) => ({ ts, text, blocks })) };
}

if (step === "join") {
  for (const person of [maintainer, admin, giver, recipient]) await join(person);
  console.log(JSON.stringify({ step, eventsSent: sent, people: [maintainer, admin, giver, recipient].map(({ id, workspace }) => ({ id, workspace })) }));
} else if (step === "week") {
  const kudos = await thanks(giver, recipient, "Thanks for rewriting the deploy runbook so the whole team can ship on a Friday", lastWednesday);
  console.log(JSON.stringify({ step, eventsSent: sent, kudos }));
} else if (step === "post-on") {
  await click(admin, { type: "setMondayPost", on: true, timeZone: "Europe/Berlin" });
  console.log(JSON.stringify({ step, eventsSent: sent }));
} else if (step === "post-off") {
  await click(admin, { type: "setMondayPost", on: false });
  console.log(JSON.stringify({ step, eventsSent: sent }));
} else if (step === "read-post") {
  console.log(JSON.stringify(await newestAppPostIn(pickedChannel), null, 2));
} else {
  throw new Error(`unknown step ${step}: join, week, post-on, post-off or read-post`);
}
