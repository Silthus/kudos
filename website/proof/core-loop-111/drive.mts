import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const cast = required("KUDOS_CAST");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;
let sent = 0;

type Person = { id: string; name: string };

const visitor: Person = { id: `U0PRF111VST${cast}`, name: "Ines Varga" };
const pella: Person = { id: `U0PRF111PEL${cast}`, name: "Pella Ruud" };
const teo: Person = { id: `U0PRF111TEO${cast}`, name: "Teo Marsh" };
const ada: Person = { id: `U0PRF111ADA${cast}`, name: "Ada Quist" };
const bram: Person = { id: `U0PRF111BRM${cast}`, name: "Bram Holt" };

const cast111 = [visitor, pella, teo, ada, bram];

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function post(event: Record<string, unknown>) {
  sent += 1;
  const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof111x${cast}x${run}x${sent}`, event_time: Math.floor(Date.now() / 1000), event });
  const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
  if (!response.ok) throw new Error(`event ${sent} answered ${response.status}: ${await response.text()}`);
  console.log(`event ${sent} (${event.type}) answered ${response.status}`);
}

async function join(person: Person) {
  const [given] = person.name.split(" ");
  const user = { id: person.id, team_id: workspace, name: given!.toLowerCase(), real_name: person.name, tz: "Europe/Berlin", profile: { display_name: person.name, real_name: person.name } };
  await post({ type: "team_join", user, event_ts: `${Date.now() / 1000}` });
}

function tsNow() {
  return (Date.now() / 1000).toFixed(6);
}

async function say(author: Person, words: string, mentioned: Person | null, count: number) {
  const ts = tsNow();
  const hedgehogs = Array.from({ length: count }, () => ({ type: "emoji", name: "hedgehog", unicode: "1f994" }));
  const mention = mentioned === null ? [] : [{ type: "user", user_id: mentioned.id }, { type: "text", text: " " }];
  const elements = [...mention, ...hedgehogs, { type: "text", text: ` ${words}` }];
  const text = `${mentioned === null ? "" : `<@${mentioned.id}> `}${":hedgehog:".repeat(count)} ${words}`;
  await post({ type: "message", channel, channel_type: "channel", user: author.id, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] });
  console.log(`${author.name} (${author.id}) said ${count} kudos to ${mentioned?.name ?? "nobody"} at ts ${ts}`);
  return ts;
}

async function hug(giver: Person, author: Person, ts: string) {
  await post({ type: "reaction_added", user: giver.id, reaction: "hedgehog", item_user: author.id, item: { type: "message", channel, ts }, event_ts: tsNow() });
  console.log(`${giver.name} hugged ${author.name}'s message ${ts}`);
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const steps: Record<string, () => Promise<void>> = {
  join: async () => {
    for (const person of cast111) await join(person);
  },
  before: async () => {
    await say(pella, "", visitor, 1);
  },
  busy: async () => {
    await say(pella, "for pairing on the release checklist, it saved my whole afternoon", visitor, 2);
    await pause(1500);
    await say(teo, "because your review caught the timezone bug before it shipped", visitor, 1);
    await pause(1500);
    await say(visitor, "for untangling the flaky deploy step with me", teo, 1);
    await pause(1500);
    const notes = await say(visitor, "The onboarding guide is updated with the new sandbox steps", null, 0);
    await pause(1500);
    for (const giver of [pella, ada, bram]) await hug(giver, visitor, notes);
    await pause(1500);
    await say(ada, "for running the retro so calmly, everyone felt heard", visitor, 1);
    await pause(1500);
    await say(bram, "because the new dashboard made our standup ten minutes shorter", visitor, 1);
    await pause(1500);
    await say(teo, "", visitor, 1);
  },
};

const step = process.argv[2] ?? "";
const run111 = steps[step];
if (!run111) throw new Error(`step must be one of ${Object.keys(steps).join(", ")}`);
await run111();
