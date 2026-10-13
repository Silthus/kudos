import Slack, { type SlackProfile } from "@auth/core/providers/slack";

export type ChatIdentity = { workspace: string; user: string };

export type SignedInProfile = { id: string; chatWorkspace: string; chatUser: string; name?: string; image?: string };

type SlackClaims = Partial<Record<"https://slack.com/team_id" | "https://slack.com/user_id" | "name" | "picture", unknown>>;

export function slackSignIn() {
  const workspace = process.env.SLACK_WORKSPACE_ID;
  return Slack({
    issuer: process.env.SLACK_OIDC_ISSUER ?? "https://slack.com",
    checks: ["state", "nonce"],
    authorization: { params: { scope: "openid profile", ...(workspace && { team: workspace }) } },
    profile: (claims: SlackProfile) => signedInProfile(claims, required("SLACK_WORKSPACE_ID")),
  });
}

export function signedInProfile(claims: SlackClaims, allowedWorkspace: string): SignedInProfile {
  const workspace = nonEmpty(claims["https://slack.com/team_id"], "team_id");
  const user = nonEmpty(claims["https://slack.com/user_id"], "user_id");
  if (workspace !== allowedWorkspace) throw new Error(`sign-in from workspace ${workspace} is not allowed here`);
  return {
    id: `${workspace}/${user}`,
    chatWorkspace: workspace,
    chatUser: user,
    ...(typeof claims.name === "string" && { name: claims.name }),
    ...(typeof claims.picture === "string" && { image: claims.picture }),
  };
}

function nonEmpty(value: unknown, claim: string) {
  if (typeof value !== "string" || value === "") throw new Error(`Slack sent no ${claim} claim`);
  return value;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
