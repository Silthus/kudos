import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const human = required("KUDOS_HUMAN");
const appId = required("SLACK_APP_ID");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const botToken = readFileSync(required("SLACK_BOT_TOKEN_FILE"), "utf8").trim();
const step = process.argv[2] ?? "join";
const run = `${Date.now()}`;
const cast = process.env.KUDOS_CAST ?? "";
const privateChannel = `G0PRF657PRV${cast}`;
const lastWednesday = Date.parse("2026-10-14T09:00:00Z");
const aWeekBeforeTheAlbum = Date.parse(process.env.KUDOS_RECAP_DAY ?? "2026-09-30T09:00:00Z");
const minuteMs = 60_000;

type Person = { id: string; name: string };

const ines: Person = { id: `U0PRF657INS${cast}`, name: "Ines Varga" };
const theo: Person = { id: `U0PRF657THO${cast}`, name: "Theo Brandt" };
const mira: Person = { id: `U0PRF657MRA${cast}`, name: "Mira Solberg" };
const newcomer: Person = { id: `U0PRF657NEW${cast}`, name: "Nell Okafor" };
const me: Person = { id: human, name: "the sandbox's human member" };

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
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof657x${run}x${sent}`, event_time: Math.floor(at / 1000), event });
}

async function slack(method: string, args: Record<string, string>) {
  const response = await fetch(`https://slack.com/api/${method}?${new URLSearchParams(args)}`, { headers: { authorization: `Bearer ${botToken}` } });
  return (await response.json()) as { ok: boolean; error?: string; ts?: string; messages?: Array<Record<string, unknown>>; message?: Record<string, unknown> };
}

async function join(person: Person) {
  const user = { id: person.id, team_id: workspace, name: person.name.split(" ")[0]!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await signed("/slack/events", envelope({ type: "team_join", user, event_ts: `${Date.now() / 1000}` }));
}

function tsAt(at: number) {
  return `${Math.floor(at / 1000)}.${String(sent + 1).padStart(6, "0")}`;
}

async function message(author: Person, at: number, elements: Array<Record<string, unknown>>, where: { channel: string; type: "channel" | "group" }) {
  const ts = tsAt(at);
  const text = elements.map((element) => (element.type === "user" ? `<@${element.user_id}>` : element.type === "emoji" ? `:${element.name}:` : String(element.text))).join("");
  await signed("/slack/events", envelope({ type: "message", channel: where.channel, channel_type: where.type, user: author.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }, at));
  await pause(4_000);
  return { channel: where.channel, ts, author };
}

function thanks(giver: Person, to: Person[], words: string, at: number, where = { channel, type: "channel" as const }) {
  const mentions = to.flatMap((person) => [{ type: "user", user_id: person.id }, { type: "text", text: " " }]);
  return message(giver, at, [{ type: "text", text: `${words} ` }, ...mentions, { type: "emoji", name: "hedgehog", unicode: "1f994" }], where);
}

async function hug(hugger: Person, { channel: where, ts, author }: { channel: string; ts: string; author: Person }) {
  const at = Number(ts.split(".")[0]) * 1000 + minuteMs;
  const event = { type: "reaction_added", user: hugger.id, reaction: "hedgehog", item_user: author.id, item: { type: "message", channel: where, ts }, event_ts: `${Math.floor(at / 1000)}.000200` };
  await signed("/slack/events", envelope(event, at));
  await pause(3_000);
}

async function click(user: string, command: Record<string, unknown>) {
  const encoded = JSON.stringify(command);
  const payload = {
    type: "block_actions",
    team: { id: workspace, domain: "sandbox" },
    user: { id: user, team_id: workspace },
    api_app_id: appId,
    trigger_id: `657.${run}.${sent}.trigger`,
    container: { type: "view", view_id: "V_HOME" },
    view: { id: "V_HOME", type: "home" },
    actions: [{ block_id: "b1", type: "button", action_id: encoded, value: encoded, action_ts: `${Date.now() / 1000}` }],
  };
  await signed("/slack/interactivity", new URLSearchParams({ payload: JSON.stringify(payload) }).toString(), "application/x-www-form-urlencoded");
  await pause(4_000);
}

async function newestAppPostIn(where: string) {
  const history = await slack("conversations.history", { channel: where, limit: "5" });
  return { ok: history.ok, error: history.error, newest: (history.messages ?? []).filter(({ bot_id }) => bot_id !== undefined).slice(0, 1).map(({ ts, text, blocks }) => ({ ts, text, blocks })) };
}

if (step === "join") {
  for (const person of [ines, theo, mira, newcomer]) await join(person);
  console.log(JSON.stringify({ step, eventsSent: sent, people: [ines, theo, mira, newcomer].map(({ id }) => id) }));
} else if (step === "week") {
  const mostHugged = await thanks(ines, [theo], "Thanks for staying late to pair on the release checklist, it saved the launch", lastWednesday);
  const twoRecipients = await thanks(theo, [mira, ines], "Thanks for the careful design review of the onboarding flow", lastWednesday + 10 * minuteMs);
  const inPrivate = await thanks(mira, [ines], "Thanks for walking me through the billing edge cases in private", lastWednesday + 20 * minuteMs, { channel: privateChannel, type: "group" });
  const short = await thanks(ines, [mira], "ty", lastWednesday + 30 * minuteMs);
  for (const hugger of [mira, me]) await hug(hugger, mostHugged);
  await hug(me, twoRecipients);
  for (const hugger of [theo, me]) await hug(hugger, inPrivate);
  for (const hugger of [theo, me]) await hug(hugger, short);
  console.log(JSON.stringify({ step, eventsSent: sent, mostHugged, twoRecipients, inPrivate, short }, null, 2));
} else if (step === "recap-week") {
  const kudos = await thanks(me, [newcomer], "Thanks for joining the sandbox proof and answering every question", aWeekBeforeTheAlbum);
  const lunch = await message(me, aWeekBeforeTheAlbum + 10 * minuteMs, [{ type: "text", text: "Lunch is in the kitchen" }], { channel, type: "channel" });
  await hug(ines, lunch);
  console.log(JSON.stringify({ step, eventsSent: sent, kudos, lunch }, null, 2));
} else if (step === "post-on") {
  await click(human, { type: "setMondayPost", on: true, timeZone: "Europe/Berlin" });
  console.log(JSON.stringify({ step, eventsSent: sent }));
} else if (step === "post-off") {
  await click(human, { type: "setMondayPost", on: false });
  console.log(JSON.stringify({ step, eventsSent: sent }));
} else if (step === "post-shape") {
  const picture = `${site}/emoji/team.png`;
  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: "*#657 shape check, not a Monday post: the top thoughtful kudos blocks with a team picture*" } },
    { type: "section", text: { type: "mrkdwn", text: "*1. Ines Varga* thanked *Theo Brandt*\n>Thanks for staying late to pair on the release checklist @Theo Brandt :hedgehog:" } },
    { type: "section", text: { type: "mrkdwn", text: "*Team stickers unlocked last week*" } },
    { type: "context", elements: [{ type: "image", image_url: picture, alt_text: "proof-hedgehogs" }, { type: "mrkdwn", text: "*Proof Hedgehogs* ×2" }] },
    { type: "context", elements: [{ type: "mrkdwn", text: "*Team 10* ×1 · *Team 11* ×1" }] },
  ];
  const posted = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { authorization: `Bearer ${botToken}`, "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel, text: "#657 shape check", blocks, unfurl_links: false, unfurl_media: false }) });
  const answer = (await posted.json()) as { ok: boolean; error?: string; message?: { blocks?: unknown } };
  console.log(JSON.stringify({ step, ok: answer.ok, error: answer.error, blocks: answer.message?.blocks }, null, 2));
} else if (step === "read-post") {
  console.log(JSON.stringify(await newestAppPostIn(channel), null, 2));
} else {
  throw new Error(`unknown step ${step}: join, week, recap-week, post-on, post-off or read-post`);
}
