import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { signingSecret } from "../../testing/signedSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { contentSecurityPolicy } from "./hosting";

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
const customEmojiPictures = ["https://emoji.slack-edge.com", "https://a.slack-edge.com"];
const slackPictureHosts = [uploadedSlackPhotos, gravatarPhotos, ...customEmojiPictures];

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

const todaysPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  `connect-src 'self' ${deploymentUrl} wss://happy-hog-123.convex.cloud`,
  `img-src 'self' ${slackPictureHosts.join(" ")} https://res.cloudinary.com`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

describe("the website runs only its own code", () => {
  test("without POSTHOG_HOST the policy is today's", () => {
    expect(contentSecurityPolicy(deploymentUrl, undefined)).toBe(todaysPolicy);
    expect(contentSecurityPolicy(deploymentUrl, "")).toBe(todaysPolicy);
  });

  test("PostHog's US host widens connect-src by the host and its assets host, and nothing else", () => {
    expect(contentSecurityPolicy(deploymentUrl, "https://us.i.posthog.com")).toBe(
      todaysPolicy.replace("wss://happy-hog-123.convex.cloud", "wss://happy-hog-123.convex.cloud https://us.i.posthog.com https://us-assets.i.posthog.com"),
    );
  });

  test("PostHog's EU host widens connect-src by the host and its assets host", () => {
    expect(contentSecurityPolicy(deploymentUrl, "https://eu.i.posthog.com")).toBe(
      todaysPolicy.replace("wss://happy-hog-123.convex.cloud", "wss://happy-hog-123.convex.cloud https://eu.i.posthog.com https://eu-assets.i.posthog.com"),
    );
  });

  test("a host of its own serves its own assets, so connect-src adds only that host", () => {
    expect(contentSecurityPolicy(deploymentUrl, "https://e.example.com/")).toBe(todaysPolicy.replace("wss://happy-hog-123.convex.cloud", "wss://happy-hog-123.convex.cloud https://e.example.com"));
  });

  test("an HTML response under a POSTHOG_HOST that isn't a URL is served with today's policy", async () => {
    vi.stubEnv("POSTHOG_HOST", "us.i.posthog.com");
    const t = testBackend();

    const response = await t.fetch("/", { method: "GET" });

    expect(response.headers.get("Content-Security-Policy")).toBe(todaysPolicy);
  });

  test("every HTML response carries the policy for the configured POSTHOG_HOST", async () => {
    vi.stubEnv("POSTHOG_HOST", "https://us.i.posthog.com");
    const t = testBackend();

    const response = await t.fetch("/", { method: "GET" });

    expect(response.headers.get("Content-Security-Policy")).toBe(contentSecurityPolicy(deploymentUrl, "https://us.i.posthog.com"));
    expect(cspOf(response).get("connect-src")).toEqual(["'self'", deploymentUrl, "wss://happy-hog-123.convex.cloud", "https://us.i.posthog.com", "https://us-assets.i.posthog.com"]);
    expect(cspOf(response).has("report-uri")).toBe(false);
    expect(cspOf(response).has("report-to")).toBe(false);
  });
});
