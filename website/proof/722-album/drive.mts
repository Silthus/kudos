import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const giver = required("KUDOS_GIVER");
const thanked = required("KUDOS_THANKED");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function envelope(event: Record<string, unknown>) {
  return JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof722x${run}`, event_time: Math.floor(Date.now() / 1000), event });
}

const ts = (Date.now() / 1000).toFixed(6);
const words = "for pairing on the SDK release notes until every breaking change had a migration line";
const elements = [{ type: "user", user_id: thanked }, { type: "text", text: " " }, { type: "emoji", name: "hedgehog", unicode: "1f994" }, { type: "text", text: ` ${words}` }];
const body = envelope({ type: "message", channel, channel_type: "channel", user: giver, ts, text: `<@${thanked}> :hedgehog: ${words}`, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] });
const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
console.log(JSON.stringify({ status: response.status, giver, thanked, ts }));
