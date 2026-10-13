import { convexAuth } from "@convex-dev/auth/server";
import { slackSignIn } from "./slack/signIn";
import { rememberSignedInMember } from "./website/signIn";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [slackSignIn()],
  callbacks: { createOrUpdateUser: rememberSignedInMember },
});
