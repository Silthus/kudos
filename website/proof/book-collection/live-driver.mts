import { execFile } from "node:child_process";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";
import { FakePostHog } from "/home/coder/dev/kudos-wt/book-collection/testing/fakePostHog";
import { FakeSlack } from "/home/coder/dev/kudos-wt/book-collection/testing/fakeSlack";
import { signedRequest } from "/home/coder/dev/kudos-wt/book-collection/testing/signedSlack";
import { blockActions, publishedHome, staleButtonOf } from "/home/coder/dev/kudos-wt/book-collection/testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, text } from "/home/coder/dev/kudos-wt/book-collection/testing/slackMessages";

const branch = process.env.WORKTREE!;
const out = process.env.OUT!;
const envFile = process.env.ENV_FILE!;
const site = process.env.SITE!;
const fakePort = Number(process.env.FAKE_PORT);
const log = `${out}/transcript.txt`;
const run = Date.now();
const people: Record<string, string> = { U_ALICE: "Alice Archer", U_BOB: "Bob Brandt" };
const slack = new FakeSlack();
for (const [id, name] of Object.entries(people)) slack.withMember(id, { real_name: name, profile: { display_name: name.split(" ")[0] } });
const postHog = new FakePostHog();
const flag = (key: string) => ({ key, filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });
let events = 0;
let clicks = 0;
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
async function convex(...args: string[]) {
  const { stdout } = await promisify(execFile)("timeout", ["180", "npx", "--no", "--", "convex", ...args, "--env-file", envFile], { cwd: branch, encoding: "utf8", maxBuffer: 10_000_000 });
  return stdout.trim();
}
const settle = (ms = 2500) => new Promise((resolve) => setTimeout(resolve, ms));
async function quiet() {
  const before = slack.calls.length;
  for (let waited = 0; slack.calls.length === before && waited < 30_000; waited += 1000) await settle(1000);
  for (let calls = -1; calls !== slack.calls.length; ) {
    calls = slack.calls.length;
    await settle(4000);
  }
}
function withUniqueEventId(body: string) {
  events += 1;
  const envelope = JSON.parse(body);
  envelope.event_id = `EvProof467-${run}-${events}`;
  envelope.event_time = Math.floor(Date.now() / 1000);
  return JSON.stringify(envelope);
}
async function send(what: string, body: string) {
  const response = await fetch(`${site}/slack/events`, await signedRequest(withUniqueEventId(body)));
  say(`> ${what}\n  HTTP ${response.status} ${await response.text()}`);
  await quiet();
}
async function clickCommand(what: string, user: string, command: object) {
  clicks += 1;
  const payload = JSON.parse(new URLSearchParams(blockActions(user, staleButtonOf(command))).get("payload")!);
  payload.trigger_id = `proof467.${run}.${clicks}`;
  const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
  const response = await fetch(`${site}/slack/interactivity`, await signedRequest(body, { contentType: "application/x-www-form-urlencoded" }));
  say(`> ${what}: ${JSON.stringify(command)} (signed /slack/interactivity)\n  HTTP ${response.status} ${await response.text()}`);
  await quiet();
}
async function appHome(user: string) {
  await send(`${people[user]} opens App Home`, appHomeOpened(user));
  const lines = publishedHome(slack, user).filter((line) => line.includes("Hoggies:"));
  say(`  hoggies line in ${people[user]}'s App Home: ${lines.length === 0 ? "(none)" : lines.join(" | ")}`);
}
async function kudos(giver: string, recipient: string) {
  const ts = (Date.now() / 1000).toFixed(6);
  await send(`${people[giver]} thanks ${people[recipient]} in #general with :taco:`, messageEvent([emoji("taco"), text(" "), mention(recipient), text(" thanks for untangling the release notes today, it saved me hours")], { user: giver, ts }));
}
async function rowsOf(table: string) {
  return (await convex("data", table, "--format", "jsonLines", "--limit", "500"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line.replace(/(\d+)n([,}])/g, "$1$2")));
}
async function importRows(table: string, rows: object[]) {
  const file = `${out}/${table}.jsonl`;
  writeFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  await convex("import", "--table", table, "--append", "-y", "--format", "jsonLines", file);
}
async function flagsOn(...keys: string[]) {
  postHog.withFlags(...keys.map(flag));
  await convex("run", "--component", "posthog", "lib:refreshFlagDefinitions", "{}");
  await convex("run", "website/flag:prepareWebsiteFlag", "{}");
  say(`  flags on for everyone: ${keys.join(", ")}; every other flag off`);
}
const sessions = new Map<string, string>();
async function signIn(user: string) {
  await importRows("users", [{ chatIdentity: { workspace: "T1", user }, name: people[user], givenName: people[user].split(" ")[0] }]);
  const userId = (await rowsOf("users")).find((row: { chatIdentity: { user: string } }) => row.chatIdentity.user === user)._id;
  await importRows("authSessions", [{ userId, expirationTime: run + 24 * 60 * 60 * 1000 }]);
  const sessionId = (await rowsOf("authSessions")).find((row: { userId: string }) => row.userId === userId)._id;
  await importRows("authRefreshTokens", [{ sessionId, expirationTime: run + 24 * 60 * 60 * 1000 }]);
  const refreshTokenId = (await rowsOf("authRefreshTokens")).find((row: { sessionId: string }) => row.sessionId === sessionId)._id;
  sessions.set(user, JSON.stringify({ subject: `${userId}|${sessionId}`, issuer: site }));
  writeFileSync(`${out}/browser-${user}.json`, JSON.stringify({ refreshToken: `${refreshTokenId}|${sessionId}` }));
  say(`  ${people[user]} signed in: users, authSessions and authRefreshTokens rows appended (browser token in browser-${user}.json)`);
}
async function memberIdOf(user: string): Promise<string> {
  return (await rowsOf("members")).find((row: { user: string }) => row.user === user)._id;
}
async function levelReadyUpTo(user: string, from: number, top: number) {
  const member = await memberIdOf(user);
  for (let level = from; level <= top; level++) {
    const event = { type: "levelReached", workspace: "T1", member, level, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200, message: { workspace: "T1", conversation: "C1", message: `level-${level}` }, at: Date.now() };
    await convex("run", "unlocks/unlocks:makeReady", JSON.stringify({ event }));
  }
  say(`  levels ${from} to ${top} reached for ${people[user]} (unlocks/unlocks:makeReady)`);
  await quiet();
}
async function read(user: string, fn: string, args: object, label: string) {
  const answer = await convex("run", fn, JSON.stringify(args), "--identity", sessions.get(user)!);
  writeFileSync(`${out}/${label}.json`, `${answer}\n`);
  return JSON.parse(answer);
}
async function drops(what: string) {
  const rows = await rowsOf("drops");
  say(`  drops after ${what}: ${rows.length}`);
  for (const { crate, hoggie, rarity, n, copy, at } of rows) say(`    crate ${crate} -> ${hoggie} (${rarity}), n ${n}, copy ${copy}, at ${new Date(at).toISOString()}`);
}

await new Promise<void>((resolve) => server.listen(fakePort, "127.0.0.1", resolve));
say(`# #467 running-app proof: one fresh local Convex backend (${site}) running ${process.env.BRANCH_SHA}, signed Slack requests in, Slack and PostHog answered by the repo's FakeSlack and FakePostHog on ${fakePort}. HOGGIE_DRAW_SECRET is unset.`);
const core = ["xp-levels", "unlocks", "everyone-board", "achievements", "skill-tree", "quests", "activity", "website", "collection"];
say(`\n## 1. Alice reaches level 5 and opens the Leaderboard, the Book and the Skill tree from App Home: three crates, three drops`);
await flagsOn(...core);
await convex("run", "feedback/unlockFilter:unopenedReplyOf", JSON.stringify({ workspace: "T1", user: "U_NOBODY", feature: "leaderboard" }));
await appHome("U_ALICE");
await appHome("U_BOB");
await kudos("U_ALICE", "U_BOB");
await levelReadyUpTo("U_ALICE", 2, 5);
await appHome("U_ALICE");
await clickCommand("Alice clicks Open on the Leaderboard in App Home", "U_ALICE", { type: "openUnlock", feature: "leaderboard" });
await clickCommand("Alice clicks Open on the Book in App Home", "U_ALICE", { type: "openUnlock", feature: "book" });
await clickCommand("Alice clicks Open on the Skill tree in App Home", "U_ALICE", { type: "openUnlock", feature: "skillTree" });
await clickCommand("Alice clicks Open on Quests in App Home", "U_ALICE", { type: "openUnlock", feature: "quests" });
await drops("the four opens");
await appHome("U_ALICE");

say(`\n## 2. The website's reads for Alice: getCollection, getActivity (all), getBook`);
await signIn("U_ALICE");
await signIn("U_BOB");
const collection = await read("U_ALICE", "website/collection:getCollection", {}, "getCollection-alice");
const held = collection.hoggies.filter(({ count }: { count: number }) => count > 0);
say(`  getCollection: kind ${collection.kind}, owned ${collection.owned} of ${collection.total}, rarities ${JSON.stringify(collection.rarities)}`);
say(`  held: ${JSON.stringify(held)}`);
const activity = await read("U_ALICE", "website/activity:getActivity", { filter: "all", cursor: null, limit: 20 }, "getActivity-alice");
say(`  getActivity (all): ${activity.kind !== "activity" ? JSON.stringify(activity) : activity.entries.map((entry: { kind: string; drop?: { name: string; rarity: string } }) => (entry.kind === "found" ? `found ${entry.drop!.name} (${entry.drop!.rarity})` : entry.kind)).join(", ")}`);
const bob = await read("U_BOB", "website/collection:getCollection", {}, "getCollection-bob");
say(`  getCollection for Bob (Book locked): ${JSON.stringify(bob)}`);

say(`\n## 3. The backend and the fakes stay up for the browser proof until ${out}/stop exists`);
while (!existsSync(`${out}/stop`)) await settle(2000);
server.close();
process.exit(0);
