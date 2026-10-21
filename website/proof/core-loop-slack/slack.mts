import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

export const site = required("KUDOS_SITE");
export const appId = required("SLACK_APP_ID");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const botToken = readFileSync(required("SLACK_BOT_TOKEN_FILE"), "utf8").trim();
const run = `${Date.now()}`;
let sent = 0;

export type Person = { id: string; name: string; workspace: string; admin?: boolean };

export type Sent = { channel: string; ts: string; author: Person };

export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function signed(path: string, body: string, contentType?: string) {
  sent += 1;
  const response = await fetch(`${site}${path}`, await signedRequest(body, { secret, ...(contentType && { contentType }) }));
  if (!response.ok) throw new Error(`request ${sent} answered ${response.status}: ${await response.text()}`);
  return response.status;
}

function envelope(workspace: string, event: Record<string, unknown>, at = Date.now()) {
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProofSlk${run}x${sent}`, event_time: Math.floor(at / 1000), event });
}

export async function join(person: Person) {
  const user = { id: person.id, team_id: person.workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", is_admin: person.admin === true, profile: { display_name: person.name, real_name: person.name } };
  return signed("/slack/events", envelope(person.workspace, { type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

export function tsAt(at: number) {
  return `${Math.floor(at / 1000)}.${String((at % 1000) * 1000 + (sent % 1000)).padStart(6, "0")}`;
}

export async function thanks(giver: Person, to: Person[], words: string, where: { channel: string; at?: number }): Promise<Sent> {
  const at = where.at ?? Date.now();
  const ts = tsAt(at);
  const mentions = to.flatMap((person) => [{ type: "user", user_id: person.id }, { type: "text", text: " " }]);
  const elements = [...mentions, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: ` ${words}` }];
  const text = `${to.map(({ id }) => `<@${id}>`).join(" ")} :hedgehog: ${words}`;
  const event = { type: "message", channel: where.channel, channel_type: "channel", user: giver.id, ts, text, team: giver.workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] };
  await signed("/slack/events", envelope(giver.workspace, event, at));
  return { channel: where.channel, ts, author: giver };
}

export async function hug(hugger: Person, { channel, ts, author }: Sent) {
  const at = Number(ts.split(".")[0]) * 1000 + 60_000;
  const event = { type: "reaction_added", user: hugger.id, reaction: "hedgehog", item_user: author.id, item: { type: "message", channel, ts }, event_ts: `${Math.floor(at / 1000)}.000200` };
  return signed("/slack/events", envelope(hugger.workspace, event, at));
}

export async function click(person: Person, command: Record<string, unknown>) {
  const encoded = JSON.stringify(command);
  const payload = {
    type: "block_actions",
    team: { id: person.workspace, domain: "proof" },
    user: { id: person.id, team_id: person.workspace },
    api_app_id: appId,
    trigger_id: `slk.${run}.${sent}.trigger`,
    container: { type: "view", view_id: "V_HOME" },
    view: { id: "V_HOME", type: "home" },
    actions: [{ block_id: "b1", type: "button", action_id: encoded, value: encoded, action_ts: `${Date.now() / 1000}` }],
  };
  return signed("/slack/interactivity", new URLSearchParams({ payload: JSON.stringify(payload) }).toString(), "application/x-www-form-urlencoded");
}

export type SlackHistory = { ok: boolean; error?: string; messages?: Array<Record<string, unknown>> };

export async function slackRead(method: string, args: Record<string, string>): Promise<SlackHistory> {
  const response = await fetch(`https://slack.com/api/${method}?${new URLSearchParams(args)}`, { headers: { authorization: `Bearer ${botToken}` } });
  return (await response.json()) as SlackHistory;
}

export function storedShapeOf(message: Record<string, unknown>) {
  const { ts, thread_ts, text, blocks, bot_id } = message;
  return { ts, thread_ts, bot_id, text, blocks };
}
