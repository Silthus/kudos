import type { GenericMutationCtx } from "convex/server";
import { internal } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import { lookup } from "../workspace/directory";

type SignInArgs = { existingUserId: Id<"users"> | null; profile: Record<string, unknown> };

export async function rememberSignedInMember(ctx: GenericMutationCtx<DataModel>, { existingUserId, profile }: SignInArgs) {
  const chatIdentity = { workspace: text(profile.chatWorkspace), user: text(profile.chatUser) };
  const display = { name: optionalText(profile.name), image: optionalText(profile.image) };

  if ((await lookup(ctx, chatIdentity.workspace, chatIdentity.user)) === undefined) {
    await ctx.scheduler.runAfter(0, internal.slack.directory.verifyMember, chatIdentity);
  }
  if (existingUserId !== null) {
    await ctx.db.patch(existingUserId, display);
    return existingUserId;
  }
  return ctx.db.insert("users", { ...display, chatIdentity });
}

function text(value: unknown) {
  if (typeof value !== "string") throw new Error("the sign-in profile carries no chat identity");
  return value;
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
