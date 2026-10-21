import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, pause, required, slackPost, slackRead, storedShapeOf, thanks, type Person } from "./slack.mts";

type Row = Record<string, any>;
type Thanks = { channel: string; ts: string };
type Cause = { kind: "thanks"; giver: string; message: { workspace: string; conversation: string; message: string } };
type NudgeMessage = { giver: string; kudosEmoji: string; cause: { kind: "thanks"; quote: string | null } | { kind: "hug"; permalink: string | null }; album: string };

const deployment = required("KUDOS_DEPLOYMENT");
const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const cast = process.env.KUDOS_CAST ?? "A";
const out = process.env.KUDOS_OUT ?? "/tmp/slack-proof/nudge-116.json";
const step = process.argv[2] ?? "";
const waitingLine = "Your rare hoggie is waiting for you to collect it.";
const deliveryJob = "slack/welcomeNudge.js:deliverWelcomeNudge";

if (deployment === "affable-bat-254") throw new Error("nudge116 runs against the sandbox only");

const giver: Person = { id: `U0PRFNDGIV${cast}`, name: "Marisol Quint", workspace };
const newcomer: Person = { id: `U0PRFNDNEW${cast}`, name: "Odile Brask", workspace };

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

async function run(fn: string, args: Record<string, unknown>) {
  return JSON.parse(await convex(["run", fn, JSON.stringify(args)]));
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

async function memberIdOf(person: Person): Promise<string> {
  const rows = (await rowsOf("members")).filter((row) => row.workspace === workspace && row.user === person.id);
  if (rows.length !== 1) throw new Error(`${person.id} has ${rows.length} members rows`);
  return rows[0]!._id;
}

async function nudgeRowsOf(member: string) {
  return (await rowsOf("welcomeNudges")).filter((row) => row.member === member);
}

async function welcomeItemsOf(member: string) {
  return (await rowsOf("items")).filter((row) => row.member === member && row.key === "welcome:first");
}

async function deliveryJobsOf(member: string) {
  const jobs = (await rowsOf("_scheduled_functions", 5_000)).filter((job) => job.name === deliveryJob && job.args?.[0]?.member === member);
  return jobs
    .map((job) => ({ id: job._id, attempt: job.args[0].attempt ?? 1, scheduledTime: new Date(job.scheduledTime).toISOString(), state: job.state, cause: job.args[0].cause }))
    .sort((one, other) => one.attempt - other.attempt);
}

async function until<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 90_000): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() - started > timeoutMs) return value;
    await pause(5_000);
  }
}

const settled = (jobs: Array<{ state: { kind: string } }>) => jobs.length > 0 && jobs.every(({ state }) => state.kind !== "pending" && state.kind !== "inProgress");

function causeOf(giverMember: string, kudos: Thanks): Cause {
  return { kind: "thanks", giver: giverMember, message: { workspace, conversation: kudos.channel, message: kudos.ts } };
}

function escaped(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function leadOf({ giver, kudosEmoji, cause }: NudgeMessage) {
  if (cause.kind === "thanks") return `<@${giver}> thanked you :${kudosEmoji}:`;
  const hugged = cause.permalink === null ? "hugged your message" : `<${cause.permalink}|hugged your message>`;
  return `<@${giver}> ${hugged} :${kudosEmoji}:`;
}

function messageOf(message: NudgeMessage) {
  const lead = leadOf(message);
  const quote = message.cause.kind === "thanks" && message.cause.quote !== null ? `\n>${escaped(message.cause.quote)}` : "";
  return {
    text: `${lead}\n${waitingLine}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `${lead}${quote}` } },
      { type: "section", text: { type: "mrkdwn", text: waitingLine } },
      { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open your HedgeHug album" }, url: message.album, action_id: "welcome-nudge-open-album" }] },
    ],
    unfurl_links: false,
    unfurl_media: false,
  };
}

async function joinBoth() {
  const answers = { [giver.id]: await join(giver), [newcomer.id]: await join(newcomer) };
  await pause(8_000);
  record({ workspace, channel, people: { giver: { user: giver.id, name: giver.name, member: await memberIdOf(giver) }, newcomer: { user: newcomer.id, name: newcomer.name, member: await memberIdOf(newcomer) } }, teamJoin: answers });
}

async function thankOnce() {
  const row = (await rowsOf("workspaces", 1_000)).find((one) => one.workspace === workspace);
  const kudosEmojiOnRow = row?.kudosEmoji ?? null;
  if (kudosEmojiOnRow !== null && kudosEmojiOnRow !== "hedgehog") throw new Error(`the workspace's kudos emoji is ${kudosEmojiOnRow}, the helper sends hedgehog`);
  const kudos = await thanks(giver, [newcomer], "thank you for walking me through the on-call runbook on your very first week and fixing the two broken links in it", { channel });
  record({ workspaceRow: { kudosEmojiOnRow, welcomeNudgeOnRow: row?.welcomeNudge ?? null }, firstKudos: { channel: kudos.channel, ts: kudos.ts, sentAt: new Date().toISOString() } });
}

async function evidence() {
  const proof = proofSoFar();
  const newcomerMember: string = proof.people.newcomer.member;
  const kudos: Thanks = proof.firstKudos;
  const nudges = await until(() => nudgeRowsOf(newcomerMember), (rows) => rows.length > 0);
  const jobs = await until(() => deliveryJobsOf(newcomerMember), settled);
  const cause = causeOf(proof.people.giver.member, kudos);
  const message: NudgeMessage | null = await run("feedback/welcomeNudge:welcomeNudgeMessage", { workspace, member: newcomerMember, cause });
  record({ afterFirstKudos: { welcomeNudges: nudges, welcomeNudgeCount: nudges.length, welcomeItems: (await welcomeItemsOf(newcomerMember)).map(({ _id, key, source, floor, reason, earnedAt }) => ({ _id, key, source, floor, reason, earnedAt })), welcomeNudgeMessageArgs: { workspace, member: newcomerMember, cause }, welcomeNudgeMessage: message, deliveryJobs: jobs } });
}

async function shapeCheck() {
  const proof = proofSoFar();
  if (proof.shapeCheck) throw new Error("the shape check was already posted once");
  const message = proof.afterFirstKudos.welcomeNudgeMessage as NudgeMessage | null;
  if (message === null) throw new Error("welcomeNudgeMessage answered null");
  const content = messageOf(message);
  const posted = await slackPost("chat.postMessage", { channel, ...content });
  await pause(3_000);
  const history = await slackRead("conversations.history", { channel, oldest: String(posted.ts), inclusive: "true", limit: "1" });
  const readBack = (history.messages ?? []).filter(({ ts }) => ts === posted.ts).map(storedShapeOf);
  record({
    shapeCheck: {
      label: "Shape check: the welcome nudge DM's exact text and blocks, posted once to #kudos-test because Slack can't DM a made-up member (chat.postMessage to their user ID answers channel_not_found)",
      sent: content,
      ok: posted.ok,
      error: posted.error ?? null,
      ts: posted.ts,
      echoedBlocks: (posted.message as Row | undefined)?.blocks ?? null,
      history: { ok: history.ok, error: history.error ?? null },
    },
    newest: readBack,
  });
}

async function onceEver() {
  const proof = proofSoFar();
  if (proof.onceEver) throw new Error("the once-ever kudos were already sent");
  const jobsBefore = await deliveryJobsOf(proof.people.newcomer.member);
  const second = await thanks(giver, [newcomer], "and thank you again for pairing on the alert thresholds this morning", { channel });
  const first: Thanks = proof.firstKudos;
  const redelivery = await thanks(giver, [newcomer], "thank you for walking me through the on-call runbook on your very first week and fixing the two broken links in it", { channel, ts: first.ts, at: Math.floor(Number(first.ts) * 1000) });
  record({ onceEver: { secondKudos: { channel: second.channel, ts: second.ts }, redeliveryOfFirst: { channel: redelivery.channel, ts: redelivery.ts, note: "same message ts and body, fresh event_id, so the event passes the receipt dedupe and reaches the engine" }, deliveryJobIdsBefore: jobsBefore.map(({ id }) => id) } });
}

async function recount() {
  const proof = proofSoFar();
  const newcomerMember: string = proof.people.newcomer.member;
  const nudges = await nudgeRowsOf(newcomerMember);
  const jobs = await deliveryJobsOf(newcomerMember);
  const before = new Set<string>(proof.onceEver.deliveryJobIdsBefore);
  const awards = (await rowsOf("awards", 5_000)).filter((row) => row.recipient === newcomerMember).map(({ _id, giver, message, kudos, at }) => ({ _id, giver, message, kudos, at }));
  record({ afterOnceEver: { welcomeNudges: nudges, welcomeNudgeCount: nudges.length, welcomeItemCount: (await welcomeItemsOf(newcomerMember)).length, deliveryJobs: jobs.length, newDeliveryJobs: jobs.filter(({ id }) => !before.has(id)), awardsToNewcomer: awards } });
}

const steps: Record<string, () => Promise<void>> = { join: joinBoth, thank: thankOnce, evidence, shape: shapeCheck, once: onceEver, recount };
const chosen = steps[step];
if (!chosen) throw new Error(`unknown step "${step}": ${Object.keys(steps).join(", ")}`);
await chosen();
