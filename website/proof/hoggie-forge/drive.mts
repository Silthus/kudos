import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";
import { forger, nameOf } from "./cast.mts";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const name = nameOf(forger);
const user = { id: forger.id, team_id: workspace, name: forger.first.toLowerCase(), real_name: name, tz: "Europe/Berlin", profile: { display_name: name, real_name: name } };
const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProofForge${Date.now()}`, event_time: Math.floor(Date.now() / 1000), event: { type: "team_join", user, event_ts: `${Date.now() / 1000}` } });

const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
if (!response.ok) throw new Error(`team_join answered ${response.status}: ${await response.text()}`);
console.log(JSON.stringify({ joined: forger.id }));

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}
