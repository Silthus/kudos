import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { ConvexHttpClient } from "convex/browser";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { MyProfile } from "../../convex/website/profile";
import { allowedWorkspace, issuer, MockSlackIssuer, type NextSignIn } from "./mockSlackIssuer";

const envFile = required("HANDSHAKE_ENV_FILE");
const cloud = /^CONVEX_SELF_HOSTED_URL=(.+)$/m.exec(readFileSync(envFile, "utf8"))?.[1]?.trim() ?? "";
const site = required("HANDSHAKE_SITE_URL");
const ada: NextSignIn = { team: allowedWorkspace, user: "U_ADA", name: "Ada Lovelace" };

const slack = new MockSlackIssuer();
let stopSlack: () => Promise<void>;

beforeAll(async () => {
  stopSlack = await slack.start();
  await convexRun("website/flag:prepareWebsiteFlag");
});

afterAll(() => stopSlack());

beforeEach(() => switchWebsite(true));

describe("WS26: the routes coexist", () => {
  test("the Slack route still refuses an unsigned request", async () => {
    expect((await fetch(`${site}/slack/events`, { method: "POST", body: "{}" })).status).toBe(401);
  });

  test("the sign-in route is Convex Auth's, not the static catch-all", async () => {
    const response = await fetch(`${site}/api/auth/signin/slack`, { redirect: "manual" });
    expect(response.headers.get("content-type") ?? "").not.toMatch(/text\/html/);
    expect(response.headers.get("content-security-policy")).toBeNull();
  });
});

describe("WS5 L-W1: a member signs in with Slack", () => {
  test("Slack is asked for openid profile in the deployment's workspace, with state and nonce, and the member lands home", async () => {
    slack.signsInNext(ada);
    const { authorize, cookies, verifier } = await startSignIn();

    expect(authorize.origin + authorize.pathname).toBe(`${issuer}/openid/connect/authorize`);
    expect(authorize.searchParams.get("scope")).toBe("openid profile");
    expect(authorize.searchParams.get("team")).toBe(allowedWorkspace);
    expect(authorize.searchParams.get("state")?.length).toBeGreaterThan(20);
    expect(authorize.searchParams.get("nonce")?.length).toBeGreaterThan(20);
    expect(authorize.searchParams.get("redirect_uri")).toBe(`${site}/api/auth/callback/slack`);
    expect(cookies.every((cookie) => /HttpOnly/i.test(cookie.attributes))).toBe(true);

    const landing = await finishAtSlack(authorize, cookies);
    expect(landing.origin + landing.pathname).toBe(`${site}/`);
    const session = await redeem(landing, verifier);

    expect(await eventuallyReads(session.client, "member")).toEqual({ kind: "member", name: "Ada Lovelace", face: { kind: "initials", initials: "AL" } });
  });
});

describe("WS6: eight refusals create no session", () => {
  test.each<[string, NextSignIn, Tampering]>([
    ["a foreign workspace", { ...ada, team: "TOTHER" }, {}],
    ["a wrong nonce", { ...ada, wrongNonce: true }, {}],
    ["another client's token", { ...ada, wrongAudience: true }, {}],
    ["a tampered state", ada, { tamperState: true }],
    ["a missing state cookie", ada, { dropCookies: true }],
    ["login CSRF, with neither state nor cookies", ada, { dropCookies: true, dropState: true }],
  ])("sign-in with %s gets no code", async (_label, who, tampering) => {
    slack.signsInNext(who);
    const { authorize, cookies } = await startSignIn();
    const landing = await finishAtSlack(tampered(authorize, tampering), tampering.dropCookies ? [] : cookies);

    expect(landing.searchParams.get("code")).toBeNull();
  });

  test("a one-time code can't be redeemed twice", async () => {
    slack.signsInNext(ada);
    const { authorize, cookies, verifier } = await startSignIn();
    const landing = await finishAtSlack(authorize, cookies);
    await redeem(landing, verifier);

    expect(await redemptionOf(landing, verifier)).toBeNull();
  });

  test("a code stolen from the redirect is useless without the browser's verifier", async () => {
    slack.signsInNext(ada);
    const { authorize, cookies } = await startSignIn();
    const landing = await finishAtSlack(authorize, cookies);

    expect(await redemptionOf(landing, "someone-elses-verifier")).toBeNull();
  });
});

describe("WS3: while the website is closed, nobody signs in and every session reads closed", () => {
  test("the callback refuses while the flag is off", async () => {
    await switchWebsite(false);
    slack.signsInNext(ada);
    const { authorize, cookies } = await startSignIn();

    expect((await finishAtSlack(authorize, cookies)).searchParams.get("code")).toBeNull();
  });

  test("switched off between initiation and the callback, the callback refuses", async () => {
    slack.signsInNext(ada);
    const { authorize, cookies } = await startSignIn();
    await switchWebsite(false);

    expect((await finishAtSlack(authorize, cookies)).searchParams.get("code")).toBeNull();
  });

  test("switched off between the callback and redeeming the code, the session reads closed", async () => {
    slack.signsInNext(ada);
    const { authorize, cookies, verifier } = await startSignIn();
    const landing = await finishAtSlack(authorize, cookies);
    await switchWebsite(false);

    const session = await redeem(landing, verifier);

    expect(await profileOf(session.client)).toEqual({ kind: "closed" });
  });

  test("switched off after sign-in, an existing session and one refreshed later both read closed", async () => {
    const session = await signedIn(ada);
    await eventuallyReads(session.client, "member");
    await switchWebsite(false);

    expect(await profileOf(session.client)).toEqual({ kind: "closed" });
    expect(await profileOf(await refreshed(session.refreshToken))).toEqual({ kind: "closed" });
  });
});

describe("WS8: a person the directory doesn't know yet is verified", () => {
  test("after three failed lookups the person reads unverified, never a member", async () => {
    const session = await signedIn({ ...ada, user: "U_NEWCOMER", name: "Newcomer" });

    expect(await profileOf(session.client)).toEqual({ kind: "verifying" });
    expect(await eventuallyReads(session.client, "unverified", 15_000)).toEqual({ kind: "unverified" });
    expect(slack.usersInfoCalls.filter((user) => user === "U_NEWCOMER")).toHaveLength(3);
  });
});

describe("WS9: sessions", () => {
  test("a refreshed session reads the member, and after sign-out a still-unexpired token reads signed out", async () => {
    const session = await signedIn(ada);
    const renewed = await refreshed(session.refreshToken);
    expect((await eventuallyReads(renewed, "member")).kind).toBe("member");

    await renewed.action(api.auth.signOut, {});

    expect(await profileOf(renewed)).toEqual({ kind: "signed-out" });
  });
});

type Cookie = { name: string; value: string; attributes: string };
type Tampering = { tamperState?: boolean; dropState?: boolean; dropCookies?: boolean };
type Session = { client: ConvexHttpClient; refreshToken: string };

async function signedIn(who: NextSignIn): Promise<Session> {
  slack.signsInNext(who);
  const { authorize, cookies, verifier } = await startSignIn();
  return redeem(await finishAtSlack(authorize, cookies), verifier);
}

async function startSignIn() {
  const started = await new ConvexHttpClient(cloud).action(api.auth.signIn, { provider: "slack", params: { redirectTo: "/" } });
  const response = await fetch(started.redirect!, { redirect: "manual" });
  return { authorize: new URL(response.headers.get("location")!), cookies: response.headers.getSetCookie().map(parseCookie), verifier: started.verifier! };
}

async function finishAtSlack(authorize: URL, cookies: Cookie[]) {
  const atSlack = await fetch(authorize, { redirect: "manual" });
  const callback = new URL(atSlack.headers.get("location")!);
  const response = await fetch(callback, { redirect: "manual", headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") } });
  return new URL(response.headers.get("location")!);
}

async function redeem(landing: URL, verifier: string): Promise<Session> {
  const tokens = await redemptionOf(landing, verifier);
  if (tokens === null) throw new Error("the code and verifier became no session");
  const client = new ConvexHttpClient(cloud);
  client.setAuth(tokens.token);
  return { client, refreshToken: tokens.refreshToken };
}

async function redemptionOf(landing: URL, verifier: string) {
  const code = landing.searchParams.get("code");
  const answer = await new ConvexHttpClient(cloud).action(api.auth.signIn, { provider: "slack", params: { code }, verifier }).catch(() => null);
  return answer?.tokens ?? null;
}

async function refreshed(refreshToken: string) {
  const answer = await new ConvexHttpClient(cloud).action(api.auth.signIn, { refreshToken });
  const client = new ConvexHttpClient(cloud);
  client.setAuth(answer.tokens!.token);
  return client;
}

function profileOf(client: ConvexHttpClient): Promise<MyProfile> {
  return client.query(api.website.profile.getMyProfile, {});
}

async function eventuallyReads(client: ConvexHttpClient, kind: MyProfile["kind"], withinMs = 10_000) {
  const deadline = Date.now() + withinMs;
  for (;;) {
    const profile = await profileOf(client);
    if (profile.kind === kind || Date.now() > deadline) return profile;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function switchWebsite(open: boolean) {
  slack.switchWebsite(open);
  await convexRun("lib:refreshFlagDefinitions", "posthog");
}

async function convexRun(functionName: string, component?: string) {
  const componentArgs = component ? ["--component", component] : [];
  await promisify(execFile)("npx", ["--no", "--", "convex", "run", ...componentArgs, functionName, "{}", "--env-file", envFile]);
}

function tampered(authorize: URL, { tamperState, dropState }: Tampering) {
  const url = new URL(authorize);
  if (tamperState) url.searchParams.set("state", "tampered");
  if (dropState) url.searchParams.delete("state");
  return url;
}

function parseCookie(header: string): Cookie {
  const [pair, ...attributes] = header.split(";");
  const [name, ...value] = pair!.split("=");
  return { name: name!.trim(), value: value.join("="), attributes: attributes.join(";").trim() };
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: the handshake test runs against a disposable local backend (see testing/handshake/README.md)`);
  return value;
}
