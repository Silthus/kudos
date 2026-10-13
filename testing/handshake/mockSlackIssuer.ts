import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

export const mockPort = Number(process.env.MOCK_SLACK_PORT ?? 3412);
export const issuer = `http://127.0.0.1:${mockPort}`;
export const allowedWorkspace = "TALLOWED";
const clientId = "mock-client";
const clientSecret = "mock-client-secret";

export type NextSignIn = { team: string; user: string; name?: string; wrongNonce?: boolean; wrongAudience?: boolean };

type Grant = NextSignIn & { nonce: string; redirectUri: string };

const keys = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(keys.publicKey)), kid: "mock", alg: "RS256", use: "sig" };

export class MockSlackIssuer {
  private readonly directory = new Map<string, { team_id: string; deleted?: boolean; tz?: string }>([
    ["U_ADA", { team_id: allowedWorkspace, tz: "Europe/Berlin" }],
    ["U_GONE", { team_id: allowedWorkspace, deleted: true }],
  ]);
  private readonly grants = new Map<string, Grant>();
  private next: NextSignIn = { team: allowedWorkspace, user: "U_ADA", name: "Ada Lovelace" };
  private websiteOpen = true;
  readonly usersInfoCalls: string[] = [];

  signsInNext(who: NextSignIn) {
    this.next = who;
  }

  switchWebsite(open: boolean) {
    this.websiteOpen = open;
  }

  start() {
    const server = createServer((request, response) => void this.route(request, response));
    return new Promise<() => Promise<void>>((resolve, reject) => {
      server.once("error", reject);
      server.listen(mockPort, "127.0.0.1", () => resolve(() => new Promise((closed) => server.close(() => closed()))));
    });
  }

  private async route(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", issuer);
    if (url.pathname === "/control/next") return json(response, this.signsInNext(JSON.parse(await body(request))));
    if (url.pathname === "/control/website") return json(response, this.switchWebsite(JSON.parse(await body(request)).open));
    if (url.pathname === "/.well-known/openid-configuration") return json(response, discovery());
    if (url.pathname === "/openid/connect/authorize") return this.authorize(url, response);
    if (url.pathname === "/api/openid.connect.token") return this.token(new URLSearchParams(await body(request)), request, response);
    if (url.pathname === "/jwks") return json(response, { keys: [jwk] });
    if (url.pathname === "/api/users.info") return this.usersInfo(url, response);
    if (url.pathname === "/flags/definitions") return json(response, this.flagDefinitions());
    if (url.pathname.startsWith("/api/")) return json(response, { ok: true });
    json(response, { status: 1 });
  }

  private authorize(url: URL, response: ServerResponse) {
    const code = crypto.randomUUID();
    const redirectUri = url.searchParams.get("redirect_uri") ?? "";
    this.grants.set(code, { ...this.next, nonce: url.searchParams.get("nonce") ?? "", redirectUri });
    const back = new URL(redirectUri);
    back.searchParams.set("code", code);
    const state = url.searchParams.get("state");
    if (state !== null) back.searchParams.set("state", state);
    response.writeHead(302, { location: back.toString() }).end();
  }

  private async token(form: URLSearchParams, request: IncomingMessage, response: ServerResponse) {
    const [id, secret] = basicCredentials(request) ?? [form.get("client_id"), form.get("client_secret")];
    if (id !== clientId || secret !== clientSecret) return json(response, { ok: false, error: "invalid_client" }, 401);
    const code = form.get("code") ?? "";
    const grant = this.grants.get(code);
    this.grants.delete(code);
    if (grant === undefined || grant.redirectUri !== form.get("redirect_uri")) return json(response, { ok: false, error: "invalid_code" }, 400);
    json(response, { ok: true, access_token: "xoxp-mock", token_type: "Bearer", id_token: await idTokenOf(grant) });
  }

  private usersInfo(url: URL, response: ServerResponse) {
    const user = url.searchParams.get("user") ?? "";
    this.usersInfoCalls.push(user);
    const known = this.directory.get(user);
    if (known === undefined) return json(response, { ok: false, error: "user_not_found" });
    json(response, { ok: true, user: { id: user, ...known } });
  }

  private flagDefinitions() {
    const flag = { id: 1, key: "website", name: "website", deleted: false, active: this.websiteOpen, ensure_experience_continuity: false };
    const filters = { groups: [{ properties: [], rollout_percentage: 100 }] };
    return { flags: [{ ...flag, filters }], group_type_mapping: {}, cohorts: {} };
  }
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

function idTokenOf(grant: Grant) {
  return new SignJWT({
    nonce: grant.wrongNonce ? "not-the-nonce-you-sent" : grant.nonce,
    "https://slack.com/team_id": grant.team,
    "https://slack.com/user_id": grant.user,
    ...(grant.name && { name: grant.name }),
  })
    .setProtectedHeader({ alg: "RS256", kid: "mock" })
    .setIssuer(issuer)
    .setAudience(grant.wrongAudience ? "another-client" : clientId)
    .setSubject(grant.user)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
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
