import type { QueryCtx } from "../_generated/server";
import { nameAndPictureOf, type MemberId } from "../workspace/directory";

export const mostRecipientsNamed = 10;

export async function firstNameOf(ctx: QueryCtx, person: MemberId): Promise<string> {
  const { name } = await nameAndPictureOf(ctx, person);
  return name?.trim().split(/\s+/)[0] || "Your teammate";
}
