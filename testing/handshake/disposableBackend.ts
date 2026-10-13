import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { allowedWorkspace, issuer } from "./mockSlackIssuer";

const backendVersion = "precompiled-2026-10-06-a3538c6";
const instanceName = "kudos-handshake";
const run = promisify(execFile);

export default async function startDisposableBackend() {
  if (process.env.HANDSHAKE_ENV_FILE) return;
  const directory = await mkdtemp(join(tmpdir(), "kudos-handshake-"));
  const [cloudPort, sitePort] = [await freePort(), await freePort()];
  const cloud = `http://127.0.0.1:${cloudPort}`;
  const site = `http://127.0.0.1:${sitePort}`;
  const binary = await backendBinary();
  const instanceSecret = randomBytes(32).toString("hex");
  const backend = spawn(binary, [
    ...["--instance-name", instanceName, "--instance-secret", instanceSecret],
    ...["--port", String(cloudPort), "--site-proxy-port", String(sitePort)],
    ...["--convex-origin", cloud, "--convex-site", site],
    ...["--local-storage", join(directory, "storage"), "--disable-beacon"],
    join(directory, "db.sqlite3"),
  ], { stdio: "ignore" });
  const stop = async () => {
    const exited = new Promise((resolve) => backend.once("exit", resolve));
    if (backend.exitCode === null && backend.kill()) await exited;
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await untilAnswering(`${cloud}/version`, backend);
    const envFile = join(directory, "deployment.env");
    await writeFile(envFile, `CONVEX_SELF_HOSTED_URL=${cloud}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${await adminKey(binary, instanceSecret)}\n`);
    const variables = join(directory, "variables.env");
    await writeFile(variables, await deploymentVariables(site));
    await convex(["env", "set", "--from-file", variables, "--env-file", envFile]);
    await convex(["deploy", "--yes", "--typecheck", "disable", "--codegen", "disable", "--env-file", envFile]);
    process.env.HANDSHAKE_ENV_FILE = envFile;
    process.env.HANDSHAKE_SITE_URL = site;
  } catch (failure) {
    await stop();
    throw failure;
  }
  return stop;
}

async function deploymentVariables(site: string) {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(publicKey)) }] });
  const signingKey = (await exportPKCS8(privateKey)).trimEnd().replace(/\n/g, " ");
  const variables = {
    SLACK_WORKSPACE_ID: allowedWorkspace,
    SLACK_OIDC_ISSUER: issuer,
    SLACK_API_URL: `${issuer}/api`,
    POSTHOG_HOST: issuer,
    AUTH_SLACK_ID: "mock-client",
    AUTH_SLACK_SECRET: "mock-client-secret",
    SITE_URL: site,
    JWT_PRIVATE_KEY: signingKey,
    JWKS: jwks,
    POSTHOG_PROJECT_TOKEN: "phc_handshake",
    POSTHOG_PERSONAL_API_KEY: "phx_handshake",
    SLACK_BOT_TOKEN: "xoxb-handshake",
    SLACK_SIGNING_SECRET: "handshake-signing-secret",
  };
  return Object.entries(variables)
    .map(([name, value]) => `${name}='${value}'`)
    .join("\n");
}

async function backendBinary() {
  if (process.env.CONVEX_LOCAL_BACKEND) return process.env.CONVEX_LOCAL_BACKEND;
  const directory = join(homedir(), ".cache", "convex", "binaries", backendVersion);
  const binary = join(directory, "convex-local-backend");
  if (existsSync(binary)) return binary;
  await mkdir(directory, { recursive: true });
  const archive = join(directory, "backend.zip");
  const download = await fetch(`https://github.com/get-convex/convex-backend/releases/download/${backendVersion}/convex-local-backend-x86_64-unknown-linux-gnu.zip`);
  if (!download.ok) throw new Error(`the local backend ${backendVersion} didn't download: ${download.status}`);
  await writeFile(archive, Buffer.from(await download.arrayBuffer()));
  await run("unzip", ["-o", archive, "-d", directory]);
  await rm(archive);
  await chmod(binary, 0o755);
  return binary;
}

async function adminKey(binary: string, instanceSecret: string) {
  const { stdout } = await run(binary, ["keygen", "admin-key", "--instance-name", instanceName, "--instance-secret", instanceSecret]);
  return stdout.trim().split("\n").at(-1)!;
}

async function convex(args: string[]) {
  await run("npx", ["--no", "--", "convex", ...args], { maxBuffer: 16 * 1024 * 1024 });
}

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("no free port"))));
    });
  });
}

async function untilAnswering(url: string, backend: ChildProcess, withinMs = 30_000) {
  const deadline = Date.now() + withinMs;
  while (Date.now() < deadline) {
    if (backend.exitCode !== null) throw new Error(`the local backend exited with ${backend.exitCode}`);
    if (await fetch(url).then((response) => response.ok, () => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`the local backend didn't answer ${url} within ${withinMs} ms`);
}
