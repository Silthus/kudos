import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, pause, required, slackRead, storedShapeOf, thanks, type Person } from "./slack.mts";

type Row = Record<string, any>;

const deployment = required("KUDOS_DEPLOYMENT");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const site = required("KUDOS_SITE");
const cast = process.env.KUDOS_CAST ?? "A";
const out = process.env.KUDOS_OUT ?? "/tmp/slack-proof/teaser-113.json";
const step = process.argv[2] ?? "";

if (deployment === "affable-bat-254") throw new Error("teaser113 runs against the sandbox only");

const person = (tag: string, name: string): Person => ({ id: `U0PRFTSR${tag}${cast}`, name, workspace });

const reader = person("RDR", "Teo Vance");
const ines = person("INS", "Ines Albrecht");
const kofi = person("KOF", "Kofi Mensah");
const lena = person("LEN", "Lena Dorsey");
const everyone = { reader, ines, kofi, lena };

function convex(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("node_modules/.bin/convex", [...args, "--deployment-name", deployment], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => (code === 0 ? resolve(stdout) : reject(new Error(`convex ${args.join(" ")} exited ${code}: ${stderr}`))));
  });
}

function parsedRow(line: string): Row {
  return JSON.parse(line.replace(/(:\s*-?\d+)n(\s*[,}\]])/g, "$1$2").replace(/:\s*NaN/g, ": null"));
}

async function rowsOf(table: string, limit = 10_000): Promise<Row[]> {
  const text = await convex(["data", table, "--format", "jsonLines", "--limit", `${limit}`]);
  return text
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map(parsedRow);
}

async function run(fn: string, args: Record<string, unknown>, identity?: Record<string, string>) {
  return JSON.parse(await convex(["run", fn, JSON.stringify(args), ...(identity ? ["--identity", JSON.stringify(identity)] : [])]));
}

async function appended(table: string, row: Row) {
  const file = `/tmp/slack-proof/${table}-113.jsonl`;
  writeFileSync(file, `${JSON.stringify(row)}\n`);
  await convex(["import", "--table", table, "--append", "--format", "jsonLines", file, "-y"]);
}

function proofSoFar(): Row {
  return existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
}

function record(part: Row) {
  const proof = { ...proofSoFar(), ...part, updatedAt: new Date().toISOString() };
  writeFileSync(out, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(part, null, 2));
  return proof;
}

async function until<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 120_000): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() - started > timeoutMs) return value;
    await pause(5_000);
  }
}

async function memberIdOf(one: Person): Promise<string> {
  const rows = (await rowsOf("members")).filter((row) => row.workspace === workspace && row.user === one.id);
  if (rows.length !== 1) throw new Error(`${one.id} has ${rows.length} members rows`);
  return rows[0]!._id;
}

const readerMember = () => proofSoFar().people.reader.member as string;

async function waitingItemsOf(member: string) {
  return (await rowsOf("items")).filter((row) => row.member === member && row.turnedAt === undefined).map(({ _id, source, key, reason, earnedAt }) => ({ _id, source, key, reason, earnedAt }));
}

async function awardsTo(member: string) {
  return (await rowsOf("awards")).filter((row) => row.recipient === member).map(({ _id, giver, message, kudos, at }) => ({ _id, giver, message, kudos, at }));
}

async function lastVisitRowsOf(member: string) {
  return (await rowsOf("lastVisits")).filter((row) => row.member === member);
}

async function joinEveryone() {
  const fresh = (await rowsOf("members")).filter((row) => row.workspace === workspace && Object.values(everyone).some(({ id }) => id === row.user));
  if (fresh.length > 0) throw new Error(`cast ${cast} already has members rows; pick another KUDOS_CAST`);
  const teamJoin: Row = {};
  for (const one of Object.values(everyone)) teamJoin[one.id] = await join(one);
  await pause(8_000);
  const people: Row = {};
  for (const [role, one] of Object.entries(everyone)) people[role] = { user: one.id, name: one.name, member: await memberIdOf(one) };
  record({ workspace, channel, cast, people, teamJoin });
}

async function beforeTheVisit() {
  const fromReader = await thanks(reader, [ines, kofi], "thank you both for staying late to untangle the billing export and for writing down every step so the rest of us can follow it next time", { channel });
  await pause(2_000);
  const fromInes = await thanks(ines, [reader], "thank you for pairing with me on the flaky deploy check and explaining how the retry budget works in such a patient way", { channel });
  record({ beforeVisit: { readerToInesAndKofi: { channel, ts: fromReader.ts }, inesToReader: { channel, ts: fromInes.ts } } });
  const member = readerMember();
  const items = await until(() => waitingItemsOf(member), (rows) => rows.length > 0);
  const awards = await until(() => awardsTo(member), (rows) => rows.length > 0);
  record({ beforeVisitRows: { readerWaitingItems: items, awardsToReader: awards } });
}

async function theVisit() {
  const member = readerMember();
  if ((await lastVisitRowsOf(member)).length > 0) throw new Error("the reader already has a last visit");
  await appended("users", { chatIdentity: { workspace, user: reader.id }, name: reader.name, givenName: reader.name.split(" ")[0] });
  const user = (await rowsOf("users")).find((row) => row.chatIdentity?.workspace === workspace && row.chatIdentity?.user === reader.id);
  if (!user) throw new Error("the imported users row was not found");
  await appended("authSessions", { userId: user._id, expirationTime: Date.now() + 2 * 60 * 60_000 });
  const session = (await rowsOf("authSessions")).find((row) => row.userId === user._id);
  if (!session) throw new Error("the imported authSessions row was not found");
  const identity = { subject: `${user._id}|${session._id}`, issuer: site };
  const arrival = await run("website/lastVisit:arrive", { from: null }, identity);
  record({ visit: { users: user, authSessions: session, arriveArgs: { from: null }, arrival, lastVisits: await lastVisitRowsOf(member) } });
}

async function afterTheVisit() {
  const proof = proofSoFar();
  const lastVisit: number = proof.visit.arrival.lastVisit;
  const fromKofi = await thanks(kofi, [reader], "thanks for reviewing the on-call handover so quickly", { channel });
  await pause(2_000);
  const fromLena = await thanks(lena, [reader], "thanks for the clear notes in the incident channel", { channel });
  record({ afterVisit: { kofiToReader: { channel, ts: fromKofi.ts }, lenaToReader: { channel, ts: fromLena.ts } } });
  const awards = await until(() => awardsTo(readerMember()), (rows) => rows.filter(({ at }) => at > lastVisit).length >= 2);
  record({ afterVisitRows: { awardsToReader: awards, awardsAfterLastVisit: awards.filter(({ at }) => at > lastVisit).length, lastVisits: await lastVisitRowsOf(readerMember()) } });
}

async function homeReads() {
  const args = { workspace, user: reader.id };
  const homeOf = await run("engine/home:homeOf", args);
  const frontDoor = await run("website/link:frontDoorLinksOf", args);
  const shownArgs = { ...args, frontDoor: frontDoor !== null };
  const shown = await run("feedback/homes:shownHomeOf", shownArgs);
  const profile = shown?.shown ?? null;
  const member = readerMember();
  record({
    homeReads: { args, homeOf, frontDoorLinksOf: frontDoor, shownHomeOfArgs: shownArgs, shownHomeOf: shown },
    flagBaseline: { shownTab: profile?.tab ?? null, teaser: profile?.teaser ?? null, thoughtfulGivers: profile?.thoughtfulGivers ?? null, note: "teaserOf answers null unless teasers and hidden-items are on for the member; the reads were taken with the sandbox's flags as they are (teasers, hidden-items and album on for every member)" },
    countsAtRead: { waitingItems: (await waitingItemsOf(member)).length, awardsToReader: (await awardsTo(member)).length, lastVisits: await lastVisitRowsOf(member) },
  });
}

async function botReplies() {
  const proof = proofSoFar();
  const oldest: string = proof.beforeVisit.readerToInesAndKofi.ts;
  const history = await slackRead("conversations.history", { channel, oldest, limit: "20" });
  const botPosts = (history.messages ?? []).filter(({ bot_id }) => bot_id !== undefined).map(storedShapeOf);
  record({ botRepliesInChannel: { oldest, history: { ok: history.ok, error: history.error ?? null }, count: botPosts.length, botPosts } });
}

const steps: Record<string, () => Promise<void>> = { join: joinEveryone, before: beforeTheVisit, visit: theVisit, after: afterTheVisit, reads: homeReads, replies: botReplies };
const chosen = steps[step];
if (!chosen) throw new Error(`unknown step "${step}": ${Object.keys(steps).join(", ")}`);
await chosen();
