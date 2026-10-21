import type { GenericMutationCtx, WithoutSystemFields } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { earnWelcomeItem } from "../items/welcome";
import { allowedSignIn } from "../slack/signIn";
import { verifyLater } from "../slack/verifyMember";
import { lookup, type MemberFacts } from "../workspace/directory";
import { websiteOpen, websiteShownTo } from "./flag";

type SignIn = { existingUserId: Id<"users"> | null; profile: Record<string, unknown> };

type NewUser = WithoutSystemFields<Doc<"users">> & { chatIdentity: NonNullable<Doc<"users">["chatIdentity"]> };

export async function rememberSignedInMember(ctx: GenericMutationCtx<DataModel>, { existingUserId, profile }: SignIn): Promise<Id<"users">> {
  const signedIn = allowedSignIn(profile);
  const chatIdentity = { workspace: signedIn.chatWorkspace, user: signedIn.chatUser };
  const person = await lookup(ctx, chatIdentity.workspace, chatIdentity.user);
  if (!(await admitted(ctx, person))) throw new Error("the website is closed, so nobody signs in");
  if (person === undefined) await verifyLater(ctx, chatIdentity.workspace, chatIdentity.user, { firstSignIn: existingUserId === null });
  const display = { name: signedIn.name, givenName: signedIn.givenName, familyName: signedIn.familyName, image: signedIn.image };
  if (existingUserId === null) return firstSignIn(ctx, { ...display, chatIdentity }, person);
  await ctx.db.replace(existingUserId, { ...display, chatIdentity });
  return existingUserId;
}

async function firstSignIn(ctx: MutationCtx, user: NewUser, person: MemberFacts | undefined): Promise<Id<"users">> {
  const signedIn = await ctx.db.insert("users", user);
  if (person?.kind === "member") await earnWelcomeItem(ctx, user.chatIdentity.workspace, person.member, Date.now());
  return signedIn;
}

async function admitted(ctx: MutationCtx, person: MemberFacts | undefined) {
  const shownToMember = person?.kind === "member" && (await websiteShownTo(ctx, person.member));
  return shownToMember || (await websiteOpen(ctx));
}
