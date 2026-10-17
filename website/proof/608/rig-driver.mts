import { execFile } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";
import { FakePostHog } from "/home/coder/dev/kudos-wt/company-profile-settings/testing/fakePostHog";
import { FakeSlack } from "/home/coder/dev/kudos-wt/company-profile-settings/testing/fakeSlack";
import { signedRequest } from "/home/coder/dev/kudos-wt/company-profile-settings/testing/signedSlack";
import { memberEvent } from "/home/coder/dev/kudos-wt/company-profile-settings/testing/slackMessages";

const tree = "/home/coder/dev/kudos-wt/company-profile-settings";
const out = "/tmp/i608/rig/out";
const envFile = "/tmp/i608/rig/backend/local.env";
const site = "http://127.0.0.1:13211";
const fakePort = 13212;
const log = `${out}/transcript.txt`;
const run = Date.now();
const dayMs = 24 * 60 * 60 * 1000;
const people: Record<string, string> = { U_ADA: "Ada Admin", U_SAM: "Sam Okafor", U_WREN: "Wren Halloway", U_JUNO: "Juno Marsh", U_ORIEL: "Oriel Pemberton" };
const admins = new Set(["U_ADA"]);
const emailOf = (user: string) => `${user.slice(2).toLowerCase()}@kudos-proof.test`;
const onForEveryone = (key: string) => ({ key, filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });
const onForEmails = (key: string, users: string[]) => ({ key, filters: { groups: [{ properties: [{ key: "email", type: "person", value: users.map(emailOf), operator: "exact" }], rollout_percentage: 100 }] } });

const firstNames = ["Avery", "Bram", "Cleo", "Dov", "Esme", "Fen", "Gil", "Hollis", "Ines", "Jory", "Kit", "Lark", "Mira", "Nell", "Otto", "Pell", "Quill", "Rhea", "Sol", "Tove", "Ula", "Vane", "Wynn", "Xan", "Yule", "Zeb"];
const lastNames = ["Ashdown", "Birchley", "Coombe", "Dunmore", "Elstow", "Fallow", "Garrow", "Hesketh"];
const roles = ["Product Engineer", "Support Engineer", "Designer", "Product Manager", "Data Engineer"];
const teamSlugs = ["lantern", "harbour", "kite"];
const extraPeople = firstNames.map((first, index) => ({ first, last: lastNames[index % lastNames.length]! }));
const profiles = [
  { profile: 1, firstName: "Wren", lastName: "Halloway", normalisedName: "wren halloway", colour: "#8567FF", teams: ["lantern"], role: "Product Engineer" },
  { profile: 2, firstName: "Oriel", lastName: "Pemberton", normalisedName: "oriel pemberton", colour: "#29DBBB", teams: ["lantern", "kite"], role: "Designer" },
  { profile: 3, firstName: "Samantha", lastName: "Okafor", normalisedName: "samantha okafor", colour: "#EB9D2A", teams: ["harbour"], role: "Support Engineer" },
  { profile: 4, firstName: "Tamsin", lastName: "Vale", normalisedName: "tamsin vale", colour: "#EEEFE9", teams: ["kite"] },
  { profile: 5, firstName: "Juniper", lastName: "Marsh", normalisedName: "juniper marsh", colour: "#F54E00", teams: ["harbour"], role: "Team Lead" },
  ...extraPeople.map(({ first, last }, index) => ({ profile: 10 + index, firstName: first, lastName: last, normalisedName: `${first} ${last}`.toLowerCase(), colour: "#EEEFE9", teams: [teamSlugs[index % 3]!], role: roles[index % roles.length] })),
];
const teams = [
  { team: "lantern", name: "Lantern", leads: [1], people: profiles.filter(({ teams }) => teams.includes("lantern")).map(({ profile }) => profile) },
  { team: "harbour", name: "Harbour", leads: [5], people: profiles.filter(({ teams }) => teams.includes("harbour")).map(({ profile }) => profile) },
  { team: "kite", name: "Kite", leads: [2], people: profiles.filter(({ teams }) => teams.includes("kite")).map(({ profile }) => profile) },
];

const slack = new FakeSlack();
const slackUser = (id: string, name: string) => ({ real_name: name, ...(admins.has(id) && { is_admin: true }), profile: { display_name: name, real_name: name, email: emailOf(id) } });
for (const [id, name] of Object.entries(people)) slack.withMember(id, slackUser(id, name));
const postHog = new FakePostHog().withFlags(onForEveryone("website"), onForEveryone("message-settings"), onForEmails("team-pages", ["U_ADA", "U_SAM", "U_WREN", "U_JUNO"]));

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
  envelope.event_id = `EvProof608-${run}-${events}`;
  envelope.event_time = Math.floor(Date.now() / 1000);
  const response = await fetch(`${site}/slack/events`, await signedRequest(JSON.stringify(envelope)));
  say(`> ${what}\n  HTTP ${response.status} ${await response.text()}`);
}

async function slackQuiet() {
  let last = -1;
  for (let waited = 0; waited < 90 && slack.calls.length !== last; waited += 4) {
    last = slack.calls.length;
    await settle(4000);
  }
}

async function rowsOf(table: string) {
  return (await convex("data", table, "--format", "jsonLines", "--limit", "10000"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line.replace(/:(-?\d+)n([,}\]])/g, ":$1$2")));
}

async function importRows(table: string, rows: object[]) {
  const file = `${out}/import-${table}.jsonl`;
  writeFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  await convex("import", "--table", table, "--append", "-y", "--format", "jsonLines", file);
}

const identities = new Map<string, string>();

async function asMember(user: string, fn: string, args: object = {}) {
  return JSON.parse(await convex("run", fn, JSON.stringify(args), "--identity", identities.get(user)!));
}

say(`# #608 running-app rig: a fresh local Convex backend at ${process.env.TREE_SHA}, site ${site}. FakeSlack and FakePostHog on ${fakePort}. Made-up people only. Now: ${new Date(run).toISOString()}.`);
say(`# Flags: website and message-settings on for everyone; team-pages on for Ada's, Sam's, Wren's and Juno's emails only, off for Oriel. Ada is the workspace admin.`);
await convex("run", "--component", "posthog", "lib:refreshFlagDefinitions", "{}");
await convex("run", "website/flag:prepareWebsiteFlag", "{}");
for (const [id, name] of Object.entries(people)) await send(`team_join ${name}${admins.has(id) ? " (workspace admin)" : ""}`, memberEvent("team_join", { id, ...slackUser(id, name) }));
await slackQuiet();
await importRows("members", extraPeople.map(({ first, last }, index) => ({ workspace: "T1", user: `U_EXTRA${index}`, kind: "member", asOf: run, name: `${first} ${last}`, realName: `${first} ${last}`, admin: false })));
const ids = new Map((await rowsOf("members")).map(({ user, _id }: { user: string; _id: string }) => [user, _id]));
const analyticsMembers = new Set((await rowsOf("analyticsIds")).map(({ member }: { member: string }) => member));
await importRows("analyticsIds", [...ids.values()].filter((member) => !analyticsMembers.has(member)).map((member) => ({ member, analyticsId: crypto.randomUUID() })));
await importRows("companyProfiles", profiles.map((profile) => ({ ...profile, asOf: run })));
await importRows("companyTeams", teams.map((team) => ({ ...team, asOf: run })));
await importRows("users", Object.entries(people).map(([user, name]) => ({ name, givenName: name.split(" ")[0], chatIdentity: { workspace: "T1", user } })));
const users = await rowsOf("users");
await importRows("authSessions", users.map(({ _id }) => ({ userId: _id, expirationTime: run + dayMs })));
const sessions = await rowsOf("authSessions");
await importRows("authRefreshTokens", sessions.map(({ _id }) => ({ sessionId: _id, expirationTime: run + dayMs })));
const refreshTokens = await rowsOf("authRefreshTokens");
const browserSessions: Record<string, string> = {};
for (const { _id, chatIdentity } of users) {
  const session = sessions.find(({ userId }) => userId === _id)._id;
  identities.set(chatIdentity.user, JSON.stringify({ subject: `${_id}|${session}`, issuer: site }));
  browserSessions[chatIdentity.user] = `${refreshTokens.find(({ sessionId }) => sessionId === session)._id}|${session}`;
}
writeFileSync(`${out}/browser-sessions.json`, JSON.stringify(browserSessions, null, 2));
say(`\n## Juno picks Juniper Marsh on posthog.com through the command`);
say(`  Juno: linkMyCompanyProfile {profile: 5} -> ${JSON.stringify(await asMember("U_JUNO", "website/commands:linkMyCompanyProfile", { profile: 5 }))}`);
for (const user of Object.keys(people)) {
  const settings = await asMember(user, "website/settings:getSettings");
  say(`  ${people[user]}: getSettings -> companyProfile ${JSON.stringify(settings.companyProfile === undefined ? "absent" : { mine: settings.companyProfile.mine?.name ?? null, by: settings.companyProfile.by, choices: settings.companyProfile.choices.length })}, admin ${settings.admin === undefined ? "absent" : `${settings.admin.members.length} members, ${settings.admin.profiles.length} profiles`}`);
  say(`  ${people[user]}: frontDoorLinksOf().sections -> ${JSON.stringify(JSON.parse(await convex("run", "website/link:frontDoorLinksOf", JSON.stringify({ workspace: "T1", user }))).sections)}`);
}
say(`\nREADY: browser sessions in ${out}/browser-sessions.json; the fakes keep serving until this process is stopped.`);
process.on("SIGTERM", () => {
  writeFileSync(`${out}/slack-calls.jsonl`, slack.calls.map((call) => JSON.stringify(call)).join("\n") + "\n");
  server.close();
  process.exit(0);
});
