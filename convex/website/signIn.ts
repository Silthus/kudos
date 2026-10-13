import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import { allowedSignIn } from "../slack/signIn";
import { verifyLater } from "../slack/verifyMember";
import { lookup } from "../workspace/directory";
import { websiteOpen } from "./flag";

type SignIn = { existingUserId: Id<"users"> | null; profile: Record<string, unknown> };

export async function rememberSignedInMember(ctx: GenericMutationCtx<DataModel>, { existingUserId, profile }: SignIn): Promise<Id<"users">> {
  if (!(await websiteOpen(ctx))) throw new Error("the website is closed, so nobody signs in");
  const signedIn = allowedSignIn(profile);
  const chatIdentity = { workspace: signedIn.chatWorkspace, user: signedIn.chatUser };
  if ((await lookup(ctx, chatIdentity.workspace, chatIdentity.user)) === undefined) {
    await verifyLater(ctx, chatIdentity.workspace, chatIdentity.user);
  }
  const display = { name: signedIn.name, givenName: signedIn.givenName, familyName: signedIn.familyName, image: signedIn.image };
  if (existingUserId === null) return ctx.db.insert("users", { ...display, chatIdentity });
  await ctx.db.replace(existingUserId, { ...display, chatIdentity });
  return existingUserId;
}
