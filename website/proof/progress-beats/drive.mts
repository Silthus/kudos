import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { promisify } from "node:util";
import { privateFolder } from "../../../testing/privateFolder";
import { signedRequest } from "../../../testing/signedSlack";
import { emojiNameOf } from "../../../convex/workspace/settingsBounds";

const sandbox = "different-dog-467";
const rig = process.env.PROOF_ENV_FILE;
const site = rig ? process.env.PROOF_SITE! : `https://${sandbox}.convex.site`;
const cloud = rig ? process.env.PROOF_CLOUD! : `https://${sandbox}.convex.cloud`;
const target = rig ? ["--env-file", rig] : ["--deployment", sandbox];
const runCommand = promisify(execFile);
const convexEnv = sandboxOnly(process.env);
const convexBinary = joinPath(process.cwd(), "node_modules/.bin/convex");
const scratch = scratchPackage();
const workspace = await envOf("SLACK_WORKSPACE_ID");
const signingSecret = await envOf("SLACK_SIGNING_SECRET");
const kudosEmoji = await kudosEmojiOfTheSandbox();
const run = Date.now().toString(36).toUpperCase();
const channel = "C0PRFPB1";
const castPrefix = "U0PRFPB";
let sent = 0;

type Person = { key: string; first: string; last: string };
type Member = Person & { user: string; member: string };
type Row = Record<string, unknown> & { _id: string };

const pip: Person = { key: "PIP", first: "Pip", last: "Hollow" };
const wren: Person = { key: "WRE", first: "Wren", last: "Calder" };
const tam: Person = { key: "TAM", first: "Tam", last: "Ferris" };
const ivo: Person = { key: "IVO", first: "Ivo", last: "Brandt" };

function sandboxOnly(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const withoutDeploymentChoice = Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith("CONVEX_")));
  return rig ? withoutDeploymentChoice : { ...withoutDeploymentChoice, CONVEX_DEPLOYMENT: `prod:${sandbox}` };
}

function scratchPackage() {
  const directory = mkdtempSync(joinPath(tmpdir(), "proof-progress-beats-"));
  writeFileSync(joinPath(directory, "package.json"), JSON.stringify({ name: "proof-progress-beats-scratch", private: true, dependencies: { convex: "*" } }));
  return directory;
}

async function convex(...args: string[]) {
  const { stdout } = await runCommand(convexBinary, [...args, ...target], { cwd: scratch, env: convexEnv, maxBuffer: 256 * 1024 * 1024 });
  return stdout;
}

async function envOf(name: string) {
  const value = (await convex("env", "get", name)).trim();
  if (value === "") throw new Error(`${name} is not set on ${sandbox}`);
  return value;
}

async function kudosEmojiOfTheSandbox() {
  const setting = (await newestRows("workspaces", 50)).find((row) => row.workspace === workspace)?.kudosEmoji as string | undefined;
  const configured = setting ?? emojiNameOf(await convex("env", "get", "KUDOS_EMOJI"));
  if (configured === "") throw new Error(`${sandbox} names no kudos emoji`);
  return configured;
}

const nameOf = ({ first, last }: Person) => `${first} ${last}`;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (line: string) => console.log(`[proof-progress-beats] ${line}`);

function rowsOf(jsonLines: string): Row[] {
  return jsonLines
    .split("\n")
    .filter((line) => line.trim().startsWith("{"))
    .map((line) => JSON.parse(line.replace(/(:\s*-?\d+)n(\s*[,}\]])/g, "$1$2")) as Row);
}

async function newestRows(table: string, limit: number) {
  return rowsOf(await convex("data", table, "--limit", String(limit), "--format", "jsonLines"));
}

async function append(table: string, rows: Record<string, unknown>[]) {
  const file = joinPath(scratch, `${table}-${sent++}.jsonl`);
  writeFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  await convex("import", "--table", table, "--append", "--format", "jsonLines", file, "-y");
}

async function event(body: Record<string, unknown>, at = Date.now()) {
  sent += 1;
  const payload = JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvProofPBx${run}x${sent}`, event_time: Math.floor(at / 1000), event: body });
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${site}/slack/events`, await signedRequest(payload, { secret: signingSecret }));
    if (response.ok) return;
    if (response.status < 500 || attempt === 3) throw new Error(`/slack/events answered ${response.status}: ${await response.text()}`);
    await pause(2000);
  }
}

function slackUserOf(person: Person, user: string) {
  const name = nameOf(person);
  return { id: user, team_id: workspace, deleted: false, name: person.first.toLowerCase(), real_name: name, tz: "Europe/Berlin", profile: { display_name: name, real_name: name } };
}

async function until<T>(what: string, read: () => Promise<T | null>, seconds = 180): Promise<T> {
  for (let waited = 0; waited < seconds; waited += 3) {
    const value = await read();
    if (value !== null) return value;
    await pause(3000);
  }
  throw new Error(`gave up waiting for ${what}`);
}

async function joined(people: Person[]): Promise<Member[]> {
  const users = people.map((person) => `${castPrefix}${person.key}${run}`);
  for (const [index, person] of people.entries()) await event({ type: "team_join", user: slackUserOf(person, users[index]!), event_ts: `${Date.now() / 1000}` });
  const ids = await until("the joins", async () => {
    const found = new Map((await newestRows("members", 400)).filter((row) => row.kind === "member" && users.includes(row.user as string)).map((row) => [row.user as string, row._id]));
    return found.size === users.length ? found : null;
  });
  return people.map((person, index) => ({ ...person, user: users[index]!, member: ids.get(users[index]!)! }));
}

async function thanks(giver: Member, recipient: Member, words: string) {
  const at = Date.now();
  const ts = `${Math.floor(at / 1000)}.${String((at % 1000) * 1000 + (sent % 1000)).padStart(6, "0")}`;
  const elements = [{ type: "user", user_id: recipient.user }, { type: "text", text: " " }, { type: "emoji", name: kudosEmoji }, { type: "text", text: ` ${words}` }];
  await event({ type: "message", channel, channel_type: "channel", user: giver.user, ts, text: `<@${recipient.user}> :${kudosEmoji}: ${words}`, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }, at);
}

async function newSession(user: string) {
  const expirationTime = Date.now() + 24 * 3600_000;
  await append("authSessions", [{ userId: user, expirationTime }]);
  const session = (await newestRows("authSessions", 20)).find((row) => row.userId === user && row.expirationTime === expirationTime)!;
  await append("authRefreshTokens", [{ sessionId: session._id, expirationTime }]);
  const token = (await newestRows("authRefreshTokens", 20)).find((row) => row.sessionId === session._id)!;
  return { session: session._id, refreshToken: token._id };
}

function signInSnippet({ session, refreshToken }: { session: string; refreshToken: string }) {
  const namespace = cloud.replace(/[^a-zA-Z0-9]/g, "");
  return [`localStorage.setItem("__convexAuthRefreshToken_${namespace}", "${refreshToken}|${session}");`, `localStorage.setItem("__convexAuthJWT_${namespace}", "eyJhbGciOiJub25lIn0.eyJzdWIiOiJwcm9vZiJ9.");`, `localStorage.removeItem("__convexAuthOAuthVerifier_${namespace}");`, "location.reload();"].join("\n");
}

async function castOf(): Promise<Member[]> {
  const rows = (await newestRows("members", 400)).filter((row) => row.kind === "member" && (row.user as string).startsWith(castPrefix));
  const newestRun = rows.map((row) => (row.user as string).slice(castPrefix.length + 3)).sort().at(-1);
  return [pip, wren, tam, ivo].map((person) => {
    const row = rows.find((row) => row.user === `${castPrefix}${person.key}${newestRun}`);
    if (!row) throw new Error("no proof cast yet: run seed first");
    return { ...person, user: row.user as string, member: row._id };
  });
}

async function journeyRewardsOf(member: Member) {
  return (await newestRows("rewardRecords", 400)).filter((row) => row.member === member.member && (row.key as string).startsWith("journey:"));
}

async function questsFinished(member: Member, count: number) {
  return until(`${member.first}'s quests`, async () => {
    const rewards = await journeyRewardsOf(member);
    return rewards.length >= count ? rewards : null;
  });
}

async function visits(member: Member) {
  await append("users", [{ chatIdentity: { workspace, user: member.user }, name: nameOf(member), givenName: member.first }]);
  await append("lastVisits", [{ member: member.member, at: Date.now() }]);
  await pause(2000);
}

async function seed() {
  const [questMember, wrenMember, tamMember, milestoneMember] = await joined([pip, wren, tam, ivo]);
  log(`quest member ${nameOf(questMember!)} is ${questMember!.user}; milestone member ${nameOf(milestoneMember!)} is ${milestoneMember!.user}`);

  await visits(questMember!);
  await thanks(questMember!, wrenMember!, "for untangling the release checklist with me");
  await questsFinished(questMember!, 1);
  await pause(1500);
  await thanks(questMember!, tamMember!, "for pairing on the flaky deploy until it was green");

  await thanks(milestoneMember!, wrenMember!, "for walking me through the on-call runbook");
  await questsFinished(milestoneMember!, 1);
  await pause(15_000);
  await visits(milestoneMember!);
  await thanks(milestoneMember!, tamMember!, "for reviewing my migration so carefully today");
  await pause(1500);
  await thanks(milestoneMember!, questMember!, "because your notes made the handover painless");
  await pause(15_000);
  await signIn();
}

async function signIn() {
  const cast = await castOf();
  const users = await newestRows("users", 200);
  const signIns = privateFolder("proof-progress-beats-sign-in-");
  for (const member of [cast[0]!, cast[3]!]) {
    const user = users.find((row) => (row.chatIdentity as { user: string }).user === member.user)!;
    const file = signIns.write(`${member.key.toLowerCase()}.js`, signInSnippet(await newSession(user._id)));
    log(`sign-in snippet for ${nameOf(member)} written to ${file}`);
  }
}

const commands: Record<string, () => Promise<void>> = { seed, "sign-in": signIn };
const command = commands[process.argv[2] ?? "seed"];
if (!command) throw new Error(`command must be one of ${Object.keys(commands).join(", ")}`);
await command();
