import type { FunctionReference } from "convex/server";
import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { homeTabValidator } from "../feedback/home";

export const showHomeTabCommand = v.object({ type: v.literal("showHomeTab"), member: v.id("members"), tab: homeTabValidator });

export const setProgressSettingsCommand = v.object({
  type: v.literal("setProgressSettings"),
  member: v.id("members"),
  hideLevel: v.optional(v.boolean()),
  hideAchievements: v.optional(v.boolean()),
  muteNotices: v.optional(v.boolean()),
  dms: v.optional(v.boolean()),
});

export const setAnnouncementChannelCommand = v.object({ type: v.literal("setAnnouncementChannel"), member: v.id("members"), channel: v.union(v.string(), v.null()) });

export const commandValidator = v.union(showHomeTabCommand, setProgressSettingsCommand, setAnnouncementChannelCommand);

export type Command = Infer<typeof commandValidator>;
type WithoutMember<C> = C extends unknown ? Omit<C, "member"> : never;
export type Intent = WithoutMember<Command>;

type CommandOf<T extends Command["type"]> = Extract<Command, { type: T }>;
export type CommandResult = "done" | "refused";
type Handler<T extends Command["type"]> = FunctionReference<"mutation", "internal", { command: CommandOf<T> }, CommandResult>;
type Registry = { [T in Command["type"]]: Handler<T> };

export const handlers: Registry = {
  showHomeTab: internal.feedback.homes.showHomeTab,
  setProgressSettings: internal.progression.settings.setProgressSettings,
  setAnnouncementChannel: internal.workspace.settings.setAnnouncementChannel,
};

export function dispatch<T extends Command["type"]>(ctx: ActionCtx, command: CommandOf<T> & { type: T }): Promise<CommandResult> {
  const handler: Handler<T> = handlers[command.type];
  return ctx.runMutation(handler, { command });
}

export function isCommandType(type: string): type is Command["type"] {
  return Object.hasOwn(handlers, type);
}
