// PROTOTYPE, throwaway: drives the real Convex Auth Slack handshake on a disposable local backend,
// playing the browser by hand, against mock-slack.ts in place of Slack.
// Run: node prototype/website-architecture/prove-sign-in.ts (backend on 127.0.0.1:3310/3311, see the brief).
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { issuer, startMockSlack, type NextSignIn } from "./mock-slack.ts";

const cloud = "http://127.0.0.1:3310";
const site = "http://127.0.0.1:3311";
const api = anyApi;
const results: string[] = [];

const stopMock = await startMockSlack();
try {
  await routesCoexist();
  const session = await happyPath();
  await codeCannotBeReplayed(session.code, session.verifier);
  await refusedSignIn("a foreign workspace", { team: "TOTHER", user: "U_ADA" });
  await refusedSignIn("a wrong nonce", { team: "TALLOWED", user: "U_ADA", wrongNonce: true });
  await refusedSignIn("a wrong audience", { team: "TALLOWED", user: "U_ADA", wrongAudience: true });
  await refusedSignIn("no state cookie", { team: "TALLOWED", user: "U_ADA" }, { dropCookies: true });
  await refusedSignIn("a tampered state", { team: "TALLOWED", user: "U_ADA" }, { tamperState: true });
  await refusedSignIn("neither state nor cookies (login CSRF)", { team: "TALLOWED", user: "U_ADA" }, { dropCookies: true, dropState: true });
  await verifierIsBoundToTheBrowser();
  await refreshThenSignOut(session.tokens);
} finally {
  stopMock();
}
console.log(results.join("\n"));
process.exitCode = results.some((line) => line.startsWith("FAIL")) ? 1 : 0;

async function routesCoexist() {
  const slack = await fetch(`${site}/slack/events`, { method: "POST", body: "{}" });
  check("POST /slack/events still answers an unsigned request with 401", slack.status === 401, slack.status);
  const root = await fetch(`${site}/`);
  check("GET / is served by static hosting", root.status === 200 || root.status === 503, `${root.status} ${root.headers.get("content-type")}`);
  const deepLink = await fetch(`${site}/profile`);
  check("GET /profile (a deep link) falls back to the SPA shell", deepLink.status === 200 || deepLink.status === 503, deepLink.status);
  const auth = await fetch(`${site}/api/auth/signin/slack`, { redirect: "manual" });
  check("GET /api/auth/signin/slack is Convex Auth's, not the static catch-all", auth.status === 500 || auth.status === 400, auth.status);
}

async function happyPath() {
  await nextSignIn({ team: "TALLOWED", user: "U_ADA", name: "Ada" });
  const { authorize, cookies, verifier } = await startSignIn("/profile");
  check("authorize goes to Slack's issuer", authorize.origin + authorize.pathname === `${issuer}/openid/connect/authorize`, authorize.pathname);
  check("authorize carries state", (authorize.searchParams.get("state") ?? "").length > 20, "");
  check("authorize carries nonce", (authorize.searchParams.get("nonce") ?? "").length > 20, "");
  check("authorize asks for openid profile", authorize.searchParams.get("scope") === "openid profile", authorize.searchParams.get("scope"));
  check("authorize pins the deployment's workspace", authorize.searchParams.get("team") === "TALLOWED", authorize.searchParams.get("team"));
  check("the callback is the deployment's /api/auth/callback/slack", authorize.searchParams.get("redirect_uri") === `${site}/api/auth/callback/slack`, authorize.searchParams.get("redirect_uri"));
  check("the handshake cookies are HttpOnly", cookies.every((cookie) => /HttpOnly/i.test(cookie.attributes)), cookies.map((c) => c.attributes).join(" | "));

  const landing = await finishAtSlack(authorize, cookies);
  const code = landing.searchParams.get("code");
  check("the callback lands on the website page that started sign-in", landing.pathname === "/profile", landing.toString().replace(/code=[^&]+/, "code=…"));
  check("the callback hands the browser a one-time code", code !== null, "");

  const client = new ConvexHttpClient(cloud);
  const tokens = await client.action(api.auth.signIn, { provider: "slack", params: { code }, verifier });
  check("the code and the browser's verifier become a session token", typeof tokens?.tokens?.token === "string", "");
  client.setAuth(tokens.tokens.token);
  const first = await client.query(api.website.profile.getMyProfile, {});
  check("right after a first sign-in the directory is being verified, or already knows the member", ["verifying", "member"].includes(first.kind), first.kind);
  const profile = await eventually(() => client.query(api.website.profile.getMyProfile, {}), (p) => p.kind === "member");
  check("once users.info answers, the member sees their own profile", profile.kind === "member" && profile.name === "Ada", JSON.stringify(profile));
  return { code: code!, verifier, tokens: tokens.tokens };
}

async function codeCannotBeReplayed(code: string, verifier: string) {
  const client = new ConvexHttpClient(cloud);
  const replay = await client.action(api.auth.signIn, { provider: "slack", params: { code }, verifier }).catch((error: Error) => error);
  check("the one-time code cannot be used twice", replay instanceof Error || replay?.tokens == null, String(replay).slice(0, 80));
}

async function refusedSignIn(label: string, who: NextSignIn, { dropCookies = false, tamperState = false, dropState = false } = {}) {
  await nextSignIn(who);
  const { authorize, cookies } = await startSignIn("/profile");
  if (tamperState) authorize.searchParams.set("state", "tampered");
  if (dropState) authorize.searchParams.delete("state");
  const landing = await finishAtSlack(authorize, dropCookies ? [] : cookies);
  check(`sign-in with ${label} gets no code`, landing.searchParams.get("code") === null, landing.toString());
}

async function verifierIsBoundToTheBrowser() {
  await nextSignIn({ team: "TALLOWED", user: "U_ADA", name: "Ada" });
  const { authorize, cookies } = await startSignIn("/profile");
  const landing = await finishAtSlack(authorize, cookies);
  const stranger = new ConvexHttpClient(cloud);
  const stolen = await stranger
    .action(api.auth.signIn, { provider: "slack", params: { code: landing.searchParams.get("code") }, verifier: "someone-elses-verifier" })
    .catch((error: Error) => error);
  check("a code stolen from the redirect is useless without the browser's verifier", stolen instanceof Error || stolen?.tokens == null, String(stolen).slice(0, 80));
}

async function refreshThenSignOut(tokens: { token: string; refreshToken: string }) {
  const client = new ConvexHttpClient(cloud);
  const refreshed = await client.action(api.auth.signIn, { refreshToken: tokens.refreshToken });
  check("the refresh token renews the session", typeof refreshed?.tokens?.token === "string", "");
  client.setAuth(refreshed.tokens.token);
  await client.action(api.auth.signOut, {});
  const after = await client.query(api.website.profile.getMyProfile, {});
  check("after sign-out, a still-unexpired token reads signed-out", after.kind === "signed-out", after.kind);
}

async function startSignIn(redirectTo: string) {
  const client = new ConvexHttpClient(cloud);
  const started = await client.action(api.auth.signIn, { provider: "slack", params: { redirectTo } });
  const response = await fetch(started.redirect, { redirect: "manual" });
  const cookies = response.headers.getSetCookie().map(parseCookie);
  return { authorize: new URL(response.headers.get("location")!), cookies, verifier: started.verifier as string };
}

async function finishAtSlack(authorize: URL, cookies: Cookie[]) {
  const atSlack = await fetch(authorize, { redirect: "manual" });
  const callback = new URL(atSlack.headers.get("location")!);
  const response = await fetch(callback, { redirect: "manual", headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") } });
  return new URL(response.headers.get("location")!);
}

async function nextSignIn(who: NextSignIn) {
  await fetch(`${issuer}/control/next`, { method: "POST", body: JSON.stringify(who) });
}

type Cookie = { name: string; value: string; attributes: string };

function parseCookie(header: string): Cookie {
  const [pair, ...attributes] = header.split(";");
  const [name, ...value] = pair!.split("=");
  return { name: name!.trim(), value: value.join("="), attributes: attributes.join(";").trim() };
}

async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean) {
  for (let tries = 0; tries < 20; tries++) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return read();
}

function check(claim: string, holds: boolean, detail: unknown) {
  results.push(`${holds ? "PASS" : "FAIL"}  ${claim}${holds ? "" : `  (${detail})`}`);
}
