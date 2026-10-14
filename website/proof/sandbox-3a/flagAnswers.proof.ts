import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { flag } from "../../../convex/analytics/flags";
import { everyoneBoardFlag } from "../../../convex/leaderboard/flag";
import { xpLevels } from "../../../convex/progression/xpLevels";
import { unlocksFlag } from "../../../convex/unlocks/launch";
import { websiteFlag } from "../../../convex/website/flag";

type Deployment = { name: string; environment: string; definitions: string; workspaceKey: string; expected: boolean };

const flags = [websiteFlag, everyoneBoardFlag, xpLevels, unlocksFlag];

const deployments: Deployment[] = [
  { name: "<sandbox>", environment: "sandbox", definitions: required("SANDBOX_DEFINITIONS"), workspaceKey: required("SANDBOX_WORKSPACE_KEY"), expected: true },
  { name: "<production>", environment: "production", definitions: required("PRODUCTION_DEFINITIONS"), workspaceKey: required("PRODUCTION_WORKSPACE_KEY"), expected: false },
  { name: "<production> read as if it were the sandbox", environment: "sandbox", definitions: required("PRODUCTION_DEFINITIONS"), workspaceKey: required("PRODUCTION_WORKSPACE_KEY"), expected: true },
];

test.each(deployments)("$name answers $expected for every slice flag under its own environment and workspace key", async (deployment) => {
  const answers = await answersOn(deployment);
  console.log(deployment.name, `KUDOS_ENVIRONMENT=${deployment.environment}`, JSON.stringify(answers));
  expect(answers).toEqual(Object.fromEntries(flags.map(({ key }) => [key, deployment.expected])));
});

async function answersOn(deployment: Deployment) {
  process.env.KUDOS_ENVIRONMENT = deployment.environment;
  process.env.POSTHOG_PERSONAL_API_KEY = "set on the deployment";
  const ctx = readOnlyContext(deployment);
  const entries = await Promise.all(flags.map(async (read) => [read.key, await flag(ctx as never, read, { workspace: "the sign-in workspace" })] as const));
  return Object.fromEntries(entries);
}

function readOnlyContext({ definitions, workspaceKey }: Deployment) {
  const cachedDefinitions = JSON.parse(readFileSync(definitions, "utf8"));
  const workspaceKeyRow = { workspaceKey };
  return {
    db: { query: () => ({ withIndex: () => ({ unique: async () => workspaceKeyRow }) }) },
    runQuery: async () => cachedDefinitions,
  };
}

function required(name: string) {
  const value = process.env[name];
  if (value === undefined) throw new Error(`${name} is not set`);
  return value;
}
