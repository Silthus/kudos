import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { promisify } from "node:util";
import { signedRequest } from "../../../testing/signedSlack";
import { drawOf } from "../../../convex/album/hoggies/draw";
import { catalogue } from "../../../convex/album/hoggies/catalogue";
import { xpToReach } from "../../../convex/progression/levels";
import { emojiNameOf } from "../../../convex/workspace/settingsBounds";

const sandbox = "different-dog-467";
const site = `https://${sandbox}.convex.site`;
const runCommand = promisify(execFile);
const convexEnv = sandboxOnly(process.env);
const convexBinary = joinPath(process.cwd(), "node_modules/.bin/convex");
const scratch = scratchPackage();
const workspace = await envOf("SLACK_WORKSPACE_ID");
const signingSecret = await envOf("SLACK_SIGNING_SECRET");
const drawSecret = await envOf("HOGGIE_DRAW_SECRET");
const kudosEmoji = await kudosEmojiOfTheSandbox();
const startedAt = Date.now();
const run = startedAt.toString(36).toUpperCase();
const channel = "C0DEMO102";
const castPrefix = "U0DEMO102";
const demoLevel = 4;
const candidatesTried = 24;
const team = { team: "demo-102-burrow-builders", name: "Burrow Builders" };
let sent = 0;

type Person = { key: string; first: string; last: string; profile?: number };
type Member = Person & { user: string; member: string };
type Row = Record<string, unknown> & { _id: string };

const robin: Person = { key: "ROB", first: "Robin", last: "Ash" };
const teammates: Person[] = [
  { key: "MIL", first: "Milo", last: "Brandt", profile: 966_102_01 },
  { key: "SAS", first: "Sasha", last: "Lind", profile: 966_102_02 },
  { key: "NIK", first: "Niko", last: "Pratt", profile: 966_102_03 },
  { key: "JUN", first: "Juno", last: "Vale", profile: 966_102_04 },
];
const friends: Person[] = [
  { key: "KIT", first: "Kit", last: "Moreau" },
  { key: "LEN", first: "Lena", last: "Ortiz" },
];

function sandboxOnly(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const withoutDeploymentChoice = Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith("CONVEX_")));
  return { ...withoutDeploymentChoice, CONVEX_DEPLOYMENT: `prod:${sandbox}` };
}

function scratchPackage() {
  const directory = mkdtempSync(joinPath(tmpdir(), "demo-102-"));
  writeFileSync(joinPath(directory, "package.json"), JSON.stringify({ name: "demo-102-scratch", private: true, dependencies: { convex: "*" } }));
  return directory;
}

async function envOf(name: string) {
  const value = (await convex("env", "get", name)).trim();
  if (value === "") throw new Error(`${name} is not set on ${sandbox}`);
  return value;
}

async function kudosEmojiOfTheSandbox() {
  const setting = (await everyRow("workspaces")).find((row) => row.workspace === workspace)?.kudosEmoji as string | undefined;
  const configured = setting ?? emojiNameOf(await convex("env", "get", "KUDOS_EMOJI"));
  if (configured === "") throw new Error(`${sandbox} names no kudos emoji: set its workspace setting or KUDOS_EMOJI`);
  return configured;
}

const nameOf = ({ first, last }: Person) => `${first} ${last}`;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (line: string) => console.log(`[demo-102] ${line}`);

async function convex(...args: string[]) {
  const { stdout } = await runCommand(convexBinary, [...args, "--deployment", sandbox], { cwd: scratch, env: convexEnv, maxBuffer: 256 * 1024 * 1024 });
  return stdout;
}

function rowsOf(jsonLines: string): Row[] {
  return jsonLines
    .split("\n")
    .filter((line) => line.trim().startsWith("{"))
    .map((line) => JSON.parse(line.replace(/(:\s*-?\d+)n(\s*[,}\]])/g, "$1$2")) as Row);
}

async function newestRows(table: string, limit: number, component?: string) {
  return rowsOf(await convex("data", table, "--limit", String(limit), "--format", "jsonLines", ...(component ? ["--component", component] : [])));
}

async function everyRow(table: string) {
  const most = 10_000;
  const rows = await newestRows(table, most);
  if (rows.length === most) throw new Error(`${table} holds ${most} rows or more, more than the seed reads whole`);
  return rows;
}

async function append(table: string, rows: Record<string, unknown>[]) {
  const file = joinPath(scratch, `${table}-${sent++}.jsonl`);
  writeFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  await convex("import", "--table", table, "--append", "--format", "jsonLines", file, "-y");
}

async function post(path: string, body: string, contentType?: string) {
  sent += 1;
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${site}${path}`, await signedRequest(body, { secret: signingSecret, ...(contentType && { contentType }) }));
    if (response.ok) return;
    if (response.status < 500 || attempt === 3) throw new Error(`${path} answered ${response.status}: ${await response.text()}`);
    await pause(2000);
  }
}

async function event(body: Record<string, unknown>, at = Date.now()) {
  await post("/slack/events", JSON.stringify({ type: "event_callback", team_id: workspace, event_id: `EvDemo102x${run}x${sent}`, event_time: Math.floor(at / 1000), event: body }));
}

function slackUserOf(person: Person, user: string, deleted = false) {
  const name = nameOf(person);
  return { id: user, team_id: workspace, deleted, name: person.first.toLowerCase(), real_name: name, tz: "Europe/Berlin", profile: { display_name: name, real_name: name } };
}

async function join(person: Person, user: string) {
  await event({ type: "team_join", user: slackUserOf(person, user), event_ts: `${Date.now() / 1000}` });
}

async function retire(user: string, name: string) {
  const [first = "", ...last] = name.split(" ");
  await event({ type: "user_change", user: slackUserOf({ key: "", first, last: last.join(" ") }, user, true), event_ts: `${Date.now() / 1000}` });
}

function tsAt(at: number) {
  return `${Math.floor(at / 1000)}.${String((at % 1000) * 1000 + (sent % 1000)).padStart(6, "0")}`;
}

async function say(author: Member, words: string, to: Member | null, at = Date.now()) {
  const ts = tsAt(at);
  const mention = to === null ? [] : [{ type: "user", user_id: to.user }, { type: "text", text: " " }, { type: "emoji", name: kudosEmoji }];
  const elements = [...mention, { type: "text", text: ` ${words}` }];
  const text = `${to === null ? "" : `<@${to.user}> :${kudosEmoji}:`} ${words}`;
  await event({ type: "message", channel, channel_type: "channel", user: author.user, ts, text, team: workspace, blocks: [{ type: "rich_text", block_id: "b1", elements: [{ type: "rich_text_section", elements }] }] }, at);
  return { ts, author };
}

async function hug(hugger: Member, { ts, author }: { ts: string; author: Member }) {
  await event({ type: "reaction_added", user: hugger.user, reaction: kudosEmoji, item_user: author.user, item: { type: "message", channel, ts }, event_ts: tsAt(Date.now()) });
}

async function until<T>(what: string, read: () => Promise<T | null>, seconds = 120): Promise<T> {
  for (let waited = 0; waited < seconds; waited += 3) {
    const value = await read();
    if (value !== null) return value;
    await pause(3000);
  }
  throw new Error(`gave up waiting for ${what}`);
}

async function membersFor(users: string[]): Promise<Map<string, string>> {
  const rows = await newestRows("members", 400);
  return new Map(rows.filter((row) => row.kind === "member" && users.includes(row.user as string)).map((row) => [row.user as string, row._id]));
}

async function joined(people: Array<{ person: Person; user: string }>): Promise<Member[]> {
  for (const { person, user } of people) await join(person, user);
  const users = people.map(({ user }) => user);
  const ids = await until("the joins", async () => {
    const found = await membersFor(users);
    return found.size === users.length ? found : null;
  });
  return people.map(({ person, user }) => ({ ...person, user, member: ids.get(user)! }));
}

async function retirePreviousCast() {
  const earlier = (await everyRow("members")).filter((row) => row.kind === "member" && (row.user as string).startsWith(castPrefix));
  for (const row of earlier) await retire(row.user as string, (row.realName ?? row.name ?? "") as string);
  log(`retired ${earlier.length} members of earlier runs`);
}

async function levelDrawsOf(member: string) {
  const slots = [{ slot: 1 }, { slot: 2 }, { slot: 3, floor: "rare" as const }];
  return Promise.all(slots.map(async ({ slot, floor }) => ({ slot, ...(await drawOf({ secret: drawSecret, member, crate: `level:${demoLevel}:${slot}`, version: catalogue.version, floor })) })));
}

async function robinWithALegendary(): Promise<Member> {
  const candidates = Array.from({ length: candidatesTried }, (_, n) => ({ person: robin, user: `${castPrefix}${robin.key}${run}${n.toString(36).toUpperCase()}` }));
  const tried = await joined(candidates);
  let chosen: Member | null = null;
  for (const candidate of tried) {
    const draws = await levelDrawsOf(candidate.member);
    if (chosen === null && draws.some(({ rarity }) => rarity === "legendary")) chosen = candidate;
  }
  for (const candidate of tried) if (candidate !== chosen) await retire(candidate.user, nameOf(robin));
  if (chosen === null) throw new Error(`no candidate of ${candidatesTried} draws a legendary at level ${demoLevel}; run again`);
  return chosen;
}

async function replaceTheCompanyCopy(team_: Member[]) {
  const withoutStored = ({ _id, _creationTime, asOf, ...row }: Row) => row;
  const profiles = (await everyRow("companyProfiles")).map(withoutStored).filter((row) => !(row.teams as string[] | undefined)?.includes(team.team));
  const teams = (await everyRow("companyTeams")).map(withoutStored).filter((row) => row.team !== team.team);
  const seeded = team_.map((person) => ({ profile: person.profile!, firstName: person.first, lastName: person.last, normalisedName: nameOf(person).toLowerCase(), colour: "teal", teams: [team.team] }));
  const args = { asOf: Date.now(), profiles: [...profiles, ...seeded], teams: [...teams, { ...team, leads: [], people: seeded.map(({ profile }) => profile) }] };
  await convex("run", "companyProfiles/sync:replaceCompanyProfiles", JSON.stringify(args));
}

async function signIn(member: Member) {
  const expirationTime = Date.now() + 7 * 24 * 3600_000;
  const before = new Set((await newestRows("users", 50)).map(({ _id }) => _id));
  await append("users", [{ chatIdentity: { workspace, user: member.user }, name: nameOf(member), givenName: member.first }]);
  const user = (await newestRows("users", 50)).find((row) => !before.has(row._id) && (row.chatIdentity as { user: string }).user === member.user)!;
  return { user: user._id, ...(await newSession(user._id, expirationTime)) };
}

async function newSession(user: string, expirationTime: number) {
  await append("authSessions", [{ userId: user, expirationTime }]);
  const session = (await newestRows("authSessions", 20)).find((row) => row.userId === user && row.expirationTime === expirationTime)!;
  await append("authRefreshTokens", [{ sessionId: session._id, expirationTime }]);
  const token = (await newestRows("authRefreshTokens", 20)).find((row) => row.sessionId === session._id)!;
  return { session: session._id, refreshToken: token._id };
}

function identityOf({ user, session }: { user: string; session: string }) {
  return JSON.stringify({ subject: `${user}|${session}`, issuer: site });
}

async function itemsOf(member: Member) {
  return (await newestRows("items", 400)).filter((row) => row.member === member.member);
}

async function xpOf(member: Member) {
  const row = (await newestRows("memberProgress", 400)).find((row) => row.member === member.member);
  return (row?.xp as number | undefined) ?? 0;
}

async function turn(identity: string, item: string) {
  const answer = JSON.parse(await convex("run", "website/album:turnItem", JSON.stringify({ item }), "--identity", identity)) as { kind: string };
  if (answer.kind !== "turned") throw new Error(`turning ${item} answered ${answer.kind}`);
}

function signInSnippet({ session, refreshToken }: { session: string; refreshToken: string }) {
  const namespace = site.replace(".convex.site", ".convex.cloud").replace(/[^a-zA-Z0-9]/g, "");
  return [
    `localStorage.setItem("__convexAuthRefreshToken_${namespace}", "${refreshToken}|${session}");`,
    `localStorage.setItem("__convexAuthJWT_${namespace}", "eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZW1vIn0.");`,
    `localStorage.removeItem("__convexAuthOAuthVerifier_${namespace}");`,
    "location.reload();",
  ].join("\n");
}

async function seed() {
  await retirePreviousCast();
  const demo = await robinWithALegendary();
  log(`demo member ${nameOf(demo)} is ${demo.user} (${demo.member})`);
  const cast = await joined([...teammates, ...friends].map((person) => ({ person, user: `${castPrefix}${person.key}${run}` })));
  const [milo, sasha, niko, juno] = cast as [Member, Member, Member, Member];
  const [kit, lena] = cast.slice(4) as [Member, Member];
  await replaceTheCompanyCopy([milo, sasha, niko, juno]);
  await append("memberProgress", [{ member: demo.member, xp: 250, pointsSpent: 0 }]);
  const signedIn = await signIn(demo);
  const identity = identityOf(signedIn);

  const yesterday = Date.now() - 26 * 3600_000;
  await say(demo, "because you paired with me on the flaky checkout test until it finally went green", milo, yesterday);
  await say(demo, "for the clearest incident write-up I've read, the whole team learned from it", sasha, yesterday + 60_000);
  await say(demo, "because your review caught the timezone bug before it reached anyone", niko, yesterday + 120_000);
  const earlier = await until("the first six items", async () => ((await itemsOf(demo)).length >= 6 ? itemsOf(demo) : null), 180);
  for (const sticker of earlier.filter((row) => row.source === "sticker")) await turn(identity, sticker._id);
  log(`turned ${earlier.filter((row) => row.source === "sticker").length} stickers before the last visit`);

  await pause(2000);
  await append("lastVisits", [{ member: demo.member, at: Date.now() }]);
  await pause(2000);

  for (const [giver, words] of [
    [milo, "for jumping on my on-call page at 7am and fixing it before standup"],
    [sasha, "because the dashboard you built saved our planning meeting"],
    [niko, "for patiently walking me through the billing export"],
    [kit, "because your retro notes were so clear we shipped the fix the same day"],
    [lena, "for covering my support shift at short notice"],
    [juno, "because your pairing session made the parser change click"],
  ] as const)
    await say(giver, words, demo);
  const notes = await say(demo, "The release notes for this week are in the shared folder, enjoy", null);
  for (const hugger of [milo, sasha, kit, lena, juno]) await hug(hugger, notes);
  const demoPost = await say(juno, "Demo time: the new onboarding flow is live in staging, have a look!", null);
  await hug(demo, demoPost);
  await say(demo, "because your onboarding demo made the whole flow click for me, best demo this week", juno);

  const { xp, items } = await settledAtLevel(demo);
  await report(demo, xp, items, newSession.bind(null, signedIn.user));
}

async function settledAtLevel(demo: Member) {
  let previous = -1;
  return until(`level ${demoLevel} with every award paid`, async () => {
    if ((await dueJobsOfThisRun()) > 0) return null;
    const standing = { xp: await xpOf(demo), items: (await itemsOf(demo)).filter((row) => row.turnedAt === undefined) };
    const settled = standing.xp === previous && standing.xp >= xpToReach(demoLevel) && standing.items.length >= 8;
    previous = standing.xp;
    return settled ? standing : null;
  }, 240);
}

async function dueJobsOfThisRun() {
  const unfinished = new Set(["pending", "inProgress"]);
  const jobs = await newestRows("_scheduled_functions", 2000);
  return jobs.filter((job) => (job._creationTime as number) >= startedAt && unfinished.has((job.state as { kind: string }).kind) && (job.scheduledTime as number) <= Date.now()).length;
}

async function report(demo: Member, xp: number, items: Row[], session: (expirationTime: number) => Promise<{ session: string; refreshToken: string }>) {
  const draws = await Promise.all(
    items.map(async (row) => ({ key: row.key as string, source: row.source as string, ...(row.source === "hoggie" ? await drawOf({ secret: drawSecret, member: demo.member, crate: row.key as string, version: catalogue.version, floor: row.floor as never }) : {}) })),
  );
  log(`${nameOf(demo)} has ${xp} XP and ${items.length} items waiting:`);
  for (const draw of draws) log(`  ${draw.source} ${draw.key}${"rarity" in draw ? ` → ${draw.rarity} ${draw.hoggie}` : ""}`);
  const fresh = await session(Date.now() + 7 * 24 * 3600_000);
  log("sign in: open the website's /book#me, paste this into the console, and it reloads signed in as the demo member:");
  console.log(signInSnippet(fresh));
}

async function signInAgain() {
  const demo = (await everyRow("members")).find((row) => row.kind === "member" && (row.user as string).startsWith(`${castPrefix}${robin.key}`));
  if (!demo) throw new Error("no demo member yet: run the seed first");
  const user = (await newestRows("users", 200)).find((row) => (row.chatIdentity as { user: string }).user === demo.user)!;
  console.log(signInSnippet(await newSession(user._id, Date.now() + 7 * 24 * 3600_000)));
}

const commands: Record<string, () => Promise<void>> = { seed, "sign-in": signInAgain };
const command = commands[process.argv[2] ?? "seed"];
if (!command) throw new Error(`command must be one of ${Object.keys(commands).join(", ")}`);
await command();
