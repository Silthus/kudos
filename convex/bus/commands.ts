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

export const commandValidator = v.union(showHomeTabCommand, setProgressSettingsCommand);

export type Command = Infer<typeof commandValidator>;
export type Intent = Command extends infer C ? (C extends Command ? Omit<C, "member"> : never) : never;

type CommandOf<T extends Command["type"]> = Extract<Command, { type: T }>;
type Handler<T extends Command["type"]> = FunctionReference<"mutation", "internal", { command: CommandOf<T> }>;
type Registry = { [T in Command["type"]]: Handler<T> };

export const handlers: Registry = {
  showHomeTab: internal.feedback.homes.showHomeTab,
  setProgressSettings: internal.progression.settings.setProgressSettings,
};

export async function dispatch<T extends Command["type"]>(ctx: ActionCtx, command: CommandOf<T> & { type: T }) {
  const handler: Handler<T> = handlers[command.type];
  await ctx.runMutation(handler, { command });
}

export function isCommandType(type: string): type is Command["type"] {
  return type in handlers;
}
