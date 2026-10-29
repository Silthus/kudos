import { memberDecisionWithoutWriting, workspaceDecisionWithoutWriting, type Flag } from "../../analytics/flags";
import type { QueryCtx } from "../../_generated/server";
import type { MemberId } from "../../workspace/directory";

export const hiddenItemsFlag = { key: "hidden-items", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function hiddenItemsShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, hiddenItemsFlag, member);
}

export const teasersFlag = { key: "teasers", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function teasersShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, teasersFlag, member);
}

export const itemShareFlag = { key: "item-share", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function itemShareAppliesToWorkspace(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return workspaceDecisionWithoutWriting(ctx, itemShareFlag, workspace);
}
