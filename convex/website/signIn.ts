import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { allowedSignIn } from "../slack/signIn";
import { verifyLater } from "../slack/verifyMember";
import { lookup, type MemberFacts } from "../workspace/directory";
import { websiteOpen, websiteShownTo } from "./flag";

type SignIn = { existingUserId: Id<"users"> | null; profile: Record<string, unknown> };

export async function rememberSignedInMember(ctx: GenericMutationCtx<DataModel>, { existingUserId, profile }: SignIn): Promise<Id<"users">> {
  const signedIn = allowedSignIn(profile);
  const chatIdentity = { workspace: signedIn.chatWorkspace, user: signedIn.chatUser };
  const person = await lookup(ctx, chatIdentity.workspace, chatIdentity.user);
  if (!(await admitted(ctx, person))) throw new Error("the website is closed, so nobody signs in");
  if (person === undefined) await verifyLater(ctx, chatIdentity.workspace, chatIdentity.user);
  const display = { name: signedIn.name, givenName: signedIn.givenName, familyName: signedIn.familyName, image: signedIn.image };
  if (existingUserId === null) return ctx.db.insert("users", { ...display, chatIdentity });
  await ctx.db.replace(existingUserId, { ...display, chatIdentity });
  return existingUserId;
}

async function admitted(ctx: MutationCtx, person: MemberFacts | undefined) {
  const shownToMember = person?.kind === "member" && (await websiteShownTo(ctx, person.member));
  return shownToMember || (await websiteOpen(ctx));
}
