import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = "https://different-dog-467.convex.site";
const secretDir = required("KUDOS_SECRET_DIR");
const secret = secretFile("SLACK_SIGNING_SECRET");
const botToken = secretFile("SLACK_BOT_TOKEN");
const appId = secretFile("SLACK_APP_ID");
const step = process.argv[2] ?? "join";
const run = `${Date.now()}`;
const workspace = "T0PRF158WKS";
const kudosChannel = "C0PRF158KUD";
const announcementChannel = "C0C9N9A4SE4";

type Person = { id: string; name: string; admin?: boolean; workspace?: string };
const ada: Person = { id: "U0PRF158ADA", name: "Ada Proof", admin: true };
const gil: Person = { id: "U0PRF158GIL", name: "Gil Proof" };
const rae: Person = { id: "U0PRF158RAE", name: "Rae Proof" };
const kai: Person = { id: "U0PRF158KAI", name: "Kai Proof" };
const mae: Person = { id: "U0PRF158MAE", name: "Mae Proof", workspace: secretFile("SLACK_WORKSPACE_ID") };
const lu: Person = { id: "U0PRF158LUU", name: "Lu Proof" };

let sent = 0;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function secretFile(name: string) {
  return readFileSync(`${secretDir}/${name}`, "utf8").trim();
}

async function signed(path: string, body: string, contentType?: string) {
  sent += 1;
  const response = await fetch(`${site}${path}`, await signedRequest(body, { secret, ...(contentType && { contentType }) }));
  if (!response.ok) throw new Error(`request ${sent} answered ${response.status}: ${await response.text()}`);
}

function envelope(event: Record<string, unknown>, at = Date.now(), team = workspace) {
  return JSON.stringify({ type: "event_callback", team_id: team, event_id: `EvProof158x${run}x${sent}`, event_time: Math.floor(at / 1000), event });
}

async function join(person: Person) {
  const team = person.workspace ?? workspace;
  const user = { id: person.id, team_id: team, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", is_admin: person.admin === true, profile: { display_name: person.name, real_name: person.name } };
  await signed("/slack/events", envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }, Date.now(), team));
  await pause(2_000);
}

async function thanks(from: Person, to: Person, words: string) {
  const at = Date.now();
  const ts = `${Math.floor(at / 1000)}.${String(sent + 1).padStart(6, "0")}`;
  const elements = [{ type: "text", text: `${words} ` }, { type: "user", user_id: to.id }, { type: "text", text: " " }, { type: "emoji", name: "hedgehug" }];
  await signed("/slack/events", envelope({ type: "message", channel: kudosChannel, channel_type: "channel", user: from.id, ts, text: `${words} <@${to.id}> :hedgehug:`, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }, at));
  await pause(5_000);
  return { from: from.name, to: to.name, ts };
}

async function click(person: Person, command: Record<string, unknown>) {
  const encoded = JSON.stringify(command);
  const payload = { type: "block_actions", team: { id: workspace, domain: "proof" }, user: { id: person.id, team_id: workspace }, api_app_id: appId, trigger_id: `158.${run}.${sent}.trigger`, container: { type: "view", view_id: "V_HOME" }, view: { id: "V_HOME", type: "home" }, actions: [{ block_id: "b1", type: "button", action_id: encoded, value: encoded, action_ts: `${Date.now() / 1000}` }] };
  await signed("/slack/interactivity", new URLSearchParams({ payload: JSON.stringify(payload) }).toString(), "application/x-www-form-urlencoded");
  await pause(4_000);
}

async function newestAppPosts() {
  const response = await fetch(`https://slack.com/api/conversations.history?${new URLSearchParams({ channel: announcementChannel, limit: "8" })}`, { headers: { authorization: `Bearer ${botToken}` } });
  const history = (await response.json()) as { ok: boolean; error?: string; messages?: Array<Record<string, unknown>> };
  return { ok: history.ok, error: history.error, appPosts: (history.messages ?? []).filter(({ bot_id }) => bot_id !== undefined).slice(0, 4).map(({ ts, text }) => ({ ts, text })) };
}

const steps: Record<string, () => Promise<unknown>> = {
  join: async () => {
    for (const person of [ada, gil, rae, kai]) await join(person);
    await click(ada, { type: "setAnnouncementChannel", channel: announcementChannel });
  },
  "join-lu": () => join(lu),
  "join-maintainer": () => join(mae),
  "level-on": async () => [await thanks(lu, kai, "Thanks for pairing on the flaky checkout test until it held")],
  "switch-off": () => click(ada, { type: "setPublicCelebrations", on: false }),
  "level-off": async () => [await thanks(rae, kai, "Thanks for the clear handover notes before your holiday")],
  "switch-on": () => click(ada, { type: "setPublicCelebrations", on: true }),
  history: newestAppPosts,
};

const action = steps[step];
if (!action) throw new Error(`unknown step ${step}`);
console.log(JSON.stringify({ step, at: new Date().toISOString(), result: (await action()) ?? null, eventsSent: sent }, null, 1));
