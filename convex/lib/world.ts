import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { MAX_SESSIONS } from "./presence";

/**
 * The rows that put a member's hog in the shared world (#155, convex/presence.ts): its
 * `worldPresence` row and its `worldOnline` copy, one each per sign-in session. Apart from
 * presence.ts so game.ts (hiding the game) can take a hog out without importing it back.
 */

/** The shared demo: every visitor is the same member, so each sign-in session is somebody else. */
export function isSharedDemo(workspace: Pick<Doc<"workspaces">, "isDemo" | "simulator">): boolean {
  return workspace.isDemo && workspace.simulator === undefined;
}

type Key = { workspaceId: Id<"workspaces">; memberId: Id<"members">; sessionId?: string };

async function rowsOf(ctx: QueryCtx, table: "worldPresence" | "worldOnline", { workspaceId, memberId, sessionId }: Key) {
  return await ctx.db
    .query(table)
    .withIndex("by_workspace_member_session", (q) => {
      const member = q.eq("workspaceId", workspaceId).eq("memberId", memberId);
      return sessionId === undefined ? member : member.eq("sessionId", sessionId);
    })
    .take(MAX_SESSIONS);
}

/**
 * Takes a member's hog out of the world at once (hiding the game, a heartbeat refused): this
 * session's in the shared demo, where the other sessions are other visitors (each leaves as it
 * next beats); every session of theirs anywhere else.
 */
export async function leaveWorld(ctx: MutationCtx, workspace: Doc<"workspaces">, memberId: Id<"members">, sessionId: string) {
  const key = { workspaceId: workspace._id, memberId, sessionId: isSharedDemo(workspace) ? sessionId : undefined };
  for (const table of ["worldPresence", "worldOnline"] as const) {
    for (const row of await rowsOf(ctx, table, key)) await ctx.db.delete(row._id);
  }
}
