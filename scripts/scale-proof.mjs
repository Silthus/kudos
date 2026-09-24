#!/usr/bin/env node
/**
 * Scale proof (#30): run every dashboard read path against a LOCAL backend seeded with
 * `rollups:seedScale` and print the documents and bytes each one read, as Convex reports them in
 * the function logs (`usageStats`). See docs/scale-proof.md.
 *
 *   CONVEX_AGENT_MODE=anonymous npx convex logs --jsonl --success > /tmp/scale-logs.jsonl &
 *   node scripts/scale-proof.mjs /tmp/scale-logs.jsonl [today ...]
 *
 * Reads the admin key of the local backend from .convex/local/default/config.json, so it cannot
 * point at a cloud deployment.
 */
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";

const [logFile, ...days] = process.argv.slice(2);
if (!logFile) throw new Error("usage: node scripts/scale-proof.mjs <logs.jsonl> [today ...]");
const todays = days.length > 0 ? days : ["2026-09-24", "2025-12-31"];
const { adminKey, ports } = JSON.parse(readFileSync(".convex/local/default/config.json", "utf8"));
const url = `http://127.0.0.1:${ports.cloud}`;
const client = new ConvexHttpClient(url);

const DOCS_LIMIT = 32_000; // https://docs.convex.dev/production/state/limits (per transaction)
const BYTES_LIMIT = 16 * 2 ** 20;
const OLD_DOCS_LIMIT = 16_384; // the limits the research budgeted against
const OLD_BYTES_LIMIT = 8 * 2 ** 20;
const FLAG_SHARE = 0.45;

const admin = () => client.setAdminAuth(adminKey);
const as = (member) =>
  client.setAdminAuth(adminKey, { subject: `${member.userId}|scale-proof`, issuer: url, tokenIdentifier: `${url}|${member.userId}` });

async function internal(name, args) {
  admin();
  return await client.query(name, args);
}

// ---------------------------------------------------------------------------------------------
// Pick the viewers: the busiest member (most own rows to read), the median one, a teammate.

const workspace = await internal("rollups:seedScaleViewers", {});
if (!workspace) throw new Error("No seeded workspace: run rollups:seedScale first");
const { heaviest, median, teammate } = workspace.viewers;
console.error(`workspace ${workspace.workspaceId}: ${workspace.members} members, viewers`, workspace.viewers);

const calls = [];
async function measure(label, viewer, name, args) {
  if (viewer) as(viewer);
  else admin();
  const started = Date.now() / 1000;
  let error = null;
  try {
    await client.query(name, args);
  } catch (e) {
    error = String(e.message ?? e).split("\n")[0];
  }
  calls.push({ label, viewer: viewer?.label ?? "admin", name, args, started, ended: Date.now() / 1000, error });
}

const PERIODS = ["week", "month", "quarter", "year", "all"];
const COMPARE_PERIODS = ["week", "month", "quarter", "year"];
for (const today of todays) {
  for (const period of PERIODS) {
    for (const metric of ["given", "received"]) {
      await measure(`leaderboard.get ${period} ${metric}`, median, "leaderboard:get", { period, metric, today });
    }
  }
  for (const viewer of [heaviest, median]) {
    for (const period of PERIODS) await measure(`me.overview ${period}`, viewer, "me:overview", { period, today });
    for (const period of PERIODS) await measure(`me.standing ${period}`, viewer, "me:standing", { period, today });
  }
  for (const period of PERIODS) await measure(`analytics.overview ${period}`, median, "analytics:overview", { period, today });
  for (const period of COMPARE_PERIODS) {
    await measure(`compare.past ${period}`, heaviest, "compare/past:get", { period, today });
    await measure(`compare.teammate ${period}`, heaviest, "compare/teammate:get", { period, today, memberId: teammate._id });
    await measure(`compare.team ${period}`, heaviest, "compare/team:get", { period, today });
  }
  await measure("me.today", heaviest, "me:today", { today });
  await measure("quests.mine", heaviest, "quests:mine", { today });
  await measure("quests.history 12 weeks", heaviest, "quests:history", { today });
  await measure("quests.history 52 weeks", heaviest, "quests:history", { today, weeks: 52 });
}
await measure("compare.candidates.list", heaviest, "compare/candidates:list", {});
await measure("store.balance", heaviest, "store:balance", {});
await measure("store.catalog", heaviest, "store:catalog", {});
await measure("discoveries.gallery", heaviest, "discoveries:gallery", {});
await measure("session.viewer", heaviest, "session:viewer", {});
for (const viewer of [heaviest, median]) {
  await measure("slackData.homeData (App Home)", null, "slackData:homeData", { workspaceId: workspace.workspaceId, slackUserId: viewer.slackUserId });
  calls.at(-1).viewer = viewer.label;
}

// ---------------------------------------------------------------------------------------------
// Match each call to its log line: calls run one at a time, so the first unclaimed completion of
// the same function inside the call's time window is it.

await new Promise((r) => setTimeout(r, 3000)); // let the log stream catch up
const completions = readFileSync(logFile, "utf8")
  .split("\n")
  .filter((l) => l.startsWith("{"))
  .map((l) => JSON.parse(l))
  .filter((e) => e.kind === "Completion" && e.udfType === "Query");
const claimed = new Set();
const pct = (n, limit) => `${((100 * n) / limit).toFixed(1)}%`;
const rows = [];
for (const c of calls) {
  const entry = completions.find(
    (e) => !claimed.has(e.executionId) && e.identifier === c.name && e.timestamp >= c.started - 1 && e.timestamp <= c.ended + 1,
  );
  if (entry) claimed.add(entry.executionId);
  const error = c.error ?? entry?.error ?? null;
  // A failed query reports zero usage, and a cached result reads nothing: neither is a measurement.
  const measured = entry && !error && !entry.cachedResult;
  const docs = measured ? entry.usageStats.databaseReadDocuments : null;
  const bytes = measured ? entry.usageStats.databaseReadBytes : null;
  rows.push({
    today: c.args.today ?? "",
    label: c.label,
    viewer: c.viewer,
    docs,
    bytes,
    ms: entry ? Math.round(entry.executionTime * 1000) : null,
    cached: entry?.cachedResult ?? null,
    error,
    docsPct: docs === null ? "" : pct(docs, DOCS_LIMIT),
    bytesPct: bytes === null ? "" : pct(bytes, BYTES_LIMIT),
    // Anything that failed, wasn't measured, or used over ~45% of the older 16k-doc / 8 MiB budget.
    flag: docs === null || docs > OLD_DOCS_LIMIT * FLAG_SHARE || bytes > OLD_BYTES_LIMIT * FLAG_SHARE,
  });
}
console.log(JSON.stringify({ workspace, rows }, null, 2));
