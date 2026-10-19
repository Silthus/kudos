import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const maintainer = { id: "U0PRF729MAEA", name: "Mae Maintainer" };

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const user = { id: maintainer.id, team_id: workspace, name: "mae", real_name: maintainer.name, tz: "Europe/Berlin", profile: { display_name: maintainer.name, real_name: maintainer.name } };
const body = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProof729x${Date.now()}`, event_time: Math.floor(Date.now() / 1000), event: { type: "team_join", user, event_ts: `${Date.now() / 1000}` } });
const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
console.log(`team_join for ${maintainer.name} (${maintainer.id}) answered ${response.status}`);
