import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { signingSecret } from "../../testing/signedSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";

const deploymentUrl = "https://happy-hog-123.convex.cloud";

beforeEach(() => {
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("CONVEX_CLOUD_URL", deploymentUrl);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type ComponentRunner = { runInComponent: (componentPath: string, handler: (ctx: ComponentCtx) => Promise<void>) => Promise<void> };
type ComponentCtx = { storage: { store: (blob: Blob) => Promise<string> }; db: { insert: (table: string, document: Record<string, unknown>) => Promise<unknown> } };

async function aPublishedSite(t: Backend) {
  const indexHtml = "<!doctype html><title>HedgeHug</title>";
  await (t as unknown as ComponentRunner).runInComponent("staticHosting", async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([indexHtml], { type: "text/html" }));
    await ctx.db.insert("staticAssets", { path: "/index.html", storageId, contentType: "text/html; charset=utf-8", deploymentId: "build-1" });
  });
  vi.stubGlobal("fetch", async () => new Response(indexHtml));
}

function cspOf(response: Response) {
  const header = response.headers.get("Content-Security-Policy") ?? "";
  return new Map(
    header
      .split(";")
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources]),
  );
}

describe("WS26: the static catch-all comes after Slack's routes", () => {
  test("an unsigned POST /slack/events still gets 401", async () => {
    const t = testBackend();

    const response = await t.fetch("/slack/events", { method: "POST", body: "{}" });

    expect(response.status).toBe(401);
  });

  test("an unsigned POST /slack/commands still gets 401", async () => {
    const t = testBackend();

    const response = await t.fetch("/slack/commands", { method: "POST", body: "command=%2Fhedgehug" });

    expect(response.status).toBe(401);
  });
});

const uploadedSlackPhotos = "https://avatars.slack-edge.com";
const gravatarPhotos = "https://secure.gravatar.com";
const slackPictureHosts = [uploadedSlackPhotos, gravatarPhotos];

describe("WS25: every HTML response carries the strict Content Security Policy header", () => {
  test("GET / answers HTML with the policy", async () => {
    const t = testBackend();

    const response = await t.fetch("/", { method: "GET" });

    expect(response.headers.get("Content-Type")).toMatch(/^text\/html/);
    const csp = cspOf(response);
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("script-src")).toEqual(["'self'"]);
    expect(csp.get("style-src")).toEqual(["'self'"]);
    expect(csp.get("connect-src")).toEqual(["'self'", deploymentUrl, "wss://happy-hog-123.convex.cloud"]);
    expect(csp.get("img-src")).toEqual(["'self'", ...slackPictureHosts, "https://res.cloudinary.com"]);
    expect(csp.get("font-src")).toEqual(["'self'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'none'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
  });

  test("a deep SPA path like /profile answers the published index.html with the same policy as /", async () => {
    const t = testBackend();
    await aPublishedSite(t);

    const root = await t.fetch("/", { method: "GET" });
    const deepPath = await t.fetch("/profile", { method: "GET" });

    expect(deepPath.status).toBe(200);
    expect(deepPath.headers.get("Content-Type")).toMatch(/^text\/html/);
    expect(await deepPath.text()).toContain("<title>HedgeHug</title>");
    expect(cspOf(deepPath).get("default-src")).toEqual(["'self'"]);
    expect(deepPath.headers.get("Content-Security-Policy")).toBe(root.headers.get("Content-Security-Policy"));
  });

  test("a response that isn't HTML gets no policy", async () => {
    const t = testBackend();

    const response = await t.fetch("/assets/index-abc12345.js", { method: "GET" });

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
  });
});
