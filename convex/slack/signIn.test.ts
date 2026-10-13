import { afterEach, describe, expect, test, vi } from "vitest";
import { signedInProfile, slackSignIn } from "./signIn";

const claims = {
  "https://slack.com/team_id": "T1",
  "https://slack.com/user_id": "U_JUNO",
  name: "Juno Whitlock",
  given_name: "Juno",
  family_name: "Whitlock",
  picture: "https://avatars.slack-edge.com/juno.png",
};

afterEach(() => vi.unstubAllEnvs());

describe("WS5 L-W1: the Slack provider asks for exactly what the manifests declare", () => {
  test("it checks state and nonce, asks only for openid profile, and opens the deployment's workspace", () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
    const { options } = slackSignIn();

    expect(options?.checks).toEqual(["state", "nonce"]);
    expect(options?.authorization).toEqual({ params: { scope: "openid profile", team: "T1" } });
  });

  test("with no SLACK_WORKSPACE_ID it still asks only for openid profile and pins no workspace", () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "");

    expect(slackSignIn().options?.authorization).toEqual({ params: { scope: "openid profile" } });
  });
});

describe("WS6 WS7: a sign-in becomes the chat identity the directory is keyed by, or nothing", () => {
  test("a sign-in from the deployment's workspace is keyed by the Slack pair and keeps the display claims", () => {
    expect(signedInProfile(claims, "T1")).toEqual({
      id: "T1/U_JUNO",
      chatWorkspace: "T1",
      chatUser: "U_JUNO",
      name: "Juno Whitlock",
      givenName: "Juno",
      familyName: "Whitlock",
      image: "https://avatars.slack-edge.com/juno.png",
    });
  });

  test("a sign-in from another workspace is refused", () => {
    expect(() => signedInProfile({ ...claims, "https://slack.com/team_id": "T_OTHER" }, "T1")).toThrow(/another workspace/);
  });

  test("no allowed workspace refuses every sign-in", () => {
    expect(() => signedInProfile(claims, undefined)).toThrow(/SLACK_WORKSPACE_ID/);
  });

  test.each(["https://slack.com/team_id", "https://slack.com/user_id"] as const)("an empty %s claim is refused", (claim) => {
    expect(() => signedInProfile({ ...claims, [claim]: " " }, "T1")).toThrow(/no/);
    expect(() => signedInProfile({ ...claims, [claim]: undefined }, "T1")).toThrow(/no/);
  });
});
