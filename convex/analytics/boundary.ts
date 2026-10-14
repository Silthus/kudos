import type { ObjectType, PropertyValidators } from "convex/values";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { httpAction, internalAction, internalMutation, type ActionCtx } from "../_generated/server";
import { carriesReportedMarker, exceptionOf, exceptionValidator, reportedMarker, typeOf, withheldErrorOf, withheldExceptionOf } from "./exceptions";
import { recordException, type FailedFunction } from "./outbox";

type ActionDefinition<Args extends PropertyValidators, Output> = {
  args: Args;
  handler: (ctx: ActionCtx, args: ObjectType<Args>) => Promise<Output>;
};

type ObservedFunction = FailedFunction & { kind: "http" | "action" };

type Observation = { carriesWords?: boolean };

const observedFunctions = new WeakSet<object>();

export function observedAction<Args extends PropertyValidators, Output>(definition: ActionDefinition<Args, Output>) {
  const action = internalAction({
    args: definition.args,
    handler: (ctx: ActionCtx, args: ObjectType<Args>): Promise<Output> => observed(ctx, () => actionOf(ctx), () => definition.handler(ctx, args)),
  });
  observedFunctions.add(action);
  return action;
}

export function observedHttpAction(handler: (ctx: ActionCtx, request: Request) => Promise<Response>, observation: Observation = {}) {
  const route = httpAction((ctx, request) => {
    const failed: ObservedFunction = { path: `${request.method} ${new URL(request.url).pathname}`, kind: "http" };
    return observed(ctx, async () => failed, () => handler(ctx, request), observation);
  });
  observedFunctions.add(route);
  return route;
}

export function isObserved(fn: unknown) {
  return observedFunctions.has(fn as object);
}

export const recordBoundaryException = internalMutation({
  args: {
    failed: v.object({ path: v.string(), kind: v.union(v.literal("http"), v.literal("action")) }),
    exception: exceptionValidator,
    job: v.union(v.id("_scheduled_functions"), v.null()),
  },
  handler: async (ctx, { failed, exception, job }): Promise<boolean> => {
    const recorded = await recordException(ctx, failed, exception, Date.now());
    if (recorded && job !== null) await ctx.db.insert("reportedJobs", { job });
    return recorded;
  },
});

async function observed<Output>(ctx: ActionCtx, failedFunction: () => Promise<ObservedFunction>, run: () => Promise<Output>, observation: Observation = {}): Promise<Output> {
  try {
    return await run();
  } catch (error) {
    throw await reported(ctx, failedFunction, error, observation);
  }
}

async function reported(ctx: ActionCtx, failedFunction: () => Promise<ObservedFunction>, error: unknown, { carriesWords = false }: Observation): Promise<unknown> {
  if (carriesReportedMarker(error)) return error;
  const unrecorded = carriesWords ? withheldErrorOf(error) : error;
  try {
    const failed = await failedFunction();
    const { scheduledFunctionId } = await ctx.meta.getRequestMetadata();
    const recorded = await ctx.runMutation(internal.analytics.boundary.recordBoundaryException, {
      failed,
      exception: carriesWords ? withheldExceptionOf(error) : exceptionOf(error),
      job: scheduledFunctionId as Id<"_scheduled_functions"> | null,
    });
    return recorded ? new Error(`${reportedMarker} ${typeOf(error)}`) : unrecorded;
  } catch {
    console.error("analytics.exception_not_recorded");
    return unrecorded;
  }
}

async function actionOf(ctx: ActionCtx): Promise<ObservedFunction> {
  const { name } = await ctx.meta.getFunctionMetadata();
  return { path: functionPathOf(name), kind: "action" };
}

export function functionPathOf(name: string) {
  return name.replace(/\.js:/, ":");
}
