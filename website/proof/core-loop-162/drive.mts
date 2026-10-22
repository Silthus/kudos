import { readFileSync } from "node:fs";
import { signedRequest } from "../../../testing/signedSlack";
import { linkSharedEvent } from "../../../testing/slackMessages";

const site = required("KUDOS_SITE");
const workspace = required("KUDOS_WORKSPACE");
const sharer = required("KUDOS_SHARER");
const channel = required("KUDOS_CHANNEL");
const secret = readFileSync(required("SLACK_SIGNING_SECRET_FILE"), "utf8").trim();
const people = process.argv.slice(2);

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const run = `${Date.now()}`;
const messageTs = (Date.now() / 1000).toFixed(6);
const links = people.map((person) => `${site}/book#people/${person}`);
const body = linkSharedEvent(links, { team: workspace, user: sharer, channel, messageTs, eventId: `EvProof162x${run}` });
const response = await fetch(`${site}/slack/events`, await signedRequest(body, { secret }));
console.log(`link_shared for ${links.join(", ")} answered ${response.status}`);
