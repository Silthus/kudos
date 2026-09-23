import { describe, expect, test } from "vitest";
import { signSlackRequest, slackManifest, verifySlackSignature } from "./slack";

const secret = "8f742231b10e8888abcd99yyyzzz85a5";

async function headersFor(body: string, timestamp: number, key = secret) {
  return new Headers({
    "x-slack-request-timestamp": String(timestamp),
    "x-slack-signature": await signSlackRequest(key, String(timestamp), body),
  });
}

describe("verifySlackSignature", () => {
  const now = Date.UTC(2026, 8, 23, 12);
  const ts = Math.floor(now / 1000);
  const body = "token=x&team_id=T1&text=me";

  test("accepts requests signed with the signing secret", async () => {
    expect(await verifySlackSignature(secret, await headersFor(body, ts), body, now)).toBe(true);
  });

  test("rejects a tampered body or a different secret", async () => {
    expect(await verifySlackSignature(secret, await headersFor(body, ts), `${body}&x=1`, now)).toBe(false);
    expect(await verifySlackSignature(secret, await headersFor(body, ts, "other"), body, now)).toBe(false);
  });

  test("rejects replays older than five minutes and missing headers", async () => {
    expect(await verifySlackSignature(secret, await headersFor(body, ts - 301), body, now)).toBe(false);
    expect(await verifySlackSignature(secret, new Headers(), body, now)).toBe(false);
  });
});

test("the manifest points every Slack surface at this deployment over HTTP", () => {
  const m = slackManifest("https://kudos.example");
  expect(m.settings.event_subscriptions.request_url).toBe("https://kudos.example/slack/events");
  expect(m.settings.socket_mode_enabled).toBe(false);
  expect(m.features.slash_commands[0].url).toBe("https://kudos.example/slack/commands");
  expect(m.oauth_config.redirect_urls).toContain("https://kudos.example/api/auth/callback/slack");
});
