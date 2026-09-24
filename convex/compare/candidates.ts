import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireViewer } from "../lib/access";
import { workspaceMembers } from "../lib/stats";

/**
 * Everyone the viewer can compare with (the teammate picker): the other active people in their
 * workspace, by name. Member rows change on every give, so the client subscribes only while the
 * picker is open.
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("members"),
      name: v.string(),
      realName: v.optional(v.string()),
      title: v.optional(v.string()),
      avatarUrl: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const { member: me, workspace } = await requireViewer(ctx);
    const members = await workspaceMembers(ctx, workspace._id);
    return members
      .filter((m) => !m.deactivated && m._id !== me._id)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .map((m) => ({ _id: m._id, name: m.name, realName: m.realName, title: m.title, avatarUrl: m.avatarUrl }));
  },
});
