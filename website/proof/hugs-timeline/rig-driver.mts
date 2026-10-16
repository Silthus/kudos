import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";
import { FakePostHog } from "/home/coder/dev/kudos-wt/hugs-timeline/testing/fakePostHog";
import { FakeSlack } from "/home/coder/dev/kudos-wt/hugs-timeline/testing/fakeSlack";
import { signedRequest } from "/home/coder/dev/kudos-wt/hugs-timeline/testing/signedSlack";
import { appHomeOpened, emoji, memberEvent, mention, messageEvent, reactionEvent, section, text, type ReactionOptions } from "/home/coder/dev/kudos-wt/hugs-timeline/testing/slackMessages";

const [label, tree, sitePort, fakePortText] = process.argv.slice(2) as [string, string, string, string];
const out = `/tmp/i580/rig/out-${label}`;
mkdirSync(out, { recursive: true });
const envFile = `/tmp/i580/rig/rig-${label}/local.env`;
const site = `http://127.0.0.1:${sitePort}`;
const fakePort = Number(fakePortText);
const log = `${out}/transcript.txt`;
const run = Date.now();
const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const people: Record<string, string> = { U_ANN: "Ann Archer", U_BOB: "Bob Brandt", U_CY: "Cy Carter", U_DEE: "Dee Dunn", U_EVE: "Eve Ellis", U_FAY: "Fay Fischer", U_GUS: "Gus Grant" };
const emailOf = (user: string) => `${user.slice(2).toLowerCase()}@kudos-proof.test`;
const onForEveryone = (key: string) => ({ key, filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });
const flags = ["xp-levels", "unlocks", "website", "activity", "message-settings", "hugs"].map(onForEveryone);

const slack = new FakeSlack();
for (const [id, name] of Object.entries(people)) slack.withMember(id, { real_name: name, tz: "Europe/Berlin", profile: { display_name: name.split(" ")[0], email: emailOf(id) } });
const postHog = new FakePostHog().withFlags(...flags);

writeFileSync(log, "");
function say(line: string) {
  appendFileSync(log, `${line}\n`);
  console.log(line);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url!, `http://127.0.0.1:${fakePort}`);
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks);
  const body = (request.headers["content-encoding"] === "gzip" || url.searchParams.get("compression") === "gzip-js" ? gunzipSync(raw) : raw).toString();
  const answered = url.pathname.startsWith("/api/")
    ? await slack.fetch(`http://slack.local${url.pathname}${url.search}`, body === "" ? undefined : { body })
    : await postHog.fetch(`https://posthog.test${url.pathname}${url.search}`, { headers: { authorization: String(request.headers.authorization ?? "") }, ...(body !== "" && { body }) });
  response.writeHead(answered.status, { "content-type": "application/json" }).end(await answered.text());
});
await new Promise<void>((resolve) => server.listen(fakePort, "127.0.0.1", () => resolve()));

async function convex(...args: string[]) {
  const { stdout } = await promisify(execFile)("timeout", ["300", "npx", "--no", "--", "convex", ...args, "--env-file", envFile], { cwd: tree, encoding: "utf8", maxBuffer: 50_000_000 });
  return stdout.trim();
}

const settle = (ms = 2500) => new Promise((resolve) => setTimeout(resolve, ms));
let events = 0;

async function send(what: string, body: string) {
  events += 1;
  const envelope = JSON.parse(body);
  envelope.event_id = `EvProof580-${label}-${run}-${events}`;
  envelope.event_time = Math.floor(Date.now() / 1000);
  const response = await fetch(`${site}/slack/events`, await signedRequest(JSON.stringify(envelope)));
  say(`> ${what}\n  HTTP ${response.status} ${await response.text()}`);
}

async function quiet() {
  let last = -1;
  for (let waited = 0; waited < 90 && slack.calls.length + postHog.requests.length !== last; waited += 4) {
    last = slack.calls.length + postHog.requests.length;
    await settle(4000);
  }
}

function publishesTo(user: string) {
  return slack.callsTo("views.publish").filter((args) => args.user_id === user).length;
}

async function opensHome(user: string) {
  const before = publishesTo(user);
  await send(`${people[user]} opens App Home (signed app_home_opened)`, appHomeOpened(user));
  for (let waited = 0; publishesTo(user) === before && waited < 240; waited += 1) await settle(1000);
  await quiet();
}

const tsOf = (at: number) => (at / 1000).toFixed(6);

async function kudos(giver: string, recipient: string, at: number, words: string) {
  const ts = tsOf(at);
  await send(`${people[giver]} posts "<@${people[recipient]}> :hedgehug: ${words}" (signed message event)`, messageEvent([section(mention(recipient), text(" "), emoji("hedgehug"), text(` ${words}`))], { user: giver, ts }));
  await quiet();
  return ts;
}

async function reacts(what: string, options: ReactionOptions) {
  await send(`${what} (signed ${options.type ?? "reaction_added"})`, reactionEvent({ team: "T1", eventTs: tsOf(Date.now()), reaction: "hedgehug", ...options }));
  await quiet();
}

async function rowsOf(table: string) {
  return (await convex("data", table, "--format", "jsonLines", "--limit", "8000"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line.replace(/(\d+)n([,}])/g, "$1$2")));
}

async function importRows(table: string, rows: object[]) {
  const file = `${out}/import-${table}.jsonl`;
  writeFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  await convex("import", "--table", table, "--append", "-y", "--format", "jsonLines", file);
}

async function waitFor(file: string) {
  while (!existsSync(file)) await settle(1000);
}

say(`# #580 proof run (${label}): a fresh local Convex backend, site ${site}, driven by signed Slack requests.`);
say(`# FakeSlack and FakePostHog serve on ${fakePort}. KUDOS_ENVIRONMENT=production. Flags on for everyone, deployment-scoped to this local backend: ${flags.map(({ key }) => key).join(", ")}. Kudos emoji: hedgehug. Now: ${new Date(run).toISOString()}.`);

say("\n## Setup: flags, the hedgehug custom emoji's picture, seven members");
await convex("run", "--component", "posthog", "lib:refreshFlagDefinitions", "{}");
await convex("run", "feedback/unlockFilter:unopenedReplyOf", JSON.stringify({ workspace: "T1", user: "U_NOBODY", feature: "quests" }));
await convex("run", "website/flag:prepareWebsiteFlag", "{}");
await importRows("customEmoji", [{ workspace: "T1", name: "hedgehug", image: "https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/1f994.png", listing: 1 }]);
for (const [id, name] of Object.entries(people)) await send(`team_join ${name}`, memberEvent("team_join", { id, real_name: name, tz: "Europe/Berlin", profile: { display_name: name.split(" ")[0], email: emailOf(id) } }));
await quiet();
for (const user of Object.keys(people)) await opensHome(user);

say("\n## 1. Kudos and plain messages");
const bobThanksAnn = await kudos("U_BOB", "U_ANN", run - 5 * hourMs, "thanks for pairing on the release checklist");
const cyThanksDee = await kudos("U_CY", "U_DEE", run - 4 * hourMs, "thank you for the incident write-up");
const annsLaunchPost = tsOf(run - 3 * hourMs);
const annsDocsPost = tsOf(run - 2 * hourMs);
const bobsPost = tsOf(run - 90 * 60_000);

say("\n## 2. Hugs Ann receives");
await reacts("Cy hugs the kudos Ann received from Bob", { user: "U_CY", itemUser: "U_BOB", ts: bobThanksAnn });
await reacts("Bob hugs Ann's docs post", { user: "U_BOB", itemUser: "U_ANN", ts: annsDocsPost });
await reacts("Cy hugs Ann's docs post with a skin tone", { user: "U_CY", itemUser: "U_ANN", ts: annsDocsPost, reaction: "hedgehug::skin-tone-3" });
for (const user of ["U_BOB", "U_CY", "U_DEE", "U_EVE", "U_FAY"]) await reacts(`${people[user]} hugs Ann's launch post`, { user, itemUser: "U_ANN", ts: annsLaunchPost });

say("\n## 3. Hugs Ann gives");
await reacts("Ann hugs Bob's post", { user: "U_ANN", itemUser: "U_BOB", ts: bobsPost });
await reacts("Ann hugs Cy's kudos to Dee", { user: "U_ANN", itemUser: "U_CY", ts: cyThanksDee });

say("\n## 4. Ann's browser session");
await importRows("users", [{ name: people.U_ANN, givenName: "Ann", chatIdentity: { workspace: "T1", user: "U_ANN" } }]);
const userId = (await rowsOf("users")).find(({ chatIdentity }: { chatIdentity?: { user: string } }) => chatIdentity?.user === "U_ANN")._id;
await importRows("authSessions", [{ userId, expirationTime: run + dayMs }]);
const sessionId = (await rowsOf("authSessions")).find(({ userId: owner }: { userId: string }) => owner === userId)._id;
await importRows("authRefreshTokens", [{ sessionId, expirationTime: run + dayMs }]);
const refreshTokenId = (await rowsOf("authRefreshTokens")).find(({ sessionId: owner }: { sessionId: string }) => owner === sessionId)._id;
writeFileSync(`${out}/session.json`, JSON.stringify({ userId, sessionId, refreshToken: `${refreshTokenId}|${sessionId}` }));
const identity = JSON.stringify({ subject: `${userId}|${sessionId}`, issuer: site });
const activity = async () => JSON.parse(await convex("run", "website/activity:getActivity", JSON.stringify({ filter: "all", cursor: null }), "--identity", identity));
const before = await activity();
writeFileSync(`${out}/activity-before.json`, JSON.stringify(before, null, 2));
say(`  Ann's activity: ${JSON.stringify(before.entries.map((entry: { kind: string; hugs?: number }) => `${entry.kind}${entry.hugs === undefined ? "" : `×${entry.hugs}`}`))}`);
say("  ready: sign the browser in, then touch go-live");

await waitFor(`${out}/go-live`);
say("\n## 5. Live: Gus hugs Ann's launch post while her page is open");
await reacts("Gus hugs Ann's launch post", { user: "U_GUS", itemUser: "U_ANN", ts: annsLaunchPost });
const after = await activity();
writeFileSync(`${out}/activity-after.json`, JSON.stringify(after, null, 2));
say(`  Ann's activity: ${JSON.stringify(after.entries.map((entry: { kind: string; hugs?: number }) => `${entry.kind}${entry.hugs === undefined ? "" : `×${entry.hugs}`}`))}`);
say("  done: touch stop");
await waitFor(`${out}/stop`);
server.close();
process.exit(0);
