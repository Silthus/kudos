import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { signingSecret } from "../../testing/signedSlack";
import { testBackend } from "../../testing/slackBackend";

const deploymentUrl = "https://happy-hog-123.convex.cloud";

beforeEach(() => {
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("CONVEX_CLOUD_URL", deploymentUrl);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

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
    expect(csp.get("img-src")).toEqual(["'self'", "https://avatars.slack-edge.com", "https://res.cloudinary.com"]);
    expect(csp.get("font-src")).toEqual(["'self'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'none'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
  });

  test("a response that isn't HTML gets no policy", async () => {
    const t = testBackend();

    const response = await t.fetch("/assets/index-abc12345.js", { method: "GET" });

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
  });
});
