// PROTOTYPE, throwaway: a stand-in for Slack's OpenID Connect issuer and users.info, on 127.0.0.1:3399.
// The driver tells it who signs in next and how to misbehave, so the real Convex Auth handshake can be proven
// without a Slack app. Never point a real deployment at it.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

export const issuer = "http://127.0.0.1:3399";
const clientId = "prototype-client";
const clientSecret = "prototype-client-secret";

export type NextSignIn = { team: string; user: string; name?: string; wrongNonce?: boolean; wrongAudience?: boolean };

const keys = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(keys.publicKey)), kid: "mock", alg: "RS256", use: "sig" };
const directory: Record<string, { team_id: string; deleted?: boolean; tz?: string }> = {
  U_ADA: { team_id: "TALLOWED", tz: "Europe/Berlin" },
};
const codes = new Map<string, NextSignIn & { nonce: string; redirectUri: string }>();
let next: NextSignIn = { team: "TALLOWED", user: "U_ADA", name: "Ada" };

export function startMockSlack() {
  const server = createServer((request, response) => void route(request, response));
  return new Promise<() => void>((resolve) => server.listen(3399, "127.0.0.1", () => resolve(() => server.close())));
}

async function route(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", issuer);
  if (url.pathname === "/.well-known/openid-configuration") return json(response, discovery());
  if (url.pathname === "/control/next") return json(response, (next = JSON.parse(await body(request))));
  if (url.pathname === "/openid/connect/authorize") return authorize(url, response);
  if (url.pathname === "/api/openid.connect.token") return token(new URLSearchParams(await body(request)), request, response);
  if (url.pathname === "/jwks") return json(response, { keys: [jwk] });
  if (url.pathname === "/api/users.info") return usersInfo(url, response);
  json(response, { ok: false, error: "unknown_method" }, 404);
}

function discovery() {
  return {
    issuer,
    authorization_endpoint: `${issuer}/openid/connect/authorize`,
    token_endpoint: `${issuer}/api/openid.connect.token`,
    userinfo_endpoint: `${issuer}/api/openid.connect.userInfo`,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email"],
  };
}

function authorize(url: URL, response: ServerResponse) {
  const code = crypto.randomUUID();
  const redirectUri = url.searchParams.get("redirect_uri")!;
  codes.set(code, { ...next, nonce: url.searchParams.get("nonce") ?? "", redirectUri });
  const back = new URL(redirectUri);
  back.searchParams.set("code", code);
  const state = url.searchParams.get("state");
  if (state !== null) back.searchParams.set("state", state);
  response.writeHead(302, { location: back.toString() }).end();
}

async function token(form: URLSearchParams, request: IncomingMessage, response: ServerResponse) {
  const [id, secret] = basicCredentials(request) ?? [form.get("client_id"), form.get("client_secret")];
  if (id !== clientId || secret !== clientSecret) return json(response, { ok: false, error: "invalid_client" }, 401);
  const grant = codes.get(form.get("code") ?? "");
  codes.delete(form.get("code") ?? "");
  if (grant === undefined || grant.redirectUri !== form.get("redirect_uri")) return json(response, { ok: false, error: "invalid_code" }, 400);

  const idToken = await new SignJWT({
    nonce: grant.wrongNonce ? "not-the-nonce-you-sent" : grant.nonce,
    "https://slack.com/team_id": grant.team,
    "https://slack.com/user_id": grant.user,
    ...(grant.name && { name: grant.name }),
  })
    .setProtectedHeader({ alg: "RS256", kid: "mock" })
    .setIssuer(issuer)
    .setAudience(grant.wrongAudience ? "someone-else" : clientId)
    .setSubject(grant.user)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
  json(response, { ok: true, access_token: "xoxp-mock", token_type: "Bearer", id_token: idToken });
}

function usersInfo(url: URL, response: ServerResponse) {
  const user = url.searchParams.get("user") ?? "";
  const known = directory[user];
  if (known === undefined) return json(response, { ok: false, error: "user_not_found" });
  json(response, { ok: true, user: { id: user, ...known } });
}

function basicCredentials(request: IncomingMessage) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Basic ")) return null;
  return Buffer.from(header.slice(6), "base64").toString().split(":").map(decodeURIComponent);
}

function body(request: IncomingMessage) {
  return new Promise<string>((resolve) => {
    let text = "";
    request.on("data", (chunk) => (text += chunk)).on("end", () => resolve(text));
  });
}

function json(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(value));
}
