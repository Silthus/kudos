import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const cast = required("KUDOS_CAST");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const run = `${Date.now()}`;

const newcomer = { id: `U0PRF115NEW${cast}`, name: "Pia Lindgren" };

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const [given] = newcomer.name.split(" ");
const user = { id: newcomer.id, team_id: workspace, name: given!.toLowerCase(), real_name: newcomer.name, tz: "Europe/Berlin", profile: { display_name: newcomer.name, real_name: newcomer.name } };
const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof115x${cast}x${run}`, event_time: Math.floor(Date.now() / 1000), event: { type: "team_join", user, event_ts: `${Date.now() / 1000}` } });
const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
if (!response.ok) throw new Error(`team_join answered ${response.status}: ${await response.text()}`);
console.log(`team_join of ${newcomer.name} (${newcomer.id}) answered ${response.status}`);
