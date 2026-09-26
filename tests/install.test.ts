import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setupConvex } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let exchanged: Record<string, string> | null;

beforeEach(() => {
  t = setupConvex();
  vi.stubEnv("SLACK_CLIENT_ID", "123.456");
  vi.stubEnv("SLACK_CLIENT_SECRET", "secret");
  vi.stubEnv("SITE_URL", "https://kudos.example");
  exchanged = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(url).split("/api/")[1];
      if (method === "oauth.v2.access") {
        exchanged = Object.fromEntries(new URLSearchParams(String(init?.body)));
        return Response.json(
          exchanged.code === "good"
            ? { ok: true, access_token: "xoxb-new", bot_user_id: "UBOT", app_id: "A1", scope: "chat:write", team: { id: "TNEW", name: "Acme" }, authed_user: { id: "UINSTALLER" } }
            : { ok: false, error: "invalid_code" },
        );
      }
      if (method === "users.list") return Response.json({ ok: true, members: [{ id: "UINSTALLER", name: "ina", is_admin: true, profile: { real_name: "Ina" } }] });
      if (method === "team.info") return Response.json({ ok: true, team: { name: "Acme", icon: { image_132: "https://img" } } });
      return Response.json({ ok: true });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const COOKIE = "__Secure-kudos_install_state";

/** Starts an install like a browser: follows nothing, keeps the state cookie it was given. */
async function startInstall() {
  const res = await t.fetch("/slack/install", { redirect: "manual" });
  expect(res.status).toBe(302);
  const url = new URL(res.headers.get("location")!);
  const state = url.searchParams.get("state")!;
  return { url, state, setCookie: res.headers.get("set-cookie") ?? "", cookie: `${COOKIE}=${state}` };
}

/** Slack sends the browser back to the callback; `cookie` is whatever that browser holds. */
async function callback(query: string, cookie?: string) {
  return await t.fetch(`/slack/oauth/callback?${query}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
}

describe("installing Kudos into a workspace", () => {
  test("/slack/install sends the admin to Slack's OAuth screen with a one-time state", async () => {
    const { url } = await startInstall();
    expect(url.origin + url.pathname).toBe("https://slack.com/oauth/v2/authorize");
    expect(url.searchParams.get("client_id")).toBe("123.456");
    expect(url.searchParams.get("redirect_uri")).toBe("https://kudos.example/slack/oauth/callback");
    expect(url.searchParams.get("scope")).toContain("chat:write");
    expect(url.searchParams.get("state")).toMatch(/^[0-9a-f]{48}$/);
  });

  test("the state is bound to the browser that started the install, in a cookie scripts can't read", async () => {
    const { state, setCookie } = await startInstall();
    expect(setCookie).toContain(`${COOKIE}=${state}`);
    expect(setCookie).toMatch(/; HttpOnly/);
    expect(setCookie).toMatch(/; Secure/);
    expect(setCookie).toMatch(/; SameSite=Lax/); // sent on Slack's top-level redirect back
    expect(setCookie).toMatch(/; Path=\/slack\/oauth\/callback/);
    expect(setCookie).toMatch(/; Max-Age=600/);
  });

  test("the callback stores the bot token, makes the installer admin and imports members", async () => {
    const { state, cookie } = await startInstall();
    const res = await callback(`code=good&state=${state}`, cookie);
    expect(res.headers.get("location")).toBe("https://kudos.example/?installed=Acme&ws=TNEW");
    expect(res.headers.get("set-cookie")).toMatch(new RegExp(`^${COOKIE}=; .*Max-Age=0`)); // spent
    expect(exchanged).toMatchObject({ code: "good", client_id: "123.456", redirect_uri: "https://kudos.example/slack/oauth/callback" });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const { install, installer, workspace } = await t.run(async (ctx) => ({
      workspace: await ctx.db.query("workspaces").first(),
      install: await ctx.db.query("slackInstallations").first(),
      installer: await ctx.db.query("members").filter((q) => q.eq(q.field("slackUserId"), "UINSTALLER")).first(),
    }));
    expect(workspace).toMatchObject({ slackTeamId: "TNEW", name: "Acme", iconUrl: "https://img", status: "active" });
    // The shared world's seed (#154): a uint32 drawn at install.
    expect(Number.isInteger(workspace!.worldSeed) && workspace!.worldSeed! >= 0 && workspace!.worldSeed! < 2 ** 32).toBe(true);
    expect(install).toMatchObject({ botToken: "xoxb-new", installedBySlackUserId: "UINSTALLER", scope: "chat:write" });
    expect(installer).toMatchObject({ isAdmin: true, name: "Ina" });
  });

  test("a forged or reused state is refused", async () => {
    const res = await callback("code=good&state=forged", `${COOKIE}=forged`);
    expect(res.headers.get("location")).toBe("https://kudos.example/?install_error=expired_state");
    expect(exchanged).toBeNull();

    const { state, cookie } = await startInstall();
    await callback(`code=good&state=${state}`, cookie);
    exchanged = null;
    const again = await callback(`code=good&state=${state}`, cookie);
    expect(again.headers.get("location")).toBe("https://kudos.example/?install_error=expired_state");
    expect(exchanged).toBeNull();
  });

  test("a callback link opened in another browser is refused, so nobody can install into your session", async () => {
    const attacker = await startInstall(); // a real state, but its cookie stays in the attacker's browser
    const victim = await startInstall();
    for (const cookie of [undefined, victim.cookie]) {
      const res = await callback(`code=good&state=${attacker.state}`, cookie);
      expect(res.headers.get("location")).toBe("https://kudos.example/?install_error=state_mismatch");
    }
    expect(exchanged).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("slackInstallations").collect())).toEqual([]);
  });

  test("Slack errors are passed back to the landing page", async () => {
    const { state, cookie } = await startInstall();
    const res = await callback(`code=bad&state=${state}`, cookie);
    expect(res.headers.get("location")).toBe("https://kudos.example/?install_error=invalid_code");
  });
});
