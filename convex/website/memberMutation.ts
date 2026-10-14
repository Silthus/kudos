import type { RegisteredMutation } from "convex/server";
import type { ObjectType, PropertyValidators } from "convex/values";
import { mutation, type MutationCtx } from "../_generated/server";
import type { HomeMember } from "../feedback/homes";
import { websiteAdmits } from "./flag";
import { verifiedMember, type Denial, type VerifiedMember } from "./memberQuery";

type CommandHandler<Args, Result> = (ctx: MutationCtx, me: VerifiedMember, person: HomeMember, args: Args) => Promise<Result>;

export function memberMutation<Args extends PropertyValidators, Result>(definition: {
  args: Args;
  handler: CommandHandler<ObjectType<Args>, Result>;
}): RegisteredMutation<"public", ObjectType<Args>, Promise<Result | Denial>>;
export function memberMutation({ args, handler }: { args: PropertyValidators; handler: CommandHandler<never, unknown> }) {
  return mutation({
    args,
    handler: async (ctx, given) => {
      const verified = await verifiedMember(ctx);
      if ("kind" in verified) return verified;
      if (!(await websiteAdmits(ctx, verified.me.member))) return { kind: "closed" };
      return handler(ctx, verified.me, verified.person, given as never);
    },
  });
}
