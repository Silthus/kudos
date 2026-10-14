import { signedRequest } from "../../../testing/signedSlack.ts";

const site = "http://127.0.0.1:5311";
const mock = "http://127.0.0.1:5312";
const secret = "handshake-signing-secret";
const team = "TALLOWED";
const [command, ...args] = process.argv.slice(2);
const run = Date.now();

function envelope(event: object) {
  return JSON.stringify({ type: "event_callback", team_id: team, event_id: `EvProof149-${run}`, event_time: Math.floor(run / 1000), event });
}

async function post(path: string, init: RequestInit, label: string) {
  const response = await fetch(`${site}${path}`, init);
  console.log(`${label}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
}

async function home(user: string) {
  return (await (await fetch(`${mock}/control/home?user=${user}`)).json()) as { blocks?: Array<Record<string, unknown>> } | null;
}

function buttonsIn(view: Awaited<ReturnType<typeof home>>) {
  const found: Array<{ text: string; value?: string; action_id?: string }> = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node === null || typeof node !== "object") return;
    const element = node as Record<string, unknown>;
    if (element.type === "button") found.push({ text: (element.text as { text: string }).text, value: element.value as string, action_id: element.action_id as string });
    Object.values(element).forEach(walk);
  };
  walk(view?.blocks ?? []);
  return found;
}

if (command === "kudos") {
  const [giver, recipient, words] = args as [string, string, string];
  const ts = `${Math.floor(run / 1000)}.000100`;
  const blocks = [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements: [{ type: "user", user_id: recipient }, { type: "text", text: ` ${words} ` }, { type: "emoji", name: "taco" }] }] }];
  const body = envelope({ type: "message", channel: "C1", channel_type: "channel", user: giver, ts, text: words, team, blocks });
  await post("/slack/events", await signedRequest(body, { secret }), `${giver} thanks ${recipient} :taco: "${words}"`);
} else if (command === "home") {
  const [user] = args as [string];
  const opened = { type: "app_home_opened", user, channel: "D_KUDOS", tab: "home", event_ts: `${Math.floor(run / 1000)}.000200` };
  await post("/slack/events", await signedRequest(envelope(opened), { secret }), `${user} opens App Home`);
} else if (command === "buttons") {
  const [user] = args as [string];
  console.log(JSON.stringify(buttonsIn(await home(user)), null, 1));
} else if (command === "view") {
  const [user] = args as [string];
  console.log(JSON.stringify(await home(user), null, 1));
}
