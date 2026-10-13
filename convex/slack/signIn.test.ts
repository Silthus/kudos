import { expect, test } from "vitest";
import { signedInProfile } from "./signIn";

const claims = { "https://slack.com/team_id": "T_ALLOWED", "https://slack.com/user_id": "U_ADA", name: "Ada", picture: "https://avatars/ada.png" };

test("a sign-in from the deployment's workspace becomes the chat identity the directory is keyed by", () => {
  expect(signedInProfile(claims, "T_ALLOWED")).toEqual({
    id: "T_ALLOWED/U_ADA",
    chatWorkspace: "T_ALLOWED",
    chatUser: "U_ADA",
    name: "Ada",
    image: "https://avatars/ada.png",
  });
});

test("a sign-in from another workspace is refused", () => {
  expect(() => signedInProfile({ ...claims, "https://slack.com/team_id": "T_OTHER" }, "T_ALLOWED")).toThrow(/not allowed/);
});

test.each(["https://slack.com/team_id", "https://slack.com/user_id"] as const)("a sign-in without %s is refused", (claim) => {
  expect(() => signedInProfile({ ...claims, [claim]: "" }, "T_ALLOWED")).toThrow(/no/);
});
